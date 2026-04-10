import { Show, SignInButton, UserButton } from '@clerk/react';

/**
 * Renders a sign-in button (when signed out) or Clerk UserButton avatar (when signed in).
 * SignInButton uses mode="modal" so it overlays the canvas without navigating away.
 *
 * Uses Clerk v6 <Show when="signed-in/signed-out"> instead of the removed SignedIn/SignedOut.
 */
export function AuthModal() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            style={{
              background: 'var(--accent-primary)',
              color: 'var(--bg-primary)',
              border: 'none',
              borderRadius: 4,
              padding: '4px 12px',
              fontSize: 'var(--font-size-label)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}
