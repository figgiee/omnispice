/**
 * Tests for insertTemplate (Phase 5 plan 05-06).
 *
 * Covers the five contract points from the PLAN:
 *   1. Every component is inserted
 *   2. Ref designators renumber sequentially from the existing store counters
 *   3. Positions are offset by the insert cursor
 *   4. Internal wires are rewritten via the portIdMap
 *   5. `omnispice:change-callout` is dispatched with the template name + count
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCircuitStore } from '@/store/circuitStore';
import { useUiStore } from '@/store/uiStore';
import { TEMPLATES } from '../index';
import { insertTemplate } from '../insertTemplate';

function resetStores() {
  useCircuitStore.setState({
    circuit: { components: new Map(), wires: new Map(), nets: new Map() },
    refCounters: {},
  });
  useCircuitStore.temporal.getState().clear();
  useUiStore.setState({
    selectedComponentIds: [],
    selectedWireIds: [],
    highlightedComponentId: null,
    insertCursor: { x: 0, y: 0 },
    cursorPosition: null,
  });
}

describe('insertTemplate', () => {
  beforeEach(() => {
    resetStores();
  });

  it('returns null for an unknown template id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = insertTemplate('does-not-exist');
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('adds every component from the template', () => {
    const template = TEMPLATES['voltage-divider']!;
    const result = insertTemplate('voltage-divider');

    expect(result).not.toBeNull();
    expect(result!.componentIds).toHaveLength(template.components.length);

    const state = useCircuitStore.getState();
    expect(state.circuit.components.size).toBe(template.components.length);
    for (const id of result!.componentIds) {
      expect(state.circuit.components.has(id)).toBe(true);
    }
  });

  it('renumbers refDesignators sequentially from the store counters', () => {
    // Seed the store so the next R designator should be R3 and next V is V2.
    useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    useCircuitStore.getState().addComponent('resistor', { x: 10, y: 10 });
    useCircuitStore.getState().addComponent('dc_voltage', { x: 20, y: 20 });
    const before = useCircuitStore.getState().refCounters;
    expect(before.R).toBe(2);
    expect(before.V).toBe(1);

    insertTemplate('voltage-divider');

    const after = useCircuitStore.getState();
    // voltage-divider has 2 resistors + 1 dc_voltage + 1 ground.
    // R should advance to R3/R4, V to V2.
    expect(after.refCounters.R).toBe(4);
    expect(after.refCounters.V).toBe(2);

    const refs = [...after.circuit.components.values()]
      .map((c) => c.refDesignator)
      .filter((r) => r !== '')
      .sort();
    expect(refs).toContain('R3');
    expect(refs).toContain('R4');
    expect(refs).toContain('V2');
  });

  it('offsets component positions by the cursor', () => {
    useUiStore.setState({ insertCursor: { x: 500, y: 400 } });
    const template = TEMPLATES['voltage-divider']!;
    const result = insertTemplate('voltage-divider')!;

    const circuit = useCircuitStore.getState().circuit;
    for (let i = 0; i < result.componentIds.length; i++) {
      const newComp = circuit.components.get(result.componentIds[i]!)!;
      const tc = template.components[i]!;
      expect(newComp.position.x).toBe(500 + tc.position.x);
      expect(newComp.position.y).toBe(400 + tc.position.y);
    }
  });

  it('preserves internal wires via the portIdMap', () => {
    const template = TEMPLATES['voltage-divider']!;
    insertTemplate('voltage-divider');

    const wires = [...useCircuitStore.getState().circuit.wires.values()];
    expect(wires).toHaveLength(template.wires.length);

    // Every wire must reference real port IDs that belong to components in the
    // circuit (i.e., portIdMap rewrote both endpoints).
    const allPortIds = new Set<string>();
    for (const comp of useCircuitStore.getState().circuit.components.values()) {
      for (const port of comp.ports) {
        allPortIds.add(port.id);
      }
    }
    for (const wire of wires) {
      expect(allPortIds.has(wire.sourcePortId)).toBe(true);
      expect(allPortIds.has(wire.targetPortId)).toBe(true);
    }
  });

  it('dispatches omnispice:change-callout with the template name and count', () => {
    const listener = vi.fn();
    window.addEventListener('omnispice:change-callout', listener);

    insertTemplate('voltage-divider');

    expect(listener).toHaveBeenCalledTimes(1);
    const evt = listener.mock.calls[0]![0] as CustomEvent;
    expect(evt.detail).toEqual({
      kind: 'insert-template',
      name: 'Voltage Divider',
      count: 4,
    });
    window.removeEventListener('omnispice:change-callout', listener);
  });

  it('falls back to cursorPosition when insertCursor is null', () => {
    useUiStore.setState({ insertCursor: null, cursorPosition: { x: 123, y: 456 } });
    const template = TEMPLATES['voltage-divider']!;
    const result = insertTemplate('voltage-divider')!;

    const firstId = result.componentIds[0]!;
    const firstComp = useCircuitStore.getState().circuit.components.get(firstId)!;
    const firstTc = template.components[0]!;
    expect(firstComp.position).toEqual({
      x: 123 + firstTc.position.x,
      y: 456 + firstTc.position.y,
    });
  });

  it('inserts every bundled template without errors', () => {
    for (const id of Object.keys(TEMPLATES)) {
      resetStores();
      expect(() => insertTemplate(id)).not.toThrow();
      const state = useCircuitStore.getState();
      expect(state.circuit.components.size).toBe(TEMPLATES[id]!.components.length);
      expect(state.circuit.wires.size).toBe(TEMPLATES[id]!.wires.length);
    }
  });
});
