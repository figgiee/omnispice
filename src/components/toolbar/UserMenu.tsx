import { useUser } from '@clerk/react';
import { useState } from 'react';
import { AuthModal } from '@/auth/AuthModal';
import { useBecomeInstructor, useRole } from '@/auth/useRole';

/**
 * Toolbar section for user auth state.
 * Renders AuthModal (sign-in button or avatar) + instructor toggle when signed in.
 * Exported for use by the toolbar layout component.
 */
export function UserMenu() {
  const { user, isSignedIn } = useUser();
  const role = useRole();
  const becomeInstructor = useBecomeInstructor();
  const [loading, setLoading] = useState(false);

  async function handleBecomeInstructor() {
    setLoading(true);
    try {
      await becomeInstructor();
      // Force a hard reload so the Dashboard re-evaluates with new role
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        paddingRight: 'var(--space-lg)',
      }}
    >
      {isSignedIn && user && (
        <>
          <a
            href="/dashboard"
            style={{
              color: 'var(--text-primary)',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Dashboard
          </a>
          {role === 'student' && (
            <button
              type="button"
              onClick={handleBecomeInstructor}
              disabled={loading}
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 4,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.color = 'var(--accent-primary)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              title="Self-declare instructor role — no approval required"
            >
              {loading ? 'Promoting...' : 'Become an Instructor'}
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({role})</span>
        </>
      )}
      <AuthModal />
    </div>
  );
}
