import { describe, it, expect, vi, beforeEach } from 'vitest';
// RED — src/lti/deepLink lands in 04-02.
// @ts-expect-error — module does not exist yet (Wave 0 scaffold).
import { buildDeepLinkingResponse } from '../../src/lti/deepLink';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importPKCS8, importJWK, jwtVerify } from 'jose';
import moodleFixture from '../fixtures/lti/moodle-id-token.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
  getAuth: vi.fn(),
}));

const toolKeypair = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/lti/tool-keypair.json'), 'utf8'),
) as { privateKeyPem: string; publicJwk: Record<string, unknown>; kid: string };

describe('lti/deepLink — LMS-02 deep linking response JWT', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('buildDeepLinkingResponse returns a signed JWT containing content_items claim', async () => {
    const privateKey = await importPKCS8(toolKeypair.privateKeyPem, 'RS256');
    const contentItems = [
      {
        type: 'ltiResourceLink',
        title: 'OmniSpice — Lab 1: RC Transient',
        url: 'https://preview.omnispice.workers.dev/lti/launch?lab_id=lab-1',
      },
    ];
    const jwt = await buildDeepLinkingResponse(
      moodleFixture as Record<string, unknown>,
      contentItems,
      { privateKey, kid: toolKeypair.kid, clientId: moodleFixture.aud },
    );
    expect(typeof jwt).toBe('string');
    expect(jwt.split('.').length).toBe(3);
  });

  it('JWT round-trips: signed by tool private key, verifiable with tool public JWK', async () => {
    const privateKey = await importPKCS8(toolKeypair.privateKeyPem, 'RS256');
    const publicKey = await importJWK(toolKeypair.publicJwk, 'RS256');
    const contentItems = [{ type: 'ltiResourceLink', title: 'X', url: 'https://x' }];

    const jwt = await buildDeepLinkingResponse(
      moodleFixture as Record<string, unknown>,
      contentItems,
      { privateKey, kid: toolKeypair.kid, clientId: moodleFixture.aud },
    );
    const { payload } = await jwtVerify(jwt, publicKey);

    // iss = tool client_id, aud = platform iss (LTI 1.3 DL response rules)
    expect(payload.iss).toBe(moodleFixture.aud);
    expect(payload.aud).toEqual(expect.arrayContaining([moodleFixture.iss]));
    const contentItemsClaim = payload['https://purl.imsglobal.org/spec/lti-dl/claim/content_items'];
    expect(Array.isArray(contentItemsClaim)).toBe(true);
    expect((contentItemsClaim as unknown[])[0]).toMatchObject({ type: 'ltiResourceLink' });
  });

  it('includes deployment_id claim echoed from the original launch', async () => {
    const privateKey = await importPKCS8(toolKeypair.privateKeyPem, 'RS256');
    const publicKey = await importJWK(toolKeypair.publicJwk, 'RS256');
    const jwt = await buildDeepLinkingResponse(
      moodleFixture as Record<string, unknown>,
      [],
      { privateKey, kid: toolKeypair.kid, clientId: moodleFixture.aud },
    );
    const { payload } = await jwtVerify(jwt, publicKey);
    expect(
      payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
    ).toBe('moodle-deployment-01');
  });
});
