import { describe, it, expect } from 'vitest';
import { COMPONENT_LIBRARY } from '../componentLibrary';
import type { PinType } from '../types';

/**
 * Pin metadata coverage tests for the component library.
 *
 * Enforces the invariants that downstream plans (05-03 subcircuits,
 * 05-04 tiered controller) assume:
 *   1. Every port in every library entry declares pinType + direction
 *   2. BJT pins are all 'signal' (D-01: signal↔supply = neutral lets
 *      BJT collector → V+ stay friendly without needing 'supply' here)
 *   3. Voltage/current sources declare 'supply' on both terminals
 *   4. Ground is 'ground'
 *   5. Op-amps use 'signal' for V+/V-/Vout (no separate Vcc/Vee pins in
 *      the current op-amp models; power is implicit)
 */
describe('COMPONENT_LIBRARY pin metadata', () => {
  it('every port has pinType and direction defined', () => {
    for (const [type, def] of Object.entries(COMPONENT_LIBRARY)) {
      for (const port of def.ports) {
        expect(port.pinType, `${type}.${port.name} missing pinType`).toBeDefined();
        expect(port.direction, `${type}.${port.name} missing direction`).toBeDefined();
      }
    }
  });

  it('every port declares a human-readable label', () => {
    for (const [type, def] of Object.entries(COMPONENT_LIBRARY)) {
      for (const port of def.ports) {
        expect(port.label, `${type}.${port.name} missing label`).toBeDefined();
      }
    }
  });

  it('resistor has 2 signal inout pins', () => {
    const ports = COMPONENT_LIBRARY.resistor.ports;
    expect(ports).toHaveLength(2);
    for (const port of ports) {
      expect(port.pinType).toBe('signal');
      expect(port.direction).toBe('inout');
    }
  });

  it('capacitor and inductor pins are signal inout', () => {
    for (const type of ['capacitor', 'inductor'] as const) {
      for (const port of COMPONENT_LIBRARY[type].ports) {
        expect(port.pinType).toBe('signal');
        expect(port.direction).toBe('inout');
      }
    }
  });

  it('NPN BJT pins are all signal inout with labels B/C/E', () => {
    const ports = COMPONENT_LIBRARY.npn_bjt.ports;
    expect(ports).toHaveLength(3);
    expect(ports.every((p) => p.pinType === 'signal')).toBe(true);
    expect(ports.every((p) => p.direction === 'inout')).toBe(true);
    const labels = ports.map((p) => p.label).sort();
    expect(labels).toEqual(['B', 'C', 'E']);
  });

  it('PNP BJT pins are all signal (D-01 compat handles supply elsewhere)', () => {
    expect(COMPONENT_LIBRARY.pnp_bjt.ports.every((p) => p.pinType === 'signal')).toBe(true);
  });

  it('NMOS and PMOS pins are all signal inout with labels G/D/S', () => {
    for (const type of ['nmos', 'pmos'] as const) {
      const ports = COMPONENT_LIBRARY[type].ports;
      expect(ports.every((p) => p.pinType === 'signal')).toBe(true);
      const labels = ports.map((p) => p.label).sort();
      expect(labels).toEqual(['D', 'G', 'S']);
    }
  });

  it('ideal op-amp has 3 signal pins (V+ in, V− in, Vout out)', () => {
    const ports = COMPONENT_LIBRARY.ideal_opamp.ports;
    expect(ports).toHaveLength(3);
    expect(ports.filter((p) => p.pinType === 'signal')).toHaveLength(3);
    // directions differ: inputs are 'in', output is 'out'
    expect(ports.filter((p) => p.direction === 'in')).toHaveLength(2);
    expect(ports.filter((p) => p.direction === 'out')).toHaveLength(1);
  });

  it('uA741 and LM741 op-amps inherit the ideal op-amp pin shape', () => {
    for (const type of ['ua741', 'lm741'] as const) {
      const ports = COMPONENT_LIBRARY[type].ports;
      expect(ports).toHaveLength(3);
      expect(ports.every((p) => p.pinType === 'signal')).toBe(true);
    }
  });

  it('all voltage source variants declare both pins as supply', () => {
    const voltageSources = ['dc_voltage', 'ac_voltage', 'pulse_voltage', 'sin_voltage', 'pwl_voltage'] as const;
    for (const type of voltageSources) {
      const ports = COMPONENT_LIBRARY[type].ports;
      expect(ports).toHaveLength(2);
      expect(ports.every((p) => p.pinType === 'supply')).toBe(true);
    }
  });

  it('all current source variants declare both pins as supply', () => {
    for (const type of ['dc_current', 'ac_current'] as const) {
      const ports = COMPONENT_LIBRARY[type].ports;
      expect(ports).toHaveLength(2);
      expect(ports.every((p) => p.pinType === 'supply')).toBe(true);
    }
  });

  it('ground declares a single ground-type pin', () => {
    const ports = COMPONENT_LIBRARY.ground.ports;
    expect(ports).toHaveLength(1);
    expect(ports[0]?.pinType).toBe('ground');
    expect(ports[0]?.label).toBe('GND');
  });

  it('transformer has 4 signal inout pins with P1/P2/S1/S2 labels', () => {
    const ports = COMPONENT_LIBRARY.transformer.ports;
    expect(ports).toHaveLength(4);
    expect(ports.every((p) => p.pinType === 'signal')).toBe(true);
    const labels = ports.map((p) => p.label).sort();
    expect(labels).toEqual(['P1', 'P2', 'S1', 'S2']);
  });

  it('every declared pinType is one of the 4 legal values', () => {
    const legalTypes: PinType[] = ['signal', 'power', 'ground', 'supply'];
    for (const def of Object.values(COMPONENT_LIBRARY)) {
      for (const port of def.ports) {
        expect(legalTypes).toContain(port.pinType);
      }
    }
  });
});
