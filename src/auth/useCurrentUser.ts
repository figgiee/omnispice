import { useUser, useAuth } from '@clerk/react';

export interface CurrentUser {
  id: string;
  firstName: string | null;
  email: string;
}

export interface UseCurrentUserReturn {
  user: CurrentUser | null;
  isSignedIn: boolean;
  isLoaded: boolean;
  /** Returns a Bearer token for API calls; null if not signed in */
  getToken: () => Promise<string | null>;
}

export function useCurrentUser(): UseCurrentUserReturn {
  const { user, isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();

  return {
    user: user
      ? {
          id: user.id,
          firstName: user.firstName,
          email: user.emailAddresses[0]?.emailAddress ?? '',
        }
      : null,
    isSignedIn: isSignedIn ?? false,
    isLoaded,
    getToken,
  };
}
