/**
 * LTspice AscCircuit → OmniSpice Circuit mapper.
 *
 * Converts the parsed .asc intermediate representation to the OmniSpice
 * Circuit data model, including wire topology resolution via net graph traversal.
 *
 * Coordinate scaling: canvasX = (ltspiceX - minX) * SCALE_FACTOR + PADDING
 * Unknown symbol names are skipped with a console.warn.
 *
 * Wire topology resolution algorithm:
 * 1. Build a graph of connected LTspice grid points from WIRE segments.
 * 2. Use union-find to assign a net ID to each connected group of points.
 * 3. For each component, snap each port to the nearest wire endpoint (in LTspice
 *    grid coordinates) within PIN_SNAP_THRESHOLD grid units.
 * 4. Components sharing the same net ID get their ports connected by an OmniSpice Wire.
 */

import { COMPONENT_LIBRARY } from '@/circuit/componentLibrary';
import type { Circuit, Component, ComponentType, Port, Wire } from '@/circuit/types';
import type { AscCircuit } from './types';

const SCALE_FACTOR = 0.25;
const PADDING = 50;

/**
 * Maximum distance (in LTspice grid units) from a symbol pin to a wire endpoint
 * to be considered connected. LTspice uses a 16-unit grid; component pin offsets
 * are typically multiples of 16 units (commonly 32, 64, 80, or 96 units).
 * A threshold of 100 units handles nearly all standard LTspice components.
 */
const PIN_SNAP_THRESHOLD = 100;

/**
 * Maps .asc symbol names to OmniSpice ComponentType.
 * Unknown names are not in this map — mapAscToCircuit skips them.
 */
const SYMBOL_MAP: Record<string, ComponentType> = {
  res: 'resistor',
  cap: 'capacitor',
  ind: 'inductor',
  diode: 'diode',
  schottky: 'schottky_diode',
  zener: 'zener_diode',
  npn: 'npn_bjt',
  pnp: 'pnp_bjt',
  nmos: 'nmos',
  pmos: 'pmos',
  voltage: 'dc_voltage',
  current: 'dc_current',
  opamp: 'ideal_opamp',
  universalopamp2: 'ideal_opamp',
};

/** Map LTspice orientation string to rotation degrees. */
function orientationToRotation(orientation: string): number {
  const map: Record<string, number> = {
    R0: 0,
    R90: 90,
    R180: 180,
    R270: 270,
    M0: 0,
    M90: 90,
    M180: 180,
    M270: 270,
  };
  return map[orientation.toUpperCase()] ?? 0;
}

/** Create Port[] for a component using COMPONENT_LIBRARY port definitions. */
function createPorts(type: ComponentType): Port[] {
  const def = COMPONENT_LIBRARY[type];
  if (!def) return [];
  return def.ports.map((p) => ({
    id: crypto.randomUUID(),
    name: p.name,
    netId: null,
  }));
}

/** Simple Union-Find for net connectivity. */
class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x) ?? x;
    if (p !== x) {
      const root = this.find(p);
      this.parent.set(x, root);
      return root;
    }
    return x;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/** Encode a LTspice grid point as a string key. */
function pointKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** Euclidean distance between two points. */
function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

/**
 * Convert AscCircuit (parsed .asc IR) to an OmniSpice Circuit.
 */
export function mapAscToCircuit(asc: AscCircuit): Circuit {
  const components = new Map<string, Component>();
  const wires = new Map<string, Wire>();

  // Compute bounding box for coordinate normalization (using all wire/flag points too)
  const allSymX = asc.symbols.map((s) => s.x);
  const allSymY = asc.symbols.map((s) => s.y);
  const minX = allSymX.length ? Math.min(...allSymX) : 0;
  const minY = allSymY.length ? Math.min(...allSymY) : 0;

  // --- Net graph: build connectivity from WIRE segments ---
  const uf = new UnionFind();
  const wireEndpoints: { x: number; y: number }[] = [];

  for (const w of asc.wires) {
    const k1 = pointKey(w.x1, w.y1);
    const k2 = pointKey(w.x2, w.y2);
    uf.union(k1, k2);
    wireEndpoints.push({ x: w.x1, y: w.y1 });
    wireEndpoints.push({ x: w.x2, y: w.y2 });
  }

  // Deduplicate wire endpoints
  const uniqueEndpoints = [...new Map(wireEndpoints.map((p) => [pointKey(p.x, p.y), p])).values()];

  // --- Place components ---
  // Track: portId → net key, for wire creation after all components are placed
  const portNetMap = new Map<string, string>(); // portId → net root key

  for (const symbol of asc.symbols) {
    let componentType: ComponentType | undefined = SYMBOL_MAP[symbol.name.toLowerCase()];

    // Refine voltage source type from value prefix
    if (componentType === 'dc_voltage' && symbol.value) {
      const v = symbol.value.toLowerCase();
      if (v.startsWith('ac')) componentType = 'ac_voltage';
      else if (v.startsWith('pulse')) componentType = 'pulse_voltage';
      else if (v.startsWith('sin')) componentType = 'sin_voltage';
      else if (v.startsWith('pwl')) componentType = 'pwl_voltage';
    }

    if (!componentType) {
      console.warn(
        `[LTspice import] Unknown symbol "${symbol.name}" (${symbol.instName}) — skipped`,
      );
      continue;
    }

    const id = crypto.randomUUID();
    const canvasX = (symbol.x - minX) * SCALE_FACTOR + PADDING;
    const canvasY = (symbol.y - minY) * SCALE_FACTOR + PADDING;
    const rotation = orientationToRotation(symbol.orientation);
    const ports = createPorts(componentType);

    const component: Component = {
      id,
      type: componentType,
      refDesignator: symbol.instName || `${componentType.slice(0, 1).toUpperCase()}?`,
      value: symbol.value || '0',
      ports,
      position: { x: canvasX, y: canvasY },
      rotation,
      ...(symbol.spiceModel ? { spiceModel: symbol.spiceModel } : {}),
    };

    components.set(id, component);

    // Snap each port to the wire net graph.
    // Strategy: the symbol anchor (x,y) IS typically one pin connection point.
    // The second pin is found by searching nearby wire endpoints.
    //
    // For single-port snap: try the symbol's x,y directly first. If not found,
    // try a search of all wire endpoints closest to the symbol position.
    //
    // For 2-port components, assign port[0] to the nearest wire endpoint
    // and port[1] to the second-nearest (at a different net).
    if (ports.length === 0) continue;

    // Build sorted list of (distance, netKey) for wire endpoints near this symbol
    const nearbyNets: { d: number; netKey: string; x: number; y: number }[] = [];
    for (const ep of uniqueEndpoints) {
      const d = dist(symbol.x, symbol.y, ep.x, ep.y);
      if (d <= PIN_SNAP_THRESHOLD) {
        nearbyNets.push({ d, netKey: uf.find(pointKey(ep.x, ep.y)), x: ep.x, y: ep.y });
      }
    }
    nearbyNets.sort((a, b) => a.d - b.d);

    if (ports.length === 1) {
      // Single port (e.g., ground) — snap to closest endpoint
      const match = nearbyNets[0];
      if (match && ports[0]) {
        portNetMap.set(ports[0].id, match.netKey);
      }
    } else {
      // Multi-port: assign distinct nets to distinct ports
      // Port 0 gets the nearest net, port 1 gets the next net at a different root
      const assignedNets: string[] = [];
      for (const { netKey } of nearbyNets) {
        if (!assignedNets.includes(netKey)) {
          assignedNets.push(netKey);
          if (assignedNets.length >= ports.length) break;
        }
      }
      for (let i = 0; i < Math.min(ports.length, assignedNets.length); i++) {
        const port = ports[i];
        const netKey = assignedNets[i];
        if (port && netKey !== undefined) {
          portNetMap.set(port.id, netKey);
        }
      }
    }
  }

  // --- Create OmniSpice Wires for ports sharing the same net ---
  // Group ports by net key
  const netPortGroups = new Map<string, string[]>(); // netKey → portId[]
  for (const [portId, netKey] of portNetMap) {
    const group = netPortGroups.get(netKey) ?? [];
    group.push(portId);
    netPortGroups.set(netKey, group);
  }

  // For each net with 2+ ports, create wires connecting them pairwise (chain)
  for (const [, portIds] of netPortGroups) {
    if (portIds.length < 2) continue;
    // Create a chain: port[0]↔port[1], port[1]↔port[2], ...
    for (let i = 0; i < portIds.length - 1; i++) {
      const sourcePortId = portIds[i];
      const targetPortId = portIds[i + 1];
      if (!sourcePortId || !targetPortId) continue;
      const wireId = crypto.randomUUID();
      wires.set(wireId, {
        id: wireId,
        sourcePortId,
        targetPortId,
        bendPoints: [],
      });
    }
  }

  return {
    components,
    wires,
    nets: new Map(),
  };
}
