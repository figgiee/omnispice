import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClerkAuth } from '../../test/helpers/clerk-mock';
import { makeTestEnv } from '../../test/helpers/d1-fixture';

vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
  getAuth: vi.fn(),
}));

// Import AFTER vi.mock — ESM hoisting requires the mock before module eval.
import app from '../../src/index';

function req(method: string, path: string): Request {
  return new Request(`http://localhost${path}`, { method });
}

describe('lti/oidc — LMS-01 third-party-initiated login', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('GET /lti/oidc/login redirects with required OIDC params', async () => {
    // RED — route not implemented yet (04-02).
    const env = makeTestEnv();
    env.DB.pushResult({
      iss: 'https://canvas.test.instructure.com',
      client_id: '10000000000001',
      auth_login_url: 'https://canvas.test.instructure.com/api/lti/authorize_redirect',
    });
    const res = await app.fetch(
      req(
        'GET',
        '/lti/oidc/login?iss=https://canvas.test.instructure.com&login_hint=abc&target_link_uri=https://preview.omnispice.workers.dev/lti/launch&client_id=10000000000001&lti_message_hint=xyz',
      ),
      env as never,
    );
    expect(res.status).toBe(302);
    const location = res.headers.get('location') ?? '';
    const u = new URL(location);
    expect(u.searchParams.get('response_type')).toBe('id_token');
    expect(u.searchParams.get('scope')).toBe('openid');
    expect(u.searchParams.get('response_mode')).toBe('form_post');
    expect(u.searchParams.get('prompt')).toBe('none');
    expect(u.searchParams.get('redirect_uri')).toBeTruthy();
    expect(u.searchParams.get('state')).toBeTruthy();
    expect(u.searchParams.get('nonce')).toBeTruthy();
    expect(u.searchParams.get('client_id')).toBe('10000000000001');
    expect(u.searchParams.get('login_hint')).toBe('abc');
  });

  it('state and nonce are persisted to D1 for /lti/launch lookup', async () => {
    // RED — route not implemented yet.
    const env = makeTestEnv();
    env.DB.pushResult({
      iss: 'https://canvas.test.instructure.com',
      client_id: '10000000000001',
      auth_login_url: 'https://canvas.test.instructure.com/api/lti/authorize_redirect',
    });
    const res = await app.fetch(
      req('GET', '/lti/oidc/login?iss=https://canvas.test.instructure.com&login_hint=x&target_link_uri=y&client_id=10000000000001'),
      env as never,
    );
    expect(res.status).toBe(302);
    // Assert that D1 was written (state + nonce persisted into lti_nonces).
    expect(env.DB.prepare).toHaveBeenCalled();
    const calls = env.DB.prepare.mock.calls.map((c) => String(c[0]));
    expect(calls.some((sql) => /INSERT INTO lti_nonces/i.test(sql))).toBe(true);
  });

  it('returns 400 when iss is missing', async () => {
    // RED
    mockClerkAuth({ userId: null });
    const env = makeTestEnv();
    const res = await app.fetch(
      req('GET', '/lti/oidc/login?login_hint=abc&target_link_uri=xyz'),
      env as never,
    );
    expect(res.status).toBe(400);
  });
});
