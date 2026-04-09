import type { NodeTypes } from '@xyflow/react';
import { ResistorNode } from './ResistorNode';
import { CapacitorNode } from './CapacitorNode';
import { InductorNode } from './InductorNode';
import { TransformerNode } from './TransformerNode';
import { DiodeNode } from './DiodeNode';
import { BjtNode } from './BjtNode';
import { MosfetNode } from './MosfetNode';
import { OpAmpNode } from './OpAmpNode';
import { VoltageSourceNode } from './VoltageSourceNode';
import { CurrentSourceNode } from './CurrentSourceNode';
import { GroundNode } from './GroundNode';

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
};
