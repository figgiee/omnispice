import type { EdgeTypes } from '@xyflow/react';
import { WireEdge } from './WireEdge';

/**
 * Registry of custom React Flow edge types for circuit wires.
 * Maps edge type identifiers to their rendering components.
 */
export const edgeTypes: EdgeTypes = {
  wire: WireEdge,
};
