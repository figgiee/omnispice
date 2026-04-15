import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from '../circuitStore';

function resetStore() {
  useCircuitStore.setState({
    circuit: { components: new Map(), wires: new Map(), nets: new Map() },
    refCounters: {},
  });
  // Clear undo history
  useCircuitStore.temporal.getState().clear();
}

describe('circuitStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('addComponent', () => {
    it('adds a component to circuit.components map', () => {
      const id = useCircuitStore.getState().addComponent('resistor', { x: 100, y: 200 });
      const comp = useCircuitStore.getState().circuit.components.get(id);
      expect(comp).toBeDefined();
      expect(comp!.type).toBe('resistor');
      expect(comp!.position).toEqual({ x: 100, y: 200 });
    });

    it('increments ref designator counter', () => {
      useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
      useCircuitStore.getState().addComponent('resistor', { x: 50, y: 50 });
      const state = useCircuitStore.getState();
      const comps = [...state.circuit.components.values()];
      const refs = comps.map((c) => c.refDesignator).sort();
      expect(refs).toEqual(['R1', 'R2']);
    });
  });

  describe('removeComponent', () => {
    it('removes from map and removes connected wires', () => {
      const state = useCircuitStore.getState();
      const id1 = state.addComponent('resistor', { x: 0, y: 0 });
      const id2 = state.addComponent('resistor', { x: 100, y: 0 });

      const comp1 = useCircuitStore.getState().circuit.components.get(id1)!;
      const comp2 = useCircuitStore.getState().circuit.components.get(id2)!;

      const wireId = useCircuitStore.getState().addWire(comp1.ports[0].id, comp2.ports[0].id);
      expect(useCircuitStore.getState().circuit.wires.size).toBe(1);

      useCircuitStore.getState().removeComponent(id1);
      expect(useCircuitStore.getState().circuit.components.has(id1)).toBe(false);
      expect(useCircuitStore.getState().circuit.wires.has(wireId)).toBe(false);
    });
  });

  describe('updateComponentValue', () => {
    it('updates value field on correct component', () => {
      const id = useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
      useCircuitStore.getState().updateComponentValue(id, '4.7k');
      expect(useCircuitStore.getState().circuit.components.get(id)!.value).toBe('4.7k');
    });
  });

  describe('addWire', () => {
    it('adds to circuit.wires map', () => {
      const id1 = useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
      const id2 = useCircuitStore.getState().addComponent('resistor', { x: 100, y: 0 });
      const comp1 = useCircuitStore.getState().circuit.components.get(id1)!;
      const comp2 = useCircuitStore.getState().circuit.components.get(id2)!;

      const wireId = useCircuitStore.getState().addWire(comp1.ports[0].id, comp2.ports[0].id);
      const wire = useCircuitStore.getState().circuit.wires.get(wireId);
      expect(wire).toBeDefined();
      expect(wire!.sourcePortId).toBe(comp1.ports[0].id);
      expect(wire!.targetPortId).toBe(comp2.ports[0].id);
    });
  });

  describe('removeWire', () => {
    it('removes from map', () => {
      const id1 = useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
      const id2 = useCircuitStore.getState().addComponent('resistor', { x: 100, y: 0 });
      const comp1 = useCircuitStore.getState().circuit.components.get(id1)!;
      const comp2 = useCircuitStore.getState().circuit.components.get(id2)!;

      const wireId = useCircuitStore.getState().addWire(comp1.ports[0].id, comp2.ports[0].id);
      useCircuitStore.getState().removeWire(wireId);
      expect(useCircuitStore.getState().circuit.wires.has(wireId)).toBe(false);
    });
  });

  describe('rotateComponent', () => {
    it('cycles through 0 -> 90 -> 180 -> 270 -> 0', () => {
      const id = useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
      expect(useCircuitStore.getState().circuit.components.get(id)!.rotation).toBe(0);

      useCircuitStore.getState().rotateComponent(id);
      expect(useCircuitStore.getState().circuit.components.get(id)!.rotation).toBe(90);

      useCircuitStore.getState().rotateComponent(id);
      expect(useCircuitStore.getState().circuit.components.get(id)!.rotation).toBe(180);

      useCircuitStore.getState().rotateComponent(id);
      expect(useCircuitStore.getState().circuit.components.get(id)!.rotation).toBe(270);

      useCircuitStore.getState().rotateComponent(id);
      expect(useCircuitStore.getState().circuit.components.get(id)!.rotation).toBe(0);
    });
  });

  describe('undo/redo', () => {
    it('undo after addComponent removes the component', async () => {
      const id = useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
      expect(useCircuitStore.getState().circuit.components.size).toBe(1);

      // zundo undo is synchronous but state updates are batched
      await useCircuitStore.temporal.getState().undo();
      expect(useCircuitStore.getState().circuit.components.size).toBe(0);
    });

    it('redo after undo re-adds the component', async () => {
      const id = useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
      await useCircuitStore.temporal.getState().undo();
      expect(useCircuitStore.getState().circuit.components.size).toBe(0);

      await useCircuitStore.temporal.getState().redo();
      expect(useCircuitStore.getState().circuit.components.size).toBe(1);
    });

    it('undo history capped at 100 entries', () => {
      for (let i = 0; i < 110; i++) {
        useCircuitStore.getState().addComponent('resistor', { x: i * 10, y: 0 });
      }
      const pastStates = useCircuitStore.temporal.getState().pastStates;
      expect(pastStates.length).toBeLessThanOrEqual(100);
    });
  });

  describe('splitWireWithNetLabel (Plan 05-02 Task 4)', () => {
    it('replaces the target wire with two wires touching a new net_label', () => {
      const state = useCircuitStore.getState();
      const r1Id = state.addComponent('resistor', { x: 0, y: 0 });
      const r2Id = state.addComponent('resistor', { x: 100, y: 0 });
      const r1 = useCircuitStore.getState().circuit.components.get(r1Id)!;
      const r2 = useCircuitStore.getState().circuit.components.get(r2Id)!;
      const wireId = useCircuitStore.getState().addWire(r1.ports[1]!.id, r2.ports[0]!.id);
      expect(useCircuitStore.getState().circuit.wires.size).toBe(1);

      const labelId = useCircuitStore
        .getState()
        .splitWireWithNetLabel(wireId, { x: 50, y: 0 }, 'VOUT');
      expect(labelId).not.toBeNull();

      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.wires.has(wireId)).toBe(false);
      expect(circuit.wires.size).toBe(2);
      expect(circuit.components.size).toBe(3);

      const label = circuit.components.get(labelId!);
      expect(label).toBeDefined();
      expect(label?.type).toBe('net_label');
      expect(label?.netLabel).toBe('VOUT');
      expect(label?.ports).toHaveLength(1);
    });

    it('returns null when the wire does not exist', () => {
      const result = useCircuitStore.getState().splitWireWithNetLabel('nope', { x: 0, y: 0 }, 'X');
      expect(result).toBeNull();
    });
  });

  describe('collapseSubcircuit (Plan 05-03 Task 1)', () => {
    /**
     * Helper: build a 3-resistor chain with boundary wires so we can
     * exercise exposed-port derivation. Layout:
     *
     *   [R1.pin1] -- w0 --> [R2.pin1]  [R2.pin2] -- w1 --> [R3.pin1]
     *
     * Selecting R2 alone is a no-op (single-item guard); selecting
     * {R2, R3} creates one subcircuit whose exposed ports are R2.pin1
     * and (depending on wiring) nothing else.
     */
    function buildChain() {
      const state = useCircuitStore.getState();
      const r1Id = state.addComponent('resistor', { x: 0, y: 0 });
      const r2Id = state.addComponent('resistor', { x: 100, y: 0 });
      const r3Id = state.addComponent('resistor', { x: 200, y: 0 });
      const r1 = useCircuitStore.getState().circuit.components.get(r1Id)!;
      const r2 = useCircuitStore.getState().circuit.components.get(r2Id)!;
      const r3 = useCircuitStore.getState().circuit.components.get(r3Id)!;
      const w0 = useCircuitStore.getState().addWire(r1.ports[1]!.id, r2.ports[0]!.id);
      const w1 = useCircuitStore.getState().addWire(r2.ports[1]!.id, r3.ports[0]!.id);
      return { r1Id, r2Id, r3Id, w0, w1 };
    }

    it('creates a subcircuit component with exposed ports for crossing wires', () => {
      const { r2Id, r3Id } = buildChain();
      useCircuitStore.getState().collapseSubcircuit([r2Id, r3Id], 'MySub');

      const circuit = useCircuitStore.getState().circuit;
      // One new subcircuit + original 3 resistors = 4 components
      expect(circuit.components.size).toBe(4);

      const subs = [...circuit.components.values()].filter((c) => c.type === 'subcircuit');
      expect(subs).toHaveLength(1);
      const sub = subs[0]!;
      expect(sub.refDesignator).toBe('X1');
      expect(sub.subcircuitName).toBe('MySub');
      // The w0 wire (R1 -> R2.pin1) crosses the boundary => exposed pin.
      // w1 is fully inside the selection => no exposed pin for it.
      expect(sub.ports.length).toBeGreaterThanOrEqual(1);
      expect(sub.childComponentIds).toEqual([r2Id, r3Id]);
      expect(sub.exposedPinMapping).toBeDefined();
    });

    it('assigns parentId to every child', () => {
      const { r2Id, r3Id } = buildChain();
      useCircuitStore.getState().collapseSubcircuit([r2Id, r3Id], 'MySub');
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.components.get(r2Id)!.parentId).toBeDefined();
      expect(circuit.components.get(r3Id)!.parentId).toBeDefined();
      expect(circuit.components.get(r2Id)!.parentId).toBe(circuit.components.get(r3Id)!.parentId);
    });

    it('infers exposed port pinType from inner port', () => {
      const { r2Id, r3Id } = buildChain();
      useCircuitStore.getState().collapseSubcircuit([r2Id, r3Id], 'MySub');
      const sub = [...useCircuitStore.getState().circuit.components.values()].find(
        (c) => c.type === 'subcircuit',
      )!;
      // Resistor pins are all 'signal'
      for (const p of sub.ports) {
        expect(p.pinType).toBe('signal');
      }
    });

    it('re-points boundary wires onto the subcircuit exposed ports', () => {
      const { r1Id, r2Id, r3Id, w0 } = buildChain();
      useCircuitStore.getState().collapseSubcircuit([r2Id, r3Id], 'MySub');
      const circuit = useCircuitStore.getState().circuit;
      const sub = [...circuit.components.values()].find((c) => c.type === 'subcircuit')!;
      const exposedIds = new Set(sub.ports.map((p) => p.id));
      // w0 should still exist but now terminate at an exposed port of sub
      const wire = circuit.wires.get(w0)!;
      expect(wire).toBeDefined();
      const r1 = circuit.components.get(r1Id)!;
      const r1PortIds = new Set(r1.ports.map((p) => p.id));
      // One endpoint is still R1's port; the other is now an exposed subcircuit port
      const endpoints = [wire.sourcePortId, wire.targetPortId];
      expect(endpoints.some((id) => r1PortIds.has(id))).toBe(true);
      expect(endpoints.some((id) => exposedIds.has(id))).toBe(true);
    });

    it('is a silent no-op with empty selection', () => {
      const before = useCircuitStore.getState().circuit.components.size;
      useCircuitStore.getState().collapseSubcircuit([], 'Nope');
      expect(useCircuitStore.getState().circuit.components.size).toBe(before);
    });

    it('is a silent no-op with single-item selection', () => {
      const id = useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
      const before = useCircuitStore.getState().circuit.components.size;
      useCircuitStore.getState().collapseSubcircuit([id], 'Nope');
      expect(useCircuitStore.getState().circuit.components.size).toBe(before);
    });
  });

  describe('expandSubcircuit (Plan 05-03 Task 1)', () => {
    function buildAndCollapse() {
      const state = useCircuitStore.getState();
      const r1Id = state.addComponent('resistor', { x: 0, y: 0 });
      const r2Id = state.addComponent('resistor', { x: 100, y: 0 });
      const r3Id = state.addComponent('resistor', { x: 200, y: 0 });
      const r1 = useCircuitStore.getState().circuit.components.get(r1Id)!;
      const r2 = useCircuitStore.getState().circuit.components.get(r2Id)!;
      const r3 = useCircuitStore.getState().circuit.components.get(r3Id)!;
      useCircuitStore.getState().addWire(r1.ports[1]!.id, r2.ports[0]!.id);
      useCircuitStore.getState().addWire(r2.ports[1]!.id, r3.ports[0]!.id);
      useCircuitStore.getState().collapseSubcircuit([r2Id, r3Id], 'MySub');
      const sub = [...useCircuitStore.getState().circuit.components.values()].find(
        (c) => c.type === 'subcircuit',
      )!;
      return { r1Id, r2Id, r3Id, subId: sub.id };
    }

    it('removes the subcircuit node', () => {
      const { subId } = buildAndCollapse();
      useCircuitStore.getState().expandSubcircuit(subId);
      expect(useCircuitStore.getState().circuit.components.has(subId)).toBe(false);
    });

    it('clears parentId on former children', () => {
      const { r2Id, r3Id, subId } = buildAndCollapse();
      useCircuitStore.getState().expandSubcircuit(subId);
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.components.get(r2Id)!.parentId).toBeUndefined();
      expect(circuit.components.get(r3Id)!.parentId).toBeUndefined();
    });

    it('restores wires to inner ports', () => {
      const { r1Id, r2Id, subId } = buildAndCollapse();
      useCircuitStore.getState().expandSubcircuit(subId);
      const circuit = useCircuitStore.getState().circuit;
      const r1 = circuit.components.get(r1Id)!;
      const r2 = circuit.components.get(r2Id)!;
      const r1PortIds = new Set(r1.ports.map((p) => p.id));
      const r2PortIds = new Set(r2.ports.map((p) => p.id));
      // There should be a wire connecting some R1 port to some R2 port
      const bridge = [...circuit.wires.values()].find((w) => {
        const a = r1PortIds.has(w.sourcePortId) || r1PortIds.has(w.targetPortId);
        const b = r2PortIds.has(w.sourcePortId) || r2PortIds.has(w.targetPortId);
        return a && b;
      });
      expect(bridge).toBeDefined();
    });

    it('round-trips a collapse + expand to structurally-equivalent circuit', () => {
      const state0 = useCircuitStore.getState();
      const r1Id = state0.addComponent('resistor', { x: 0, y: 0 });
      const r2Id = state0.addComponent('resistor', { x: 100, y: 0 });
      const r3Id = state0.addComponent('resistor', { x: 200, y: 0 });
      const r1 = useCircuitStore.getState().circuit.components.get(r1Id)!;
      const r2 = useCircuitStore.getState().circuit.components.get(r2Id)!;
      const r3 = useCircuitStore.getState().circuit.components.get(r3Id)!;
      useCircuitStore.getState().addWire(r1.ports[1]!.id, r2.ports[0]!.id);
      useCircuitStore.getState().addWire(r2.ports[1]!.id, r3.ports[0]!.id);

      const originalComponentIds = new Set(useCircuitStore.getState().circuit.components.keys());
      const originalWireCount = useCircuitStore.getState().circuit.wires.size;

      useCircuitStore.getState().collapseSubcircuit([r2Id, r3Id], 'MySub');
      const sub = [...useCircuitStore.getState().circuit.components.values()].find(
        (c) => c.type === 'subcircuit',
      )!;
      useCircuitStore.getState().expandSubcircuit(sub.id);

      const after = useCircuitStore.getState().circuit;
      // Original 3 components restored; subcircuit gone.
      expect(after.components.size).toBe(originalComponentIds.size);
      for (const id of originalComponentIds) {
        expect(after.components.has(id)).toBe(true);
      }
      // Wire count preserved
      expect(after.wires.size).toBe(originalWireCount);
    });
  });
});
