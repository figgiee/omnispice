import type { NodeTypes } from '@xyflow/react';
import { BjtNode } from './BjtNode';
import { CapacitorNode } from './CapacitorNode';
import { CurrentSourceNode } from './CurrentSourceNode';
import { DiodeNode } from './DiodeNode';
import { GroundNode } from './GroundNode';
import { InductorNode } from './InductorNode';
import { MosfetNode } from './MosfetNode';
import { NetLabelNode } from './NetLabelNode';
import { OpAmpNode } from './OpAmpNode';
import { ResistorNode } from './ResistorNode';
import { SubcircuitNode } from './SubcircuitNode';
import { TransformerNode } from './TransformerNode';
import { VoltageSourceNode } from './VoltageSourceNode';

/**
 * Registry of all custom React Flow node types for circuit components.
 * Maps ComponentType values to their corresponding node components.
 */
export const nodeTypes: NodeTypes = {
  // Passives
  resistor: ResistorNode,
  capacitor: CapacitorNode,
  inductor: InductorNode,
  transformer: TransformerNode,

  // Semiconductors - Diodes
  diode: DiodeNode,
  zener_diode: DiodeNode,
  schottky_diode: DiodeNode,

  // Semiconductors - BJTs
  npn_bjt: BjtNode,
  pnp_bjt: BjtNode,

  // Semiconductors - MOSFETs
  nmos: MosfetNode,
  pmos: MosfetNode,

  // Op-Amps
  ideal_opamp: OpAmpNode,
  ua741: OpAmpNode,
  lm741: OpAmpNode,

  // Voltage Sources
  dc_voltage: VoltageSourceNode,
  ac_voltage: VoltageSourceNode,
  pulse_voltage: VoltageSourceNode,
  sin_voltage: VoltageSourceNode,
  pwl_voltage: VoltageSourceNode,

  // Current Sources
  dc_current: CurrentSourceNode,
  ac_current: CurrentSourceNode,

  // Ground
  ground: GroundNode,

  // Phase 5 Pillar 1 — net label pseudo-component
  net_label: NetLabelNode,

  // Phase 5 Pillar 1 Part 2 (Plan 05-03) — collapsed subcircuit block
  subcircuit: SubcircuitNode,
};
