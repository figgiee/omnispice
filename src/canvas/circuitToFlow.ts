/**
 * Utility functions to convert the OmniSpice circuit data model to
 * React Flow nodes and edges. Shared by the main editor (Layout.tsx)
 * and the read-only SharedCircuitViewer.
 */

import type { Edge, Node } from '@xyflow/react';
import type { CircuitNodeData } from '@/canvas/components/types';
import type { Circuit } from '@/circuit/types';

/**
 * Convert circuit components to React Flow nodes.
 */
export function circuitToNodes(circuit: Circuit): Node<CircuitNodeData>[] {
  return [...circuit.components.values()].map((comp) => ({
    id: comp.id,
    type: comp.type,
    position: comp.position,
    data: {
      type: comp.type,
      refDesignator: comp.refDesignator,
      value: comp.value,
      rotation: comp.rotation,
      ...(comp.netLabel ? { netLabel: comp.netLabel } : {}),
    },
  }));
}

/**
 * Convert circuit wires to React Flow edges.
 */
export function circuitToEdges(circuit: Circuit): Edge[] {
  const portToNode = new Map<string, string>();
  for (const comp of circuit.components.values()) {
    for (const port of comp.ports) {
      portToNode.set(port.id, comp.id);
    }
  }

  return [...circuit.wires.values()].map((wire) => ({
    id: wire.id,
    source: portToNode.get(wire.sourcePortId) ?? '',
    target: portToNode.get(wire.targetPortId) ?? '',
    sourceHandle: wire.sourcePortId,
    targetHandle: wire.targetPortId,
    type: 'wire',
  }));
}
