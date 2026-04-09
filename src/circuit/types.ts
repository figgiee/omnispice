/**
 * Circuit data model types for OmniSpice.
 *
 * These types represent the complete circuit domain: components, wires,
 * nets, and analysis configurations. All other circuit modules depend
 * on these interfaces.
 */

export type ComponentType =
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'transformer'
  | 'diode'
  | 'zener_diode'
  | 'schottky_diode'
  | 'npn_bjt'
  | 'pnp_bjt'
  | 'nmos'
  | 'pmos'
  | 'ideal_opamp'
  | 'ua741'
  | 'lm741'
  | 'dc_voltage'
  | 'ac_voltage'
  | 'pulse_voltage'
  | 'sin_voltage'
  | 'pwl_voltage'
  | 'dc_current'
  | 'ac_current'
  | 'ground';

export interface Port {
  id: string;
  name: string;
  netId: string | null;
}

export interface Component {
  id: string;
  type: ComponentType;
  refDesignator: string;
  value: string;
  ports: Port[];
  position: { x: number; y: number };
  rotation: number;
  spiceModel?: string;
  parameters?: Record<string, string>;
}

export interface Wire {
  id: string;
  sourcePortId: string;
  targetPortId: string;
  bendPoints: { x: number; y: number }[];
}

export interface Net {
  id: string;
  name: string;
  portIds: string[];
}

export interface Circuit {
  components: Map<string, Component>;
  wires: Map<string, Wire>;
  nets: Map<string, Net>;
}

export type AnalysisType = 'dc_op' | 'transient' | 'ac' | 'dc_sweep';

export interface AnalysisConfig {
  type: AnalysisType;
  // Transient
  stopTime?: string;
  timeStep?: string;
  startTime?: string;
  // AC
  startFreq?: string;
  stopFreq?: string;
  pointsPerDecade?: number;
  // DC Sweep
  sweepSource?: string;
  sweepStart?: string;
  sweepStop?: string;
  sweepStep?: string;
}
