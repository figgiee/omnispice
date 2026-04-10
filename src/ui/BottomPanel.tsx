/**
 * Bottom panel with tabbed interface: Errors, Waveform, Properties.
 *
 * Per UI-SPEC Bottom Panel Tabs. Auto-switches tabs based on simulation state:
 * - Simulation complete -> Waveform tab
 * - Simulation error -> Errors tab
 * - Component selected -> Properties tab
 */

import { useEffect } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { useUiStore } from '@/store/uiStore';
import { ErrorPanel } from './ErrorPanel';
import { WaveformViewer } from '@/waveform/WaveformViewer';
import { BodePlot } from '@/waveform/BodePlot';
import { PropertyPanel } from './PropertyPanel';
import type { SimulationController } from '@/simulation/controller';
import styles from './BottomPanel.module.css';

interface BottomPanelProps {
  controller: SimulationController | null;
}

const TABS = [
  { id: 'errors', label: 'Errors' },
  { id: 'waveform', label: 'Waveform' },
  { id: 'properties', label: 'Properties' },
] as const;

export function BottomPanel({ controller }: BottomPanelProps) {
  const bottomTab = useUiStore((s) => s.bottomTab);
  const setBottomTab = useUiStore((s) => s.setBottomTab);
  const selectedComponentIds = useUiStore((s) => s.selectedComponentIds);

  const status = useSimulationStore((s) => s.status);
  const errors = useSimulationStore((s) => s.errors);
  const validationErrors = useSimulationStore((s) => s.validationErrors);
  const analysisConfig = useSimulationStore((s) => s.analysisConfig);

  // Auto-switch tabs based on simulation state (per UI-SPEC State Contracts)
  useEffect(() => {
    if (status === 'complete') {
      setBottomTab('waveform');
    }
  }, [status, setBottomTab]);

  useEffect(() => {
    if (status === 'error' || errors.length > 0 || validationErrors.length > 0) {
      if (status === 'error') {
        setBottomTab('errors');
      }
    }
  }, [status, errors.length, validationErrors.length, setBottomTab]);

  useEffect(() => {
    if (selectedComponentIds.length > 0) {
      setBottomTab('properties');
    }
  }, [selectedComponentIds, setBottomTab]);

  const isAcAnalysis = analysisConfig.type === 'ac';

  // Error badge count
  const errorCount = errors.length + validationErrors.length;

  return (
    <div className={styles.panel}>
      {/* Tab bar */}
      <div className={styles.tabBar} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={bottomTab === tab.id}
            className={`${styles.tab} ${bottomTab === tab.id ? styles.active : ''}`}
            onClick={() => setBottomTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'errors' && errorCount > 0 && (
              <span className={styles.badge}>{errorCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={styles.content}>
        {bottomTab === 'errors' && <ErrorPanel />}
        {bottomTab === 'waveform' && (
          isAcAnalysis ? <BodePlot /> : <WaveformViewer />
        )}
        {bottomTab === 'properties' && (
          <PropertyPanel controller={controller} />
        )}
      </div>
    </div>
  );
}
