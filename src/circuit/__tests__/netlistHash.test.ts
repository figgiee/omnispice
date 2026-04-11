/**
 * Tests for hashNetlist — deterministic structural hashing of Circuit.
 *
 * Covers Plan 05-04 Task 1 behavior bullets:
 *  - Short deterministic string (16 hex chars)
 *  - Same structure + values → same hash
 *  - Changing a value changes the hash
 *  - Moving position does NOT change the hash
 *  - Adding a component changes the hash
 *  - Re-ordering underlying Map insertion order does NOT change the hash
 */

import { describe, expect, it } from 'vitest';
import { hashNetlist } from '../netlistHash';
import type { Circuit, Component, Port, Wire } from '../types';

function makePort(id: string, name: string): Port {
  return { id, name, netId: null };
}

function makeResistor(id: string, value: string, x = 0, y = 0): Component {
  return {
    id,
    type: 'resistor',
    refDesignator: id.toUpperCase(),
    value,
    ports: [makePort(`${id}-p1`, '1'), makePort(`${id}-p2`, '2')],
    position: { x, y },
    rotation: 0,
  };
}

function makeCapacitor(id: string, value: string): Component {
  return {
    id,
    type: 'capacitor',
    refDesignator: id.toUpperCase(),
    value,
    ports: [makePort(`${id}-p1`, '1'), makePort(`${id}-p2`, '2')],
    position: { x: 0, y: 0 },
    rotation: 0,
  };
}

function makeWire(id: string, source: string, target: string): Wire {
  return { id, sourcePortId: source, targetPortId: target, bendPoints: [] };
}

function makeCircuit(components: Component[], wires: Wire[] = []): Circuit {
  return {
    components: new Map(components.map((c) => [c.id, c])),
    wires: new Map(wires.map((w) => [w.id, w])),
    nets: new Map(),
  };
}

describe('hashNetlist', () => {
  it('returns a 16-character hex string', () => {
    const circuit = makeCircuit([makeResistor('r1', '1k')]);
    const hash = hashNetlist(circuit);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic: same circuit hashes to the same value', () => {
    const circuit1 = makeCircuit([makeResistor('r1', '1k'), makeResistor('r2', '2k')]);
    const circuit2 = makeCircuit([makeResistor('r1', '1k'), makeResistor('r2', '2k')]);
    expect(hashNetlist(circuit1)).toBe(hashNetlist(circuit2));
  });

  it('changes when a resistor value changes', () => {
    const before = makeCircuit([makeResistor('r1', '1k')]);
    const after = makeCircuit([makeResistor('r1', '2k')]);
    expect(hashNetlist(before)).not.toBe(hashNetlist(after));
  });

  it('does NOT change when a component position moves', () => {
    const before = makeCircuit([makeResistor('r1', '1k', 0, 0)]);
    const after = makeCircuit([makeResistor('r1', '1k', 999, 999)]);
    expect(hashNetlist(before)).toBe(hashNetlist(after));
  });

  it('does NOT change when rotation changes (layout only)', () => {
    const resistor = makeResistor('r1', '1k');
    const rotated = { ...resistor, rotation: 90 };
    const before = makeCircuit([resistor]);
    const after = makeCircuit([rotated]);
    expect(hashNetlist(before)).toBe(hashNetlist(after));
  });

  it('changes when a component is added', () => {
    const before = makeCircuit([makeResistor('r1', '1k')]);
    const after = makeCircuit([makeResistor('r1', '1k'), makeCapacitor('c1', '1n')]);
    expect(hashNetlist(before)).not.toBe(hashNetlist(after));
  });

  it('does NOT change when underlying Map insertion order changes', () => {
    const r1 = makeResistor('r1', '1k');
    const r2 = makeResistor('r2', '2k');
    const w1 = makeWire('w1', 'r1-p1', 'r2-p1');
    const w2 = makeWire('w2', 'r1-p2', 'r2-p2');

    // Circuit A: r1 then r2, w1 then w2
    const a: Circuit = {
      components: new Map([
        ['r1', r1],
        ['r2', r2],
      ]),
      wires: new Map([
        ['w1', w1],
        ['w2', w2],
      ]),
      nets: new Map(),
    };

    // Circuit B: r2 then r1, w2 then w1 (same data, different insertion order)
    const b: Circuit = {
      components: new Map([
        ['r2', r2],
        ['r1', r1],
      ]),
      wires: new Map([
        ['w2', w2],
        ['w1', w1],
      ]),
      nets: new Map(),
    };

    expect(hashNetlist(a)).toBe(hashNetlist(b));
  });

  it('changes when a wire is added', () => {
    const r1 = makeResistor('r1', '1k');
    const r2 = makeResistor('r2', '2k');
    const before = makeCircuit([r1, r2]);
    const after = makeCircuit([r1, r2], [makeWire('w1', 'r1-p1', 'r2-p1')]);
    expect(hashNetlist(before)).not.toBe(hashNetlist(after));
  });

  it('changes when a wire endpoint changes (topology)', () => {
    const r1 = makeResistor('r1', '1k');
    const r2 = makeResistor('r2', '2k');
    const wireA = makeWire('w1', 'r1-p1', 'r2-p1');
    const wireB = makeWire('w1', 'r1-p1', 'r2-p2');
    const before = makeCircuit([r1, r2], [wireA]);
    const after = makeCircuit([r1, r2], [wireB]);
    expect(hashNetlist(before)).not.toBe(hashNetlist(after));
  });

  it('changes when component parameters change (pulse source params)', () => {
    const pulse: Component = {
      id: 'v1',
      type: 'pulse_voltage',
      refDesignator: 'V1',
      value: '5',
      ports: [makePort('v1-p1', '+'), makePort('v1-p2', '-')],
      position: { x: 0, y: 0 },
      rotation: 0,
      parameters: { v1: '0', v2: '5', td: '0', tr: '1n', tf: '1n', pw: '5u', per: '10u' },
    };
    const before = makeCircuit([pulse]);
    const after = makeCircuit([{ ...pulse, parameters: { ...pulse.parameters, pw: '10u' } }]);
    expect(hashNetlist(before)).not.toBe(hashNetlist(after));
  });
});
