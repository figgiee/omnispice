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
 *
 * Plan 05-02 Rule 1 fix: React Flow's `<Handle id=...>` uses the port NAME
 * (e.g. "pin1", "base", "collector"), not the port UUID. We therefore index
 * ports by UUID to look up their owning component, and independently map
 * UUID → port name so the edge's `sourceHandle`/`targetHandle` values match
 * the DOM Handle ids. Previously the edge carried a UUID in those fields,
 * which prevented React Flow from routing the edge and dropped wires from
 * the canvas entirely.
 */
export function circuitToEdges(circuit: Circuit): Edge[] {
  const portToNode = new Map<string, string>();
  const portIdToName = new Map<string, string>();
  for (const comp of circuit.components.values()) {
    for (const port of comp.ports) {
      portToNode.set(port.id, comp.id);
      portIdToName.set(port.id, port.name);
    }
  }

  return [...circuit.wires.values()].map((wire) => ({
    id: wire.id,
    source: portToNode.get(wire.sourcePortId) ?? '',
    target: portToNode.get(wire.targetPortId) ?? '',
    sourceHandle: portIdToName.get(wire.sourcePortId) ?? wire.sourcePortId,
    targetHandle: portIdToName.get(wire.targetPortId) ?? wire.targetPortId,
    type: 'wire',
  }));
}
