/**
 * Plan 05-03 — circuitToFlow level-filter coverage.
 *
 * Verifies that `circuitToNodes` / `circuitToEdges` emit only the components
 * and wires that belong to the current hierarchy level.
 */

import { describe, expect, it } from 'vitest';
import { circuitToEdges, circuitToNodes } from '../circuitToFlow';
import type { Circuit, Component, Wire } from '@/circuit/types';

function makeResistor(id: string, parentId?: string): Component {
  return {
    id,
    type: 'resistor',
    refDesignator: id.toUpperCase(),
    value: '1k',
    rotation: 0,
    position: { x: 0, y: 0 },
    ports: [
      { id: `${id}_p1`, name: 'pin1', netId: null, pinType: 'signal', direction: 'inout' },
      { id: `${id}_p2`, name: 'pin2', netId: null, pinType: 'signal', direction: 'inout' },
    ],
    ...(parentId ? { parentId } : {}),
  };
}

function makeSubcircuit(
  id: string,
  childIds: string[],
  exposedPins: Array<{ id: string; mapsTo: string }>,
): Component {
  return {
    id,
    type: 'subcircuit',
    refDesignator: 'X1',
    value: 'MySub',
    subcircuitName: 'MySub',
    rotation: 0,
    position: { x: 100, y: 100 },
    ports: exposedPins.map((p) => ({
      id: p.id,
      name: `pin_${p.id}`,
      netId: null,
      pinType: 'signal',
      direction: 'inout',
    })),
    childComponentIds: childIds,
    exposedPinMapping: Object.fromEntries(exposedPins.map((p) => [p.id, p.mapsTo])),
  };
}

function wire(id: string, sourcePortId: string, targetPortId: string): Wire {
  return { id, sourcePortId, targetPortId, bendPoints: [] };
}

describe('circuitToFlow subcircuit filtering (Plan 05-03)', () => {
  it('flat circuit at top-level returns every component', () => {
    const components = new Map<string, Component>();
    components.set('r1', makeResistor('r1'));
    components.set('r2', makeResistor('r2'));
    const circuit: Circuit = { components, wires: new Map(), nets: new Map() };
    const nodes = circuitToNodes(circuit, null);
    expect(nodes).toHaveLength(2);
  });

  it('top level hides subcircuit children and shows the block', () => {
    const components = new Map<string, Component>();
    // r2, r3 are children of sub1. r1 is top-level.
    components.set('r1', makeResistor('r1'));
    components.set('r2', makeResistor('r2', 'sub1'));
    components.set('r3', makeResistor('r3', 'sub1'));
    components.set(
      'sub1',
      makeSubcircuit('sub1', ['r2', 'r3'], [{ id: 'sub1_ep1', mapsTo: 'r2_p1' }]),
    );
    const circuit: Circuit = { components, wires: new Map(), nets: new Map() };
    const nodes = circuitToNodes(circuit, null);
    expect(nodes.map((n) => n.id).sort()).toEqual(['r1', 'sub1']);
  });

  it('descending into a subcircuit shows only its children', () => {
    const components = new Map<string, Component>();
    components.set('r1', makeResistor('r1'));
    components.set('r2', makeResistor('r2', 'sub1'));
    components.set('r3', makeResistor('r3', 'sub1'));
    components.set(
      'sub1',
      makeSubcircuit('sub1', ['r2', 'r3'], [{ id: 'sub1_ep1', mapsTo: 'r2_p1' }]),
    );
    const circuit: Circuit = { components, wires: new Map(), nets: new Map() };
    const nodes = circuitToNodes(circuit, 'sub1');
    expect(nodes.map((n) => n.id).sort()).toEqual(['r2', 'r3']);
  });

  it('top-level wires filter out purely-internal subcircuit wires', () => {
    const components = new Map<string, Component>();
    components.set('r2', makeResistor('r2', 'sub1'));
    components.set('r3', makeResistor('r3', 'sub1'));
    components.set(
      'sub1',
      makeSubcircuit('sub1', ['r2', 'r3'], [{ id: 'sub1_ep1', mapsTo: 'r2_p1' }]),
    );
    const wires = new Map<string, Wire>();
    // Internal: r2.pin2 -> r3.pin1 (both have parentId='sub1')
    wires.set('wInside', wire('wInside', 'r2_p2', 'r3_p1'));
    const circuit: Circuit = { components, wires, nets: new Map() };
    const topEdges = circuitToEdges(circuit, null);
    expect(topEdges).toHaveLength(0);
    const insideEdges = circuitToEdges(circuit, 'sub1');
    expect(insideEdges).toHaveLength(1);
    expect(insideEdges[0]?.id).toBe('wInside');
  });
});
