/**
 * LTI 1.3 Third-Party-Initiated Login (OIDC login init).
 *
 * Builds the redirect URL the tool sends back to the platform to kick off
 * the OIDC authorization dance. Per the spec, the platform must receive:
 *
 *   - scope=openid
 *   - response_type=id_token
 *   - client_id          (platform-assigned)
 *   - redirect_uri       (the tool's launch URL, == target_link_uri)
 *   - login_hint         (echoed back from the login init)
 *   - state              (CSRF protection — persisted in D1 for /launch to verify)
 *   - response_mode=form_post
 *   - nonce              (single-use, persisted in D1 for replay detection)
 *   - prompt=none
 *   - lti_message_hint   (echoed back if provided)
 *
 * State + nonce are stored in `lti_nonces` with a `state:` key prefix as
 * documented in the 04-01 decision list (short-term shortcut until a
 * dedicated `lti_oidc_states` table ships in Phase 5).
 */

export interface OidcLoginParams {
  iss: string;
  login_hint: string;
  target_link_uri: string;
  client_id?: string;
  lti_deployment_id?: string;
  lti_message_hint?: string;
}

export interface OidcPlatformRow {
  iss: string;
  client_id: string;
  auth_login_url: string;
}

export interface OidcLoginResult {
  location: string;
  state: string;
  nonce: string;
}

/**
 * Build the OIDC authorization redirect and persist state + nonce.
 *
 * The state + nonce are stored in `lti_nonces` under synthetic keys
 * `state:${state}` and `nonce:${nonce}` so the /launch handler can verify
 * the round-trip without a dedicated state table.
 */
export async function buildOidcLoginRedirect(
  params: OidcLoginParams,
  platform: OidcPlatformRow,
  db: D1Database,
): Promise<OidcLoginResult> {
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes — short OIDC window

  // Persist BOTH state and nonce in lti_nonces. Two inserts, not a transaction
  // (D1 in Workers doesn't expose native transactions for the simple case;
  // if the first succeeds and the second fails, the orphaned state row expires
  // harmlessly after 5 minutes).
  await db
    .prepare('INSERT INTO lti_nonces (nonce, iss, expires_at) VALUES (?, ?, ?)')
    .bind(`state:${state}`, params.iss, expiresAt)
    .run();
  await db
    .prepare('INSERT INTO lti_nonces (nonce, iss, expires_at) VALUES (?, ?, ?)')
    .bind(`oidc-nonce:${nonce}`, params.iss, expiresAt)
    .run();

  // The OIDC redirect_uri is the tool's own launch endpoint. LTI spec says
  // this MUST equal target_link_uri (the tool sets redirect_uri = the launch
  // URL; the LMS POSTs id_token there as form_post).
  const clientId = params.client_id ?? platform.client_id;

  const qs = new URLSearchParams({
    scope: 'openid',
    response_type: 'id_token',
    client_id: clientId,
    redirect_uri: params.target_link_uri,
    login_hint: params.login_hint,
    state,
    response_mode: 'form_post',
    nonce,
    prompt: 'none',
  });
  if (params.lti_message_hint) {
    qs.set('lti_message_hint', params.lti_message_hint);
  }
  if (params.lti_deployment_id) {
    qs.set('lti_deployment_id', params.lti_deployment_id);
  }

  const location = `${platform.auth_login_url}?${qs.toString()}`;

  return { location, state, nonce };
}
