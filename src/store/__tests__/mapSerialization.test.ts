/**
 * Tests for mapReplacer / mapReviver used by the circuit store persist
 * middleware. JSON.stringify drops Maps (and Sets) by default — we must
 * round-trip them losslessly so the persisted blob reloads faithfully.
 */

import { describe, expect, it } from 'vitest';
import { mapAwareJSON, mapReplacer, mapReviver } from '../mapSerialization';

describe('mapReplacer / mapReviver', () => {
  it('round-trips a flat Map', () => {
    const m = new Map<string, number>([
      ['a', 1],
      ['b', 2],
    ]);
    const str = JSON.stringify(m, mapReplacer);
    const restored = JSON.parse(str, mapReviver) as Map<string, number>;
    expect(restored).toBeInstanceOf(Map);
    expect(restored.get('a')).toBe(1);
    expect(restored.get('b')).toBe(2);
    expect(restored.size).toBe(2);
  });

  it('round-trips nested Maps', () => {
    const m = new Map<string, Map<string, number>>([
      ['outer', new Map<string, number>([['inner', 42]])],
    ]);
    const restored = JSON.parse(
      JSON.stringify(m, mapReplacer),
      mapReviver,
    ) as Map<string, Map<string, number>>;
    expect(restored).toBeInstanceOf(Map);
    const outer = restored.get('outer');
    expect(outer).toBeInstanceOf(Map);
    expect(outer?.get('inner')).toBe(42);
  });

  it('handles an object containing a Map field', () => {
    const obj = {
      name: 'circuit',
      components: new Map<string, { value: string }>([
        ['r1', { value: '10k' }],
      ]),
    };
    const restored = JSON.parse(
      JSON.stringify(obj, mapReplacer),
      mapReviver,
    ) as typeof obj;
    expect(restored.name).toBe('circuit');
    expect(restored.components).toBeInstanceOf(Map);
    expect(restored.components.get('r1')?.value).toBe('10k');
  });

  it('passes through non-Map values unchanged', () => {
    const v = { a: 1, b: 'two', c: [1, 2, 3], d: null };
    const restored = JSON.parse(JSON.stringify(v, mapReplacer), mapReviver);
    expect(restored).toEqual(v);
  });

  it('round-trips a Set', () => {
    const s = new Set<string>(['x', 'y', 'z']);
    const str = JSON.stringify(s, mapReplacer);
    const restored = JSON.parse(str, mapReviver) as Set<string>;
    expect(restored).toBeInstanceOf(Set);
    expect(restored.has('x')).toBe(true);
    expect(restored.has('y')).toBe(true);
    expect(restored.has('z')).toBe(true);
    expect(restored.size).toBe(3);
  });

  it('round-trips a circuit-like shape with Maps for components/wires/nets', () => {
    const circuitLike = {
      circuit: {
        components: new Map<string, { id: string; type: string }>([
          ['r1', { id: 'r1', type: 'resistor' }],
          ['c1', { id: 'c1', type: 'capacitor' }],
        ]),
        wires: new Map<string, { id: string }>([['w1', { id: 'w1' }]]),
        nets: new Map<string, { id: string }>(),
      },
      refCounters: { R: 1, C: 1 },
    };
    const restored = JSON.parse(
      JSON.stringify(circuitLike, mapReplacer),
      mapReviver,
    ) as typeof circuitLike;
    expect(restored.circuit.components).toBeInstanceOf(Map);
    expect(restored.circuit.wires).toBeInstanceOf(Map);
    expect(restored.circuit.nets).toBeInstanceOf(Map);
    expect(restored.circuit.components.size).toBe(2);
    expect(restored.circuit.wires.size).toBe(1);
    expect(restored.circuit.nets.size).toBe(0);
    expect(restored.refCounters).toEqual({ R: 1, C: 1 });
  });

  it('mapAwareJSON convenience wrapper round-trips', () => {
    const obj = { m: new Map<string, number>([['k', 7]]) };
    const str = mapAwareJSON.stringify(obj);
    const restored = mapAwareJSON.parse(str) as typeof obj;
    expect(restored.m).toBeInstanceOf(Map);
    expect(restored.m.get('k')).toBe(7);
  });

  it('does not confuse a plain object that happens to have a __type field', () => {
    // A plain object with __type but not our sentinels should pass through.
    const plain = { __type: 'something-else', entries: [['a', 1]] };
    const restored = JSON.parse(
      JSON.stringify(plain, mapReplacer),
      mapReviver,
    );
    expect(restored).toEqual(plain);
    expect(restored).not.toBeInstanceOf(Map);
  });
});
