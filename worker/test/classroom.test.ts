import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClerkAuth } from './helpers/clerk-mock';
import { makeTestEnv } from './helpers/d1-fixture';

vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
  getAuth: vi.fn(),
}));

// Import AFTER vi.mock — ESM hoisting requires the mock before module eval (STATE.md note from Phase 2).
import app from '../src/index';

function makeRequest(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('classroom routes — CLASS-01 course CRUD', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('POST /api/courses as instructor creates course + returns join_code', async () => {
    mockClerkAuth({ userId: 'inst_1', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult(null); // join code uniqueness check
    const res = await app.fetch(
      makeRequest('POST', '/api/courses', { name: 'Circuits 101', term: 'Fall 2026' }),
      env as never
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; joinCode: string };
    expect(body.joinCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('POST /api/courses as student returns 403', async () => {
    mockClerkAuth({ userId: 'stu_1', role: 'student' });
    const env = makeTestEnv();
    const res = await app.fetch(
      makeRequest('POST', '/api/courses', { name: 'Attempt' }),
      env as never
    );
    expect(res.status).toBe(403);
  });

  it('GET /api/courses returns courses for authenticated user', async () => {
    mockClerkAuth({ userId: 'user_1', role: 'student' });
    const env = makeTestEnv();
    env.DB.pushResult([]);
    const res = await app.fetch(makeRequest('GET', '/api/courses'), env as never);
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });
});

describe('classroom routes — CLASS-02 join flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('POST /api/courses/join with valid code enrolls student', async () => {
    mockClerkAuth({ userId: 'stu_1', role: 'student' });
    const env = makeTestEnv();
    env.DB.pushResult({ id: 'course_1' });
    const res = await app.fetch(
      makeRequest('POST', '/api/courses/join', { code: 'ABC234' }),
      env as never
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { courseId: string };
    expect(body.courseId).toBe('course_1');
  });

  it('POST /api/courses/join with invalid code returns 404', async () => {
    mockClerkAuth({ userId: 'stu_1', role: 'student' });
    const env = makeTestEnv();
    env.DB.pushResult(null);
    const res = await app.fetch(
      makeRequest('POST', '/api/courses/join', { code: 'ZZZZZZ' }),
      env as never
    );
    expect(res.status).toBe(404);
  });

  it('POST /api/courses/join is idempotent (re-join = no-op)', async () => {
    mockClerkAuth({ userId: 'stu_1', role: 'student' });
    const env = makeTestEnv();
    env.DB.pushResult({ id: 'course_1' });
    const res = await app.fetch(
      makeRequest('POST', '/api/courses/join', { code: 'ABC234' }),
      env as never
    );
    expect(res.status).toBe(200);
  });
});
