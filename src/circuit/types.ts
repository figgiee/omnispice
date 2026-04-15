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
  | 'ground'
  /**
   * Phase 5 Pillar 1 — pseudo-component that overrides the name of the
   * net it sits on. Not emitted to SPICE; its `data.netName` becomes
   * the net's SPICE identifier. See `NetLabelNode.tsx` and `computeNets`.
   */
  | 'net_label';

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
  /**
   * Phase 5 Pillar 1 — only populated on `net_label` components. The
   * string is used by `computeNets` to override the generated net name
   * and is surfaced directly in the rendered netlist.
   */
  netLabel?: string;
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
  /**
   * Phase 5 Pillar 1 — when a `net_label` pseudo-component touches this net,
   * its `netLabel` field is hoisted here so downstream tooling (netlister,
   * overlays, UI) can distinguish user-named nets from auto-generated ones.
   */
  netLabel?: string;
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
