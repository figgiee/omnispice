/**
 * RED tests for voltageDividerRatio insight rule.
 */

import { describe, expect, it } from 'vitest';
import type { Circuit, Component, Port } from '@/circuit/types';
import { voltageDividerRatio } from '../rules/voltageDividerRatio';

/**
 * Build a two-resistor divider:
 *   V+ --- R2 --- mid-net --- R1 --- GND
 */
function buildVoltageDivider(r1Ohm: number, r2Ohm: number, vcc = 5): Circuit {
  const vccNet = 'net-vcc';
  const midNet = 'net-mid';
  const gndNet = '0';

  const voltageSource: Component = {
    id: 'V1',
    type: 'dc_voltage',
    refDesignator: 'V1',
    value: `${vcc}`,
    ports: [
      { id: 'v1-p', name: 'P', netId: vccNet },
      { id: 'v1-n', name: 'N', netId: gndNet },
    ],
    position: { x: -100, y: 0 },
    rotation: 0,
  };

  const r2: Component = {
    id: 'R2',
    type: 'resistor',
    refDesignator: 'R2',
    value: `${r2Ohm}`,
    ports: [
      { id: 'r2-p1', name: 'P', netId: vccNet },
      { id: 'r2-p2', name: 'N', netId: midNet },
    ],
    position: { x: 0, y: 0 },
    rotation: 0,
  };

  const r1: Component = {
    id: 'R1',
    type: 'resistor',
    refDesignator: 'R1',
    value: `${r1Ohm}`,
    ports: [
      { id: 'r1-p1', name: 'P', netId: midNet },
      { id: 'r1-p2', name: 'N', netId: gndNet },
    ],
    position: { x: 100, y: 0 },
    rotation: 0,
  };

  return {
    components: new Map([['V1', voltageSource], ['R2', r2], ['R1', r1]]),
    wires: new Map(),
    nets: new Map([
      [vccNet, { id: vccNet, name: vccNet, portIds: ['v1-p', 'r2-p1'] }],
      [midNet, { id: midNet, name: midNet, portIds: ['r2-p2', 'r1-p1'] }],
      [gndNet, { id: gndNet, name: gndNet, portIds: ['v1-n', 'r1-p2'] }],
    ]),
  };
}

function buildSingleResistorCircuit(): Circuit {
  const r: Component = {
    id: 'R1',
    type: 'resistor',
    refDesignator: 'R1',
    value: '1000',
    ports: [
      { id: 'r1-p1', name: 'P', netId: 'net-in' },
      { id: 'r1-p2', name: 'N', netId: '0' },
    ],
    position: { x: 0, y: 0 },
    rotation: 0,
  };
  return {
    components: new Map([['R1', r]]),
    wires: new Map(),
    nets: new Map([
      ['net-in', { id: 'net-in', name: 'net-in', portIds: ['r1-p1'] }],
      ['0', { id: '0', name: '0', portIds: ['r1-p2'] }],
    ]),
  };
}

describe('voltageDividerRatio rule', () => {
  it('detects a 50/50 divider (R1=R2=1k, Vcc=5V) → 2.50V output', () => {
    const circuit = buildVoltageDivider(1000, 1000, 5);
    const insight = voltageDividerRatio.evaluate({ circuit, vectors: [], measurements: [] });
    expect(insight).not.toBeNull();
    expect(insight!.summary).toContain('50.0%');
    expect(insight!.summary).toContain('2.50 V');
    expect(insight!.rule).toBe('voltage-divider-ratio');
    expect(insight!.anchor.kind).toBe('schematic-net');
  });

  it('detects a 1/3 divider (R1=1k, R2=2k, Vcc=3V) → 1.00V output', () => {
    const circuit = buildVoltageDivider(1000, 2000, 3);
    const insight = voltageDividerRatio.evaluate({ circuit, vectors: [], measurements: [] });
    expect(insight).not.toBeNull();
    expect(insight!.summary).toContain('33.3%');
    expect(insight!.summary).toContain('1.00 V');
  });

  it('returns null when circuit has only one resistor', () => {
    const circuit = buildSingleResistorCircuit();
    const insight = voltageDividerRatio.evaluate({ circuit, vectors: [], measurements: [] });
    expect(insight).toBeNull();
  });

  it('includes a KaTeX formula', () => {
    const circuit = buildVoltageDivider(1000, 1000, 5);
    const insight = voltageDividerRatio.evaluate({ circuit, vectors: [], measurements: [] });
    expect(insight!.formula).toBeDefined();
    expect(insight!.formula).toContain('V_{out}');
  });
});
