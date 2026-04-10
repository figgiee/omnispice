import type { Page, Route } from '@playwright/test';

/**
 * Mock LMS platform fixture for @phase4-lti Playwright suite.
 *
 * Playwright cannot run a full Hono server inside the browser context, so we
 * use `page.route()` to intercept outbound calls and synthesise LTI platform
 * responses (JWKS, token, scores, lineitems). The captured requests are
 * exposed so specs can assert Content-Type, Authorization, body shape.
 *
 * Usage:
 *   const platform = mockPlatformRoutes(page);
 *   await launchOidcFlow(page, { iss, loginHint, targetLinkUri });
 *   expect(platform.scoresReceived).toHaveLength(1);
 */

export interface CapturedScore {
  lineItemUrl: string;
  contentType: string;
  authorization: string;
  body: unknown;
}

export interface MockLmsPlatform {
  jwks: { keys: Array<Record<string, unknown>> };
  tokenIssued: Array<{ assertion: string; scope: string }>;
  scoresReceived: CapturedScore[];
  lineItemsPosted: unknown[];
}

/**
 * Mock LMS JWKS — matches the mock-platform keypair committed to
 * worker/tests/fixtures/lti/jwks.json. In real E2E, the tool fetches JWKS
 * from the platform, so this route intercepts those calls.
 */
export async function mockPlatformRoutes(
  page: Page,
  opts: { issOrigin: string } = { issOrigin: 'https://mock-lms.test' },
): Promise<MockLmsPlatform> {
  const platform: MockLmsPlatform = {
    jwks: { keys: [] }, // populated by the spec from worker fixtures
    tokenIssued: [],
    scoresReceived: [],
    lineItemsPosted: [],
  };

  await page.route(`${opts.issOrigin}/.well-known/jwks.json`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(platform.jwks),
    });
  });

  await page.route(`${opts.issOrigin}/login/oauth2/token`, async (route: Route) => {
    const req = route.request();
    const body = req.postData() ?? '';
    const params = new URLSearchParams(body);
    platform.tokenIssued.push({
      assertion: params.get('client_assertion') ?? '',
      scope: params.get('scope') ?? '',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-bearer-' + platform.tokenIssued.length,
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });
  });

  await page.route(/\/line_items\/\d+\/scores$/, async (route: Route) => {
    const req = route.request();
    const rawBody = req.postData() ?? '';
    platform.scoresReceived.push({
      lineItemUrl: req.url().replace(/\/scores$/, ''),
      contentType: req.headers()['content-type'] ?? '',
      authorization: req.headers()['authorization'] ?? '',
      body: rawBody ? JSON.parse(rawBody) : null,
    });
    if (req.headers()['content-type'] !== 'application/vnd.ims.lis.v1.score+json') {
      await route.fulfill({
        status: 415,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_content_type' }),
      });
      return;
    }
    await route.fulfill({ status: 204, body: '' });
  });

  await page.route(/\/line_items(\?|$)/, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = req.postData() ?? '';
      const parsed = body ? JSON.parse(body) : {};
      platform.lineItemsPosted.push(parsed);
      await route.fulfill({
        status: 201,
        contentType: 'application/vnd.ims.lis.v2.lineitem+json',
        body: JSON.stringify({ ...parsed, id: `${opts.issOrigin}/line_items/mock-id` }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/vnd.ims.lis.v2.lineitemcontainer+json',
      body: JSON.stringify([]),
    });
  });

  return platform;
}

/**
 * Drive the OIDC third-party-initiated login dance from the mock platform.
 * Specs use this instead of hand-rolling the auth redirect chain.
 */
export async function launchOidcFlow(
  page: Page,
  args: { iss: string; loginHint: string; targetLinkUri: string; clientId: string },
): Promise<void> {
  const url = new URL('/lti/oidc/login', page.context().browser()!.version().length > 0 ? 'http://localhost:5173' : 'http://localhost:5173');
  url.searchParams.set('iss', args.iss);
  url.searchParams.set('login_hint', args.loginHint);
  url.searchParams.set('target_link_uri', args.targetLinkUri);
  url.searchParams.set('client_id', args.clientId);
  await page.goto(url.toString());
}
