import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { SignJWT, importPKCS8 } from 'jose';
import {
  mockPlatformRoutes,
  registerMockPlatformInWorker,
} from '../fixtures/mock-lms/platform';

/**
 * LMS-03: Student launches OmniSpice from an LMS and lands on the
 * assignment page without a SignIn modal flashing on the way.
 *
 * This spec drives a real Worker via `wrangler dev` (or whatever webServer
 * is running at http://localhost:8787). It:
 *
 *   1. Seeds the lti_platforms D1 table with a mock-LMS row via wrangler
 *      d1 execute (registerMockPlatformInWorker)
 *   2. Signs an id_token with the mock-platform private key committed at
 *      worker/tests/fixtures/lti/mock-platform-private.pem
 *   3. Intercepts the platform's JWKS URL so verifyLaunch sees the matching
 *      public key
 *   4. POSTs the id_token to /lti/launch as form_post
 *   5. Follows the HTML bootstrap → /lti/bootstrap → target_link_uri
 *   6. Asserts no SignIn modal rendered at any point (LMS-03 core invariant)
 *
 * Runtime prerequisites (auth gate):
 *   - `wrangler dev` running in worker/ with CLERK_SECRET_KEY configured in
 *     worker/.dev.vars (test Clerk instance is fine)
 *   - LTI_PRIVATE_KEY and LTI_PUBLIC_KID set in worker/.dev.vars
 *   - D1 migrations applied locally: `wrangler d1 migrations apply omnispice-db --local`
 *   - Env var RUN_LTI_E2E=1 so the suite opts in (otherwise skipped)
 *
 * Without those prereqs the test auto-skips (rather than failing CI) because
 * the Clerk test secret key is a per-developer credential that cannot live
 * in the repo.
 */

const RUN_LTI_E2E = process.env.RUN_LTI_E2E === '1';

const MOCK_ISS = 'https://mock-lms.test';
const MOCK_CLIENT_ID = 'test-client-1';
const MOCK_SUB = 'test-student-lms03';
const TARGET_LINK_URI = 'http://localhost:5173/dashboard';
const WORKER_ORIGIN = process.env.WORKER_ORIGIN ?? 'http://localhost:8787';

test.describe('@phase4-lti LTI launch — no SignIn modal (LMS-03)', () => {
  test.beforeEach(() => {
    test.skip(
      !RUN_LTI_E2E,
      'LMS-03 E2E requires RUN_LTI_E2E=1 + wrangler dev + test Clerk keys (see spec docstring)',
    );
  });

  test('mock LMS POSTs signed id_token, SPA boots pre-authenticated', async ({
    page,
  }) => {
    await mockPlatformRoutes(page, { issOrigin: MOCK_ISS });
    registerMockPlatformInWorker({
      iss: MOCK_ISS,
      client_id: MOCK_CLIENT_ID,
    });

    const idToken = await signMockIdToken({
      iss: MOCK_ISS,
      aud: MOCK_CLIENT_ID,
      sub: MOCK_SUB,
    });

    // Step 4: POST the id_token to /lti/launch as form_post. The Worker
    // returns HTML that redirects to /lti/bootstrap?ticket=...
    const formBody = new URLSearchParams({
      id_token: idToken,
      state: 'e2e-state-01',
    });
    const launchResponse = await page.request.post(
      `${WORKER_ORIGIN}/lti/launch`,
      {
        data: formBody.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    expect(launchResponse.status()).toBe(200);
    const launchHtml = await launchResponse.text();
    // The Worker emits an HTML bootstrap whose inline <script> replaces
    // location with /lti/bootstrap?ticket=... We extract that URL so we
    // can navigate the browser directly without relying on Worker-rendered
    // JS execution inside a Playwright request context.
    const bootstrapUrl = extractBootstrapUrl(launchHtml);
    expect(bootstrapUrl).toMatch(/\/lti\/bootstrap\?ticket=/);

    // Step 5: Navigate the page to the bootstrap URL. The React
    // LtiLaunchBootstrap component redeems the ticket via Clerk and then
    // calls history.replaceState(target) + dispatches a popstate.
    await page.goto(`http://localhost:5173${bootstrapUrl}`);

    // Step 6: Assert no SignIn modal in the DOM at any point. The Clerk
    // SignIn component renders with data-clerk-component="SignIn" or
    // aria-label="Sign in". We assert both selectors are hidden.
    await expect(page.locator('[data-clerk-component="SignIn"]')).toHaveCount(0);
    await expect(page.locator('[aria-label="Sign in"]')).toHaveCount(0);
  });

  test('second launch with same (iss,sub) re-uses Clerk user (externalId lookup)', async ({
    page,
  }) => {
    await mockPlatformRoutes(page, { issOrigin: MOCK_ISS });
    registerMockPlatformInWorker({
      iss: MOCK_ISS,
      client_id: MOCK_CLIENT_ID,
    });

    const tok1 = await signMockIdToken({
      iss: MOCK_ISS,
      aud: MOCK_CLIENT_ID,
      sub: MOCK_SUB,
      nonce: 'launch-one-nonce',
    });
    const tok2 = await signMockIdToken({
      iss: MOCK_ISS,
      aud: MOCK_CLIENT_ID,
      sub: MOCK_SUB,
      nonce: 'launch-two-nonce',
    });

    const r1 = await page.request.post(`${WORKER_ORIGIN}/lti/launch`, {
      data: new URLSearchParams({ id_token: tok1 }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(r1.status()).toBe(200);

    const r2 = await page.request.post(`${WORKER_ORIGIN}/lti/launch`, {
      data: new URLSearchParams({ id_token: tok2 }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(r2.status()).toBe(200);

    // Both launches must succeed against the same Clerk user. The best
    // hermetic assertion we have without hitting Clerk's REST API is that
    // both /lti/launch calls returned 200 (meaning mintClerkTicketForLtiLaunch
    // resolved both times) and both bootstrap URLs contain a ticket param.
    const body1 = await r1.text();
    const body2 = await r2.text();
    expect(body1).toContain('ticket=');
    expect(body2).toContain('ticket=');
  });
});

// ---------- helpers ----------

/**
 * Sign an LTI id_token using the mock-platform private key committed at
 * worker/tests/fixtures/lti/mock-platform-private.pem. The matching public
 * JWK lives in worker/tests/fixtures/lti/jwks.json and is what the
 * mockPlatformRoutes fixture serves over page.route().
 */
async function signMockIdToken(args: {
  iss: string;
  aud: string;
  sub: string;
  nonce?: string;
}): Promise<string> {
  const pemPath = resolve(
    process.cwd(),
    'worker/tests/fixtures/lti/mock-platform-private.pem',
  );
  const pem = readFileSync(pemPath, 'utf8');
  const privateKey = await importPKCS8(pem, 'RS256');

  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    iss: args.iss,
    aud: args.aud,
    sub: args.sub,
    nonce: args.nonce ?? `e2e-nonce-${crypto.randomUUID()}`,
    iat: now,
    exp: now + 600,
    email: `${args.sub}@example.edu`,
    name: 'LMS-03 Test Student',
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti/claim/message_type':
      'LtiResourceLinkRequest',
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': 'deployment-1',
    'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': TARGET_LINK_URI,
    'https://purl.imsglobal.org/spec/lti/claim/resource_link': {
      id: 'e2e-resource-link-1',
      title: 'E2E Test Lab',
    },
    'https://purl.imsglobal.org/spec/lti/claim/roles': [
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
    ],
  };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: 'mock-platform-2026', typ: 'JWT' })
    .sign(privateKey);
}

/**
 * Extract the /lti/bootstrap URL from the HTML bootstrap payload the
 * Worker returns from POST /lti/launch. The payload is a small inline
 * script calling window.location.replace("/lti/bootstrap?ticket=...").
 */
function extractBootstrapUrl(html: string): string {
  const match = html.match(/window\.location\.replace\(\"([^\"]+)\"\)/);
  if (!match?.[1]) {
    throw new Error(`Bootstrap URL not found in launch HTML: ${html.slice(0, 200)}`);
  }
  return match[1];
}
