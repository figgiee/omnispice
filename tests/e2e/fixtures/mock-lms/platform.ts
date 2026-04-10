import { execSync } from 'node:child_process';
import type { Page, Route } from '@playwright/test';

/**
 * Mock LMS platform fixture for @phase4-lti Playwright suite.
 *
 * Playwright cannot run a full Hono server inside the browser context, so we
 * use `page.route()` to intercept outbound calls and synthesise LTI platform
 * responses (JWKS, token, scores, lineitems). The captured requests are
 * exposed so specs can assert Content-Type, Authorization, body shape.
 *
 * Plan 04-02 adds `registerMockPlatformInWorker` which seeds the
 * `lti_platforms` D1 table via `wrangler d1 execute` so the real Worker's
 * verifyLaunch handler can look up the mock platform row during /lti/launch.
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

export interface PlatformRegistration {
  iss: string;
  client_id: string;
  name?: string;
  auth_login_url?: string;
  auth_token_url?: string;
  jwks_uri?: string;
}

/**
 * Seed the mock platform into the Worker's `lti_platforms` D1 table via
 * `wrangler d1 execute`. Called by the E2E spec before driving a launch,
 * so the real verifyLaunch handler can look up the (iss, client_id) row.
 *
 * This shells out to wrangler rather than going through the admin HTTP
 * endpoint because the admin endpoint is Clerk-gated and E2E specs don't
 * have an instructor Clerk session at setup time.
 */
export function registerMockPlatformInWorker(opts: PlatformRegistration): void {
  const row = {
    iss: opts.iss,
    client_id: opts.client_id,
    name: opts.name ?? 'Mock LMS',
    auth_login_url: opts.auth_login_url ?? `${opts.iss}/api/lti/authorize_redirect`,
    auth_token_url: opts.auth_token_url ?? `${opts.iss}/login/oauth2/token`,
    jwks_uri: opts.jwks_uri ?? `${opts.iss}/.well-known/jwks.json`,
  };
  const now = Date.now();
  // Build an UPSERT so repeat runs are idempotent.
  const sql = `
    INSERT INTO lti_platforms (iss, client_id, deployment_id, name, auth_login_url, auth_token_url, jwks_uri, created_at, updated_at)
    VALUES ('${escapeSql(row.iss)}', '${escapeSql(row.client_id)}', NULL, '${escapeSql(row.name)}', '${escapeSql(row.auth_login_url)}', '${escapeSql(row.auth_token_url)}', '${escapeSql(row.jwks_uri)}', ${now}, ${now})
    ON CONFLICT(iss, client_id) DO UPDATE SET
      name=excluded.name,
      auth_login_url=excluded.auth_login_url,
      auth_token_url=excluded.auth_token_url,
      jwks_uri=excluded.jwks_uri,
      updated_at=excluded.updated_at;
  `.trim();

  execSync(
    `pnpm --silent --prefix worker exec wrangler d1 execute omnispice-db --local --command "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
    { stdio: 'pipe' },
  );
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Drive the OIDC third-party-initiated login dance from the mock platform.
 * Specs use this instead of hand-rolling the auth redirect chain.
 */
export async function launchOidcFlow(
  page: Page,
  args: { iss: string; loginHint: string; targetLinkUri: string; clientId: string },
): Promise<void> {
  const url = new URL('/lti/oidc/login', 'http://localhost:8787');
  url.searchParams.set('iss', args.iss);
  url.searchParams.set('login_hint', args.loginHint);
  url.searchParams.set('target_link_uri', args.targetLinkUri);
  url.searchParams.set('client_id', args.clientId);
  await page.goto(url.toString());
}
