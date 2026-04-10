import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireAuth } from '../middleware/auth';
import { requireInstructor } from '../middleware/requireInstructor';
import type { Bindings } from '../index';

interface AssignmentRow {
  id: string;
  course_id: string;
  title: string;
  instructions: string | null;
  starter_r2_key: string;
  due_at: number | null;
  created_at: number;
  updated_at: number;
}

const assignments = new Hono<{
  Bindings: Bindings;
  Variables: { userId: string };
}>();

// GET /api/assignments/:id — assignment detail (instructor of course OR enrolled student)
assignments.get('/:id', async (c) => {
  const userId = requireAuth(c);
  const { id } = c.req.param();

  const row = await c.env.DB.prepare(`
    SELECT a.*, c.instructor_id
    FROM assignments a JOIN courses c ON c.id = a.course_id
    WHERE a.id = ?
  `).bind(id).first<AssignmentRow & { instructor_id: string }>();
  if (!row) return c.json({ error: 'Not found' }, 404);

  const isInstructor = row.instructor_id === userId;
  if (!isInstructor) {
    const enrolled = await c.env.DB.prepare(
      'SELECT 1 FROM enrollments WHERE course_id = ? AND student_id = ?'
    ).bind(row.course_id, userId).first();
    if (!enrolled) return c.json({ error: 'Forbidden' }, 403);
  }

  const { instructor_id, ...assignment } = row;
  return c.json({ assignment, isInstructor });
});

// PATCH /api/assignments/:id — update title/instructions/due_at/starter (owning instructor only)
assignments.patch('/:id', requireInstructor, async (c) => {
  const instructorId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json<{
    title?: string;
    instructions?: string;
    due_at?: number | null;
    starterCircuit?: string;
  }>();

  const row = await c.env.DB.prepare(`
    SELECT a.*, c.instructor_id FROM assignments a
    JOIN courses c ON c.id = a.course_id WHERE a.id = ?
  `).bind(id).first<AssignmentRow & { instructor_id: string }>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.instructor_id !== instructorId) return c.json({ error: 'Forbidden' }, 403);

  if (body.starterCircuit !== undefined) {
    await c.env.CIRCUIT_BUCKET.put(row.starter_r2_key, body.starterCircuit, {
      httpMetadata: { contentType: 'application/json' },
    });
  }

  const now = Date.now();
  await c.env.DB.prepare(`
    UPDATE assignments SET
      title = COALESCE(?, title),
      instructions = COALESCE(?, instructions),
      due_at = ?,
      updated_at = ?
    WHERE id = ?
  `).bind(
    body.title ?? null,
    body.instructions ?? null,
    body.due_at !== undefined ? body.due_at : row.due_at,
    now,
    id
  ).run();

  return c.json({ id });
});

// DELETE /api/assignments/:id — owning instructor only; R2 cleanup for starter + submissions
assignments.delete('/:id', requireInstructor, async (c) => {
  const instructorId = c.get('userId');
  const { id } = c.req.param();
  const row = await c.env.DB.prepare(`
    SELECT a.starter_r2_key, c.instructor_id FROM assignments a
    JOIN courses c ON c.id = a.course_id WHERE a.id = ?
  `).bind(id).first<{ starter_r2_key: string; instructor_id: string }>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.instructor_id !== instructorId) return c.json({ error: 'Forbidden' }, 403);

  // Enumerate submission R2 keys before deleting (Pitfall 2: R2 does not cascade)
  const { results: subKeys } = await c.env.DB.prepare(
    'SELECT r2_key FROM submissions WHERE assignment_id = ?'
  ).bind(id).all<{ r2_key: string }>();
  for (const sub of subKeys) {
    await c.env.CIRCUIT_BUCKET.delete(sub.r2_key);
  }
  await c.env.CIRCUIT_BUCKET.delete(row.starter_r2_key);
  await c.env.DB.prepare('DELETE FROM assignments WHERE id = ?').bind(id).run();
  return c.json({ deleted: true });
});

// GET /api/assignments/:id/starter — stream starter R2 blob (instructor or enrolled student)
// Per D-35: R2 always proxied through Worker with Cache-Control: private, max-age=0
assignments.get('/:id/starter', async (c) => {
  const userId = requireAuth(c);
  const { id } = c.req.param();
  const row = await c.env.DB.prepare(`
    SELECT a.starter_r2_key, a.course_id, c.instructor_id
    FROM assignments a JOIN courses c ON c.id = a.course_id
    WHERE a.id = ?
  `).bind(id).first<{ starter_r2_key: string; course_id: string; instructor_id: string }>();
  if (!row) return c.json({ error: 'Not found' }, 404);

  if (row.instructor_id !== userId) {
    const enrolled = await c.env.DB.prepare(
      'SELECT 1 FROM enrollments WHERE course_id = ? AND student_id = ?'
    ).bind(row.course_id, userId).first();
    if (!enrolled) return c.json({ error: 'Forbidden' }, 403);
  }

  const obj = await c.env.CIRCUIT_BUCKET.get(row.starter_r2_key);
  if (!obj) return c.json({ error: 'Starter missing' }, 500);
  return new Response(obj.body as ReadableStream, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=0' },
  });
});

// POST /api/assignments/:id/submit — student submits (upsert preserving id) per Pattern §Submitting
assignments.post('/:id/submit', async (c) => {
  const studentId = requireAuth(c);
  const assignmentId = c.req.param('id');
  const body = await c.req.json<{ circuit: string }>();
  if (!body.circuit || typeof body.circuit !== 'string') {
    throw new HTTPException(400, { message: 'circuit is required' });
  }

  const context = await c.env.DB.prepare(`
    SELECT a.id AS assignment_id, a.course_id,
      (SELECT 1 FROM enrollments WHERE course_id = a.course_id AND student_id = ?) AS enrolled
    FROM assignments a WHERE a.id = ?
  `).bind(studentId, assignmentId).first<{
    assignment_id: string;
    course_id: string;
    enrolled: number | null;
  }>();

  if (!context) return c.json({ error: 'Not found' }, 404);
  if (!context.enrolled) return c.json({ error: 'Not enrolled' }, 403);

  // Preserve submission id on resubmit for stable URLs (Pitfall 3)
  const existing = await c.env.DB.prepare(
    'SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?'
  ).bind(assignmentId, studentId).first<{ id: string }>();

  const submissionId = existing?.id ?? crypto.randomUUID();
  const r2Key = `submissions/${submissionId}.json`;
  const now = Date.now();

  await c.env.CIRCUIT_BUCKET.put(r2Key, body.circuit, {
    httpMetadata: { contentType: 'application/json' },
  });

  await c.env.DB.prepare(`
    INSERT INTO submissions (id, assignment_id, student_id, r2_key, submitted_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(assignment_id, student_id) DO UPDATE SET
      r2_key = excluded.r2_key,
      submitted_at = excluded.submitted_at
  `).bind(submissionId, assignmentId, studentId, r2Key, now).run();

  return c.json({ id: submissionId, submittedAt: now });
});

// GET /api/assignments/:id/submissions — instructor list with LEFT JOIN (D-23)
assignments.get('/:id/submissions', requireInstructor, async (c) => {
  const instructorId = c.get('userId');
  const assignmentId = c.req.param('id');

  const ctx = await c.env.DB.prepare(`
    SELECT c.instructor_id, a.course_id FROM assignments a
    JOIN courses c ON c.id = a.course_id
    WHERE a.id = ?
  `).bind(assignmentId).first<{ instructor_id: string; course_id: string }>();
  if (!ctx) return c.json({ error: 'Not found' }, 404);
  if (ctx.instructor_id !== instructorId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const { results } = await c.env.DB.prepare(`
    SELECT
      e.student_id,
      s.id AS submission_id,
      s.submitted_at,
      s.grade,
      s.feedback,
      s.graded_at,
      s.graded_by
    FROM enrollments e
    LEFT JOIN submissions s
      ON s.student_id = e.student_id AND s.assignment_id = ?
    WHERE e.course_id = ?
    ORDER BY s.submitted_at DESC
  `).bind(assignmentId, ctx.course_id).all();

  return c.json(results);
});

// GET /api/assignments/:id/my-submission — current student's submission (for classroom-mode UI)
assignments.get('/:id/my-submission', async (c) => {
  const studentId = requireAuth(c);
  const { id } = c.req.param();
  const row = await c.env.DB.prepare(
    'SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?'
  ).bind(id, studentId).first();
  return c.json(row ?? null);
});

export { assignments as assignmentsRouter };
