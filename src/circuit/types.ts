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

/**
 * Pin electrical type (Phase 5 Pillar 1 — Schematic Honesty).
 *
 * Drives the live compatibility feedback system in the schematic editor:
 * - signal: data/analog nets (resistor pins, BJT base, op-amp inputs)
 * - power: power rail endpoints (voltage-source +, Vcc buses)
 * - ground: ground reference (ground symbol, shield grounds)
 * - supply: supply-side pins (voltage/current source, op-amp Vcc/Vee)
 *
 * See src/circuit/pinCompat.ts for the compatibility matrix.
 */
export type PinType = 'signal' | 'power' | 'ground' | 'supply';

/**
 * Pin signal direction (used for future bus/direction-aware routing).
 */
export type PinDirection = 'in' | 'out' | 'inout';

export interface Port {
  id: string;
  name: string;
  netId: string | null;
  /**
   * Phase 5 — pin electrical type. Optional at the TS level so legacy
   * saved circuits and unrelated test fixtures still compile; `createPorts`
   * always populates it with `'signal'` as the fallback.
   */
  pinType?: PinType;
  /**
   * Phase 5 — pin signal direction. Optional at the TS level (same
   * rationale as `pinType`); `createPorts` always fills `'inout'`.
   */
  direction?: PinDirection;
  /** Optional human-readable label like 'C','B','E' for BJTs. */
  label?: string;
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
