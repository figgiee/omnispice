/**
 * REST client for /api/labs — LAB-02 runtime + LAB-01 authoring.
 *
 * Matches the Worker route contract defined by the RED test stub at
 * worker/tests/routes/labs.test.ts (lands green in 04-05). This module
 * compiles now because it only depends on the type signatures — at
 * runtime the endpoints 404 until 04-05 ships the Hono route.
 *
 * Pattern follows src/cloud/classroomApi.ts: an authedFetch helper that
 * attaches a Clerk bearer token and throws on non-2xx with the response
 * body inlined for debugging.
 */

import type { Lab } from '@/labs/schema';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

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

/** Summary shape returned by GET /api/labs (listing). */
export interface LabSummary {
  id: string;
  title: string;
  description?: string;
  owner_id?: string;
  updated_at?: number;
}

/** Attempt shape returned by POST /api/labs/:id/attempts. */
export interface LabAttempt {
  id: string;
  lab_id: string;
  student_id?: string;
  started_at: number;
  submitted_at?: number | null;
  score?: number | null;
}

/** GET /api/labs — list labs visible to the current user. */
export async function listLabs(getToken: TokenFn): Promise<LabSummary[]> {
  const res = await authedFetch('/api/labs', { method: 'GET' }, getToken);
  return res.json() as Promise<LabSummary[]>;
}

/** GET /api/labs/:id — metadata for a single lab (D1 row). */
export async function getLab(id: string, getToken: TokenFn): Promise<LabSummary> {
  const res = await authedFetch(`/api/labs/${id}`, { method: 'GET' }, getToken);
  return res.json() as Promise<LabSummary>;
}

/**
 * GET /api/labs/:id/json — the full Lab document body from R2.
 *
 * Separate from getLab() because the R2 blob can be large (~KB–MB) and
 * the listing UI only needs the summary. Parsing with Zod happens at the
 * hook layer.
 */
export async function getLabJson(id: string, getToken: TokenFn): Promise<Lab> {
  const res = await authedFetch(`/api/labs/${id}/json`, { method: 'GET' }, getToken);
  return res.json() as Promise<Lab>;
}

/**
 * GET /api/labs/:id/references/:probe — reference CSV for a waveform
 * match predicate. Returns text for parseReferenceCsv.
 *
 * `probe` is URL-encoded because it usually contains parens, e.g. `v(out)`.
 */
export async function getReferenceCsv(
  labId: string,
  probe: string,
  getToken: TokenFn,
): Promise<string> {
  const res = await authedFetch(
    `/api/labs/${labId}/references/${encodeURIComponent(probe)}`,
    { method: 'GET' },
    getToken,
  );
  return res.text();
}

/** POST /api/labs/:id/attempts — open a new attempt on a lab. */
export async function createAttempt(labId: string, getToken: TokenFn): Promise<LabAttempt> {
  const res = await authedFetch(
    `/api/labs/${labId}/attempts`,
    { method: 'POST', body: '{}' },
    getToken,
  );
  return res.json() as Promise<LabAttempt>;
}

/**
 * PATCH /api/labs/attempts/:id/submit — finalize an attempt with a weighted
 * score. The server persists to lab_attempts and (if launched via LTI) fans
 * out to the AGS score passback queue.
 */
export async function submitAttempt(
  attemptId: string,
  score: number,
  getToken: TokenFn,
): Promise<void> {
  await authedFetch(
    `/api/labs/attempts/${attemptId}/submit`,
    { method: 'PATCH', body: JSON.stringify({ score }) },
    getToken,
  );
}
