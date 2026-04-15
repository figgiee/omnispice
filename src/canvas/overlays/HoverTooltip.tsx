/**
 * HoverTooltip — V/I/P readout for the hovered React Flow node.
 *
 * Plan 05-07 — this is the S7 immediacy surface: the student hovers a
 * component for 300ms and a floating tooltip shows the DC op-point
 * voltage, current, and power at that component, plus a status line
 * indicating whether the reading is live, computing, stale, or failed.
 *
 * ## Why delegated event listeners (not onMouseEnter props)
 *
 * React Flow renders node components behind its own wrapper element,
 * and wiring `onMouseEnter` through every single `ComponentNode` would
 * add ~20 props to every node type we already have. Instead we attach
 * a single `mouseover`/`mouseout` pair to `document`, filter by
 * `.react-flow__node` ancestry, and read the node's `data-id` attribute
 * — which React Flow always sets on the DOM node (stable API).
 *
 * ## Why not `@floating-ui/react`
 *
 * The plan referenced `@floating-ui/react` as "already installed in
 * Plan 05-05", but that dependency was never actually added to
 * package.json. Rather than pull in another dependency for a simple
 * cursor-anchored tooltip, we use a fixed-position div with a 12px
 * offset from the hovered node's bounding rect — this avoids the
 * middleware ceremony (flip/shift/autoUpdate) and is easier to test.
 * If future tooltip placements need richer collision avoidance the
 * swap is ~10 lines.
 *
 * ## Accessibility
 *
 * - `role="tooltip"` + `aria-live="polite"` on the status text so AT
 *   users get the simulation status without focus-stealing
 * - `prefers-reduced-motion` short-circuits the fade via CSS media query
 */

import { useEffect, useRef, useState } from 'react';
import { useOverlayStore } from '@/overlay/overlayStore';
import { useCircuitStore } from '@/store/circuitStore';
import { formatValue } from '@/waveform/measurements';
import styles from './HoverTooltip.module.css';

/** Hover delay before the tooltip appears — per UI-SPEC §7.7. */
const HOVER_DELAY_MS = 300;
/** Fade-out delay after mouse leaves — stays in DOM long enough for CSS fade. */
const HIDE_DELAY_MS = 100;
/** Pixel offset from the hovered node's bounding rect. */
const OFFSET_PX = 12;

/**
 * Mirrors the hover gesture contract in one place so the E2E spec and
 * the implementation cannot drift. Exported for tests.
 */
export const HOVER_TOOLTIP_TEST_ID = 'hover-tooltip';

type SimStatus = ReturnType<typeof useOverlayStore.getState>['simStatus'];

interface StatusPresentation {
  text: string;
  className: string;
  stale: boolean;
}

function presentStatus(status: SimStatus): StatusPresentation {
  switch (status) {
    case 'live':
      return { text: 'DC op: live', className: styles.statusLive ?? '', stale: false };
    case 'computing':
      return {
        text: 'DC op: computing…',
        className: styles.statusComputing ?? '',
        stale: false,
      };
    case 'error':
      return {
        text: 'DC op: no solution',
        className: styles.statusError ?? '',
        stale: false,
      };
    case 'stale':
      return {
        text: 'Transient: last committed',
        className: styles.statusMuted ?? '',
        stale: true,
      };
    default:
      return { text: 'DC op: not run', className: styles.statusMuted ?? '', stale: false };
  }
}

interface HoverState {
  nodeId: string;
  rect: DOMRect;
}

export function HoverTooltip() {
  const [hover, setHover] = useState<HoverState | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearEnter() {
      if (enterTimerRef.current !== null) {
        clearTimeout(enterTimerRef.current);
        enterTimerRef.current = null;
      }
    }
    function clearHide() {
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }

    function onMouseOver(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;
      const nodeEl = target.closest('.react-flow__node') as HTMLElement | null;
      if (!nodeEl) return;
      const nodeId = nodeEl.getAttribute('data-id');
      if (!nodeId) return;

      // Re-entering the same hovered node should not reset the delay.
      if (hover?.nodeId === nodeId) {
        clearHide();
        return;
      }

      clearEnter();
      clearHide();
      enterTimerRef.current = setTimeout(() => {
        const rect = nodeEl.getBoundingClientRect();
        setHover({ nodeId, rect });
        enterTimerRef.current = null;
      }, HOVER_DELAY_MS);
    }

    function onMouseOut(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;
      const nodeEl = target.closest('.react-flow__node') as HTMLElement | null;
      if (!nodeEl) return;
      const related = e.relatedTarget as Element | null;
      // Moving from one pixel of the node to another still fires mouseout
      // on the inner element — ignore when the relatedTarget is still
      // inside the same React Flow node.
      if (related && typeof related.closest === 'function') {
        const relatedNode = related.closest('.react-flow__node') as HTMLElement | null;
        if (relatedNode === nodeEl) return;
      }
      clearEnter();
      clearHide();
      hideTimerRef.current = setTimeout(() => {
        setHover(null);
        hideTimerRef.current = null;
      }, HIDE_DELAY_MS);
    }

    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('mouseout', onMouseOut);
    return () => {
      document.removeEventListener('mouseover', onMouseOver);
      document.removeEventListener('mouseout', onMouseOut);
      clearEnter();
      clearHide();
    };
  }, [hover?.nodeId]);

  const component = useCircuitStore((s) =>
    hover ? s.circuit.components.get(hover.nodeId) : null,
  );
  const simStatus = useOverlayStore((s) => s.simStatus);
  const nodeVoltages = useOverlayStore((s) => s.nodeVoltages);
  const branchCurrents = useOverlayStore((s) => s.branchCurrents);

  if (!hover || !component) return null;

  const presentation = presentStatus(simStatus);

  // Derive V/I/P from overlayStore. The first port's net determines the
  // node-side voltage we report; branch current is keyed by the SPICE
  // reference designator (upper-cased, matching the orchestrator's
  // overlay writer). Power = |V * I|.
  const firstPort = component.ports[0];
  const netName = firstPort?.netId;
  const voltage = netName !== null && netName !== undefined ? nodeVoltages[netName] : undefined;
  const current = branchCurrents[component.refDesignator];
  const power =
    voltage !== undefined && current !== undefined ? voltage * current : undefined;

  const valueClass = presentation.stale ? styles.valueStale : styles.value;

  // Anchor: 12px right + 12px below the hovered node's top-right corner.
  // `position: fixed` in CSS means these coordinates are viewport-space.
  const left = hover.rect.right + OFFSET_PX;
  const top = hover.rect.top + OFFSET_PX;

  return (
    <div
      className={styles.tooltip}
      style={{ left, top }}
      role="tooltip"
      data-testid={HOVER_TOOLTIP_TEST_ID}
      data-node-id={hover.nodeId}
    >
      <div className={styles.refDesignator}>{component.refDesignator}</div>
      <div className={styles.row}>
        <span className={styles.label}>V</span>
        <span className={valueClass}>
          {voltage !== undefined ? formatValue(voltage, 'V') : '—'}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>I</span>
        <span className={valueClass}>
          {current !== undefined ? formatValue(current, 'A') : '—'}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>P</span>
        <span className={valueClass}>
          {power !== undefined ? formatValue(power, 'W') : '—'}
        </span>
      </div>
      <div className={`${styles.status} ${presentation.className}`} aria-live="polite">
        {presentation.text}
      </div>
    </div>
  );
}
