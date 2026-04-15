/**
 * Plan 05-02 Task 4 — net label type-to-capture gesture.
 *
 * Listens at the window level for printable characters while exactly one
 * wire is selected. The first letter seeds a `pendingNetLabel` buffer in
 * uiStore; subsequent keystrokes append. Enter commits the buffer into a
 * `net_label` component via `circuitStore.splitWireWithNetLabel`, Escape
 * cancels, Backspace trims.
 *
 * Ignores keypresses while focus is in an input/textarea/contenteditable so
 * the value-edit overlay keeps working.
 */

import { useEffect } from 'react';
import type { Wire } from '@/circuit/types';
import { useCircuitStore } from '@/store/circuitStore';
import { useUiStore } from '@/store/uiStore';

const PRINTABLE_START = /^[a-zA-Z_]$/;
const PRINTABLE_CONT = /^[a-zA-Z0-9_]$/;

function isTextLikeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

function wireMidpoint(
  wire: Wire,
  getPortOwner: (portId: string) => { x: number; y: number } | null,
): { x: number; y: number } {
  const a = getPortOwner(wire.sourcePortId);
  const b = getPortOwner(wire.targetPortId);
  if (a && b) {
    return {
      x: Math.round((a.x + b.x) / 2 / 10) * 10,
      y: Math.round((a.y + b.y) / 2 / 10) * 10,
    };
  }
  return a ?? b ?? { x: 0, y: 0 };
}

export function useNetLabelInput(): void {
  useEffect(() => {
    function commit(): void {
      const pending = useUiStore.getState().consumeNetLabel();
      if (!pending) return;
      const chars = pending.chars.trim();
      if (!chars) return;

      const circuit = useCircuitStore.getState().circuit;
      const wire = circuit.wires.get(pending.wireId);
      if (!wire) return;

      const getPortOwner = (portId: string) => {
        for (const comp of circuit.components.values()) {
          if (comp.ports.some((p) => p.id === portId)) {
            return comp.position;
          }
        }
        return null;
      };
      const mid = wireMidpoint(wire, getPortOwner);

      const labelId = useCircuitStore
        .getState()
        .splitWireWithNetLabel(pending.wireId, mid, chars);
      if (labelId) {
        useUiStore.getState().setSelectedComponentIds([labelId]);
        useUiStore.getState().setSelectedWireIds([]);
      }
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (isTextLikeTarget(event.target)) return;
      if (event.altKey || event.metaKey || event.ctrlKey) return;

      const ui = useUiStore.getState();
      const pending = ui.pendingNetLabel;

      if (pending) {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          ui.cancelNetLabel();
          return;
        }
        if (event.key === 'Backspace') {
          event.preventDefault();
          ui.backspaceNetLabelChar();
          return;
        }
        if (event.key.length === 1 && PRINTABLE_CONT.test(event.key)) {
          event.preventDefault();
          ui.appendNetLabelChar(event.key);
          return;
        }
        return;
      }

      // Not currently capturing — start only if exactly one wire is selected.
      const selected = ui.selectedWireIds;
      if (selected.length !== 1) return;
      if (event.key.length !== 1) return;
      if (!PRINTABLE_START.test(event.key)) return;

      event.preventDefault();
      ui.beginNetLabelInput(selected[0]!, event.key);
    }

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, []);
}
