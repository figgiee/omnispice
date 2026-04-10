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

describe('assignments routes — CLASS-02 assignment CRUD', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('POST /api/courses/:id/assignments as owning instructor creates assignment', async () => {
    mockClerkAuth({ userId: 'inst_1', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult({ instructor_id: 'inst_1' }); // ownership check
    const res = await app.fetch(
      makeRequest('POST', '/api/courses/course_1/assignments', {
        title: 'Lab 1',
        instructions: '# Build a voltage divider',
        starterCircuit: '{"components":[],"wires":[],"nets":[]}',
      }),
      env as never
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string };
    expect(typeof body.id).toBe('string');
  });

  it('POST /api/courses/:id/assignments as non-owning instructor returns 403', async () => {
    mockClerkAuth({ userId: 'inst_2', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult({ instructor_id: 'inst_1' });
    const res = await app.fetch(
      makeRequest('POST', '/api/courses/course_1/assignments', { title: 'X', instructions: '', starterCircuit: '{}' }),
      env as never
    );
    expect(res.status).toBe(403);
  });

  it('GET /api/assignments/:id/starter as enrolled student returns starter blob', async () => {
    mockClerkAuth({ userId: 'stu_1', role: 'student' });
    const env = makeTestEnv();
    env.DB.pushResult({ starter_r2_key: 'assignments/a1/starter.json', course_id: 'c1', instructor_id: 'inst_1' });
    env.DB.pushResult({ 1: 1 }); // enrollment check
    await env.CIRCUIT_BUCKET.put('assignments/a1/starter.json', '{"components":[],"wires":[],"nets":[]}');
    const res = await app.fetch(makeRequest('GET', '/api/assignments/a1/starter'), env as never);
    expect(res.status).toBe(200);
  });
});

describe('assignments routes — CLASS-03 submit', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('POST /api/assignments/:id/submit as enrolled student creates submission row + R2 blob', async () => {
    mockClerkAuth({ userId: 'stu_1', role: 'student' });
    const env = makeTestEnv();
    env.DB.pushResult({ assignment_id: 'a1', course_id: 'c1', enrolled: 1 });
    env.DB.pushResult(null); // no existing submission
    const res = await app.fetch(
      makeRequest('POST', '/api/assignments/a1/submit', { circuit: '{"components":[],"wires":[],"nets":[]}' }),
      env as never
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; submittedAt: number };
    expect(typeof body.id).toBe('string');
    expect(typeof body.submittedAt).toBe('number');
  });

  it('POST /api/assignments/:id/submit as non-enrolled user returns 403', async () => {
    mockClerkAuth({ userId: 'stu_2', role: 'student' });
    const env = makeTestEnv();
    env.DB.pushResult({ assignment_id: 'a1', course_id: 'c1', enrolled: null });
    const res = await app.fetch(
      makeRequest('POST', '/api/assignments/a1/submit', { circuit: '{}' }),
      env as never
    );
    expect(res.status).toBe(403);
  });

  it('POST /api/assignments/:id/submit upserts preserving submission id on resubmit', async () => {
    mockClerkAuth({ userId: 'stu_1', role: 'student' });
    const env = makeTestEnv();
    env.DB.pushResult({ assignment_id: 'a1', course_id: 'c1', enrolled: 1 });
    env.DB.pushResult({ id: 'sub_existing' });
    const res = await app.fetch(
      makeRequest('POST', '/api/assignments/a1/submit', { circuit: '{}' }),
      env as never
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string };
    expect(body.id).toBe('sub_existing');
  });
});
