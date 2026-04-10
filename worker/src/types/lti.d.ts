import type { LtiLaunchPayload } from '../lti/claims';

/**
 * Hono context variables used across LTI routes.
 *
 * verifiedLaunch is set by the /lti/launch handler after id_token verification
 * so downstream middleware / logging can inspect the parsed claims without
 * re-parsing.
 *
 * platformRow carries the lti_platforms D1 row looked up by (iss, client_id).
 */
export interface LtiPlatformRow {
  iss: string;
  client_id: string;
  deployment_id: string | null;
  name: string;
  auth_login_url: string;
  auth_token_url: string;
  jwks_uri: string;
  created_at: number;
  updated_at: number;
}

export interface LtiHonoVariables {
  verifiedLaunch?: LtiLaunchPayload;
  platformRow?: LtiPlatformRow;
}
