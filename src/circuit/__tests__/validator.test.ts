import { describe, it, expect } from 'vitest';
import { validateCircuit, type ValidationError } from '../validator';
import type { Circuit, Component, Wire } from '../types';

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

function makeCircuit(
  components: Component[],
  wires: Wire[] = []
): Circuit {
  const compMap = new Map<string, Component>();
  for (const c of components) compMap.set(c.id, c);
  const wireMap = new Map<string, Wire>();
  for (const w of wires) wireMap.set(w.id, w);
  return { components: compMap, wires: wireMap, nets: new Map() };
}

describe('validateCircuit', () => {
  it('returns error with type "no_ground" when circuit has no ground', () => {
    const circuit = makeCircuit([
      makeComponent({
        id: 'r1',
        type: 'resistor',
        refDesignator: 'R1',
        value: '10k',
        ports: [
          { id: 'r1_p1', name: 'pin1', netId: null },
          { id: 'r1_p2', name: 'pin2', netId: null },
        ],
      }),
      makeComponent({
        id: 'v1',
        type: 'dc_voltage',
        refDesignator: 'V1',
        value: '5',
        ports: [
          { id: 'v1_pos', name: 'positive', netId: null },
          { id: 'v1_neg', name: 'negative', netId: null },
        ],
      }),
    ]);

    const errors = validateCircuit(circuit);
    const groundErrors = errors.filter((e) => e.type === 'no_ground');

    expect(groundErrors.length).toBeGreaterThanOrEqual(1);
    expect(groundErrors[0].message).toBe('No ground connection');
    expect(groundErrors[0].severity).toBe('error');
  });

  it('returns warning with type "floating_node" for unconnected port', () => {
    const circuit = makeCircuit(
      [
        makeComponent({
          id: 'r1',
          type: 'resistor',
          refDesignator: 'R1',
          value: '10k',
          ports: [
            { id: 'r1_p1', name: 'pin1', netId: null },
            { id: 'r1_p2', name: 'pin2', netId: null },
          ],
        }),
        makeComponent({
          id: 'gnd1',
          type: 'ground',
          ports: [{ id: 'gnd1_p1', name: 'pin1', netId: null }],
        }),
      ],
      [makeWire('w1', 'r1_p2', 'gnd1_p1')]
    );

    const errors = validateCircuit(circuit);
    const floatingErrors = errors.filter((e) => e.type === 'floating_node');

    expect(floatingErrors.length).toBeGreaterThanOrEqual(1);
    // Should reference the component ref designator and pin name
    expect(floatingErrors[0].message).toContain('R1');
    expect(floatingErrors[0].message).toContain('pin1');
    expect(floatingErrors[0].severity).toBe('warning');
  });

  it('returns error with type "source_loop" for parallel voltage sources', () => {
    const circuit = makeCircuit(
      [
        makeComponent({
          id: 'v1',
          type: 'dc_voltage',
          refDesignator: 'V1',
          value: '5',
          ports: [
            { id: 'v1_pos', name: 'positive', netId: 'net_1' },
            { id: 'v1_neg', name: 'negative', netId: '0' },
          ],
        }),
        makeComponent({
          id: 'v2',
          type: 'dc_voltage',
          refDesignator: 'V2',
          value: '3',
          ports: [
            { id: 'v2_pos', name: 'positive', netId: 'net_1' },
            { id: 'v2_neg', name: 'negative', netId: '0' },
          ],
        }),
        makeComponent({
          id: 'gnd1',
          type: 'ground',
          ports: [{ id: 'gnd1_p1', name: 'pin1', netId: null }],
        }),
      ],
      [
        makeWire('w1', 'v1_pos', 'v2_pos'),
        makeWire('w2', 'v1_neg', 'gnd1_p1'),
        makeWire('w3', 'v2_neg', 'gnd1_p1'),
      ]
    );

    const errors = validateCircuit(circuit);
    const sourceLoopErrors = errors.filter((e) => e.type === 'source_loop');

    expect(sourceLoopErrors.length).toBeGreaterThanOrEqual(1);
    expect(sourceLoopErrors[0].message).toContain('V1');
    expect(sourceLoopErrors[0].message).toContain('V2');
    expect(sourceLoopErrors[0].severity).toBe('error');
  });

  it('returns empty error array for valid RC circuit with ground', () => {
    const circuit = makeCircuit(
      [
        makeComponent({
          id: 'v1',
          type: 'dc_voltage',
          refDesignator: 'V1',
          value: '5',
          ports: [
            { id: 'v1_pos', name: 'positive', netId: null },
            { id: 'v1_neg', name: 'negative', netId: null },
          ],
        }),
        makeComponent({
          id: 'r1',
          type: 'resistor',
          refDesignator: 'R1',
          value: '10k',
          ports: [
            { id: 'r1_p1', name: 'pin1', netId: null },
            { id: 'r1_p2', name: 'pin2', netId: null },
          ],
        }),
        makeComponent({
          id: 'c1',
          type: 'capacitor',
          refDesignator: 'C1',
          value: '100n',
          ports: [
            { id: 'c1_p1', name: 'pin1', netId: null },
            { id: 'c1_p2', name: 'pin2', netId: null },
          ],
        }),
        makeComponent({
          id: 'gnd1',
          type: 'ground',
          ports: [{ id: 'gnd1_p1', name: 'pin1', netId: null }],
        }),
      ],
      [
        makeWire('w1', 'v1_pos', 'r1_p1'),
        makeWire('w2', 'r1_p2', 'c1_p1'),
        makeWire('w3', 'c1_p2', 'gnd1_p1'),
        makeWire('w4', 'v1_neg', 'gnd1_p1'),
      ]
    );

    const errors = validateCircuit(circuit);
    expect(errors).toHaveLength(0);
  });

  it('returns "disconnected" warning for completely disconnected component', () => {
    const circuit = makeCircuit(
      [
        makeComponent({
          id: 'r1',
          type: 'resistor',
          refDesignator: 'R1',
          value: '10k',
          ports: [
            { id: 'r1_p1', name: 'pin1', netId: null },
            { id: 'r1_p2', name: 'pin2', netId: null },
          ],
        }),
        makeComponent({
          id: 'r2',
          type: 'resistor',
          refDesignator: 'R2',
          value: '5k',
          ports: [
            { id: 'r2_p1', name: 'pin1', netId: null },
            { id: 'r2_p2', name: 'pin2', netId: null },
          ],
        }),
        makeComponent({
          id: 'gnd1',
          type: 'ground',
          ports: [{ id: 'gnd1_p1', name: 'pin1', netId: null }],
        }),
      ],
      [
        // Only R1 is connected -- R2 is completely disconnected
        makeWire('w1', 'r1_p1', 'gnd1_p1'),
        makeWire('w2', 'r1_p2', 'gnd1_p1'),
      ]
    );

    const errors = validateCircuit(circuit);
    const disconnected = errors.filter((e) => e.type === 'disconnected');

    expect(disconnected.length).toBeGreaterThanOrEqual(1);
    expect(disconnected[0].message).toContain('R2');
    expect(disconnected[0].severity).toBe('warning');
  });
});
