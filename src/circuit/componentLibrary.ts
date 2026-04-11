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

export const COMPONENT_LIBRARY: Record<ComponentType, ComponentDefinition> = {
  resistor: {
    type: 'resistor',
    name: 'Resistor',
    category: 'passives',
    spicePrefix: 'R',
    defaultValue: '1k',
    ports: [
      { name: 'pin1', position: 'left' },
      { name: 'pin2', position: 'right' },
    ],
  },
  capacitor: {
    type: 'capacitor',
    name: 'Capacitor',
    category: 'passives',
    spicePrefix: 'C',
    defaultValue: '100n',
    ports: [
      { name: 'pin1', position: 'left' },
      { name: 'pin2', position: 'right' },
    ],
  },
  inductor: {
    type: 'inductor',
    name: 'Inductor',
    category: 'passives',
    spicePrefix: 'L',
    defaultValue: '1m',
    ports: [
      { name: 'pin1', position: 'left' },
      { name: 'pin2', position: 'right' },
    ],
  },
  transformer: {
    type: 'transformer',
    name: 'Transformer',
    category: 'passives',
    spicePrefix: 'L',
    defaultValue: '1m',
    ports: [
      { name: 'pri+', position: 'left' },
      { name: 'pri-', position: 'left' },
      { name: 'sec+', position: 'right' },
      { name: 'sec-', position: 'right' },
    ],
  },
  diode: {
    type: 'diode',
    name: 'Diode',
    category: 'semiconductors',
    spicePrefix: 'D',
    defaultValue: '',
    ports: [
      { name: 'anode', position: 'left' },
      { name: 'cathode', position: 'right' },
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
      { name: 'anode', position: 'left' },
      { name: 'cathode', position: 'right' },
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
      { name: 'anode', position: 'left' },
      { name: 'cathode', position: 'right' },
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
      { name: 'base', position: 'left' },
      { name: 'collector', position: 'top' },
      { name: 'emitter', position: 'bottom' },
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
      { name: 'base', position: 'left' },
      { name: 'collector', position: 'bottom' },
      { name: 'emitter', position: 'top' },
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
      { name: 'gate', position: 'left' },
      { name: 'drain', position: 'top' },
      { name: 'source', position: 'bottom' },
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
      { name: 'gate', position: 'left' },
      { name: 'drain', position: 'top' },
      { name: 'source', position: 'bottom' },
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
      { name: 'non_inv', position: 'left' },
      { name: 'inv', position: 'left' },
      { name: 'output', position: 'right' },
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
      { name: 'non_inv', position: 'left' },
      { name: 'inv', position: 'left' },
      { name: 'output', position: 'right' },
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
      { name: 'non_inv', position: 'left' },
      { name: 'inv', position: 'left' },
      { name: 'output', position: 'right' },
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
      { name: 'positive', position: 'top' },
      { name: 'negative', position: 'bottom' },
    ],
  },
  ac_voltage: {
    type: 'ac_voltage',
    name: 'AC Voltage Source',
    category: 'sources',
    spicePrefix: 'V',
    defaultValue: '1',
    ports: [
      { name: 'positive', position: 'top' },
      { name: 'negative', position: 'bottom' },
    ],
  },
  pulse_voltage: {
    type: 'pulse_voltage',
    name: 'Pulse Voltage Source',
    category: 'sources',
    spicePrefix: 'V',
    defaultValue: '5',
    ports: [
      { name: 'positive', position: 'top' },
      { name: 'negative', position: 'bottom' },
    ],
  },
  sin_voltage: {
    type: 'sin_voltage',
    name: 'Sine Voltage Source',
    category: 'sources',
    spicePrefix: 'V',
    defaultValue: '1',
    ports: [
      { name: 'positive', position: 'top' },
      { name: 'negative', position: 'bottom' },
    ],
  },
  pwl_voltage: {
    type: 'pwl_voltage',
    name: 'PWL Voltage Source',
    category: 'sources',
    spicePrefix: 'V',
    defaultValue: '0',
    ports: [
      { name: 'positive', position: 'top' },
      { name: 'negative', position: 'bottom' },
    ],
  },
  dc_current: {
    type: 'dc_current',
    name: 'DC Current Source',
    category: 'sources',
    spicePrefix: 'I',
    defaultValue: '1m',
    ports: [
      { name: 'in', position: 'top' },
      { name: 'out', position: 'bottom' },
    ],
  },
  ac_current: {
    type: 'ac_current',
    name: 'AC Current Source',
    category: 'sources',
    spicePrefix: 'I',
    defaultValue: '1m',
    ports: [
      { name: 'in', position: 'top' },
      { name: 'out', position: 'bottom' },
    ],
  },
  ground: {
    type: 'ground',
    name: 'Ground',
    category: 'sources',
    spicePrefix: '',
    defaultValue: '',
    ports: [{ name: 'pin1', position: 'top' }],
  },
};
