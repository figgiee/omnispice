/**
 * Circuit graph algorithms for OmniSpice.
 *
 * Uses union-find (disjoint set) to compute nets from components and wires.
 * Connected ports are merged into the same net. Ground components' ports
 * always map to the special net "0".
 */

import type { Component, Net, Wire } from './types';

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
function buildPortIndex(components: Map<string, Component>): Map<string, Component> {
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
 * 5. Phase 5: walk each group for `net_label` pseudo-components and, if
 *    present, override the group's user-facing name with `netLabel`.
 *    Multiple conflicting labels on the same net → pick the
 *    lexicographically first and `console.warn`.
 *
 * Also mutates each port's netId to the assigned net name.
 *
 * @returns Map of net ID to Net object.
 */
export function computeNets(
  components: Map<string, Component>,
  wires: Map<string, Wire>,
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

  // Phase 5: collect net labels per group root. A group may contain multiple
  // `net_label` pseudo-components; pick the lexicographically smallest name
  // and warn on conflicts so the user knows which label "won".
  const labelsByRoot = new Map<string, string[]>();
  for (const comp of components.values()) {
    if (comp.type !== 'net_label') continue;
    const label = comp.netLabel?.trim();
    if (!label) continue;
    for (const port of comp.ports) {
      const root = uf.find(port.id);
      const arr = labelsByRoot.get(root) ?? [];
      arr.push(label);
      labelsByRoot.set(root, arr);
    }
  }

  const resolvedLabelByRoot = new Map<string, string>();
  for (const [root, labels] of labelsByRoot) {
    const unique = [...new Set(labels)].sort((a, b) => a.localeCompare(b));
    const winner = unique[0];
    if (!winner) continue;
    if (unique.length > 1) {
      // Multi-label conflict — pick the first alphabetically.
      // eslint-disable-next-line no-console
      console.warn(
        `[omnispice] Net has ${unique.length} conflicting labels: ${unique.join(', ')}. Using "${winner}".`,
      );
    }
    resolvedLabelByRoot.set(root, winner);
  }

  // Assign net names
  const nets = new Map<string, Net>();
  let netCounter = 1;

  for (const [root, members] of groups) {
    const isGround = root === groundGroupRoot;
    const labelOverride = !isGround ? resolvedLabelByRoot.get(root) : undefined;
    const defaultName = `net_${netCounter++}`;
    const netName = isGround ? '0' : (labelOverride ?? defaultName);
    // Net ID stays auto-generated so the overlay store (which keys by netId)
    // keeps working; the SPICE-facing `name` is what the netlister emits.
    const netId = isGround ? 'gnd' : `net_${netCounter - 1}`;

    const net: Net = {
      id: netId,
      name: netName,
      portIds: [...members],
      ...(labelOverride ? { netLabel: labelOverride } : {}),
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
