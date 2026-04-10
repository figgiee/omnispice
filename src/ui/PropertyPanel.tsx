/**
 * Property panel for the bottom tab panel.
 *
 * Shows selected component properties: type, ref designator, value,
 * rotation, SPICE model. Includes SPICE model import (COMP-08).
 */

import { useRef, useCallback } from 'react';
import { useUiStore } from '@/store/uiStore';
import { useCircuitStore } from '@/store/circuitStore';
import { COMPONENT_LIBRARY } from '@/circuit/componentLibrary';
import type { SimulationController } from '@/simulation/controller';
import styles from './PropertyPanel.module.css';

interface PropertyPanelProps {
  controller: SimulationController | null;
}

export function PropertyPanel({ controller }: PropertyPanelProps) {
  const selectedComponentIds = useUiStore((s) => s.selectedComponentIds);
  const circuit = useCircuitStore((s) => s.circuit);
  const updateComponentValue = useCircuitStore((s) => s.updateComponentValue);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedId = selectedComponentIds[0];
  const component = selectedId ? circuit.components.get(selectedId) : null;

  const handleImportModel = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !controller) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target?.result as string;
        if (content && controller) {
          controller.loadModel(file.name, content);
        }
      };
      reader.readAsText(file);

      // Reset input so same file can be re-selected
      e.target.value = '';
    },
    [controller]
  );

  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedId) return;
      updateComponentValue(selectedId, e.target.value);
    },
    [selectedId, updateComponentValue]
  );

  // Empty state when no component selected
  if (!component) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          Select a component to view its properties.
        </div>
      </div>
    );
  }

  const def = COMPONENT_LIBRARY[component.type];
  const hasValue = def && def.defaultValue !== '';
  const hasModel = component.spiceModel || def?.defaultModel;

  // Source types with extra parameters
  const isSource =
    component.type === 'dc_voltage' ||
    component.type === 'ac_voltage' ||
    component.type === 'pulse_voltage' ||
    component.type === 'sin_voltage' ||
    component.type === 'pwl_voltage' ||
    component.type === 'dc_current' ||
    component.type === 'ac_current';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.refDesignator}>{component.refDesignator}</span>
        <span className={styles.componentType}>{def?.name ?? component.type}</span>
      </div>

      <div className={styles.fieldGroup}>
        {hasValue && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="prop-value">
              Value
            </label>
            <input
              id="prop-value"
              type="text"
              className={styles.input}
              value={component.value}
              onChange={handleValueChange}
            />
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>Rotation</label>
          <span className={styles.readonlyValue}>{component.rotation}°</span>
        </div>

        {hasModel && (
          <div className={styles.field}>
            <label className={styles.label}>SPICE Model</label>
            <span className={styles.readonlyValue}>
              {component.spiceModel ?? def?.defaultModel ?? '—'}
            </span>
          </div>
        )}

        {isSource && component.parameters && (
          <div className={styles.parametersSection}>
            <div className={styles.sectionTitle}>Parameters</div>
            {Object.entries(component.parameters).map(([key, val]) => (
              <div key={key} className={styles.field}>
                <label className={styles.label}>{key}</label>
                <span className={styles.readonlyValue}>{val}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SPICE model import (COMP-08) */}
      <div className={styles.importSection}>
        <button
          type="button"
          className={styles.importBtn}
          onClick={handleImportModel}
          title="Import a .mod or .lib SPICE model file"
        >
          Import Model (.mod / .lib)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mod,.lib,.sp,.spice"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
