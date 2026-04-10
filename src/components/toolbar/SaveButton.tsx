import { Show, SignInButton } from '@clerk/react';
import { useState } from 'react';
import { useSaveCircuit } from '@/cloud/hooks';

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border-default)',
  borderRadius: 4,
  padding: '4px 10px',
  cursor: 'pointer',
  color: 'var(--text-primary)',
  fontSize: 'var(--font-size-label)',
  fontFamily: 'var(--font-body)',
};

const btnDisabledStyle: React.CSSProperties = {
  ...btnStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
};

/**
 * Save button in the toolbar.
 *
 * - When signed out: wraps a SignInButton so clicking opens the Clerk modal.
 * - When signed in: prompts for a circuit name, calls useSaveCircuit, shows
 *   brief "Saved" feedback on success.
 */
export function SaveButton() {
  const save = useSaveCircuit();
  const [savedBriefly, setSavedBriefly] = useState(false);

  function handleSave() {
    const name = window.prompt('Circuit name:', 'Untitled Circuit') ?? 'Untitled Circuit';
    save.mutate(
      { name },
      {
        onSuccess: () => {
          setSavedBriefly(true);
          setTimeout(() => setSavedBriefly(false), 2000);
        },
      },
    );
  }

  const label = save.isPending ? '...' : savedBriefly ? '✓ Saved' : 'Save';

  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button type="button" style={btnStyle}>
            Save
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <button
          type="button"
          onClick={handleSave}
          disabled={save.isPending}
          style={save.isPending ? btnDisabledStyle : btnStyle}
          title="Save circuit to cloud"
        >
          {label}
        </button>
      </Show>
    </>
  );
}
