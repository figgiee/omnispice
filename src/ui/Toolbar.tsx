/**
 * Main application toolbar.
 *
 * Per UI-SPEC Toolbar Layout:
 * - Left: Logo + tool selection (Select/Wire)
 * - Center: Undo/Redo
 * - Right: SimulationControls
 */

import { MousePointer2, Minus, RotateCcw, RotateCw } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useCircuitStore } from '@/store/circuitStore';
import { SimulationControls } from './SimulationControls';
import type { SimulationController } from '@/simulation/controller';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  controller: SimulationController | null;
}

export function Toolbar({ controller }: ToolbarProps) {
  const activeTool = useUiStore((s) => s.activeTool);
  const setActiveTool = useUiStore((s) => s.setActiveTool);

  const handleUndo = () => {
    useCircuitStore.temporal.getState().undo();
  };

  const handleRedo = () => {
    useCircuitStore.temporal.getState().redo();
  };

  return (
    <div className={styles.toolbar}>
      {/* Left group: Logo + tool selection */}
      <div className={styles.group}>
        <div className={styles.logo} aria-label="OmniSpice">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
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

        {/* Pointer tool */}
        <button
          type="button"
          className={`${styles.toolBtn} ${activeTool === 'select' ? styles.active : ''}`}
          onClick={() => setActiveTool('select')}
          title="Select (V)"
          aria-label="Select tool"
          aria-pressed={activeTool === 'select'}
        >
          <MousePointer2 size={16} />
        </button>

        {/* Wire tool */}
        <button
          type="button"
          className={`${styles.toolBtn} ${activeTool === 'wire' ? styles.active : ''}`}
          onClick={() => setActiveTool('wire')}
          title="Draw Wire (W)"
          aria-label="Wire tool"
          aria-pressed={activeTool === 'wire'}
        >
          <Minus size={16} />
        </button>
      </div>

      {/* Center group: Undo/Redo */}
      <div className={styles.group}>
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
      </div>

      {/* Right group: Simulation controls */}
      <div className={`${styles.group} ${styles.right}`}>
        <SimulationControls controller={controller} />
      </div>
    </div>
  );
}
