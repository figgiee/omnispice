/**
 * SPICE netlist generator for OmniSpice.
 *
 * Converts a Circuit data model into a valid SPICE netlist string.
 * Pure function -- no side effects, no UI dependencies.
 */

import type { Circuit, Component, AnalysisConfig } from './types';
import { computeNets, buildPortToNetMap } from './graph';
import { COMPONENT_LIBRARY } from './componentLibrary';

/**
 * Generate a complete SPICE netlist from a circuit and analysis config.
 */
export function generateNetlist(
  circuit: Circuit,
  config: AnalysisConfig
): string {
  const lines: string[] = ['* OmniSpice Generated Netlist'];

  // 1. Compute nets via union-find on connected ports
  const nets = computeNets(circuit.components, circuit.wires);
  const portToNet = buildPortToNetMap(nets);

  // 2. Emit component lines (skip ground -- it's implicit in net "0")
  for (const comp of circuit.components.values()) {
    if (comp.type === 'ground') continue;
    const line = componentToSpiceLine(comp, portToNet);
    if (line) {
      lines.push(line);
    }
  }

  // 3. Emit analysis directive
  lines.push(analysisToDirective(config));

  // 4. Emit save directive
  lines.push(generateSaveDirective(circuit));

  lines.push('.end');
  return lines.join('\n');
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
export function componentToSpiceLine(
  component: Component,
  portToNet: Map<string, string>
): string {
  const lib = COMPONENT_LIBRARY[component.type];
  if (!lib) return '';

  const prefix = lib.spicePrefix;
  const ref = component.refDesignator;

  // Get net names for each port
  const netNames = component.ports.map(
    (p) => portToNet.get(p.id) ?? '?'
  );

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
