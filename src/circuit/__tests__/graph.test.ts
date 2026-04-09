import { describe, it, expect } from 'vitest';
import { computeNets, buildPortToNetMap } from '../graph';
import type { Component, Wire } from '../types';

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
