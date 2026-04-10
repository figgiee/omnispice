import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseAsc } from '../parser';
import { mapAscToCircuit } from '../mapper';
import type { AscCircuit } from '../types';

const rcFixture = readFileSync(resolve(__dirname, 'fixtures/rc-circuit.asc'), 'utf-8');
const rcAsc = parseAsc(rcFixture);

describe('mapAscToCircuit', () => {
  it('produces 3 components from RC fixture', () => {
    const circuit = mapAscToCircuit(rcAsc);
    expect(circuit.components.size).toBe(3);
  });

  it('maps "res" to "resistor" ComponentType', () => {
    const circuit = mapAscToCircuit(rcAsc);
    const resistors = Array.from(circuit.components.values()).filter((c) => c.type === 'resistor');
    expect(resistors).toHaveLength(1);
    expect(resistors[0]?.refDesignator).toBe('R1');
    expect(resistors[0]?.value).toBe('10k');
  });

  it('maps "cap" to "capacitor" ComponentType', () => {
    const circuit = mapAscToCircuit(rcAsc);
    const caps = Array.from(circuit.components.values()).filter((c) => c.type === 'capacitor');
    expect(caps).toHaveLength(1);
  });

  it('maps "voltage" to "dc_voltage" ComponentType', () => {
    const circuit = mapAscToCircuit(rcAsc);
    const vsrc = Array.from(circuit.components.values()).filter((c) => c.type === 'dc_voltage');
    expect(vsrc).toHaveLength(1);
  });

  it('scales coordinates so no component is at {x: 0, y: 0}', () => {
    const circuit = mapAscToCircuit(rcAsc);
    const atOrigin = Array.from(circuit.components.values()).filter(
      (c) => c.position.x === 0 && c.position.y === 0
    );
    expect(atOrigin).toHaveLength(0);
  });

  it('skips unknown symbol names without throwing', () => {
    const ascWithUnknown: AscCircuit = {
      symbols: [{ name: 'unknownthing', x: 0, y: 0, orientation: 'R0', instName: 'X1', value: '1' }],
      wires: [],
      flags: [],
      directives: [],
    };
    expect(() => mapAscToCircuit(ascWithUnknown)).not.toThrow();
    const circuit = mapAscToCircuit(ascWithUnknown);
    expect(circuit.components.size).toBe(0);
  });

  it('returns empty Circuit for empty AscCircuit', () => {
    const empty: AscCircuit = { symbols: [], wires: [], flags: [], directives: [] };
    const circuit = mapAscToCircuit(empty);
    expect(circuit.components.size).toBe(0);
    expect(circuit.wires.size).toBe(0);
  });

  it('creates wire connections between matched ports', () => {
    // The RC fixture has 4 WIRE segments connecting R1, C1, and V1 pins.
    // After spatial matching, at least one wire should be created.
    const circuit = mapAscToCircuit(rcAsc);
    expect(circuit.wires.size).toBeGreaterThan(0);
  });
});
