import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClerkAuth } from './helpers/clerk-mock';
import { makeTestEnv } from './helpers/d1-fixture';

vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
  getAuth: vi.fn(),
}));

import app from '../src/index';

function makeRequest(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('submissions routes — CLASS-04 list', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('GET /api/assignments/:id/submissions as owning instructor returns LEFT JOIN with not-submitted rows', async () => {
    mockClerkAuth({ userId: 'inst_1', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult({ instructor_id: 'inst_1', course_id: 'c1' });
    env.DB.pushResult([
      { student_id: 'stu_1', submission_id: 'sub_1', submitted_at: 1, grade: null, feedback: null, graded_at: null, graded_by: null },
      { student_id: 'stu_2', submission_id: null, submitted_at: null, grade: null, feedback: null, graded_at: null, graded_by: null },
    ]);
    const res = await app.fetch(makeRequest('GET', '/api/assignments/a1/submissions'), env as never);
    expect(res.status).toBe(200);
    const rows = await res.json() as unknown[];
    expect(rows.length).toBe(2);
  });

  it('GET /api/assignments/:id/submissions as non-owning instructor returns 403', async () => {
    mockClerkAuth({ userId: 'inst_2', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult({ instructor_id: 'inst_1', course_id: 'c1' });
    const res = await app.fetch(makeRequest('GET', '/api/assignments/a1/submissions'), env as never);
    expect(res.status).toBe(403);
  });
});

describe('submissions routes — CLASS-05 grade', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('PATCH /api/submissions/:id/grade sets grade, feedback, graded_at, graded_by', async () => {
    mockClerkAuth({ userId: 'inst_1', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult({ id: 'sub_1', student_id: 'stu_1', assignment_id: 'a1', course_id: 'c1', instructor_id: 'inst_1', r2_key: 'submissions/sub_1.json' });
    const res = await app.fetch(
      makeRequest('PATCH', '/api/submissions/sub_1/grade', { grade: 85, feedback: 'Good work' }),
      env as never
    );
    expect(res.status).toBe(200);
  });

  it('PATCH /api/submissions/:id/grade rejects grade outside 0-100', async () => {
    mockClerkAuth({ userId: 'inst_1', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult({ id: 'sub_1', student_id: 'stu_1', assignment_id: 'a1', course_id: 'c1', instructor_id: 'inst_1' });
    const res = await app.fetch(
      makeRequest('PATCH', '/api/submissions/sub_1/grade', { grade: 150, feedback: '' }),
      env as never
    );
    expect(res.status).toBe(400);
  });

  it('PATCH /api/submissions/:id/grade as non-owning instructor returns 403', async () => {
    mockClerkAuth({ userId: 'inst_2', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult({ id: 'sub_1', student_id: 'stu_1', assignment_id: 'a1', course_id: 'c1', instructor_id: 'inst_1' });
    const res = await app.fetch(
      makeRequest('PATCH', '/api/submissions/sub_1/grade', { grade: 80, feedback: '' }),
      env as never
    );
    expect(res.status).toBe(403);
  });
});
