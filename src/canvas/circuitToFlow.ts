/**
 * Utility functions to convert the OmniSpice circuit data model to
 * React Flow nodes and edges. Shared by the main editor (Layout.tsx)
 * and the read-only SharedCircuitViewer.
 *
 * Plan 05-03: accepts an optional `currentSubcircuitId` filter so the
 * canvas can render only the level the user is currently viewing. A
 * `null` value (default) means the top level — components without a
 * `parentId` are shown (including collapsed subcircuit blocks). A
 * non-null value hides top-level components and shows only the children
 * of the matching subcircuit. The read-only viewers call these without
 * the argument and therefore keep their flat-circuit behaviour.
 */

import type { Edge, Node } from '@xyflow/react';
import type { CircuitNodeData } from '@/canvas/components/types';
import type { Circuit, Component, Wire } from '@/circuit/types';

/**
 * Convert circuit components to React Flow nodes.
 *
 * Top-level (currentSubcircuitId = null): emits components without a
 * parentId — both ordinary top-level components and subcircuit blocks.
 * Descended (currentSubcircuitId = <id>): emits only the children of
 * the given subcircuit. Subcircuit blocks themselves are filtered out at
 * the descended level because V1 is single-level only.
 */
export function circuitToNodes(
  circuit: Circuit,
  currentSubcircuitId: string | null = null,
): Node<CircuitNodeData>[] {
  const all = [...circuit.components.values()];
  const visible = all.filter((c) => isVisibleAtLevel(c, currentSubcircuitId));
  return visible.map((comp) => ({
    id: comp.id,
    type: comp.type,
    position: comp.position,
    data: {
      type: comp.type,
      refDesignator: comp.refDesignator,
      value: comp.value,
      rotation: comp.rotation,
      ...(comp.netLabel ? { netLabel: comp.netLabel } : {}),
      ...(comp.subcircuitName ? { subcircuitName: comp.subcircuitName } : {}),
      ...(comp.childComponentIds ? { childComponentIds: comp.childComponentIds } : {}),
      ports: comp.ports,
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
 *
 * Plan 05-03 filter: at the top level, show wires whose endpoints both
 * resolve to top-level-visible components (either with no parentId or
 * onto a subcircuit block's exposed ports). When descended into a
 * subcircuit, show only wires whose endpoints both resolve to components
 * with `parentId === currentSubcircuitId`.
 */
export function circuitToEdges(
  circuit: Circuit,
  currentSubcircuitId: string | null = null,
): Edge[] {
  const portToNode = new Map<string, string>();
  const portIdToName = new Map<string, string>();
  for (const comp of circuit.components.values()) {
    for (const port of comp.ports) {
      portToNode.set(port.id, comp.id);
      portIdToName.set(port.id, port.name);
    }
  }

  return [...circuit.wires.values()]
    .filter((w) => isVisibleWire(w, circuit, portToNode, currentSubcircuitId))
    .map((wire) => ({
      id: wire.id,
      source: portToNode.get(wire.sourcePortId) ?? '',
      target: portToNode.get(wire.targetPortId) ?? '',
      sourceHandle: portIdToName.get(wire.sourcePortId) ?? wire.sourcePortId,
      targetHandle: portIdToName.get(wire.targetPortId) ?? wire.targetPortId,
      type: 'wire',
    }));
}

function isVisibleAtLevel(c: Component, currentSubcircuitId: string | null): boolean {
  if (currentSubcircuitId === null) {
    // Top level — show components without a parentId. Collapsed subcircuit
    // blocks satisfy this because collapseSubcircuit never sets parentId on
    // the block itself (only on its children).
    return !c.parentId;
  }
  // Descended — show only children of the current subcircuit.
  return c.parentId === currentSubcircuitId;
}

function isVisibleWire(
  wire: Wire,
  circuit: Circuit,
  portToNode: Map<string, string>,
  currentSubcircuitId: string | null,
): boolean {
  const srcCompId = portToNode.get(wire.sourcePortId);
  const tgtCompId = portToNode.get(wire.targetPortId);
  if (!srcCompId || !tgtCompId) return false;
  const src = circuit.components.get(srcCompId);
  const tgt = circuit.components.get(tgtCompId);
  if (!src || !tgt) return false;
  return isVisibleAtLevel(src, currentSubcircuitId) && isVisibleAtLevel(tgt, currentSubcircuitId);
}
