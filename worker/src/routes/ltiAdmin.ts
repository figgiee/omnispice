import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireInstructor } from '../middleware/requireInstructor';
import { LtiPlatformRegistrationSchema } from '../lti/claims';
import type { Bindings } from '../index';
import type { LtiPlatformRow } from '../types/lti';

/**
 * Instructor-facing LTI platform registry.
 *
 * Mounted at `/api/lti` (NOT `/lti` — that prefix is reserved for
 * publicly-callable LMS endpoints which must NOT be behind Clerk middleware).
 *
 * All mutating routes require role === 'instructor' via requireInstructor.
 * GET /platforms is also gated because platform material (jwks_uri,
 * auth_token_url) is not student-relevant.
 */
const ltiAdmin = new Hono<{
  Bindings: Bindings;
  Variables: { userId: string };
}>();

// POST /api/lti/platforms — create a new platform registration
ltiAdmin.post('/platforms', requireInstructor, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  }

  const parsed = LtiPlatformRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: 'Invalid platform registration', issues: parsed.error.issues },
      400,
    );
  }

  const now = Date.now();
  const p = parsed.data;
  await c.env.DB.prepare(
    `INSERT INTO lti_platforms (iss, client_id, deployment_id, name, auth_login_url, auth_token_url, jwks_uri, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      p.iss,
      p.client_id,
      p.deployment_id ?? null,
      p.name,
      p.auth_login_url,
      p.auth_token_url,
      p.jwks_uri,
      now,
      now,
    )
    .run();

  return c.json({
    iss: p.iss,
    client_id: p.client_id,
    name: p.name,
  });
});

// GET /api/lti/platforms — list all registered platforms (instructor-only)
ltiAdmin.get('/platforms', requireInstructor, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT iss, client_id, deployment_id, name, auth_login_url, auth_token_url, jwks_uri, created_at, updated_at
     FROM lti_platforms
     ORDER BY created_at DESC`,
  ).all<LtiPlatformRow>();
  return c.json(results ?? []);
});

// GET /api/lti/platforms/:iss/:client_id — single row lookup
ltiAdmin.get('/platforms/:iss/:client_id', requireInstructor, async (c) => {
  const iss = decodeURIComponent(c.req.param('iss'));
  const clientId = decodeURIComponent(c.req.param('client_id'));
  const row = await c.env.DB.prepare(
    `SELECT iss, client_id, deployment_id, name, auth_login_url, auth_token_url, jwks_uri, created_at, updated_at
     FROM lti_platforms WHERE iss = ? AND client_id = ?`,
  )
    .bind(iss, clientId)
    .first<LtiPlatformRow>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

// DELETE /api/lti/platforms/:iss/:client_id — CASCADE via FK drops deployments etc.
ltiAdmin.delete('/platforms/:iss/:client_id', requireInstructor, async (c) => {
  const iss = decodeURIComponent(c.req.param('iss'));
  const clientId = decodeURIComponent(c.req.param('client_id'));
  await c.env.DB.prepare(
    'DELETE FROM lti_platforms WHERE iss = ? AND client_id = ?',
  )
    .bind(iss, clientId)
    .run();
  return c.json({ deleted: true });
});

export { ltiAdmin as ltiAdminRouter };
