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

describe('routes/ltiAdmin — instructor platform registry', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('POST /api/lti/platforms as instructor creates a row in lti_platforms', async () => {
    // RED — 04-02 adds POST /api/lti/platforms
    mockClerkAuth({ userId: 'inst_1', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult(null);
    const res = await app.fetch(
      makeRequest('POST', '/api/lti/platforms', {
        iss: 'https://canvas.test.instructure.com',
        client_id: '10000000000001',
        name: 'Canvas Test Sandbox',
        auth_login_url: 'https://canvas.test.instructure.com/api/lti/authorize_redirect',
        auth_token_url: 'https://canvas.test.instructure.com/login/oauth2/token',
        jwks_uri: 'https://canvas.test.instructure.com/api/lti/security/jwks',
      }),
      env as never,
    );
    expect(res.status).toBe(200);
    const sqls = env.DB.prepare.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(sqls.some((s: string) => /INSERT INTO lti_platforms/i.test(s))).toBe(true);
  });

  it('POST /api/lti/platforms as student returns 403', async () => {
    mockClerkAuth({ userId: 'stu_1', role: 'student' });
    const env = makeTestEnv();
    const res = await app.fetch(
      makeRequest('POST', '/api/lti/platforms', {
        iss: 'https://canvas.test.instructure.com',
        client_id: 'x',
        name: 'x',
        auth_login_url: 'https://x',
        auth_token_url: 'https://x',
        jwks_uri: 'https://x',
      }),
      env as never,
    );
    expect(res.status).toBe(403);
  });

  it('GET /api/lti/platforms lists instructor-owned platforms', async () => {
    mockClerkAuth({ userId: 'inst_1', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult([]);
    const res = await app.fetch(makeRequest('GET', '/api/lti/platforms'), env as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('DELETE /api/lti/platforms/:iss/:client_id deletes a platform', async () => {
    mockClerkAuth({ userId: 'inst_1', role: 'instructor' });
    const env = makeTestEnv();
    env.DB.pushResult(null);
    const res = await app.fetch(
      makeRequest(
        'DELETE',
        '/api/lti/platforms/' +
          encodeURIComponent('https://canvas.test.instructure.com') +
          '/10000000000001',
      ),
      env as never,
    );
    expect(res.status).toBe(200);
  });

  it('Zod validation rejects malformed jwks_uri / auth_login_url', async () => {
    mockClerkAuth({ userId: 'inst_1', role: 'instructor' });
    const env = makeTestEnv();
    const res = await app.fetch(
      makeRequest('POST', '/api/lti/platforms', {
        iss: 'https://canvas.test.instructure.com',
        client_id: 'x',
        name: 'x',
        auth_login_url: 'not-a-url',
        auth_token_url: 'also-not-a-url',
        jwks_uri: 'nope',
      }),
      env as never,
    );
    expect(res.status).toBe(400);
  });
});
