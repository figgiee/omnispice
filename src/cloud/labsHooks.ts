/**
 * TanStack Query hooks for /api/labs — LAB-02 runtime.
 *
 * Mirrors classroomHooks.ts naming and caching conventions:
 * - Query keys are tuples starting with a string domain tag.
 * - `enabled: isSignedIn && !!id` for any hook that requires an ID.
 * - `staleTime: 30_000` for list data; `Infinity` for immutable R2 blobs.
 * - Mutations invalidate the minimum set of queries on success.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/auth/useCurrentUser';
import { type Lab, LabSchema } from '@/labs/schema';
import {
  createAttempt,
  createLab,
  deleteLab,
  getLab,
  getLabJson,
  getReferenceCsv,
  type LabAttempt,
  type LabSummary,
  listLabs,
  submitAttempt,
  updateLab,
  uploadReference,
} from './labsApi';

/** GET /api/labs — list all labs visible to the current user. */
export function useLabs() {
  const { getToken, isSignedIn } = useCurrentUser();
  return useQuery({
    queryKey: ['labs'],
    queryFn: () => listLabs(getToken),
    enabled: isSignedIn,
    staleTime: 30_000,
  });
}

/** GET /api/labs/:id — metadata row. */
export function useLab(id: string | null) {
  const { getToken, isSignedIn } = useCurrentUser();
  return useQuery<LabSummary>({
    queryKey: ['lab', id],
    queryFn: () => getLab(id!, getToken),
    enabled: isSignedIn && !!id,
    staleTime: 30_000,
  });
}

/**
 * GET /api/labs/:id/json — full Lab document body (R2 blob).
 *
 * Parses through `LabSchema` so every downstream consumer sees a
 * type-safe, validated Lab. A parse error surfaces as a query error,
 * which the runner page renders as a "lab is corrupted" state.
 *
 * `staleTime: Infinity` because the blob is immutable per version — a new
 * version lands as a new R2 key.
 */
export function useLabJson(id: string | null) {
  const { getToken, isSignedIn } = useCurrentUser();
  return useQuery<Lab>({
    queryKey: ['lab-json', id],
    queryFn: async () => {
      const raw = await getLabJson(id!, getToken);
      return LabSchema.parse(raw);
    },
    enabled: isSignedIn && !!id,
    staleTime: Infinity,
  });
}

/**
 * GET /api/labs/:labId/references/:probe — reference CSV text for
 * waveform_match predicates. Raw text — parsing happens in the runner
 * hook to keep this layer cheap.
 */
export function useReferenceCsv(labId: string | null, probe: string | null) {
  const { getToken, isSignedIn } = useCurrentUser();
  return useQuery<string>({
    queryKey: ['lab-ref', labId, probe],
    queryFn: () => getReferenceCsv(labId!, probe!, getToken),
    enabled: isSignedIn && !!labId && !!probe,
    staleTime: Infinity,
  });
}

/** POST /api/labs/:id/attempts — open a new attempt. */
export function useCreateAttempt() {
  const { getToken } = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation<LabAttempt, Error, { labId: string }>({
    mutationFn: ({ labId }) => createAttempt(labId, getToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['labs'] });
    },
  });
}

/** PATCH /api/labs/attempts/:id/submit — finalize an attempt. */
export function useSubmitAttempt() {
  const { getToken } = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation<void, Error, { attemptId: string; score: number }>({
    mutationFn: ({ attemptId, score }) => submitAttempt(attemptId, score, getToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['labs'] });
    },
  });
}

/** POST /api/labs — create a new lab. */
export function useCreateLab() {
  const { getToken } = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation<{ id: string }, Error, { lab: Lab; courseId?: string | null }>({
    mutationFn: ({ lab, courseId = null }) => createLab(lab, courseId, getToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['labs'] });
    },
  });
}

/** PATCH /api/labs/:id — update lab JSON body + title. */
export function useUpdateLab() {
  const { getToken } = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation<{ id: string; updated_at: number }, Error, { id: string; lab: Lab }>({
    mutationFn: ({ id, lab }) => updateLab(id, lab, getToken),
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['labs'] });
      void queryClient.invalidateQueries({ queryKey: ['lab', vars.id] });
      void queryClient.invalidateQueries({ queryKey: ['lab-json', vars.id] });
    },
  });
}

/** POST /api/labs/:id/reference/:probe — upload a reference CSV. */
export function useUploadReference() {
  const { getToken } = useCurrentUser();
  return useMutation<void, Error, { labId: string; probe: string; csvText: string }>({
    mutationFn: ({ labId, probe, csvText }) => uploadReference(labId, probe, csvText, getToken),
  });
}

/** DELETE /api/labs/:id — owner deletes a lab. */
export function useDeleteLab() {
  const { getToken } = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => deleteLab(id, getToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['labs'] });
    },
  });
}
