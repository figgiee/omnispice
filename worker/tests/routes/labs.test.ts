import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClerkAuth } from '../../test/helpers/clerk-mock';
import { makeTestEnv } from '../../test/helpers/d1-fixture';

vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
  getAuth: vi.fn(),
}));

// Import AFTER vi.mock.
import app from '../../src/index';

function makeRequest(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('routes/labs — LAB-01 CRUD', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('POST /api/labs as instructor writes lab JSON to R2 + metadata row to D1', async () => {
    // RED — route not implemented yet (04-05).
    mockClerkAuth({ userId: 'inst_1', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult(null);
    const res = await app.fetch(
      makeRequest('POST', '/api/labs', {
        title: 'RC Transient',
        schema_version: 1,
        steps: [{ id: 'step-1', title: 'Build RC', checkpoints: [] }],
      }),
      env as never,
    );
    expect(res.status).toBe(200);
    expect(env.CIRCUIT_BUCKET.put).toHaveBeenCalled();
  });

  it('POST /api/labs as student returns 403', async () => {
    mockClerkAuth({ userId: 'stu_1', role: 'student' });
    const env = makeTestEnv();
    const res = await app.fetch(
      makeRequest('POST', '/api/labs', { title: 'attempt' }),
      env as never,
    );
    expect(res.status).toBe(403);
  });

  it('GET /api/labs/:id returns lab JSON for enrolled student', async () => {
    // RED
    mockClerkAuth({ userId: 'stu_1', role: 'student' });
    const env = makeTestEnv();
    env.DB.pushResult({
      id: 'lab-1',
      instructor_id: 'inst_1',
      title: 'RC',
      lab_json_r2_key: 'labs/lab-1/lab.json',
      reference_waveform_keys: '{}',
    });
    env.DB.pushResult({ course_id: 'c1', student_id: 'stu_1' });
    env.CIRCUIT_BUCKET._store.set('labs/lab-1/lab.json', JSON.stringify({ title: 'RC' }));
    const res = await app.fetch(
      makeRequest('GET', '/api/labs/lab-1'),
      env as never,
    );
    expect(res.status).toBe(200);
  });

  it('POST /api/labs/:id/reference/:probe stores CSV in R2 and updates reference_waveform_keys', async () => {
    // RED
    mockClerkAuth({ userId: 'inst_1', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult({ id: 'lab-1', instructor_id: 'inst_1', reference_waveform_keys: '{}' });
    const res = await app.fetch(
      new Request('http://localhost/api/labs/lab-1/reference/v(out)', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: 'time,value\n0,0\n0.001,1.2\n',
      }),
      env as never,
    );
    expect(res.status).toBe(200);
    expect(env.CIRCUIT_BUCKET.put).toHaveBeenCalledWith(
      expect.stringMatching(/^labs\/lab-1\/references\/.*\.csv$/),
      expect.anything(),
    );
  });

  it('DELETE /api/labs/:id enforced to owner instructor only', async () => {
    // RED
    mockClerkAuth({ userId: 'inst_2', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult({ id: 'lab-1', instructor_id: 'inst_1' });
    const res = await app.fetch(
      makeRequest('DELETE', '/api/labs/lab-1'),
      env as never,
    );
    expect(res.status).toBe(403);
  });

  it('PATCH /api/labs/:id updates lab_json_r2_key and updated_at', async () => {
    // RED
    mockClerkAuth({ userId: 'inst_1', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult({ id: 'lab-1', instructor_id: 'inst_1' });
    const res = await app.fetch(
      makeRequest('PATCH', '/api/labs/lab-1', {
        title: 'RC v2',
        schema_version: 1,
        steps: [],
      }),
      env as never,
    );
    expect(res.status).toBe(200);
    const sqls = env.DB.prepare.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(sqls.some((s: string) => /UPDATE labs/i.test(s))).toBe(true);
  });
});
