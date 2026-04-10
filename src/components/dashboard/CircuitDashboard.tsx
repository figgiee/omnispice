import { useCircuits, useLoadCircuit } from '@/cloud/hooks';

interface CircuitDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Overlay panel listing the user's saved circuits.
 * Selecting a circuit loads it into the editor and closes the panel.
 */
export function CircuitDashboard({ isOpen, onClose }: CircuitDashboardProps) {
  const { data: circuits, isLoading } = useCircuits();
  const load = useLoadCircuit();

  if (!isOpen) return null;

  function handleLoad(id: string) {
    load.mutate(id, { onSuccess: onClose });
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
          minWidth: 480,
          maxWidth: 640,
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
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
            My Circuits
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

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {isLoading && (
            <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)' }}>
              Loading...
            </p>
          )}

          {!isLoading && (!circuits || circuits.length === 0) && (
            <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)' }}>
              No saved circuits yet. Click Save to store your first circuit.
            </p>
          )}

          {circuits && circuits.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {circuits.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--surface-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 4,
                    padding: '8px 12px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--font-size-body)',
                        fontWeight: 'var(--font-weight-semibold)',
                      }}
                    >
                      {c.name}
                    </div>
                    <div
                      style={{
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--font-size-label)',
                        marginTop: 2,
                      }}
                    >
                      {new Date(c.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLoad(c.id)}
                    disabled={load.isPending}
                    style={{
                      background: 'var(--accent-primary)',
                      color: 'var(--bg-primary)',
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 14px',
                      cursor: load.isPending ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--font-size-label)',
                      opacity: load.isPending ? 0.6 : 1,
                    }}
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
