import type { CircuitMeta, SaveCircuitInput, SaveCircuitResponse, ShareResponse } from './types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

async function authedFetch(
  path: string,
  options: RequestInit,
  getToken: () => Promise<string | null>,
): Promise<Response> {
  const token = await getToken();
  const headers = new Headers((options.headers as HeadersInit | undefined) ?? {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${options.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }
  return res;
}

export async function saveCircuit(
  input: SaveCircuitInput,
  getToken: () => Promise<string | null>,
): Promise<SaveCircuitResponse> {
  const res = await authedFetch(
    '/api/circuits',
    { method: 'POST', body: JSON.stringify(input) },
    getToken,
  );
  return res.json() as Promise<SaveCircuitResponse>;
}

export async function listCircuits(
  getToken: () => Promise<string | null>,
): Promise<CircuitMeta[]> {
  const res = await authedFetch('/api/circuits', { method: 'GET' }, getToken);
  return res.json() as Promise<CircuitMeta[]>;
}

export async function loadCircuit(
  id: string,
  getToken: () => Promise<string | null>,
): Promise<string> {
  const res = await authedFetch(`/api/circuits/${id}`, { method: 'GET' }, getToken);
  return res.text();
}

export async function shareCircuit(
  id: string,
  getToken: () => Promise<string | null>,
): Promise<ShareResponse> {
  const res = await authedFetch(`/api/circuits/${id}/share`, { method: 'POST' }, getToken);
  return res.json() as Promise<ShareResponse>;
}

export async function loadSharedCircuit(token: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/share/${token}`);
  if (!res.ok) throw new Error(`Shared circuit not found: ${token}`);
  return res.text();
}
