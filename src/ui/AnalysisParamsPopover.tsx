/**
 * Floating popover for analysis parameter configuration.
 *
 * Per D-17: shows parameter fields based on selected analysis type.
 * Positioned below the toolbar parameters button.
 */

import { useCallback } from 'react';
import type { AnalysisConfig } from '@/circuit/types';
import { useCircuitStore } from '@/store/circuitStore';
import styles from './AnalysisParamsPopover.module.css';

interface AnalysisParamsPopoverProps {
  config: AnalysisConfig;
  onChange: (config: AnalysisConfig) => void;
  onClose: () => void;
}

export function AnalysisParamsPopover({
  config,
  onChange,
  onClose,
}: AnalysisParamsPopoverProps) {
  const circuit = useCircuitStore((s) => s.circuit);

  const update = useCallback(
    (patch: Partial<AnalysisConfig>) => {
      onChange({ ...config, ...patch });
    },
    [config, onChange]
  );

  // Get voltage source ref designators for DC sweep source dropdown
  const voltageSources = [...circuit.components.values()]
    .filter(
      (c) =>
        c.type === 'dc_voltage' ||
        c.type === 'ac_voltage' ||
        c.type === 'pulse_voltage' ||
        c.type === 'sin_voltage' ||
        c.type === 'pwl_voltage'
    )
    .map((c) => c.refDesignator);

  return (
    <div className={styles.popover}>
      <div className={styles.header}>
        <span className={styles.title}>Analysis Parameters</span>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close parameters"
        >
          ×
        </button>
      </div>

      <div className={styles.fields}>
        {config.type === 'transient' && (
          <>
            <FieldRow label="Stop Time">
              <input
                type="text"
                className={styles.input}
                value={config.stopTime ?? '10m'}
                onChange={(e) => update({ stopTime: e.target.value })}
                placeholder="e.g. 10m"
              />
            </FieldRow>
            <FieldRow label="Time Step (optional)">
              <input
                type="text"
                className={styles.input}
                value={config.timeStep ?? ''}
                onChange={(e) => update({ timeStep: e.target.value })}
                placeholder="e.g. 1u (auto)"
              />
            </FieldRow>
            <FieldRow label="Start Time (optional)">
              <input
                type="text"
                className={styles.input}
                value={config.startTime ?? ''}
                onChange={(e) => update({ startTime: e.target.value })}
                placeholder="e.g. 0"
              />
            </FieldRow>
          </>
        )}

        {config.type === 'ac' && (
          <>
            <FieldRow label="Start Frequency">
              <input
                type="text"
                className={styles.input}
                value={config.startFreq ?? '1'}
                onChange={(e) => update({ startFreq: e.target.value })}
                placeholder="e.g. 1"
              />
            </FieldRow>
            <FieldRow label="Stop Frequency">
              <input
                type="text"
                className={styles.input}
                value={config.stopFreq ?? '1MEG'}
                onChange={(e) => update({ stopFreq: e.target.value })}
                placeholder="e.g. 1MEG"
              />
            </FieldRow>
            <FieldRow label="Points per Decade">
              <input
                type="number"
                className={styles.input}
                value={config.pointsPerDecade ?? 100}
                min={1}
                max={1000}
                onChange={(e) =>
                  update({ pointsPerDecade: parseInt(e.target.value, 10) || 100 })
                }
              />
            </FieldRow>
          </>
        )}

        {config.type === 'dc_sweep' && (
          <>
            <FieldRow label="Source">
              <select
                className={styles.select}
                value={config.sweepSource ?? ''}
                onChange={(e) => update({ sweepSource: e.target.value })}
              >
                <option value="">Select source...</option>
                {voltageSources.map((ref) => (
                  <option key={ref} value={ref}>
                    {ref}
                  </option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Start Value">
              <input
                type="text"
                className={styles.input}
                value={config.sweepStart ?? '0'}
                onChange={(e) => update({ sweepStart: e.target.value })}
                placeholder="e.g. 0"
              />
            </FieldRow>
            <FieldRow label="Stop Value">
              <input
                type="text"
                className={styles.input}
                value={config.sweepStop ?? '5'}
                onChange={(e) => update({ sweepStop: e.target.value })}
                placeholder="e.g. 5"
              />
            </FieldRow>
            <FieldRow label="Step Size">
              <input
                type="text"
                className={styles.input}
                value={config.sweepStep ?? '0.1'}
                onChange={(e) => update({ sweepStep: e.target.value })}
                placeholder="e.g. 0.1"
              />
            </FieldRow>
          </>
        )}
      </div>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.fieldRow}>
      <label className={styles.label}>{label}</label>
      {children}
    </div>
  );
}
