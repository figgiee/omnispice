import { RenderedInstructions } from './RenderedInstructions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  instructions: string | null;
  dueAt: number | null;
}

export function InstructionsDrawer({ isOpen, onClose, title, instructions, dueAt }: Props) {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 400,
        background: 'var(--bg-elevated)',
        borderLeft: '1px solid var(--border-default)',
        padding: 24,
        overflowY: 'auto',
        zIndex: 500,
        boxShadow: '-4px 0 12px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close instructions"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 20,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>
      {dueAt && (
        <div
          style={{
            background: 'var(--surface-primary)',
            borderRadius: 4,
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--text-secondary)',
            marginBottom: 16,
          }}
        >
          Due: {new Date(dueAt).toLocaleString()}
        </div>
      )}
      {instructions ? (
        <RenderedInstructions markdown={instructions} />
      ) : (
        <p style={{ color: 'var(--text-secondary)' }}>No instructions provided.</p>
      )}
    </div>
  );
}
