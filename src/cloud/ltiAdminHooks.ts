import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '../auth/useCurrentUser';
import {
  type CreateLtiPlatformInput,
  createPlatform,
  deletePlatform,
  embedInLms,
  type LtiPlatform,
  listPlatforms,
} from './ltiAdminApi';

/** List all registered LTI platforms (instructor-only endpoint). */
export function useLtiPlatforms() {
  const { getToken, isSignedIn } = useCurrentUser();
  return useQuery<LtiPlatform[]>({
    queryKey: ['ltiPlatforms'],
    queryFn: () => listPlatforms(getToken),
    enabled: isSignedIn,
    staleTime: 60_000,
  });
}

/** Create a new LTI platform registration. */
export function useCreatePlatform() {
  const { getToken } = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLtiPlatformInput) => createPlatform(input, getToken),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ltiPlatforms'] });
    },
  });
}

/** Delete a registered LTI platform. */
export function useDeletePlatform() {
  const { getToken } = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ iss, clientId }: { iss: string; clientId: string }) =>
      deletePlatform(iss, clientId, getToken),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ltiPlatforms'] });
    },
  });
}

/**
 * Submit selected assignments to the current LMS via Deep Linking response.
 * The returned HTML must be written into the window to fire the auto-submit form.
 */
export function useEmbedInLms() {
  return useMutation({
    mutationFn: ({ launchId, assignmentIds }: { launchId: string; assignmentIds: string[] }) =>
      embedInLms({ launchId, assignmentIds }),
  });
}
