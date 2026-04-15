/**
 * Plan 05-05 — Inline Parameter Chip (S2).
 *
 * A floating toolbar anchored above the currently-selected component node
 * on the React Flow canvas. Replaces the sidebar PropertyPanel as the
 * *primary* parameter editing surface for single-selection workflows.
 *
 * Architecture:
 *   - Anchored via `@floating-ui/react` using the React Flow node DOM
 *     element (`[data-id="{componentId}"]`) as the reference.
 *   - Pan/zoom tracking: `autoUpdate` does NOT observe React Flow's CSS
 *     transform changes (RESEARCH §17.6). We subscribe to the React Flow
 *     store's `transform` tuple and manually call `update()` on every
 *     viewport change.
 *   - `chipTargetId` is derived from `uiStore.selectedComponentIds`: set
 *     when exactly one component is selected, cleared otherwise.
 *   - The component never mutates state directly; `ChipParameterField`
 *     writes through `circuitStore.updateComponentParam` on commit.
 *
 * Accessibility:
 *   - Rendered as `role="toolbar"` with a labelled ref-designator header.
 *   - PropertyPanel remains the focus-via-keyboard fallback per UI-SPEC Q7.
 *   - Tab / Shift+Tab cycle between fields (wraps at ends, preventDefault
 *     so focus never leaks out of the chip).
 */
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import { useStore } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { COMPONENT_LIBRARY } from '@/circuit/componentLibrary';
import type { Component } from '@/circuit/types';
import { useCircuitStore } from '@/store/circuitStore';
import { useUiStore } from '@/store/uiStore';
import {
  ChipParameterField,
  type ChipParameterFieldHandle,
} from './ChipParameterField';
import styles from './InlineParameterChip.module.css';

/**
 * Derive the ordered list of editable parameters for a component. The
 * primary "value" slot always comes first; additional SPICE params
 * (sources, op-amps) follow, excluding private keys like `__sweep`.
 */
function paramListForComponent(component: Component): Array<{ name: string; value: string }> {
  const def = COMPONENT_LIBRARY[component.type];
  const hasValue = !!def && def.defaultValue !== '';
  const list: Array<{ name: string; value: string }> = [];
  if (hasValue || component.value) {
    list.push({ name: 'value', value: component.value });
  }
  if (component.parameters) {
    for (const [k, v] of Object.entries(component.parameters)) {
      if (k.startsWith('__')) continue; // __sweep etc.
      list.push({ name: k, value: v });
    }
  }
  return list;
}

/**
 * Bridge `uiStore.selectedComponentIds` → `uiStore.chipTargetId`. Exactly
 * one component selected → chip opens on that id; 0 or 2+ → chip closes.
 * Implemented as a sibling effect component so it doesn't re-render the
 * chip itself whenever selection is multi-select (performance + layout
 * stability).
 */
export function InlineParameterChipController(): null {
  const selected = useUiStore((s) => s.selectedComponentIds);
  const setChipTarget = useUiStore((s) => s.setChipTarget);
  useEffect(() => {
    if (selected.length === 1) {
      setChipTarget(selected[0] ?? null);
    } else {
      setChipTarget(null);
    }
  }, [selected, setChipTarget]);
  return null;
}

export function InlineParameterChip() {
  const chipTargetId = useUiStore((s) => s.chipTargetId);
  const component = useCircuitStore((s) =>
    chipTargetId ? (s.circuit.components.get(chipTargetId) ?? null) : null,
  );

  // React Flow viewport transform (x, y, zoom). Subscribed via useStore so
  // we re-render whenever the user pans/zooms, which lets us kick the
  // floating-ui `update()` below.
  const transform = useStore((s) => s.transform);

  const open = !!component;
  const { refs, floatingStyles, update } = useFloating({
    open,
    placement: 'top',
    middleware: [
      offset(12),
      flip({ fallbackPlacements: ['bottom', 'right', 'left'] }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Anchor the chip to the React Flow node DOM element that carries
  // `data-id={componentId}`. Re-resolve whenever the target id changes.
  useEffect(() => {
    if (!chipTargetId) {
      refs.setReference(null);
      return;
    }
    const nodeEl = document.querySelector(
      `.react-flow__node[data-id="${chipTargetId}"]`,
    );
    refs.setReference((nodeEl as Element | null) ?? null);
  }, [chipTargetId, refs]);

  // RESEARCH §17.6 — @floating-ui's autoUpdate does NOT react to React
  // Flow's CSS transform changes during pan/zoom. Manually call update()
  // every time the viewport transform tuple changes.
  useEffect(() => {
    if (open) update();
  }, [transform, update, open]);

  const params = useMemo(
    () => (component ? paramListForComponent(component) : []),
    [component],
  );

  // Field refs for Tab cycling. Size follows params length.
  const fieldRefs = useRef<Array<ChipParameterFieldHandle | null>>([]);
  if (fieldRefs.current.length !== params.length) {
    fieldRefs.current = new Array(params.length).fill(null);
  }

  const focusFieldAt = useCallback((index: number) => {
    const n = fieldRefs.current.length;
    if (n === 0) return;
    const wrapped = ((index % n) + n) % n;
    fieldRefs.current[wrapped]?.focus();
  }, []);

  if (!component) return null;

  return (
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      className={styles.chip}
      role="toolbar"
      aria-label={`Parameters for ${component.refDesignator}`}
      data-testid="inline-parameter-chip"
      data-component-id={component.id}
    >
      <span className={styles.refDesignator}>{component.refDesignator}</span>
      {params.map((p, i) => (
        <div key={p.name} className={styles.fieldWrap}>
          {i > 0 && <span className={styles.separator}>·</span>}
          <ChipParameterField
            ref={(h) => {
              fieldRefs.current[i] = h;
            }}
            componentId={component.id}
            paramName={p.name}
            value={p.value}
            onFocusField={(offset) => focusFieldAt(i + offset)}
          />
        </div>
      ))}
    </div>
  );
}
