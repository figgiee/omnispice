import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireAuth } from '../middleware/auth';
import { requireInstructor } from '../middleware/requireInstructor';
import { generateUniqueJoinCode } from '../util/joinCode';
import type { Bindings } from '../index';

interface CourseRow {
  id: string;
  instructor_id: string;
  name: string;
  term: string | null;
  join_code: string;
  created_at: number;
  updated_at: number;
}

const classroom = new Hono<{
  Bindings: Bindings;
  Variables: { userId: string };
}>();

// POST /api/courses — create a course (instructor only)
classroom.post('/', requireInstructor, async (c) => {
  const instructorId = c.get('userId');
  const body = await c.req.json<{ name: string; term?: string }>();
  if (!body.name || body.name.trim().length === 0) {
    throw new HTTPException(400, { message: 'name is required' });
  }
  const id = crypto.randomUUID();
  const joinCode = await generateUniqueJoinCode(c.env.DB);
  const now = Date.now();

  await c.env.DB.prepare(`
    INSERT INTO courses (id, instructor_id, name, term, join_code, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, instructorId, body.name, body.term ?? null, joinCode, now, now).run();

  return c.json({ id, joinCode, name: body.name, term: body.term ?? null });
});

// GET /api/courses — list courses where user is instructor OR enrolled student
classroom.get('/', async (c) => {
  const userId = requireAuth(c);
  const { results } = await c.env.DB.prepare(`
    SELECT DISTINCT c.id, c.instructor_id, c.name, c.term, c.join_code, c.created_at, c.updated_at
    FROM courses c
    LEFT JOIN enrollments e ON e.course_id = c.id
    WHERE c.instructor_id = ? OR e.student_id = ?
    ORDER BY c.updated_at DESC
  `).bind(userId, userId).all<CourseRow>();
  return c.json(results);
});

// GET /api/courses/:id — course detail (instructor OR enrolled student)
classroom.get('/:id', async (c) => {
  const userId = requireAuth(c);
  const { id } = c.req.param();
  const course = await c.env.DB.prepare(
    'SELECT * FROM courses WHERE id = ?'
  ).bind(id).first<CourseRow>();
  if (!course) return c.json({ error: 'Not found' }, 404);

  const isInstructor = course.instructor_id === userId;
  if (!isInstructor) {
    const enrolled = await c.env.DB.prepare(
      'SELECT 1 FROM enrollments WHERE course_id = ? AND student_id = ?'
    ).bind(id, userId).first();
    if (!enrolled) return c.json({ error: 'Forbidden' }, 403);
  }

  // Assignments for this course
  const { results: assignments } = await c.env.DB.prepare(`
    SELECT id, title, instructions, due_at, created_at, updated_at
    FROM assignments WHERE course_id = ? ORDER BY created_at DESC
  `).bind(id).all();

  // Enrolled students (instructor only)
  let students: unknown[] = [];
  if (isInstructor) {
    const { results } = await c.env.DB.prepare(
      'SELECT student_id, joined_at FROM enrollments WHERE course_id = ? ORDER BY joined_at ASC'
    ).bind(id).all();
    students = results;
  }

  return c.json({ course, assignments, students, isInstructor });
});

// DELETE /api/courses/:id — instructor only; cascades enrollments+assignments+submissions via FK.
// R2 cleanup for starter + submission blobs handled in Plan 03 when assignments route lands.
classroom.delete('/:id', requireInstructor, async (c) => {
  const instructorId = c.get('userId');
  const { id } = c.req.param();
  const course = await c.env.DB.prepare(
    'SELECT instructor_id FROM courses WHERE id = ?'
  ).bind(id).first<{ instructor_id: string }>();
  if (!course) return c.json({ error: 'Not found' }, 404);
  if (course.instructor_id !== instructorId) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  // Enumerate R2 keys before cascading (per Pitfall 2 — R2 does not cascade).
  const { results: r2Keys } = await c.env.DB.prepare(`
    SELECT a.starter_r2_key AS key FROM assignments a WHERE a.course_id = ?
    UNION ALL
    SELECT s.r2_key AS key FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = ?
  `).bind(id, id).all<{ key: string }>();
  for (const row of r2Keys) {
    await c.env.CIRCUIT_BUCKET.delete(row.key);
  }
  await c.env.DB.prepare('DELETE FROM courses WHERE id = ?').bind(id).run();
  return c.json({ deleted: true });
});

// POST /api/courses/join — student joins via code (idempotent per D-12)
classroom.post('/join', async (c) => {
  const studentId = requireAuth(c);
  const { code } = await c.req.json<{ code: string }>();
  if (!code || typeof code !== 'string') {
    throw new HTTPException(400, { message: 'code is required' });
  }
  const normalized = code.trim().toUpperCase();

  const course = await c.env.DB.prepare(
    'SELECT id FROM courses WHERE join_code = ?'
  ).bind(normalized).first<{ id: string }>();

  if (!course) return c.json({ error: 'Invalid code' }, 404);

  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO enrollments (course_id, student_id, joined_at)
    VALUES (?, ?, ?)
  `).bind(course.id, studentId, Date.now()).run();

  return c.json({ courseId: course.id });
});

// POST /api/courses/:id/assignments — owning instructor creates an assignment.
// Starter circuit is copy-on-create to R2 at assignments/{id}/starter.json per D-09/D-15.
classroom.post('/:id/assignments', requireInstructor, async (c) => {
  const instructorId = c.get('userId');
  const courseId = c.req.param('id');
  const body = await c.req.json<{
    title: string;
    instructions?: string;
    starterCircuit: string;
    due_at?: number | null;
  }>();

  if (!body.title || !body.starterCircuit) {
    return c.json({ error: 'title and starterCircuit are required' }, 400);
  }

  // Ownership check
  const course = await c.env.DB.prepare(
    'SELECT instructor_id FROM courses WHERE id = ?'
  ).bind(courseId).first<{ instructor_id: string }>();
  if (!course) return c.json({ error: 'Course not found' }, 404);
  if (course.instructor_id !== instructorId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const assignmentId = crypto.randomUUID();
  const starterKey = `assignments/${assignmentId}/starter.json`;
  const now = Date.now();

  await c.env.CIRCUIT_BUCKET.put(starterKey, body.starterCircuit, {
    httpMetadata: { contentType: 'application/json' },
  });

  await c.env.DB.prepare(`
    INSERT INTO assignments (id, course_id, title, instructions, starter_r2_key, due_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    assignmentId,
    courseId,
    body.title,
    body.instructions ?? null,
    starterKey,
    body.due_at ?? null,
    now,
    now
  ).run();

  return c.json({ id: assignmentId, title: body.title });
});

export { classroom as classroomRouter };
