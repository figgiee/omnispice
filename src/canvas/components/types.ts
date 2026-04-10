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
  [key: string]: unknown;
}

export type CircuitNode = Node<CircuitNodeData>;
