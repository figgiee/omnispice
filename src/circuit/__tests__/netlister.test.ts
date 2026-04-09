import { describe, it, expect } from 'vitest';
import {
  generateNetlist,
  componentToSpiceLine,
  analysisToDirective,
} from '../netlister';
import { COMPONENT_LIBRARY } from '../componentLibrary';
import type { Circuit, Component, Wire, AnalysisConfig, ComponentType } from '../types';

/**
 * Helper to create a component with typed ports.
 */
function makeComponent(
  overrides: Partial<Component> & { id: string; type: Component['type'] }
): Component {
  return {
    refDesignator: overrides.id.toUpperCase(),
    value: '',
    ports: [],
    position: { x: 0, y: 0 },
    rotation: 0,
    ...overrides,
  };
}

function makeWire(id: string, sourcePortId: string, targetPortId: string): Wire {
  return { id, sourcePortId, targetPortId, bendPoints: [] };
}

/**
 * Build a simple circuit: V1(5V) -- R1(10k) -- GND
 */
function buildSimpleResistorCircuit(): Circuit {
  const components = new Map<string, Component>();
  const v1 = makeComponent({
    id: 'v1',
    type: 'dc_voltage',
    refDesignator: 'V1',
    value: '5',
    ports: [
      { id: 'v1_pos', name: 'positive', netId: null },
      { id: 'v1_neg', name: 'negative', netId: null },
    ],
  });
  const r1 = makeComponent({
    id: 'r1',
    type: 'resistor',
    refDesignator: 'R1',
    value: '10k',
    ports: [
      { id: 'r1_p1', name: 'pin1', netId: null },
      { id: 'r1_p2', name: 'pin2', netId: null },
    ],
  });
  const gnd = makeComponent({
    id: 'gnd1',
    type: 'ground',
    refDesignator: 'GND',
    ports: [{ id: 'gnd1_p1', name: 'pin1', netId: null }],
  });
  components.set('v1', v1);
  components.set('r1', r1);
  components.set('gnd1', gnd);

  const wires = new Map<string, Wire>();
  // V1 positive -> R1 pin1
  wires.set('w1', makeWire('w1', 'v1_pos', 'r1_p1'));
  // R1 pin2 -> GND
  wires.set('w2', makeWire('w2', 'r1_p2', 'gnd1_p1'));
  // V1 negative -> GND
  wires.set('w3', makeWire('w3', 'v1_neg', 'gnd1_p1'));

  return { components, wires, nets: new Map() };
}

/**
 * Build an RC circuit: V1(5V) -- R1(10k) --+-- C1(100n) -- GND
 *                                           |
 *                                          GND (V1 neg)
 */
function buildRCCircuit(): Circuit {
  const components = new Map<string, Component>();
  const v1 = makeComponent({
    id: 'v1',
    type: 'dc_voltage',
    refDesignator: 'V1',
    value: '5',
    ports: [
      { id: 'v1_pos', name: 'positive', netId: null },
      { id: 'v1_neg', name: 'negative', netId: null },
    ],
  });
  const r1 = makeComponent({
    id: 'r1',
    type: 'resistor',
    refDesignator: 'R1',
    value: '10k',
    ports: [
      { id: 'r1_p1', name: 'pin1', netId: null },
      { id: 'r1_p2', name: 'pin2', netId: null },
    ],
  });
  const c1 = makeComponent({
    id: 'c1',
    type: 'capacitor',
    refDesignator: 'C1',
    value: '100n',
    ports: [
      { id: 'c1_p1', name: 'pin1', netId: null },
      { id: 'c1_p2', name: 'pin2', netId: null },
    ],
  });
  const gnd = makeComponent({
    id: 'gnd1',
    type: 'ground',
    refDesignator: 'GND',
    ports: [{ id: 'gnd1_p1', name: 'pin1', netId: null }],
  });
  components.set('v1', v1);
  components.set('r1', r1);
  components.set('c1', c1);
  components.set('gnd1', gnd);

  const wires = new Map<string, Wire>();
  // V1 positive -> R1 pin1
  wires.set('w1', makeWire('w1', 'v1_pos', 'r1_p1'));
  // R1 pin2 -> C1 pin1 (shared net)
  wires.set('w2', makeWire('w2', 'r1_p2', 'c1_p1'));
  // C1 pin2 -> GND
  wires.set('w3', makeWire('w3', 'c1_p2', 'gnd1_p1'));
  // V1 negative -> GND
  wires.set('w4', makeWire('w4', 'v1_neg', 'gnd1_p1'));

  return { components, wires, nets: new Map() };
}

describe('generateNetlist', () => {
  it('produces valid SPICE for single resistor + voltage source + ground', () => {
    const circuit = buildSimpleResistorCircuit();
    const config: AnalysisConfig = {
      type: 'transient',
      timeStep: '1u',
      stopTime: '10m',
    };

    const netlist = generateNetlist(circuit, config);

    // Should contain title
    expect(netlist).toContain('* OmniSpice Generated Netlist');
    // Should contain R1 with value
    expect(netlist).toContain('R1');
    expect(netlist).toContain('10k');
    // Should contain V1 with dc value
    expect(netlist).toContain('V1');
    expect(netlist).toContain('dc 5');
    // Should contain transient analysis
    expect(netlist).toContain('.tran 1u 10m');
    // Should contain .end
    expect(netlist).toContain('.end');
    // Ground should map to node 0
    expect(netlist).toContain(' 0 ');
    // Should NOT contain ground as a component line
    expect(netlist).not.toMatch(/^GND/m);
  });

  it('produces correct net assignments for RC circuit (shared net between R and C)', () => {
    const circuit = buildRCCircuit();
    const config: AnalysisConfig = {
      type: 'transient',
      timeStep: '1u',
      stopTime: '10m',
    };

    const netlist = generateNetlist(circuit, config);

    // The R1 line and C1 line should share a net name (the junction between R and C)
    const lines = netlist.split('\n');
    const r1Line = lines.find((l) => l.startsWith('R1'));
    const c1Line = lines.find((l) => l.startsWith('C1'));
    expect(r1Line).toBeDefined();
    expect(c1Line).toBeDefined();

    // R1 format: R1 <net_a> <net_b> 10k
    const r1Parts = r1Line!.split(/\s+/);
    // C1 format: C1 <net_c> <net_d> 100n
    const c1Parts = c1Line!.split(/\s+/);

    // R1 pin2 net should equal C1 pin1 net (they share a wire)
    expect(r1Parts[2]).toBe(c1Parts[1]);

    // C1 pin2 should be ground (0)
    expect(c1Parts[2]).toBe('0');
  });

  it('handles ground as node 0 in netlist', () => {
    const circuit = buildSimpleResistorCircuit();
    const config: AnalysisConfig = { type: 'dc_op' };
    const netlist = generateNetlist(circuit, config);

    // V1 negative is connected to ground, so should reference node 0
    const v1Line = netlist.split('\n').find((l) => l.startsWith('V1'));
    expect(v1Line).toBeDefined();
    expect(v1Line).toContain(' 0 ');
  });
});

describe('componentToSpiceLine', () => {
  const portToNet = new Map<string, string>([
    ['p1', 'net_1'],
    ['p2', '0'],
    ['p3', 'net_2'],
    ['p4', 'net_3'],
  ]);

  it('generates correct SPICE for resistor', () => {
    const comp = makeComponent({
      id: 'r1',
      type: 'resistor',
      refDesignator: 'R1',
      value: '10k',
      ports: [
        { id: 'p1', name: 'pin1', netId: 'net_1' },
        { id: 'p2', name: 'pin2', netId: '0' },
      ],
    });
    expect(componentToSpiceLine(comp, portToNet)).toBe('R1 net_1 0 10k');
  });

  it('generates correct SPICE for capacitor', () => {
    const comp = makeComponent({
      id: 'c1',
      type: 'capacitor',
      refDesignator: 'C1',
      value: '100n',
      ports: [
        { id: 'p1', name: 'pin1', netId: 'net_1' },
        { id: 'p2', name: 'pin2', netId: '0' },
      ],
    });
    expect(componentToSpiceLine(comp, portToNet)).toBe('C1 net_1 0 100n');
  });

  it('generates correct SPICE for inductor', () => {
    const comp = makeComponent({
      id: 'l1',
      type: 'inductor',
      refDesignator: 'L1',
      value: '1m',
      ports: [
        { id: 'p1', name: 'pin1', netId: 'net_1' },
        { id: 'p2', name: 'pin2', netId: '0' },
      ],
    });
    expect(componentToSpiceLine(comp, portToNet)).toBe('L1 net_1 0 1m');
  });

  it('generates correct SPICE for diode with model', () => {
    const comp = makeComponent({
      id: 'd1',
      type: 'diode',
      refDesignator: 'D1',
      ports: [
        { id: 'p1', name: 'anode', netId: 'net_1' },
        { id: 'p2', name: 'cathode', netId: '0' },
      ],
    });
    expect(componentToSpiceLine(comp, portToNet)).toBe('D1 net_1 0 D1N4148');
  });

  it('generates correct SPICE for NPN BJT (collector, base, emitter order)', () => {
    const comp = makeComponent({
      id: 'q1',
      type: 'npn_bjt',
      refDesignator: 'Q1',
      ports: [
        { id: 'p1', name: 'base', netId: 'net_1' },
        { id: 'p3', name: 'collector', netId: 'net_2' },
        { id: 'p2', name: 'emitter', netId: '0' },
      ],
    });
    // SPICE format: Q1 collector base emitter model
    expect(componentToSpiceLine(comp, portToNet)).toBe(
      'Q1 net_2 net_1 0 Q2N2222'
    );
  });

  it('generates correct SPICE for NMOS (drain, gate, source, bulk order)', () => {
    const comp = makeComponent({
      id: 'm1',
      type: 'nmos',
      refDesignator: 'M1',
      ports: [
        { id: 'p1', name: 'gate', netId: 'net_1' },
        { id: 'p3', name: 'drain', netId: 'net_2' },
        { id: 'p2', name: 'source', netId: '0' },
      ],
    });
    // SPICE format: M1 drain gate source source model
    expect(componentToSpiceLine(comp, portToNet)).toBe(
      'M1 net_2 net_1 0 0 NMOS1'
    );
  });

  it('generates correct SPICE for subcircuit op-amp', () => {
    const comp = makeComponent({
      id: 'x1',
      type: 'ideal_opamp',
      refDesignator: 'X1',
      ports: [
        { id: 'p1', name: 'non_inv', netId: 'net_1' },
        { id: 'p2', name: 'inv', netId: '0' },
        { id: 'p3', name: 'output', netId: 'net_2' },
      ],
    });
    expect(componentToSpiceLine(comp, portToNet)).toBe(
      'X1 net_1 0 net_2 IDEAL_OPAMP'
    );
  });

  it('generates correct SPICE for DC voltage source', () => {
    const comp = makeComponent({
      id: 'v1',
      type: 'dc_voltage',
      refDesignator: 'V1',
      value: '5',
      ports: [
        { id: 'p1', name: 'positive', netId: 'net_1' },
        { id: 'p2', name: 'negative', netId: '0' },
      ],
    });
    expect(componentToSpiceLine(comp, portToNet)).toBe('V1 net_1 0 dc 5');
  });

  it('generates correct SPICE for AC voltage source', () => {
    const comp = makeComponent({
      id: 'v2',
      type: 'ac_voltage',
      refDesignator: 'V2',
      value: '1',
      ports: [
        { id: 'p1', name: 'positive', netId: 'net_1' },
        { id: 'p2', name: 'negative', netId: '0' },
      ],
    });
    expect(componentToSpiceLine(comp, portToNet)).toBe('V2 net_1 0 ac 1');
  });

  it('generates correct SPICE for DC current source', () => {
    const comp = makeComponent({
      id: 'i1',
      type: 'dc_current',
      refDesignator: 'I1',
      value: '1m',
      ports: [
        { id: 'p1', name: 'in', netId: 'net_1' },
        { id: 'p2', name: 'out', netId: '0' },
      ],
    });
    expect(componentToSpiceLine(comp, portToNet)).toBe('I1 net_1 0 dc 1m');
  });
});

describe('analysisToDirective', () => {
  it('generates .op for DC operating point', () => {
    expect(analysisToDirective({ type: 'dc_op' })).toBe('.op');
  });

  it('generates .tran for transient analysis', () => {
    expect(
      analysisToDirective({
        type: 'transient',
        timeStep: '1u',
        stopTime: '10m',
      })
    ).toBe('.tran 1u 10m');
  });

  it('generates .ac for AC analysis', () => {
    expect(
      analysisToDirective({
        type: 'ac',
        pointsPerDecade: 100,
        startFreq: '1',
        stopFreq: '1MEG',
      })
    ).toBe('.ac dec 100 1 1MEG');
  });

  it('generates .dc for DC sweep', () => {
    expect(
      analysisToDirective({
        type: 'dc_sweep',
        sweepSource: 'V1',
        sweepStart: '0',
        sweepStop: '5',
        sweepStep: '0.1',
      })
    ).toBe('.dc V1 0 5 0.1');
  });

  it('handles transient with start time', () => {
    expect(
      analysisToDirective({
        type: 'transient',
        timeStep: '1u',
        stopTime: '10m',
        startTime: '1m',
      })
    ).toBe('.tran 1u 10m 1m');
  });
});

describe('COMPONENT_LIBRARY coverage', () => {
  const expectedTypes: ComponentType[] = [
    'resistor',
    'capacitor',
    'inductor',
    'transformer',
    'diode',
    'zener_diode',
    'schottky_diode',
    'npn_bjt',
    'pnp_bjt',
    'nmos',
    'pmos',
    'ideal_opamp',
    'ua741',
    'lm741',
    'dc_voltage',
    'ac_voltage',
    'pulse_voltage',
    'sin_voltage',
    'pwl_voltage',
    'dc_current',
    'ac_current',
    'ground',
  ];

  it('has entries for all Phase 1 component types', () => {
    for (const type of expectedTypes) {
      expect(COMPONENT_LIBRARY[type]).toBeDefined();
      expect(COMPONENT_LIBRARY[type].type).toBe(type);
    }
  });

  it('has at least 22 entries (all Phase 1 types)', () => {
    expect(Object.keys(COMPONENT_LIBRARY).length).toBeGreaterThanOrEqual(22);
  });

  it('each entry has required fields', () => {
    for (const def of Object.values(COMPONENT_LIBRARY)) {
      expect(def.name).toBeTruthy();
      expect(def.category).toBeTruthy();
      expect(def.ports.length).toBeGreaterThan(0);
      // spicePrefix may be empty for ground
      if (def.type !== 'ground') {
        expect(def.spicePrefix).toBeTruthy();
      }
    }
  });

  it('semiconductors have default models', () => {
    const semis: ComponentType[] = [
      'diode',
      'zener_diode',
      'schottky_diode',
      'npn_bjt',
      'pnp_bjt',
      'nmos',
      'pmos',
    ];
    for (const type of semis) {
      expect(COMPONENT_LIBRARY[type].defaultModel).toBeTruthy();
    }
  });

  it('op-amps are marked as subcircuits', () => {
    const opamps: ComponentType[] = ['ideal_opamp', 'ua741', 'lm741'];
    for (const type of opamps) {
      expect(COMPONENT_LIBRARY[type].subcircuit).toBe(true);
      expect(COMPONENT_LIBRARY[type].spicePrefix).toBe('X');
    }
  });
});
