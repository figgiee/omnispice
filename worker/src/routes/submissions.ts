import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import { requireAuth } from '../middleware/auth';
import { requireInstructor } from '../middleware/requireInstructor';
import type { Bindings } from '../index';

interface SubmissionRow {
  id: string;
  assignment_id: string;
  student_id: string;
  r2_key: string;
  submitted_at: number;
  grade: number | null;
  feedback: string | null;
  graded_at: number | null;
  graded_by: string | null;
  course_id: string;
  instructor_id: string;
}

/**
 * Single-query permission helper (Pattern 7).
 * Returns the submission + its course context. Throws 404 or 403.
 * Readers: owning student OR course instructor.
 */
async function assertCanReadSubmission(
  c: Context<{ Bindings: Bindings }>,
  submissionId: string,
  userId: string
): Promise<SubmissionRow> {
  const row = await c.env.DB.prepare(`
    SELECT s.*, a.course_id, c.instructor_id
    FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    JOIN courses c ON c.id = a.course_id
    WHERE s.id = ?
  `).bind(submissionId).first<SubmissionRow>();

  if (!row) throw new HTTPException(404, { message: 'Not found' });
  const isOwner = row.student_id === userId;
  const isInstructor = row.instructor_id === userId;
  if (!isOwner && !isInstructor) {
    throw new HTTPException(403, { message: 'Forbidden' });
  }
  return row;
}

const submissions = new Hono<{
  Bindings: Bindings;
  Variables: { userId: string };
}>();

// GET /api/submissions/:id — owner or course instructor
submissions.get('/:id', async (c) => {
  const userId = requireAuth(c);
  const { id } = c.req.param();
  const row = await assertCanReadSubmission(c, id, userId);
  return c.json({
    id: row.id,
    assignment_id: row.assignment_id,
    student_id: row.student_id,
    submitted_at: row.submitted_at,
    grade: row.grade,
    feedback: row.feedback,
    graded_at: row.graded_at,
    graded_by: row.graded_by,
    course_id: row.course_id,
    isInstructor: row.instructor_id === userId,
  });
});

// GET /api/submissions/:id/circuit — stream R2 blob (owner or course instructor)
// Per D-35: proxied through Worker, Cache-Control: private, max-age=0
submissions.get('/:id/circuit', async (c) => {
  const userId = requireAuth(c);
  const { id } = c.req.param();
  const row = await assertCanReadSubmission(c, id, userId);
  const obj = await c.env.CIRCUIT_BUCKET.get(row.r2_key);
  if (!obj) return c.json({ error: 'Circuit data missing' }, 500);
  return new Response(obj.body as ReadableStream, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=0' },
  });
});

// PATCH /api/submissions/:id/grade — owning instructor only. Per D-25, D-34.
submissions.patch('/:id/grade', requireInstructor, async (c) => {
  const instructorId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json<{ grade: number | null; feedback: string }>();

  // Validate grade: integer 0-100 or null per D-25
  if (body.grade !== null && body.grade !== undefined) {
    if (!Number.isInteger(body.grade) || body.grade < 0 || body.grade > 100) {
      return c.json({ error: 'grade must be integer 0-100 or null' }, 400);
    }
  }
  // Feedback max 2000 chars per D-25
  if (body.feedback && body.feedback.length > 2000) {
    return c.json({ error: 'feedback exceeds 2000 characters' }, 400);
  }

  // Ownership check via JOIN
  const row = await c.env.DB.prepare(`
    SELECT s.id, c.instructor_id FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    JOIN courses c ON c.id = a.course_id
    WHERE s.id = ?
  `).bind(id).first<{ id: string; instructor_id: string }>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.instructor_id !== instructorId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const now = Date.now();
  await c.env.DB.prepare(`
    UPDATE submissions SET
      grade = ?,
      feedback = ?,
      graded_at = ?,
      graded_by = ?
    WHERE id = ?
  `).bind(
    body.grade ?? null,
    body.feedback ?? null,
    now,
    instructorId,
    id
  ).run();

  return c.json({
    id,
    grade: body.grade ?? null,
    feedback: body.feedback ?? null,
    graded_at: now,
    graded_by: instructorId,
  });
});

export { submissions as submissionsRouter };
