import { Hono } from 'hono';
import { buildOidcLoginRedirect } from '../lti/oidcLogin';
import { getToolPublicJwks } from '../lti/keys';
import {
  verifyLaunch,
  d1NonceStore,
  fetchRemoteJwks,
  type PlatformRow as VerifyPlatformRow,
} from '../lti/verify';
import { mintClerkTicketForLtiLaunch } from '../lti/mintClerkTicket';
import { LTI_CLAIMS, type LtiLaunchPayload } from '../lti/claims';
import type { Bindings } from '../index';
import type { LtiPlatformRow } from '../types/lti';

/**
 * LTI 1.3 router — Phase 4 (Wave 1, 04-02).
 *
 * Mounts at /lti BEFORE any Clerk middleware so LMSes (which have no Clerk
 * session at OIDC login / launch time) can reach these endpoints.
 *
 * Endpoints:
 *   - GET  /.well-known/jwks.json — tool public JWKS from env.LTI_PRIVATE_KEY
 *   - GET  /oidc/login            — third-party-initiated login → 302 to platform
 *   - POST /oidc/login            — same, some LMSes POST instead of GET
 *   - POST /launch                — verify id_token → Clerk ticket → HTML bootstrap
 */
const lti = new Hono<{ Bindings: Bindings }>();

/** Tool public JWKS — publicly callable. */
lti.get('/.well-known/jwks.json', async (c) => {
  try {
    const jwks = await getToolPublicJwks(c.env);
    return c.json(jwks);
  } catch (err) {
    // Before `wrangler secret put LTI_PRIVATE_KEY`, return an empty JWKS so
    // admins can still discover the endpoint during platform registration.
    console.error('[lti/jwks] Failed to derive public JWKS:', err);
    return c.json({ keys: [] });
  }
});

/**
 * OIDC Third-Party-Initiated Login.
 * Accepts GET (most platforms) and POST (Canvas occasionally form-posts).
 */
lti.all('/oidc/login', async (c) => {
  let params: Record<string, string> = {};
  if (c.req.method === 'POST') {
    const body = await c.req.parseBody();
    params = Object.fromEntries(
      Object.entries(body).map(([k, v]) => [k, String(v)]),
    );
  } else {
    params = Object.fromEntries(new URL(c.req.url).searchParams.entries());
  }

  const iss = params.iss;
  const login_hint = params.login_hint;
  const target_link_uri = params.target_link_uri;

  if (!iss) {
    return c.json({ error: 'Missing required parameter: iss' }, 400);
  }
  if (!login_hint) {
    return c.json({ error: 'Missing required parameter: login_hint' }, 400);
  }
  if (!target_link_uri) {
    return c.json({ error: 'Missing required parameter: target_link_uri' }, 400);
  }

  // Resolve the platform: prefer (iss, client_id) if client_id was provided,
  // fall back to iss-only if the LMS omits it.
  const clientId = params.client_id;
  let platform: LtiPlatformRow | null = null;
  if (clientId) {
    platform = await c.env.DB.prepare(
      `SELECT iss, client_id, deployment_id, name, auth_login_url, auth_token_url, jwks_uri, created_at, updated_at
       FROM lti_platforms WHERE iss = ? AND client_id = ?`,
    )
      .bind(iss, clientId)
      .first<LtiPlatformRow>();
  } else {
    platform = await c.env.DB.prepare(
      `SELECT iss, client_id, deployment_id, name, auth_login_url, auth_token_url, jwks_uri, created_at, updated_at
       FROM lti_platforms WHERE iss = ? LIMIT 1`,
    )
      .bind(iss)
      .first<LtiPlatformRow>();
  }

  if (!platform) {
    return c.json({ error: `Unregistered platform: ${iss}` }, 404);
  }

  const result = await buildOidcLoginRedirect(
    {
      iss,
      login_hint,
      target_link_uri,
      client_id: clientId,
      lti_deployment_id: params.lti_deployment_id,
      lti_message_hint: params.lti_message_hint,
    },
    {
      iss: platform.iss,
      client_id: platform.client_id,
      auth_login_url: platform.auth_login_url,
    },
    c.env.DB,
  );

  return c.redirect(result.location, 302);
});

/**
 * LTI launch endpoint.
 *
 * The LMS POSTs a signed id_token (and state) as form_post. We:
 *   1. Verify the id_token via jose + platform JWKS
 *   2. Persist an lti_launches audit row
 *   3. Mint a short-lived Clerk sign-in ticket for the (iss, sub) user
 *   4. Return an HTML bootstrap page that hands the ticket to the SPA
 */
lti.post('/launch', async (c) => {
  const body = await c.req.parseBody();
  const idToken = typeof body.id_token === 'string' ? body.id_token : '';
  // state is not currently cross-checked because we store it in lti_nonces
  // under a `state:` prefix and the nonce in the id_token is the primary
  // replay guard — Phase 5 promotes state to a dedicated table.

  if (!idToken) {
    return c.json({ error: 'Missing id_token' }, 400);
  }

  let claims: LtiLaunchPayload;
  try {
    claims = await verifyLaunch(idToken, {
      platformLookup: async (iss, clientId): Promise<VerifyPlatformRow | null> => {
        const row = await c.env.DB.prepare(
          `SELECT iss, client_id, jwks_uri, auth_token_url FROM lti_platforms
           WHERE iss = ? AND client_id = ?`,
        )
          .bind(iss, clientId)
          .first<VerifyPlatformRow>();
        return row;
      },
      fetchJwks: fetchRemoteJwks,
      nonceStore: d1NonceStore(c.env.DB),
    });
  } catch (err) {
    const msg = (err as Error).message || 'id_token verification failed';
    console.error('[lti/launch] verify failed:', msg);
    return c.json({ error: msg }, 401);
  }

  // Audit row for downstream joins (submissions.lti_launch_id lands in 04-03).
  const launchId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO lti_launches (id, iss, client_id, deployment_id, sub, clerk_user_id, message_type, resource_link_id, context_id, raw_claims, ags_lineitem_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      launchId,
      claims.iss,
      Array.isArray(claims.aud) ? claims.aud[0] : claims.aud,
      (claims as unknown as Record<string, unknown>)[LTI_CLAIMS.DEPLOYMENT_ID] as string | null,
      claims.sub,
      '', // clerk_user_id filled immediately below
      (claims as unknown as Record<string, unknown>)[LTI_CLAIMS.MESSAGE_TYPE] as string,
      ((claims as unknown as Record<string, unknown>)[LTI_CLAIMS.RESOURCE_LINK] as { id?: string } | undefined)?.id ?? null,
      ((claims as unknown as Record<string, unknown>)[LTI_CLAIMS.CONTEXT] as { id?: string } | undefined)?.id ?? null,
      JSON.stringify(claims),
      ((claims as unknown as Record<string, unknown>)[LTI_CLAIMS.AGS_ENDPOINT] as { lineitem?: string } | undefined)?.lineitem ?? null,
      Date.now(),
    )
    .run();

  // Mint the Clerk sign-in ticket.
  const { ticket, clerkUserId } = await mintClerkTicketForLtiLaunch({
    iss: claims.iss,
    sub: claims.sub,
    email: claims.email,
    name: claims.name,
    secretKey: c.env.CLERK_SECRET_KEY,
  });

  // Backfill clerk_user_id on the audit row (small cost; atomic enough).
  await c.env.DB.prepare('UPDATE lti_launches SET clerk_user_id = ? WHERE id = ?')
    .bind(clerkUserId, launchId)
    .run();

  // Message type drives the bootstrap mode so the SPA knows whether to show
  // the deep-link picker (04-03) or just navigate to the resource.
  const messageType = (claims as unknown as Record<string, unknown>)[
    LTI_CLAIMS.MESSAGE_TYPE
  ] as string;
  const mode = messageType === 'LtiDeepLinkingRequest' ? 'deeplink' : 'resource';

  const target =
    ((claims as unknown as Record<string, unknown>)[LTI_CLAIMS.TARGET_LINK_URI] as
      | string
      | undefined) ?? '/';

  // HTML bootstrap: minimal inline script that navigates to /lti/bootstrap
  // with the ticket as a query param. The React LtiLaunchBootstrap page
  // redeems the ticket via @clerk/react useSignIn.
  const bootstrapUrl = `/lti/bootstrap?ticket=${encodeURIComponent(ticket)}&launch=${encodeURIComponent(launchId)}&target=${encodeURIComponent(target)}&mode=${mode}`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Loading OmniSpice...</title>
<meta name="referrer" content="no-referrer">
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0b0d12;color:#dde}</style>
</head>
<body>
<p>Signing you in...</p>
<script>window.location.replace(${JSON.stringify(bootstrapUrl)});</script>
</body>
</html>`;

  return c.html(html);
});

export { lti as ltiRouter };
