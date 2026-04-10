import { useUser, useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';

export type Role = 'instructor' | 'student';

/**
 * Read the current user's role from Clerk publicMetadata.
 * Defaults to 'student' when undefined (pilot trust model per D-01).
 */
export function useRole(): Role {
  const { user } = useUser();
  const raw = user?.publicMetadata?.role;
  return raw === 'instructor' ? 'instructor' : 'student';
}

/**
 * Flip the current user's role to 'instructor' via Worker endpoint,
 * then force-refresh the Clerk JWT to pick up the new custom claim (Pitfall 1).
 */
export function useBecomeInstructor() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

  return async (): Promise<void> => {
    const token = await getToken();
    const res = await fetch(`${apiBase}/api/me/become-instructor`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to become instructor: ${res.status}`);
    }
    // Reload publicMetadata from Clerk and force a fresh JWT (Pitfall 1).
    await user?.reload();
    await getToken({ skipCache: true });
    // Invalidate classroom-dependent queries so dashboard re-renders as instructor.
    queryClient.invalidateQueries({ queryKey: ['courses'] });
  };
}
