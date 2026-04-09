/**
 * Circuit graph algorithms for OmniSpice.
 *
 * Uses union-find (disjoint set) to compute nets from components and wires.
 * Connected ports are merged into the same net. Ground components' ports
 * always map to the special net "0".
 */

import type { Component, Wire, Net } from './types';

/**
 * Union-Find data structure for efficient net merging.
 */
class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return;

    const rankA = this.rank.get(rootA)!;
    const rankB = this.rank.get(rootB)!;

    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
  }

  /**
   * Returns all unique groups as maps from root -> member set.
   */
  groups(): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>();
    for (const key of this.parent.keys()) {
      const root = this.find(key);
      if (!result.has(root)) {
        result.set(root, new Set());
      }
      result.get(root)!.add(key);
    }
    return result;
  }
}

/**
 * Build a lookup map from port ID to the port's owner component.
 */
function buildPortIndex(
  components: Map<string, Component>
): Map<string, Component> {
  const index = new Map<string, Component>();
  for (const comp of components.values()) {
    for (const port of comp.ports) {
      index.set(port.id, comp);
    }
  }
  return index;
}

/**
 * Compute nets from components and wires using union-find.
 *
 * 1. Initialize each port as its own set.
 * 2. For each wire, union the source and target ports.
 * 3. For ground components, mark their port group as net "0".
 * 4. Assign unique net names to remaining groups.
 *
 * Also mutates each port's netId to the assigned net name.
 *
 * @returns Map of net ID to Net object.
 */
export function computeNets(
  components: Map<string, Component>,
  wires: Map<string, Wire>
): Map<string, Net> {
  const uf = new UnionFind();
  const portIndex = buildPortIndex(components);

  // Register all ports
  for (const comp of components.values()) {
    for (const port of comp.ports) {
      uf.find(port.id);
    }
  }

  // Union connected ports via wires
  for (const wire of wires.values()) {
    uf.union(wire.sourcePortId, wire.targetPortId);
  }

  // Find ground ports -- they define net "0"
  const groundPortIds = new Set<string>();
  for (const comp of components.values()) {
    if (comp.type === 'ground') {
      for (const port of comp.ports) {
        groundPortIds.add(port.id);
      }
    }
  }

  // Merge all ground groups together
  let groundRoot: string | null = null;
  for (const gid of groundPortIds) {
    if (groundRoot === null) {
      groundRoot = gid;
    } else {
      uf.union(groundRoot, gid);
    }
  }

  // Get groups
  const groups = uf.groups();

  // Determine which root is the ground net
  const groundGroupRoot = groundRoot !== null ? uf.find(groundRoot) : null;

  // Assign net names
  const nets = new Map<string, Net>();
  let netCounter = 1;

  for (const [root, members] of groups) {
    const isGround = root === groundGroupRoot;
    const netName = isGround ? '0' : `net_${netCounter++}`;
    const netId = isGround ? 'gnd' : `net_${netCounter - 1}`;

    const net: Net = {
      id: netId,
      name: netName,
      portIds: [...members],
    };
    nets.set(net.id, net);

    // Mutate port netIds on the components
    for (const portId of members) {
      const comp = portIndex.get(portId);
      if (comp) {
        const port = comp.ports.find((p) => p.id === portId);
        if (port) {
          port.netId = netName;
        }
      }
    }
  }

  return nets;
}

/**
 * Build a map from port ID to net name, given a set of computed nets.
 */
export function buildPortToNetMap(nets: Map<string, Net>): Map<string, string> {
  const map = new Map<string, string>();
  for (const net of nets.values()) {
    for (const portId of net.portIds) {
      map.set(portId, net.name);
    }
  }
  return map;
}
