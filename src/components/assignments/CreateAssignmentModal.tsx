import { useState } from 'react';
import { useCreateAssignment } from '@/cloud/classroomHooks';
import { useCircuitStore } from '@/store/circuitStore';
import { serializeCircuit } from '@/cloud/serialization';
import styles from '@/components/classroom/Dashboard.module.css';

interface Props {
  courseId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (assignmentId: string) => void;
}

/**
 * Per D-14, D-15: starter source is the currently-loaded editor circuit (option (a)).
 * File-upload option (b) is deferred — professors can load an .asc via the existing
 * ImportMenu and THEN create the assignment. This keeps Plan 06 scope tight.
 */
export function CreateAssignmentModal({ courseId, isOpen, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState('');
  const createAssignment = useCreateAssignment();
  const circuit = useCircuitStore((s) => s.circuit);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const starterCircuit = serializeCircuit(circuit);
    const dueTimestamp = dueAt ? new Date(dueAt).getTime() : null;
    const result = await createAssignment.mutateAsync({
      courseId,
      input: {
        title: title.trim(),
        instructions: instructions.trim() || undefined,
        starterCircuit,
        due_at: dueTimestamp,
      },
    });
    setTitle('');
    setInstructions('');
    setDueAt('');
    onCreated?.(result.id);
    onClose();
  }

  const componentCount = circuit.components.size;

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalPanel} onClick={(e) => e.stopPropagation()} style={{ minWidth: 520 }}>
        <h2 className={styles.modalTitle}>New Assignment</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <label className={styles.label}>Title</label>
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Instructions (Markdown supported)</label>
            <textarea
              className={styles.input}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={8}
              placeholder="# Lab 1&#10;&#10;Build a voltage divider that outputs 3.3V from a 5V source..."
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13, resize: 'vertical' }}
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Due date (optional)</label>
            <input
              className={styles.input}
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Starter circuit</label>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Using the currently-loaded editor circuit ({componentCount} component{componentCount === 1 ? '' : 's'}).
              Close this modal and load a different circuit first if that's not what you want.
            </div>
          </div>
          {createAssignment.isError && (
            <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{createAssignment.error?.message}</p>
          )}
          <div className={styles.buttonRow}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={styles.ctaButton}
              disabled={createAssignment.isPending}
              style={{ cursor: createAssignment.isPending ? 'not-allowed' : 'pointer' }}
            >
              {createAssignment.isPending ? 'Creating...' : 'Create Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
