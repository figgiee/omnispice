import { Hono } from 'hono';
import type { Bindings } from '../index';

/**
 * LTI 1.3 router — Phase 4.
 *
 * Wave 0 (04-01) ships only the JWKS stub so Canvas/Moodle admins can
 * configure Public JWK URL during sandbox provisioning. The login/launch/
 * deeplink/ags endpoints land in 04-02.
 *
 * IMPORTANT: this router is mounted at `/lti` BEFORE any Clerk middleware in
 * worker/src/index.ts. LMSes call these endpoints without a Clerk session.
 */
const lti = new Hono<{ Bindings: Bindings }>();

/**
 * Tool JWKS. Serves the tool's public key so LMSes can verify
 * DeepLinkingResponse JWTs and AGS client_assertion JWTs.
 * Publicly callable — NO Clerk middleware.
 *
 * Wave 0 stub: returns an empty keys array. Plan 04-02 replaces this with
 * a JWK derived from `LTI_PRIVATE_KEY` at cold start, cached per-isolate.
 */
lti.get('/.well-known/jwks.json', async (c) => {
  return c.json({ keys: [] });
});

export { lti as ltiRouter };
