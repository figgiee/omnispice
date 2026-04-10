import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPlatform } from '../helpers/mockPlatform';
// RED — src/lti/ags lands in 04-03.
// @ts-expect-error — module does not exist yet (Wave 0 scaffold).
import { postScore, getPlatformToken, ensureLineItem } from '../../src/lti/ags';

vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
  getAuth: vi.fn(),
}));

describe('lti/ags — LMS-03 grade passback', () => {
  let platform: ReturnType<typeof createMockPlatform>;

  beforeEach(() => {
    vi.clearAllMocks();
    platform = createMockPlatform();
  });

  it('postScore sends application/vnd.ims.lis.v1.score+json Content-Type (Pitfall 4)', async () => {
    await postScore({
      lineItemUrl: 'https://canvas.test.instructure.com/api/lti/courses/1/line_items/42',
      userId: 'lti-sub-student-01',
      scoreGiven: 0.85,
      scoreMaximum: 1.0,
      timestamp: '2026-04-10T00:00:00Z',
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      iss: 'https://canvas.test.instructure.com',
      clientId: '10000000000001',
      fetch: platform.fetch,
      getPlatformToken: async () => 'mock-bearer-token-1',
    });
    expect(platform.scoresReceived).toHaveLength(1);
    expect(platform.scoresReceived[0].contentType).toBe('application/vnd.ims.lis.v1.score+json');
  });

  it('postScore sends Authorization: Bearer <token>', async () => {
    await postScore({
      lineItemUrl: 'https://canvas.test.instructure.com/api/lti/courses/1/line_items/42',
      userId: 'u1',
      scoreGiven: 1,
      scoreMaximum: 1,
      timestamp: '2026-04-10T00:00:00Z',
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      iss: 'https://canvas.test.instructure.com',
      clientId: '10000000000001',
      fetch: platform.fetch,
      getPlatformToken: async () => 'mock-bearer-token-42',
    });
    expect(platform.scoresReceived[0].authorization).toBe('Bearer mock-bearer-token-42');
  });

  it('postScore body contains all required LTI AGS score fields', async () => {
    await postScore({
      lineItemUrl: 'https://canvas.test.instructure.com/api/lti/courses/1/line_items/42',
      userId: 'student-01',
      scoreGiven: 0.75,
      scoreMaximum: 1.0,
      timestamp: '2026-04-10T00:00:00Z',
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      iss: 'https://canvas.test.instructure.com',
      clientId: '10000000000001',
      fetch: platform.fetch,
      getPlatformToken: async () => 'tkn',
    });
    const body = platform.scoresReceived[0].body as Record<string, unknown>;
    expect(body.userId).toBe('student-01');
    expect(body.scoreGiven).toBe(0.75);
    expect(body.scoreMaximum).toBe(1.0);
    expect(body.timestamp).toBe('2026-04-10T00:00:00Z');
    expect(body.activityProgress).toBe('Completed');
    expect(body.gradingProgress).toBe('FullyGraded');
  });

  it('getPlatformToken caches bearer within expiry window', async () => {
    const cacheStore = new Map<string, { token: string; expiresAt: number }>();
    const t1 = await getPlatformToken({
      iss: 'https://canvas.test.instructure.com',
      clientId: '10000000000001',
      scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
      tokenUrl: 'https://canvas.test.instructure.com/login/oauth2/token',
      toolPrivateKey: 'PEM-PLACEHOLDER',
      toolKid: 'omnispice-test-2026',
      fetch: platform.fetch,
      cache: cacheStore,
    });
    const t2 = await getPlatformToken({
      iss: 'https://canvas.test.instructure.com',
      clientId: '10000000000001',
      scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
      tokenUrl: 'https://canvas.test.instructure.com/login/oauth2/token',
      toolPrivateKey: 'PEM-PLACEHOLDER',
      toolKid: 'omnispice-test-2026',
      fetch: platform.fetch,
      cache: cacheStore,
    });
    expect(t1).toBe(t2);
    expect(platform.tokenIssued).toHaveLength(1);
  });

  it('ensureLineItem PUT/GETs lineitems endpoint and returns the lineitem URL', async () => {
    const url = await ensureLineItem({
      lineItemsUrl: 'https://canvas.test.instructure.com/api/lti/courses/1/line_items',
      resourceLinkId: 'canvas-resource-link-01',
      label: 'OmniSpice Lab 1',
      scoreMaximum: 1.0,
      iss: 'https://canvas.test.instructure.com',
      clientId: '10000000000001',
      fetch: platform.fetch,
      getPlatformToken: async () => 'bearer',
    });
    expect(typeof url).toBe('string');
    expect(url).toContain('line_items');
    expect(platform.lineItemsPosted.length).toBeGreaterThanOrEqual(0);
  });
});
