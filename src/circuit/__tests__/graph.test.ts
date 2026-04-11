import { describe, expect, it } from 'vitest';
import { buildPortToNetMap, computeNets } from '../graph';
import type { Component, Wire } from '../types';

/**
 * Helper to create a component with typed ports.
 */
function makeComponent(
  overrides: Partial<Component> & { id: string; type: Component['type'] },
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

describe('computeNets', () => {
  it('merges ports connected by a wire into the same net', () => {
    const components = new Map<string, Component>();
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
    const r2 = makeComponent({
      id: 'r2',
      type: 'resistor',
      refDesignator: 'R2',
      value: '5k',
      ports: [
        { id: 'r2_p1', name: 'pin1', netId: null },
        { id: 'r2_p2', name: 'pin2', netId: null },
      ],
    });
    components.set('r1', r1);
    components.set('r2', r2);

    // Wire connects r1_p2 to r2_p1 (series connection)
    const wires = new Map<string, Wire>();
    wires.set('w1', makeWire('w1', 'r1_p2', 'r2_p1'));

    const nets = computeNets(components, wires);
    const portToNet = buildPortToNetMap(nets);

    // r1_p2 and r2_p1 should be on the same net
    expect(portToNet.get('r1_p2')).toBe(portToNet.get('r2_p1'));

    // r1_p1 and r2_p2 should be on different nets
    expect(portToNet.get('r1_p1')).not.toBe(portToNet.get('r2_p2'));
  });

  it('maps ground component ports to net "0"', () => {
    const components = new Map<string, Component>();
    const gnd = makeComponent({
      id: 'gnd1',
      type: 'ground',
      refDesignator: 'GND',
      ports: [{ id: 'gnd1_p1', name: 'pin1', netId: null }],
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
    components.set('gnd1', gnd);
    components.set('r1', r1);

    // Wire connects r1_p2 to ground
    const wires = new Map<string, Wire>();
    wires.set('w1', makeWire('w1', 'r1_p2', 'gnd1_p1'));

    const nets = computeNets(components, wires);
    const portToNet = buildPortToNetMap(nets);

    // Ground net should be "0"
    expect(portToNet.get('gnd1_p1')).toBe('0');
    // r1_p2 connected to ground should also be "0"
    expect(portToNet.get('r1_p2')).toBe('0');
    // r1_p1 should be a different net
    expect(portToNet.get('r1_p1')).not.toBe('0');
  });

  it('handles multiple ground components merging into net "0"', () => {
    const components = new Map<string, Component>();
    const gnd1 = makeComponent({
      id: 'gnd1',
      type: 'ground',
      ports: [{ id: 'gnd1_p1', name: 'pin1', netId: null }],
    });
    const gnd2 = makeComponent({
      id: 'gnd2',
      type: 'ground',
      ports: [{ id: 'gnd2_p1', name: 'pin1', netId: null }],
    });
    components.set('gnd1', gnd1);
    components.set('gnd2', gnd2);

    const wires = new Map<string, Wire>();
    const nets = computeNets(components, wires);
    const portToNet = buildPortToNetMap(nets);

    // Both ground ports should be on net "0"
    expect(portToNet.get('gnd1_p1')).toBe('0');
    expect(portToNet.get('gnd2_p1')).toBe('0');
  });

  it('mutates port netId on the component objects', () => {
    const components = new Map<string, Component>();
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
      ports: [{ id: 'gnd1_p1', name: 'pin1', netId: null }],
    });
    components.set('r1', r1);
    components.set('gnd1', gnd);

    const wires = new Map<string, Wire>();
    wires.set('w1', makeWire('w1', 'r1_p2', 'gnd1_p1'));

    computeNets(components, wires);

    expect(r1.ports[1].netId).toBe('0');
    expect(r1.ports[0].netId).not.toBeNull();
  });

  it('assigns unique net names to disconnected groups', () => {
    const components = new Map<string, Component>();
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
    components.set('r1', r1);

    const wires = new Map<string, Wire>();
    const nets = computeNets(components, wires);
    const portToNet = buildPortToNetMap(nets);

    // Two unconnected ports should have different net names
    const net1 = portToNet.get('r1_p1');
    const net2 = portToNet.get('r1_p2');
    expect(net1).toBeDefined();
    expect(net2).toBeDefined();
    expect(net1).not.toBe(net2);
  });
});

describe('computeNets — net label overrides (Plan 05-02 Task 4)', () => {
  it('uses NetLabelNode names when present on a non-ground net', () => {
    const components = new Map<string, Component>();
    const r1 = makeComponent({
      id: 'r1',
      type: 'resistor',
      ports: [
        { id: 'r1_p1', name: 'pin1', netId: null },
        { id: 'r1_p2', name: 'pin2', netId: null },
      ],
    });
    const r2 = makeComponent({
      id: 'r2',
      type: 'resistor',
      ports: [
        { id: 'r2_p1', name: 'pin1', netId: null },
        { id: 'r2_p2', name: 'pin2', netId: null },
      ],
    });
    const label = makeComponent({
      id: 'nl1',
      type: 'net_label',
      netLabel: 'VOUT',
      ports: [{ id: 'nl1_p1', name: 'pin1', netId: null }],
    });
    components.set('r1', r1);
    components.set('r2', r2);
    components.set('nl1', label);

    // Wires: r1_p2 -> nl1_p1, nl1_p1 -> r2_p1
    const wires = new Map<string, Wire>();
    wires.set('w1', makeWire('w1', 'r1_p2', 'nl1_p1'));
    wires.set('w2', makeWire('w2', 'nl1_p1', 'r2_p1'));

    const nets = computeNets(components, wires);
    const portToNet = buildPortToNetMap(nets);

    expect(portToNet.get('r1_p2')).toBe('VOUT');
    expect(portToNet.get('r2_p1')).toBe('VOUT');
    expect(portToNet.get('nl1_p1')).toBe('VOUT');
    // r1_p1 is a different net, no label
    expect(portToNet.get('r1_p1')).not.toBe('VOUT');
  });

  it('reports the same label across all wire segments in a net', () => {
    const components = new Map<string, Component>();
    // Chain of three resistors with a label on the middle node
    const r1 = makeComponent({
      id: 'r1',
      type: 'resistor',
      ports: [
        { id: 'r1_p1', name: 'pin1', netId: null },
        { id: 'r1_p2', name: 'pin2', netId: null },
      ],
    });
    const r2 = makeComponent({
      id: 'r2',
      type: 'resistor',
      ports: [
        { id: 'r2_p1', name: 'pin1', netId: null },
        { id: 'r2_p2', name: 'pin2', netId: null },
      ],
    });
    const r3 = makeComponent({
      id: 'r3',
      type: 'resistor',
      ports: [
        { id: 'r3_p1', name: 'pin1', netId: null },
        { id: 'r3_p2', name: 'pin2', netId: null },
      ],
    });
    const label = makeComponent({
      id: 'nl1',
      type: 'net_label',
      netLabel: 'IN',
      ports: [{ id: 'nl1_p1', name: 'pin1', netId: null }],
    });
    components.set('r1', r1);
    components.set('r2', r2);
    components.set('r3', r3);
    components.set('nl1', label);

    const wires = new Map<string, Wire>();
    wires.set('w1', makeWire('w1', 'r1_p2', 'r2_p1'));
    wires.set('w2', makeWire('w2', 'r2_p1', 'nl1_p1'));
    wires.set('w3', makeWire('w3', 'r2_p1', 'r3_p1'));

    computeNets(components, wires);
    expect(r1.ports[1]?.netId).toBe('IN');
    expect(r2.ports[0]?.netId).toBe('IN');
    expect(r3.ports[0]?.netId).toBe('IN');
  });

  it('ground net is never overridden by a label', () => {
    const components = new Map<string, Component>();
    const gnd = makeComponent({
      id: 'gnd1',
      type: 'ground',
      ports: [{ id: 'gnd1_p1', name: 'pin1', netId: null }],
    });
    // User attached a label to the ground net — this should NOT rename "0"
    const label = makeComponent({
      id: 'nl1',
      type: 'net_label',
      netLabel: 'NOT_GND',
      ports: [{ id: 'nl1_p1', name: 'pin1', netId: null }],
    });
    components.set('gnd1', gnd);
    components.set('nl1', label);

    const wires = new Map<string, Wire>();
    wires.set('w1', makeWire('w1', 'gnd1_p1', 'nl1_p1'));

    const nets = computeNets(components, wires);
    const portToNet = buildPortToNetMap(nets);
    expect(portToNet.get('gnd1_p1')).toBe('0');
    expect(portToNet.get('nl1_p1')).toBe('0');
  });

  it('picks first alphabetically when two labels conflict on the same net', () => {
    const components = new Map<string, Component>();
    const r1 = makeComponent({
      id: 'r1',
      type: 'resistor',
      ports: [
        { id: 'r1_p1', name: 'pin1', netId: null },
        { id: 'r1_p2', name: 'pin2', netId: null },
      ],
    });
    const labelA = makeComponent({
      id: 'nlA',
      type: 'net_label',
      netLabel: 'ZED',
      ports: [{ id: 'nlA_p1', name: 'pin1', netId: null }],
    });
    const labelB = makeComponent({
      id: 'nlB',
      type: 'net_label',
      netLabel: 'ALPHA',
      ports: [{ id: 'nlB_p1', name: 'pin1', netId: null }],
    });
    components.set('r1', r1);
    components.set('nlA', labelA);
    components.set('nlB', labelB);

    const wires = new Map<string, Wire>();
    wires.set('w1', makeWire('w1', 'r1_p1', 'nlA_p1'));
    wires.set('w2', makeWire('w2', 'nlA_p1', 'nlB_p1'));

    const nets = computeNets(components, wires);
    const portToNet = buildPortToNetMap(nets);
    // ALPHA < ZED lexicographically
    expect(portToNet.get('r1_p1')).toBe('ALPHA');
  });
});
