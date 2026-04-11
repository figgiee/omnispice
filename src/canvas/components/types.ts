import type { Node } from '@xyflow/react';
import type { ComponentType } from '../../circuit/types';

/**
 * Data payload for all circuit component nodes on the React Flow canvas.
 */
export interface CircuitNodeData {
  type: ComponentType;
  refDesignator: string;
  value: string;
  rotation: number;
  /**
   * Phase 5 Pillar 1 — only populated on `net_label` pseudo-components.
   * Mirrored from `Component.netLabel` by `circuitToNodes` so NetLabelNode
   * can render the user-facing net identifier.
   */
  netLabel?: string;
  [key: string]: unknown;
}

export type CircuitNode = Node<CircuitNodeData>;
