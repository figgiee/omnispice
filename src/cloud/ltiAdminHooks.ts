import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '../auth/useCurrentUser';
import {
  listPlatforms,
  createPlatform,
  deletePlatform,
  type CreateLtiPlatformInput,
  type LtiPlatform,
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
