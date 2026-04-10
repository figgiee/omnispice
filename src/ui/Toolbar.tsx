/**
 * Main application toolbar.
 *
 * Left: Logo + Undo/Redo
 * Right: Save + My Circuits + SimulationControls + Export + User
 *
 * Wire drawing is mode-free: click any pin to start a wire, click another pin to complete.
 * No wire tool needed — removed per user feedback.
 */

import { Show } from '@clerk/react';
import { RotateCcw, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { CircuitDashboard } from '@/components/dashboard/CircuitDashboard';
import { ExportMenu } from '@/components/toolbar/ExportMenu';
import { SaveButton } from '@/components/toolbar/SaveButton';
import { UserMenu } from '@/components/toolbar/UserMenu';
import { ImportMenu } from '@/ltspice/ImportMenu';
import type { SimulationController } from '@/simulation/controller';
import { useCircuitStore } from '@/store/circuitStore';
import { OverlayToggle } from './OverlayToggle';
import { SimulationControls } from './SimulationControls';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  controller: SimulationController | null;
}

export function Toolbar({ controller }: ToolbarProps) {
  const [dashboardOpen, setDashboardOpen] = useState(false);

  const handleUndo = () => {
    useCircuitStore.temporal.getState().undo();
  };

  const handleRedo = () => {
    useCircuitStore.temporal.getState().redo();
  };

  return (
    <>
      <div className={styles.toolbar} data-testid="toolbar">
        {/* Left group: Logo + Undo/Redo */}
        <div className={styles.group}>
          <div className={styles.logo} role="img" aria-label="OmniSpice">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="var(--accent-primary)" strokeWidth="2" />
              <polyline
                points="6,14 9,10 12,13 15,8 18,11"
                stroke="var(--accent-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className={styles.logoText}>OmniSpice</span>
          </div>

          <div className={styles.divider} aria-hidden="true" />

          <button
            type="button"
            className={styles.toolBtn}
            onClick={handleUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={handleRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <RotateCw size={16} />
          </button>
          <ImportMenu />
        </div>

        {/* Right group */}
        <div className={`${styles.group} ${styles.right}`}>
          <SaveButton />
          <Show when="signed-in">
            <button
              type="button"
              onClick={() => setDashboardOpen(true)}
              style={{
                background: 'none',
                border: '1px solid var(--border-default)',
                borderRadius: 4,
                padding: '4px 10px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-label)',
                fontFamily: 'var(--font-body)',
              }}
              title="View saved circuits"
            >
              My Circuits
            </button>
          </Show>
          <OverlayToggle />
          <SimulationControls controller={controller} />
          <ExportMenu />
          <UserMenu />
        </div>
      </div>

      <CircuitDashboard isOpen={dashboardOpen} onClose={() => setDashboardOpen(false)} />
    </>
  );
}
