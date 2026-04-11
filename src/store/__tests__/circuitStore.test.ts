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
});
