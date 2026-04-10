import { useEffect, useState } from 'react';
import { useShareCircuit } from '@/cloud/hooks';

interface ShareModalProps {
  circuitId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal for generating and copying a shareable read-only link.
 *
 * On open it calls useShareCircuit (idempotent — returns existing token if already set).
 * Displays the URL in a readonly input with a copy-to-clipboard button.
 * Closes on backdrop click.
 */
export function ShareModal({ circuitId, isOpen, onClose }: ShareModalProps) {
  const shareMutation = useShareCircuit();
  const [copied, setCopied] = useState(false);

  // Trigger share URL generation when the modal opens
  useEffect(() => {
    if (isOpen && !shareMutation.data) {
      shareMutation.mutate(circuitId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, circuitId]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shareUrl = shareMutation.data?.shareUrl ?? '';

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          padding: 24,
          minWidth: 420,
          maxWidth: 560,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              color: 'var(--text-primary)',
              fontSize: 'var(--font-size-heading)',
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-semibold)',
              margin: 0,
            }}
          >
            Share Circuit
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '2px 6px',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {shareMutation.isPending && (
          <p
            style={{
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--font-size-body)',
            }}
          >
            Generating link...
          </p>
        )}

        {shareUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              readOnly
              value={shareUrl}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--surface-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 4,
                padding: '8px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--font-size-mono)',
              }}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={() => void handleCopy()}
              style={{
                alignSelf: 'flex-start',
                background: 'var(--accent-primary)',
                color: 'var(--bg-primary)',
                border: 'none',
                borderRadius: 4,
                padding: '6px 16px',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--font-size-label)',
                fontWeight: 'var(--font-weight-semibold)',
              }}
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        )}

        {shareMutation.isError && (
          <p
            style={{
              color: 'var(--color-error)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--font-size-body)',
            }}
          >
            Failed to generate share link. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}
