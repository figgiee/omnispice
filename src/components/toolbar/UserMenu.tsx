import { AuthModal } from '@/auth/AuthModal';

/**
 * Toolbar section for user auth state.
 * Renders AuthModal (sign-in button or avatar) in the right side of the toolbar.
 * Exported for use by the toolbar layout component.
 */
export function UserMenu() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        paddingRight: 'var(--space-lg)',
      }}
    >
      <AuthModal />
    </div>
  );
}
