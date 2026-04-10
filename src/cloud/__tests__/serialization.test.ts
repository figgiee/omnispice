import { describe, it, expect } from 'vitest';
import { serializeCircuit, deserializeCircuit } from '../serialization';
import type { Circuit } from '@/circuit/types';

function makeEmptyCircuit(): Circuit {
  return {
    components: new Map(),
    wires: new Map(),
    nets: new Map(),
  };
}

describe('serializeCircuit / deserializeCircuit', () => {
  it('round-trips an empty circuit', () => {
    const circuit = makeEmptyCircuit();
    const json = serializeCircuit(circuit);
    const restored = deserializeCircuit(json);
    expect(restored.components.size).toBe(0);
    expect(restored.wires.size).toBe(0);
    expect(restored.nets.size).toBe(0);
  });

  it('produces valid JSON', () => {
    const circuit = makeEmptyCircuit();
    expect(() => JSON.parse(serializeCircuit(circuit))).not.toThrow();
  });

  it('round-trips a circuit with one component', () => {
    const circuit = makeEmptyCircuit();
    circuit.components.set('c1', {
      id: 'c1',
      type: 'resistor',
      refDesignator: 'R1',
      value: '10k',
      ports: [],
      position: { x: 100, y: 200 },
      rotation: 0,
    });
    const restored = deserializeCircuit(serializeCircuit(circuit));
    expect(restored.components.has('c1')).toBe(true);
    expect(restored.components.get('c1')?.value).toBe('10k');
  });

  it('includes component id in serialized JSON', () => {
    const circuit = makeEmptyCircuit();
    circuit.components.set('abc', {
      id: 'abc',
      type: 'capacitor',
      refDesignator: 'C1',
      value: '100n',
      ports: [],
      position: { x: 0, y: 0 },
      rotation: 0,
    });
    const json = serializeCircuit(circuit);
    expect(json).toContain('abc');
  });
});
