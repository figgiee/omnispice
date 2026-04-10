/**
 * Error panel component for the bottom tab panel.
 *
 * Displays simulation errors and validation warnings from the simulation store.
 * Clicking an error navigates to the problematic component on the canvas (D-21).
 */

import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { useSimulationStore } from '@/store/simulationStore';
import { useUiStore } from '@/store/uiStore';
import styles from './ErrorPanel.module.css';

export function ErrorPanel() {
  const errors = useSimulationStore((s) => s.errors);
  const validationErrors = useSimulationStore((s) => s.validationErrors);
  const setHighlightedComponentId = useUiStore((s) => s.setHighlightedComponentId);
  const setBottomTab = useUiStore((s) => s.setBottomTab);

  const totalCount = errors.length + validationErrors.length;

  // Empty state
  if (totalCount === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <CheckCircle size={16} className={styles.emptyIcon} />
          <span>No issues found.</span>
        </div>
      </div>
    );
  }

  const handleErrorClick = (componentId: string | undefined) => {
    if (!componentId) return;
    setHighlightedComponentId(componentId);
    // Keep Errors tab active so user can see it
    setBottomTab('errors');
  };

  return (
    <div className={styles.container}>
      {/* Simulation errors */}
      {errors.map((error, index) => (
        <div
          key={`sim-${index}`}
          className={styles.errorRow}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleErrorClick(undefined)}
        >
          <div className={styles.severityIcon}>
            <AlertCircle size={14} className={styles.errorIcon} />
          </div>
          <div className={styles.errorContent}>
            <div className={styles.errorMessage}>{error.message}</div>
          </div>
        </div>
      ))}

      {/* Validation errors/warnings */}
      {validationErrors.map((error, index) => {
        const primaryComponentId = error.componentIds[0];
        const isClickable = !!primaryComponentId;

        return (
          <div
            key={`val-${index}`}
            className={`${styles.errorRow} ${isClickable ? styles.clickable : ''}`}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={() => handleErrorClick(primaryComponentId)}
            onKeyDown={(e) =>
              e.key === 'Enter' && handleErrorClick(primaryComponentId)
            }
            title={isClickable ? 'Click to navigate to component' : undefined}
          >
            <div className={styles.severityIcon}>
              {error.severity === 'error' ? (
                <AlertCircle size={14} className={styles.errorIcon} />
              ) : (
                <AlertTriangle size={14} className={styles.warningIcon} />
              )}
            </div>
            <div className={styles.errorContent}>
              <div className={styles.errorMessage}>{error.message}</div>
              {error.suggestion && (
                <div className={styles.suggestion}>{error.suggestion}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
