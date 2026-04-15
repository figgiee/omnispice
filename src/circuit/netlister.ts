/**
 * SPICE netlist generator for OmniSpice.
 *
 * Converts a Circuit data model into a valid SPICE netlist string.
 * Pure function -- no side effects, no UI dependencies.
 *
 * Plan 05-03: supports single-level hierarchy via `.subckt` / `.ends`
 * blocks. For each top-level component of type `subcircuit`, the
 * netlister emits a `.subckt` block with the inner children and a
 * top-level `X{N}` instantiation. Nested subcircuits are explicitly
 * rejected (V1 decision #2).
 */

import { COMPONENT_LIBRARY } from './componentLibrary';
import { buildPortToNetMap, computeNets } from './graph';
import type { AnalysisConfig, Circuit, Component, Wire } from './types';

/**
 * Generate netlist AND return the netId → spiceName map.
 * Used by the simulation overlay to correlate port netIds with ngspice vector names.
 * The netMap key is Net.id (e.g., "net_1", "gnd"); value is the SPICE name (e.g., "net_1", "0").
 */
export function generateNetlistWithMap(
  circuit: Circuit,
  config: AnalysisConfig,
): { netlist: string; netMap: Map<string, string> } {
  const nets = computeNets(circuit.components, circuit.wires);
  // Build netId → spiceName map from the computed nets
  const netMap = new Map<string, string>();
  for (const net of nets.values()) {
    netMap.set(net.id, net.name);
  }
  // Reuse existing generate logic (re-runs computeNets internally — acceptable for now)
  const netlist = generateNetlist(circuit, config);
  return { netlist, netMap };
}

/**
 * Generate a complete SPICE netlist from a circuit and analysis config.
 *
 * Emission order (Plan 05-03):
 *   1. Title comment
 *   2. `.subckt` blocks for every top-level subcircuit component (one
 *      per unique subcircuitName; duplicates share a single definition)
 *   3. Top-level components (ground skipped, net_label skipped, plain
 *      components emit their SPICE line, subcircuit blocks emit an
 *      `X{ref}` instantiation line)
 *   4. Analysis directive
 *   5. Save directive
 *   6. `.end`
 */
export function generateNetlist(circuit: Circuit, config: AnalysisConfig): string {
  const lines: string[] = ['* OmniSpice Generated Netlist'];

  // 1. Compute TOP-LEVEL nets (used for the top-level components + the
  //    `X{ref}` subcircuit instantiation lines). Building this from the
  //    full circuit is correct: inner wires still participate in the
  //    union-find, but every inner port ends up sharing a net with its
  //    parent subcircuit block's exposed port because `collapseSubcircuit`
  //    re-points the boundary wire onto the exposed port.
  const topNets = computeNets(circuit.components, circuit.wires);
  const topPortToNet = buildPortToNetMap(topNets);

  // 2. Emit `.subckt` blocks for every top-level subcircuit instance,
  //    deduped by subcircuit name so two instances of the same shape
  //    share one definition (standard SPICE practice).
  const emittedSubNames = new Set<string>();
  for (const comp of circuit.components.values()) {
    if (comp.type !== 'subcircuit') continue;
    if (comp.parentId) continue; // only top-level subcircuit blocks
    const name = comp.subcircuitName ?? comp.value;
    if (!name || emittedSubNames.has(name)) continue;
    emittedSubNames.add(name);
    const block = emitSubcircuitBlock(comp, circuit);
    lines.push(...block);
  }

  // 3. Emit top-level components.
  for (const comp of circuit.components.values()) {
    if (comp.parentId) continue; // skip inner children
    if (comp.type === 'ground') continue;
    if (comp.type === 'net_label') continue;

    if (comp.type === 'subcircuit') {
      const line = subcircuitInstanceLine(comp, topPortToNet);
      if (line) lines.push(line);
      continue;
    }

    const line = componentToSpiceLine(comp, topPortToNet);
    if (line) lines.push(line);
  }

  // 4. Analysis directive
  lines.push(analysisToDirective(config));

  // 5. Save directive
  lines.push(generateSaveDirective(circuit));

  lines.push('.end');
  return lines.join('\n');
}

/**
 * Emit a single `.subckt ... .ends` block for a subcircuit component.
 *
 * Builds a self-contained sub-circuit over the block's children +
 * internal wires, runs `computeNets` on that narrow view, and emits
 * each child's SPICE line using net names scoped to the block. Internal
 * net names are prefixed with the subcircuit ref so they never collide
 * with top-level names.
 *
 * Throws if any child is itself a subcircuit (V1 single-level guard).
 */
function emitSubcircuitBlock(sub: Component, circuit: Circuit): string[] {
  if (sub.type !== 'subcircuit') return [];
  const childIds = sub.childComponentIds ?? [];
  const exposedMap = sub.exposedPinMapping ?? {};

  const children: Component[] = [];
  for (const id of childIds) {
    const c = circuit.components.get(id);
    if (!c) continue;
    // V1 guard: nested subcircuits are not supported. The UI path can't
    // produce this (collapseSubcircuit refuses to collapse while nested),
    // but an imported or constructed circuit could smuggle one in.
    if (c.type === 'subcircuit') {
      throw new Error(
        `Nested subcircuit detected in '${sub.subcircuitName ?? sub.refDesignator}' — V1 supports single-level nesting only`,
      );
    }
    children.push(c);
  }

  // Collect the internal wires: both endpoints must belong to the
  // children's ports (NOT the subcircuit block's exposed ports).
  const childPortIds = new Set<string>();
  for (const c of children) {
    for (const p of c.ports) childPortIds.add(p.id);
  }
  const innerWires = new Map<string, Wire>();
  for (const w of circuit.wires.values()) {
    if (childPortIds.has(w.sourcePortId) && childPortIds.has(w.targetPortId)) {
      innerWires.set(w.id, w);
    }
  }

  // Build a narrow component map so computeNets only sees the inside.
  const innerComponents = new Map<string, Component>();
  for (const c of children) innerComponents.set(c.id, c);

  // Run union-find on the narrow view. The resulting nets cover every
  // inner port; ports that were the inside-end of a boundary wire remain
  // as their own singleton nets (no wires left to union them to anything
  // else). Those are precisely the ports that map to exposed pins.
  const innerNets = computeNets(innerComponents, innerWires);
  const innerPortToNet = buildPortToNetMap(innerNets);

  // Assign scoped SPICE names:
  //   - Exposed pins (mapped inner port ids) become the .subckt formal
  //     parameters `p_<name>`
  //   - Everything else becomes `<subref>_net_<n>`
  const exposedInnerIds = new Set(Object.values(exposedMap));
  const formalName = (innerPortId: string): string => {
    // Find the exposed port that maps to this inner id and use its name.
    for (const [exposedId, innerId] of Object.entries(exposedMap)) {
      if (innerId === innerPortId) {
        const exposedPort = sub.ports.find((p) => p.id === exposedId);
        return exposedPort ? `p_${exposedPort.name}` : `p_${exposedId.slice(0, 6)}`;
      }
    }
    return `p_${innerPortId.slice(0, 6)}`;
  };

  const scopedNetName = new Map<string, string>();
  let internalCounter = 1;
  const subRef = sub.refDesignator.toLowerCase();
  for (const net of innerNets.values()) {
    // If ANY port in the net is an exposed inside port, the whole net
    // takes the formal parameter name (so the inner line references the
    // same identifier that appears in the `.subckt` header).
    const exposedMatch = net.portIds.find((pid) => exposedInnerIds.has(pid));
    if (exposedMatch) {
      scopedNetName.set(net.id, formalName(exposedMatch));
    } else {
      scopedNetName.set(net.id, `${subRef}_net_${internalCounter++}`);
    }
  }

  // Build a port->scopedName lookup for the SPICE emitter.
  const scopedPortMap = new Map<string, string>();
  for (const net of innerNets.values()) {
    const name = scopedNetName.get(net.id) ?? '?';
    for (const pid of net.portIds) scopedPortMap.set(pid, name);
  }

  // Header: `.subckt <name> <formal1> <formal2> ...` — ordered by the
  // subcircuit block's port declaration order so the top-level X line
  // lines up with `.subckt` pin-for-pin.
  const formalParams: string[] = [];
  for (const p of sub.ports) {
    const innerId = exposedMap[p.id];
    if (!innerId) continue;
    const net = innerNets.get(innerPortToNet.get(innerId) ?? '');
    // If computeNets classified the inner port into a net, use that
    // net's scoped name; otherwise fall back to the formal name so
    // parsing still succeeds.
    const named = net ? (scopedNetName.get(net.id) ?? formalName(innerId)) : formalName(innerId);
    formalParams.push(named);
  }

  const lines: string[] = [];
  lines.push(`.subckt ${sub.subcircuitName ?? sub.value} ${formalParams.join(' ')}`.trimEnd());
  for (const child of children) {
    if (child.type === 'ground') continue;
    if (child.type === 'net_label') continue;
    const line = componentToSpiceLine(child, scopedPortMap);
    if (line) lines.push(line);
  }
  lines.push('.ends');
  return lines;
}

/**
 * Emit the top-level `X{ref} net1 net2 ... subName` instantiation line
 * for a subcircuit block. Ports on the block are already wired to
 * top-level nets via `topPortToNet` because boundary wires terminate on
 * the exposed ports.
 */
function subcircuitInstanceLine(sub: Component, topPortToNet: Map<string, string>): string {
  if (sub.type !== 'subcircuit') return '';
  const name = sub.subcircuitName ?? sub.value;
  if (!name) return '';
  const nets = sub.ports.map((p) => topPortToNet.get(p.id) ?? '?');
  return `${sub.refDesignator} ${nets.join(' ')} ${name}`.replace(/\s+$/, '');
}

/**
 * Convert a single component to its SPICE netlist line.
 *
 * Format varies by component type:
 * - Passives: R1 net_1 net_2 10k
 * - Diodes: D1 net_1 net_2 D1N4148
 * - BJTs: Q1 collector base emitter Q2N2222
 * - MOSFETs: M1 drain gate source source NMOS1
 * - Subcircuits: X1 non_inv inv output IDEAL_OPAMP
 * - Voltage sources: V1 net_1 0 dc 5
 * - Current sources: I1 net_1 0 dc 1m
 */
export function componentToSpiceLine(component: Component, portToNet: Map<string, string>): string {
  const lib = COMPONENT_LIBRARY[component.type];
  if (!lib) return '';

  const ref = component.refDesignator;

  // Get net names for each port
  const netNames = component.ports.map((p) => portToNet.get(p.id) ?? '?');

  switch (component.type) {
    // Passives: prefix ref node1 node2 value
    case 'resistor':
    case 'capacitor':
    case 'inductor':
      return `${ref} ${netNames[0]} ${netNames[1]} ${component.value}`;

    // Transformer: two coupled inductors (L + K statement)
    case 'transformer': {
      const l1Ref = `${ref}_pri`;
      const l2Ref = `${ref}_sec`;
      const kRef = `K${ref.slice(1)}`;
      return [
        `${l1Ref} ${netNames[0]} ${netNames[1]} ${component.value}`,
        `${l2Ref} ${netNames[2]} ${netNames[3]} ${component.value}`,
        `${kRef} ${l1Ref} ${l2Ref} 1`,
      ].join('\n');
    }

    // Diodes: D ref anode cathode model
    case 'diode':
    case 'zener_diode':
    case 'schottky_diode':
      return `${ref} ${netNames[0]} ${netNames[1]} ${component.spiceModel || lib.defaultModel}`;

    // BJTs: Q ref collector base emitter model
    case 'npn_bjt':
    case 'pnp_bjt': {
      // ports order: base(0), collector(1), emitter(2)
      // SPICE order: collector, base, emitter
      return `${ref} ${netNames[1]} ${netNames[0]} ${netNames[2]} ${component.spiceModel || lib.defaultModel}`;
    }

    // MOSFETs: M ref drain gate source source model
    case 'nmos':
    case 'pmos': {
      // ports order: gate(0), drain(1), source(2)
      // SPICE order: drain, gate, source, bulk(=source)
      return `${ref} ${netNames[1]} ${netNames[0]} ${netNames[2]} ${netNames[2]} ${component.spiceModel || lib.defaultModel}`;
    }

    // Subcircuits (op-amps): X ref nodes... model
    case 'ideal_opamp':
    case 'ua741':
    case 'lm741':
      return `${ref} ${netNames.join(' ')} ${component.spiceModel || lib.defaultModel}`;

    // DC Voltage: V ref pos neg dc value
    case 'dc_voltage':
      return `${ref} ${netNames[0]} ${netNames[1]} dc ${component.value}`;

    // AC Voltage: V ref pos neg ac value
    case 'ac_voltage':
      return `${ref} ${netNames[0]} ${netNames[1]} ac ${component.value}`;

    // Pulse Voltage: V ref pos neg pulse(params)
    case 'pulse_voltage': {
      const params = component.parameters || {};
      const v1 = params.v1 || '0';
      const v2 = params.v2 || component.value;
      const td = params.td || '0';
      const tr = params.tr || '1n';
      const tf = params.tf || '1n';
      const pw = params.pw || '5u';
      const per = params.per || '10u';
      return `${ref} ${netNames[0]} ${netNames[1]} pulse(${v1} ${v2} ${td} ${tr} ${tf} ${pw} ${per})`;
    }

    // Sine Voltage: V ref pos neg sin(offset amplitude freq)
    case 'sin_voltage': {
      const params = component.parameters || {};
      const offset = params.offset || '0';
      const amplitude = component.value;
      const freq = params.freq || '1k';
      return `${ref} ${netNames[0]} ${netNames[1]} sin(${offset} ${amplitude} ${freq})`;
    }

    // PWL Voltage: V ref pos neg pwl(time value pairs)
    case 'pwl_voltage': {
      const params = component.parameters || {};
      const pwlData = params.pwl || '0 0 1m 5';
      return `${ref} ${netNames[0]} ${netNames[1]} pwl(${pwlData})`;
    }

    // DC Current: I ref in out dc value
    case 'dc_current':
      return `${ref} ${netNames[0]} ${netNames[1]} dc ${component.value}`;

    // AC Current: I ref in out ac value
    case 'ac_current':
      return `${ref} ${netNames[0]} ${netNames[1]} ac ${component.value}`;

    default:
      // Subcircuit instances are handled by `subcircuitInstanceLine`;
      // `ground` and `net_label` are skipped at the top of generateNetlist.
      return '';
  }
}

/**
 * Convert an analysis config to a SPICE directive string.
 *
 * Examples:
 * - DC op: ".op"
 * - Transient: ".tran 1u 10m"
 * - AC: ".ac dec 100 1 1MEG"
 * - DC sweep: ".dc V1 0 5 0.1"
 */
export function analysisToDirective(config: AnalysisConfig): string {
  switch (config.type) {
    case 'dc_op':
      return '.op';

    case 'transient': {
      const step = config.timeStep || '1u';
      const stop = config.stopTime || '10m';
      if (config.startTime && config.startTime !== '0') {
        return `.tran ${step} ${stop} ${config.startTime}`;
      }
      return `.tran ${step} ${stop}`;
    }

    case 'ac': {
      const points = config.pointsPerDecade || 100;
      const start = config.startFreq || '1';
      const stop = config.stopFreq || '1MEG';
      return `.ac dec ${points} ${start} ${stop}`;
    }

    case 'dc_sweep': {
      const src = config.sweepSource || 'V1';
      const start = config.sweepStart || '0';
      const stop = config.sweepStop || '5';
      const step = config.sweepStep || '0.1';
      return `.dc ${src} ${start} ${stop} ${step}`;
    }

    default:
      return '.op';
  }
}

/**
 * Generate a save directive for the simulation.
 * Uses ".save all" for simplicity -- captures all node voltages and branch currents.
 */
export function generateSaveDirective(_circuit: Circuit): string {
  return '.save all';
}
