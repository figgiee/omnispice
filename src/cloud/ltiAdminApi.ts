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
