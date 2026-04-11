/**
 * Component library definitions for OmniSpice.
 *
 * Defines all Phase 1 component types with their SPICE prefix mappings,
 * default values, pin configurations, and model information.
 */

import type { ComponentType, PinDirection, PinType } from './types';

/**
 * Pin definition for a component library entry.
 *
 * Phase 5 adds `pinType`, `direction`, and `label` so live compat highlights
 * and structured tooltips can read the canonical metadata. These three fields
 * are optional at the type level only to keep legacy migration painless;
 * every entry in `COMPONENT_LIBRARY` MUST declare them.
 */
export interface ComponentPortDefinition {
  name: string;
  position: 'left' | 'right' | 'top' | 'bottom';
  pinType?: PinType;
  direction?: PinDirection;
  label?: string;
}

export interface ComponentDefinition {
  type: ComponentType;
  name: string;
  category: 'passives' | 'semiconductors' | 'sources' | 'opamps';
  spicePrefix: string;
  defaultValue: string;
  ports: ComponentPortDefinition[];
  defaultModel?: string;
  subcircuit?: boolean;
}

/**
 * Phase 5 pin metadata per RESEARCH §4.5 + locked D-01.
 *
 * All BJT pins are `signal` (not `supply`) because the compat matrix allows
 * `signal ↔ supply = neutral`, which keeps the BJT collector → V+ wiring
 * gesture friendly for students. Voltage/current sources are `supply` so
 * that wiring them to `power` rails stays `ok` (green) and wiring them to
 * signal nets stays `neutral` (gray) per D-01.
 *
 * Op-amps ship `signal` V+/V-/Vout and `supply` Vcc/Vee so the rail pins
 * get the warm orange treatment while the signal pins stay blue.
 */
export const COMPONENT_LIBRARY: Record<ComponentType, ComponentDefinition> = {
  resistor: {
    type: 'resistor',
    name: 'Resistor',
    category: 'passives',
    spicePrefix: 'R',
    defaultValue: '1k',
    ports: [
      { name: 'pin1', position: 'left', pinType: 'signal', direction: 'inout', label: '1' },
      { name: 'pin2', position: 'right', pinType: 'signal', direction: 'inout', label: '2' },
    ],
  },
  capacitor: {
    type: 'capacitor',
    name: 'Capacitor',
    category: 'passives',
    spicePrefix: 'C',
    defaultValue: '100n',
    ports: [
      { name: 'pin1', position: 'left', pinType: 'signal', direction: 'inout', label: '+' },
      { name: 'pin2', position: 'right', pinType: 'signal', direction: 'inout', label: '−' },
    ],
  },
  inductor: {
    type: 'inductor',
    name: 'Inductor',
    category: 'passives',
    spicePrefix: 'L',
    defaultValue: '1m',
    ports: [
      { name: 'pin1', position: 'left', pinType: 'signal', direction: 'inout', label: '1' },
      { name: 'pin2', position: 'right', pinType: 'signal', direction: 'inout', label: '2' },
    ],
  },
  transformer: {
    type: 'transformer',
    name: 'Transformer',
    category: 'passives',
    spicePrefix: 'L',
    defaultValue: '1m',
    ports: [
      { name: 'pri+', position: 'left', pinType: 'signal', direction: 'inout', label: 'P1' },
      { name: 'pri-', position: 'left', pinType: 'signal', direction: 'inout', label: 'P2' },
      { name: 'sec+', position: 'right', pinType: 'signal', direction: 'inout', label: 'S1' },
      { name: 'sec-', position: 'right', pinType: 'signal', direction: 'inout', label: 'S2' },
    ],
  },
  diode: {
    type: 'diode',
    name: 'Diode',
    category: 'semiconductors',
    spicePrefix: 'D',
    defaultValue: '',
    ports: [
      { name: 'anode', position: 'left', pinType: 'signal', direction: 'inout', label: 'A' },
      { name: 'cathode', position: 'right', pinType: 'signal', direction: 'inout', label: 'K' },
    ],
    defaultModel: 'D1N4148',
  },
  zener_diode: {
    type: 'zener_diode',
    name: 'Zener Diode',
    category: 'semiconductors',
    spicePrefix: 'D',
    defaultValue: '',
    ports: [
      { name: 'anode', position: 'left', pinType: 'signal', direction: 'inout', label: 'A' },
      { name: 'cathode', position: 'right', pinType: 'signal', direction: 'inout', label: 'K' },
    ],
    defaultModel: 'D1N4733A',
  },
  schottky_diode: {
    type: 'schottky_diode',
    name: 'Schottky Diode',
    category: 'semiconductors',
    spicePrefix: 'D',
    defaultValue: '',
    ports: [
      { name: 'anode', position: 'left', pinType: 'signal', direction: 'inout', label: 'A' },
      { name: 'cathode', position: 'right', pinType: 'signal', direction: 'inout', label: 'K' },
    ],
    defaultModel: 'D1N5817',
  },
  npn_bjt: {
    type: 'npn_bjt',
    name: 'NPN BJT',
    category: 'semiconductors',
    spicePrefix: 'Q',
    defaultValue: '',
    ports: [
      // All signal (D-01 — compat matrix handles signal↔supply = neutral)
      { name: 'base', position: 'left', pinType: 'signal', direction: 'inout', label: 'B' },
      { name: 'collector', position: 'top', pinType: 'signal', direction: 'inout', label: 'C' },
      { name: 'emitter', position: 'bottom', pinType: 'signal', direction: 'inout', label: 'E' },
    ],
    defaultModel: 'Q2N2222',
  },
  pnp_bjt: {
    type: 'pnp_bjt',
    name: 'PNP BJT',
    category: 'semiconductors',
    spicePrefix: 'Q',
    defaultValue: '',
    ports: [
      { name: 'base', position: 'left', pinType: 'signal', direction: 'inout', label: 'B' },
      { name: 'collector', position: 'bottom', pinType: 'signal', direction: 'inout', label: 'C' },
      { name: 'emitter', position: 'top', pinType: 'signal', direction: 'inout', label: 'E' },
    ],
    defaultModel: 'Q2N3906',
  },
  nmos: {
    type: 'nmos',
    name: 'NMOS',
    category: 'semiconductors',
    spicePrefix: 'M',
    defaultValue: '',
    ports: [
      { name: 'gate', position: 'left', pinType: 'signal', direction: 'inout', label: 'G' },
      { name: 'drain', position: 'top', pinType: 'signal', direction: 'inout', label: 'D' },
      { name: 'source', position: 'bottom', pinType: 'signal', direction: 'inout', label: 'S' },
    ],
    defaultModel: 'NMOS1',
  },
  pmos: {
    type: 'pmos',
    name: 'PMOS',
    category: 'semiconductors',
    spicePrefix: 'M',
    defaultValue: '',
    ports: [
      { name: 'gate', position: 'left', pinType: 'signal', direction: 'inout', label: 'G' },
      { name: 'drain', position: 'top', pinType: 'signal', direction: 'inout', label: 'D' },
      { name: 'source', position: 'bottom', pinType: 'signal', direction: 'inout', label: 'S' },
    ],
    defaultModel: 'PMOS1',
  },
  ideal_opamp: {
    type: 'ideal_opamp',
    name: 'Ideal Op-Amp',
    category: 'opamps',
    spicePrefix: 'X',
    defaultValue: '',
    ports: [
      { name: 'non_inv', position: 'left', pinType: 'signal', direction: 'in', label: 'V+' },
      { name: 'inv', position: 'left', pinType: 'signal', direction: 'in', label: 'V−' },
      { name: 'output', position: 'right', pinType: 'signal', direction: 'out', label: 'Vout' },
    ],
    defaultModel: 'IDEAL_OPAMP',
    subcircuit: true,
  },
  ua741: {
    type: 'ua741',
    name: 'uA741',
    category: 'opamps',
    spicePrefix: 'X',
    defaultValue: '',
    ports: [
      { name: 'non_inv', position: 'left', pinType: 'signal', direction: 'in', label: 'V+' },
      { name: 'inv', position: 'left', pinType: 'signal', direction: 'in', label: 'V−' },
      { name: 'output', position: 'right', pinType: 'signal', direction: 'out', label: 'Vout' },
    ],
    defaultModel: 'UA741',
    subcircuit: true,
  },
  lm741: {
    type: 'lm741',
    name: 'LM741',
    category: 'opamps',
    spicePrefix: 'X',
    defaultValue: '',
    ports: [
      { name: 'non_inv', position: 'left', pinType: 'signal', direction: 'in', label: 'V+' },
      { name: 'inv', position: 'left', pinType: 'signal', direction: 'in', label: 'V−' },
      { name: 'output', position: 'right', pinType: 'signal', direction: 'out', label: 'Vout' },
    ],
    defaultModel: 'LM741',
    subcircuit: true,
  },
  dc_voltage: {
    type: 'dc_voltage',
    name: 'DC Voltage Source',
    category: 'sources',
    spicePrefix: 'V',
    defaultValue: '5',
    ports: [
      { name: 'positive', position: 'top', pinType: 'supply', direction: 'inout', label: '+' },
      { name: 'negative', position: 'bottom', pinType: 'supply', direction: 'inout', label: '−' },
    ],
  },
  ac_voltage: {
    type: 'ac_voltage',
    name: 'AC Voltage Source',
    category: 'sources',
    spicePrefix: 'V',
    defaultValue: '1',
    ports: [
      { name: 'positive', position: 'top', pinType: 'supply', direction: 'inout', label: '+' },
      { name: 'negative', position: 'bottom', pinType: 'supply', direction: 'inout', label: '−' },
    ],
  },
  pulse_voltage: {
    type: 'pulse_voltage',
    name: 'Pulse Voltage Source',
    category: 'sources',
    spicePrefix: 'V',
    defaultValue: '5',
    ports: [
      { name: 'positive', position: 'top', pinType: 'supply', direction: 'inout', label: '+' },
      { name: 'negative', position: 'bottom', pinType: 'supply', direction: 'inout', label: '−' },
    ],
  },
  sin_voltage: {
    type: 'sin_voltage',
    name: 'Sine Voltage Source',
    category: 'sources',
    spicePrefix: 'V',
    defaultValue: '1',
    ports: [
      { name: 'positive', position: 'top', pinType: 'supply', direction: 'inout', label: '+' },
      { name: 'negative', position: 'bottom', pinType: 'supply', direction: 'inout', label: '−' },
    ],
  },
  pwl_voltage: {
    type: 'pwl_voltage',
    name: 'PWL Voltage Source',
    category: 'sources',
    spicePrefix: 'V',
    defaultValue: '0',
    ports: [
      { name: 'positive', position: 'top', pinType: 'supply', direction: 'inout', label: '+' },
      { name: 'negative', position: 'bottom', pinType: 'supply', direction: 'inout', label: '−' },
    ],
  },
  dc_current: {
    type: 'dc_current',
    name: 'DC Current Source',
    category: 'sources',
    spicePrefix: 'I',
    defaultValue: '1m',
    ports: [
      { name: 'in', position: 'top', pinType: 'supply', direction: 'inout', label: '+' },
      { name: 'out', position: 'bottom', pinType: 'supply', direction: 'inout', label: '−' },
    ],
  },
  ac_current: {
    type: 'ac_current',
    name: 'AC Current Source',
    category: 'sources',
    spicePrefix: 'I',
    defaultValue: '1m',
    ports: [
      { name: 'in', position: 'top', pinType: 'supply', direction: 'inout', label: '+' },
      { name: 'out', position: 'bottom', pinType: 'supply', direction: 'inout', label: '−' },
    ],
  },
  ground: {
    type: 'ground',
    name: 'Ground',
    category: 'sources',
    spicePrefix: '',
    defaultValue: '',
    ports: [{ name: 'pin1', position: 'top', pinType: 'ground', direction: 'inout', label: 'GND' }],
  },
  /**
   * Phase 5 Pillar 1 — net label pseudo-component.
   *
   * Not a real SPICE primitive; the netlister skips it. Its `data.netLabel`
   * string becomes the net's SPICE name via `computeNets`. A single signal
   * pin lets the user wire it into any existing net.
   */
  net_label: {
    type: 'net_label',
    name: 'Net Label',
    category: 'passives',
    spicePrefix: '',
    defaultValue: '',
    ports: [
      { name: 'pin1', position: 'left', pinType: 'signal', direction: 'inout', label: 'NET' },
    ],
  },
};
