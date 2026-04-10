import { useState } from 'react';
import styles from './Dashboard.module.css';

interface Props {
  isOpen: boolean;
  title: string;
  description: string;
  confirmName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  title,
  description,
  confirmName,
  onCancel,
  onConfirm,
  isDeleting,
}: Props) {
  const [typed, setTyped] = useState('');

  if (!isOpen) return null;

  async function handleConfirm() {
    await onConfirm();
    setTyped('');
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <p className={styles.modalDescription}>{description}</p>
        </div>

        <div className={styles.modalForm}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>
              Type <strong>{confirmName}</strong> to confirm
            </label>
            <input
              type="text"
              className={styles.formInput}
              placeholder={confirmName}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={isDeleting}
              autoFocus
            />
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={onCancel}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.buttonDanger}
              onClick={handleConfirm}
              disabled={typed !== confirmName || isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
