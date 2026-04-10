import { Hono } from 'hono';
import { getToolPublicJwks } from '../lti/keys';
import type { Bindings } from '../index';

/**
 * LTI 1.3 router — Phase 4.
 *
 * Mounts at /lti BEFORE any Clerk middleware so LMSes (which have no Clerk
 * session at OIDC login / launch time) can reach these endpoints.
 *
 * Endpoints (Wave 1, 04-02):
 * - GET  /.well-known/jwks.json — tool public JWKS derived from env.LTI_PRIVATE_KEY
 * - GET  /oidc/login            — third-party-initiated login → 302 to platform
 * - POST /oidc/login            — same, some LMSes POST instead of GET
 * - POST /launch                — verify id_token → mint Clerk ticket → HTML bootstrap
 */
const lti = new Hono<{ Bindings: Bindings }>();

/**
 * Tool JWKS. Serves the tool's public key so LMSes can verify
 * DeepLinkingResponse JWTs and AGS client_assertion JWTs.
 * Publicly callable — NO Clerk middleware.
 */
lti.get('/.well-known/jwks.json', async (c) => {
  try {
    const jwks = await getToolPublicJwks(c.env);
    return c.json(jwks);
  } catch (err) {
    // If LTI_PRIVATE_KEY is not configured (e.g. before first wrangler secret put),
    // return an empty JWKS rather than 500 so LMS admins can still fetch /jwks.json
    // during tool registration.
    console.error('[lti/jwks] Failed to derive public JWKS:', err);
    return c.json({ keys: [] });
  }
});

export { lti as ltiRouter };
