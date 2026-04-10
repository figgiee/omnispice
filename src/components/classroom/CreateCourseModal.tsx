import { useState } from 'react';
import { useCreateCourse } from '@/cloud/classroomHooks';
import styles from './Dashboard.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (courseId: string) => void;
}

export function CreateCourseModal({ isOpen, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [term, setTerm] = useState('');
  const createCourse = useCreateCourse();

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const res = await createCourse.mutateAsync({
        name: name.trim(),
        term: term.trim() || undefined,
      });
      setName('');
      setTerm('');
      onCreated(res.id);
    } catch (err) {
      console.error('Failed to create course:', err);
    }
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Create a new course</h2>
          <p className={styles.modalDescription}>Give your course a name and optional term/semester.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Course Name *</label>
            <input
              type="text"
              className={styles.formInput}
              placeholder="e.g., EE101 Circuit Analysis"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={createCourse.isPending}
              autoFocus
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Term / Semester (optional)</label>
            <input
              type="text"
              className={styles.formInput}
              placeholder="e.g., Spring 2026"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              disabled={createCourse.isPending}
            />
          </div>

          {createCourse.isError && (
            <div className={styles.error}>
              {(createCourse.error as Error).message || 'Failed to create course'}
            </div>
          )}

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={onClose}
              disabled={createCourse.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.buttonPrimary}
              disabled={!name.trim() || createCourse.isPending}
            >
              {createCourse.isPending ? 'Creating...' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
