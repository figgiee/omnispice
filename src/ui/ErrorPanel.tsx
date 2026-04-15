/**
 * Error panel component for the bottom tab panel.
 *
 * Displays simulation errors and validation warnings from the simulation store.
 * Clicking an error navigates to the problematic component on the canvas (D-21).
 * Auto-fix buttons appear for errors that have a known fix strategy.
 */

import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import type { ValidationError } from '@/circuit/validator';
import { useCircuitStore } from '@/store/circuitStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useUiStore } from '@/store/uiStore';
import styles from './ErrorPanel.module.css';

// ---------------------------------------------------------------------------
// Auto-fix strategies
// ---------------------------------------------------------------------------

/** Place a ground below the lowest ungrounded component and wire a free pin to it. */
function autoFixNoGround() {
  const { circuit, addComponent, addWire } = useCircuitStore.getState();

  const connectedPortIds = new Set(
    [...circuit.wires.values()].flatMap((w) => [w.sourcePortId, w.targetPortId]),
  );

  let targetComp: { portId: string; position: { x: number; y: number } } | null = null;
  let maxY = -Infinity;

  for (const [, comp] of circuit.components) {
    if (comp.type === 'ground') continue;
    const freePort = comp.ports.find((p) => !connectedPortIds.has(p.id)) ?? comp.ports[0];
    if (!freePort) continue;
    if (comp.position.y > maxY) {
      maxY = comp.position.y;
      targetComp = { portId: freePort.id, position: comp.position };
    }
  }

  const groundPos = targetComp
    ? { x: targetComp.position.x, y: targetComp.position.y + 60 }
    : { x: 100, y: 80 };

  const groundId = addComponent('ground', groundPos);

  if (targetComp) {
    const groundPort = useCircuitStore.getState().circuit.components.get(groundId)?.ports[0];
    if (groundPort) {
      addWire(targetComp.portId, groundPort.id);
    }
  }
}

function getAutoFix(error: ValidationError): (() => void) | null {
  if (error.type === 'no_ground') return autoFixNoGround;
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ErrorPanel() {
  const errors = useSimulationStore((s) => s.errors);
  const validationErrors = useSimulationStore((s) => s.validationErrors);
  const setHighlightedComponentId = useUiStore((s) => s.setHighlightedComponentId);
  const setBottomTab = useUiStore((s) => s.setBottomTab);

  const totalCount = errors.length + validationErrors.length;

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
    setBottomTab('errors');
  };

  return (
    <div className={styles.container}>
      {/* Simulation errors (no auto-fix available) */}
      {errors.map((error) => (
        <div key={error.message} className={styles.errorRow}>
          <div className={styles.severityIcon}>
            <AlertCircle size={14} className={styles.errorIcon} />
          </div>
          <div className={styles.errorContent}>
            <div className={styles.errorMessage}>{error.message}</div>
          </div>
        </div>
      ))}

      {/* Validation errors/warnings */}
      {validationErrors.map((error) => {
        const primaryComponentId = error.componentIds[0];
        const fix = getAutoFix(error);

        return (
          <div
            key={`${error.type}-${error.componentIds.join('-')}`}
            className={`${styles.errorRow} ${primaryComponentId ? styles.clickable : ''}`}
          >
            <div className={styles.severityIcon}>
              {error.severity === 'error' ? (
                <AlertCircle size={14} className={styles.errorIcon} />
              ) : (
                <AlertTriangle size={14} className={styles.warningIcon} />
              )}
            </div>
            <button
              type="button"
              className={styles.errorContent}
              onClick={() => handleErrorClick(primaryComponentId)}
              disabled={!primaryComponentId}
              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: primaryComponentId ? 'pointer' : 'default' }}
            >
              <div className={styles.errorMessage}>{error.message}</div>
              {error.suggestion && <div className={styles.suggestion}>{error.suggestion}</div>}
            </button>
            {fix && (
              <button type="button" className={styles.fixBtn} onClick={fix}>
                Auto-fix
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
