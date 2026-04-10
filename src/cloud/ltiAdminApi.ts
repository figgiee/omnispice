/**
 * Instructor-facing LTI platform registry REST client.
 * Mirrors the classroomApi.ts pattern so hooks + tests feel familiar.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

type TokenFn = () => Promise<string | null>;

async function authedFetch(
  path: string,
  options: RequestInit,
  getToken: TokenFn,
): Promise<Response> {
  const token = await getToken();
  const headers = new Headers((options.headers as HeadersInit | undefined) ?? {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${options.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }
  return res;
}

export interface LtiPlatform {
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

export interface CreateLtiPlatformInput {
  iss: string;
  client_id: string;
  deployment_id?: string;
  name: string;
  auth_login_url: string;
  auth_token_url: string;
  jwks_uri: string;
}

export async function listPlatforms(getToken: TokenFn): Promise<LtiPlatform[]> {
  const res = await authedFetch('/api/lti/platforms', { method: 'GET' }, getToken);
  return res.json() as Promise<LtiPlatform[]>;
}

export async function createPlatform(
  input: CreateLtiPlatformInput,
  getToken: TokenFn,
): Promise<{ iss: string; client_id: string; name: string }> {
  const res = await authedFetch(
    '/api/lti/platforms',
    { method: 'POST', body: JSON.stringify(input) },
    getToken,
  );
  return res.json() as Promise<{ iss: string; client_id: string; name: string }>;
}

export async function deletePlatform(
  iss: string,
  clientId: string,
  getToken: TokenFn,
): Promise<void> {
  await authedFetch(
    `/api/lti/platforms/${encodeURIComponent(iss)}/${encodeURIComponent(clientId)}`,
    { method: 'DELETE' },
    getToken,
  );
}

/**
 * Embed selected assignments in the calling LMS via LTI Deep Linking.
 *
 * Called by DeepLinkPickerPage after the instructor clicks "Embed".
 * The Worker responds with an HTML document containing an auto-submitting
 * form; the caller should write that HTML directly into the current window
 * so the form POST fires against the platform's deep_link_return_url.
 *
 * NOTE: This endpoint is on the /lti/* router which is mounted pre-Clerk,
 * so no Authorization header is needed — the launch id is the capability.
 */
export async function embedInLms(input: {
  launchId: string;
  assignmentIds: string[];
}): Promise<string> {
  const res = await fetch(`${API_BASE}/lti/deeplink/response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LTI embed failed (${res.status}): ${body}`);
  }
  return res.text();
}
