/**
 * Breadcrumb — Phase 5 Pillar 1 Part 2 (Plan 05-03).
 *
 * Top-of-canvas breadcrumb bar for hierarchy navigation. Shows `Home ▸
 * {subName}` while the user is descended into a subcircuit; renders
 * nothing at the top level.
 *
 * Clicking "Home" or pressing Esc (wired by `useCanvasInteractions`)
 * ascends to the parent. Per UI-SPEC §7.12 the bar is 28px tall with
 * a `--bg-secondary` background and a border-bottom.
 */

import { useCircuitStore } from '@/store/circuitStore';
import { useUiStore } from '@/store/uiStore';
import styles from './Breadcrumb.module.css';

export function Breadcrumb() {
  const currentSubId = useUiStore((s) => s.currentSubcircuitId);
  const ascend = useUiStore((s) => s.ascendSubcircuit);
  const subName = useCircuitStore((s) =>
    currentSubId ? (s.circuit.components.get(currentSubId)?.subcircuitName ?? null) : null,
  );

  if (!currentSubId || !subName) return null;

  return (
    <nav
      className={styles.breadcrumb}
      role="navigation"
      aria-label="Circuit hierarchy"
      data-testid="subcircuit-breadcrumb"
    >
      <button
        type="button"
        onClick={ascend}
        className={styles.home}
        aria-label="Ascend to top level"
      >
        Home
      </button>
      <span className={styles.separator} aria-hidden="true">
        ▸
      </span>
      <span className={styles.current}>{subName}</span>
    </nav>
  );
}
