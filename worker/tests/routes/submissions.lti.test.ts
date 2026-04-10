import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClerkAuth } from '../../test/helpers/clerk-mock';
import { makeTestEnv } from '../../test/helpers/d1-fixture';

vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
  getAuth: vi.fn(),
}));

import app from '../../src/index';

function makeRequest(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('routes/submissions — LMS-03 LTI grade passback hook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('PATCH /api/submissions/:id/grade writes to lti_score_log when submission has lti_launch_id', async () => {
    // RED — 04-03 extends the grade endpoint to append a score_log row.
    mockClerkAuth({ userId: 'inst_1', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult({
      id: 'sub-1',
      assignment_id: 'a1',
      student_id: 'stu-1',
      lti_launch_id: 'launch-1',
    });
    env.DB.pushResult({
      id: 'launch-1',
      iss: 'https://canvas.test.instructure.com',
      client_id: '10000000000001',
      sub: 'lti-sub-student-01',
      ags_lineitem_url: 'https://canvas.test/line_items/42',
    });
    const res = await app.fetch(
      makeRequest('PATCH', '/api/submissions/sub-1/grade', { grade: 85, feedback: 'nice' }),
      env as never,
    );
    expect(res.status).toBe(200);
    const sqls = env.DB.prepare.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(sqls.some((s: string) => /INSERT INTO lti_score_log/i.test(s))).toBe(true);
  });

  it('PATCH /api/submissions/:id/grade does NOT write to lti_score_log when submission lacks lti_launch_id', async () => {
    // RED
    mockClerkAuth({ userId: 'inst_1', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult({
      id: 'sub-2',
      assignment_id: 'a1',
      student_id: 'stu-1',
      lti_launch_id: null,
    });
    const res = await app.fetch(
      makeRequest('PATCH', '/api/submissions/sub-2/grade', { grade: 90 }),
      env as never,
    );
    expect(res.status).toBe(200);
    const sqls = env.DB.prepare.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(sqls.every((s: string) => !/INSERT INTO lti_score_log/i.test(s))).toBe(true);
  });

  it('existing Phase 3 grade behavior unchanged: grade, graded_at, graded_by set', async () => {
    mockClerkAuth({ userId: 'inst_1', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult({ id: 'sub-3', assignment_id: 'a1', student_id: 'stu-1', lti_launch_id: null });
    const res = await app.fetch(
      makeRequest('PATCH', '/api/submissions/sub-3/grade', { grade: 100 }),
      env as never,
    );
    expect(res.status).toBe(200);
    const sqls = env.DB.prepare.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(sqls.some((s: string) => /UPDATE submissions SET .*grade/i.test(s))).toBe(true);
  });
});
