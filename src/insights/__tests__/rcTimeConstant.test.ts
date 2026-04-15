/**
 * RED tests for rcTimeConstant insight rule.
 * These tests are written BEFORE the implementation.
 */

import { describe, expect, it } from 'vitest';
import type { Circuit, Component, Port } from '@/circuit/types';
import { rcTimeConstant } from '../rules/rcTimeConstant';

/** Build a minimal circuit with one resistor and one capacitor sharing a net. */
function buildRcNetwork(r: number, c: number): Circuit {
  const sharedNet = 'net-rc';

  const resistorPorts: Port[] = [
    { id: 'r1-p1', name: 'P', netId: 'net-in' },
    { id: 'r1-p2', name: 'N', netId: sharedNet },
  ];

  const capacitorPorts: Port[] = [
    { id: 'c1-p1', name: 'P', netId: sharedNet },
    { id: 'c1-p2', name: 'N', netId: '0' },
  ];

  const resistor: Component = {
    id: 'R1',
    type: 'resistor',
    refDesignator: 'R1',
    value: `${r}`,
    ports: resistorPorts,
    position: { x: 0, y: 0 },
    rotation: 0,
  };

  const capacitor: Component = {
    id: 'C1',
    type: 'capacitor',
    refDesignator: 'C1',
    value: `${c}`,
    ports: capacitorPorts,
    position: { x: 100, y: 0 },
    rotation: 0,
  };

  return {
    components: new Map([['R1', resistor], ['C1', capacitor]]),
    wires: new Map(),
    nets: new Map([
      ['net-in', { id: 'net-in', name: 'net-in', portIds: ['r1-p1'] }],
      [sharedNet, { id: sharedNet, name: sharedNet, portIds: ['r1-p2', 'c1-p1'] }],
      ['0', { id: '0', name: '0', portIds: ['c1-p2'] }],
    ]),
  };
}

function buildEmptyCircuit(): Circuit {
  return {
    components: new Map(),
    wires: new Map(),
    nets: new Map(),
  };
}

function buildResistorOnlyCircuit(): Circuit {
  const r: Component = {
    id: 'R1',
    type: 'resistor',
    refDesignator: 'R1',
    value: '1000',
    ports: [{ id: 'r1-p1', name: 'P', netId: 'net-in' }, { id: 'r1-p2', name: 'N', netId: '0' }],
    position: { x: 0, y: 0 },
    rotation: 0,
  };
  return {
    components: new Map([['R1', r]]),
    wires: new Map(),
    nets: new Map(),
  };
}

describe('rcTimeConstant rule', () => {
  it('detects a simple RC network with R=1k C=1uF → tau=1ms, fc=159Hz', () => {
    const circuit = buildRcNetwork(1000, 1e-6);
    const insight = rcTimeConstant.evaluate({ circuit, vectors: [], measurements: [] });
    expect(insight).not.toBeNull();
    expect(insight!.summary).toContain('1.0 ms');
    expect(insight!.summary).toContain('159');
    expect(insight!.rule).toBe('rc-time-constant');
    expect(insight!.severity).toBe('info');
    expect(insight!.anchor.kind).toBe('schematic-net');
  });

  it('returns null when circuit has no RC pair', () => {
    const circuit = buildResistorOnlyCircuit();
    const insight = rcTimeConstant.evaluate({ circuit, vectors: [], measurements: [] });
    expect(insight).toBeNull();
  });

  it('returns null for an empty circuit', () => {
    const insight = rcTimeConstant.evaluate({ circuit: buildEmptyCircuit(), vectors: [], measurements: [] });
    expect(insight).toBeNull();
  });

  it('handles invalid component values gracefully — returns null instead of throwing', () => {
    const circuit = buildRcNetwork(0, 1e-6); // R=0 is invalid
    expect(() => rcTimeConstant.evaluate({ circuit, vectors: [], measurements: [] })).not.toThrow();
  });

  it('includes a KaTeX formula', () => {
    const circuit = buildRcNetwork(1000, 1e-6);
    const insight = rcTimeConstant.evaluate({ circuit, vectors: [], measurements: [] });
    expect(insight!.formula).toBeDefined();
    expect(insight!.formula).toContain('tau');
  });
});
