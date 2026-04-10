import { describe, it, expect, vi, beforeEach } from 'vitest';
// RED — src/lti/verify lands in 04-02.
// @ts-expect-error — module does not exist yet (Wave 0 scaffold).
import { verifyLaunch } from '../../src/lti/verify';
import { signFixtureIdToken, signWithWrongKey } from '../helpers/ltiTestSigner';
import { createMockPlatform } from '../helpers/mockPlatform';
import canvasFixture from '../fixtures/lti/canvas-id-token.json' with { type: 'json' };

vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
  getAuth: vi.fn(),
}));

describe('lti/verify — LMS-01 id_token verification', () => {
  let platform: ReturnType<typeof createMockPlatform>;

  beforeEach(() => {
    vi.clearAllMocks();
    platform = createMockPlatform();
  });

  it('returns parsed claims for a valid signed id_token', async () => {
    const jwt = await signFixtureIdToken(canvasFixture as Record<string, unknown>);
    const claims = await verifyLaunch(jwt, {
      platformLookup: vi.fn().mockResolvedValue({
        iss: canvasFixture.iss,
        client_id: canvasFixture.aud,
        jwks_uri: 'https://mock/jwks.json',
      }),
      fetchJwks: () => Promise.resolve(platform.jwks),
      nonceStore: { seen: async () => false, mark: async () => {} },
    });
    expect(claims.sub).toBe(canvasFixture.sub);
    expect(claims.iss).toBe(canvasFixture.iss);
  });

  it('rejects when iss is unknown (no row in lti_platforms)', async () => {
    const jwt = await signFixtureIdToken(canvasFixture as Record<string, unknown>);
    await expect(
      verifyLaunch(jwt, {
        platformLookup: vi.fn().mockResolvedValue(null),
        fetchJwks: () => Promise.resolve(platform.jwks),
        nonceStore: { seen: async () => false, mark: async () => {} },
      }),
    ).rejects.toThrow(/unknown platform|unregistered/i);
  });

  it('rejects on expired exp', async () => {
    const jwt = await signFixtureIdToken(canvasFixture as Record<string, unknown>, {
      iat: 1000, exp: 2000, // year 1970
    });
    await expect(
      verifyLaunch(jwt, {
        platformLookup: vi.fn().mockResolvedValue({
          iss: canvasFixture.iss,
          client_id: canvasFixture.aud,
          jwks_uri: 'https://mock/jwks.json',
        }),
        fetchJwks: () => Promise.resolve(platform.jwks),
        nonceStore: { seen: async () => false, mark: async () => {} },
      }),
    ).rejects.toThrow(/exp|expired/i);
  });

  it('rejects on audience mismatch', async () => {
    const jwt = await signFixtureIdToken({ ...canvasFixture, aud: 'wrong-client-id' } as Record<string, unknown>);
    await expect(
      verifyLaunch(jwt, {
        platformLookup: vi.fn().mockResolvedValue({
          iss: canvasFixture.iss,
          client_id: canvasFixture.aud,
          jwks_uri: 'https://mock/jwks.json',
        }),
        fetchJwks: () => Promise.resolve(platform.jwks),
        nonceStore: { seen: async () => false, mark: async () => {} },
      }),
    ).rejects.toThrow(/aud|audience/i);
  });

  it('rejects on nonce replay', async () => {
    const jwt = await signFixtureIdToken(canvasFixture as Record<string, unknown>, {
      nonce: 'replay-nonce-01',
    });
    let calls = 0;
    const nonceStore = {
      seen: async () => calls++ > 0,
      mark: async () => {},
    };
    const opts = {
      platformLookup: vi.fn().mockResolvedValue({
        iss: canvasFixture.iss,
        client_id: canvasFixture.aud,
        jwks_uri: 'https://mock/jwks.json',
      }),
      fetchJwks: () => Promise.resolve(platform.jwks),
      nonceStore,
    };
    await verifyLaunch(jwt, opts); // first call OK
    await expect(verifyLaunch(jwt, opts)).rejects.toThrow(/nonce|replay/i); // second call throws
  });

  it('rejects on signature mismatch (wrong key)', async () => {
    const jwt = await signWithWrongKey(canvasFixture as Record<string, unknown>);
    await expect(
      verifyLaunch(jwt, {
        platformLookup: vi.fn().mockResolvedValue({
          iss: canvasFixture.iss,
          client_id: canvasFixture.aud,
          jwks_uri: 'https://mock/jwks.json',
        }),
        fetchJwks: () => Promise.resolve(platform.jwks),
        nonceStore: { seen: async () => false, mark: async () => {} },
      }),
    ).rejects.toThrow(/signature|verify/i);
  });
});
