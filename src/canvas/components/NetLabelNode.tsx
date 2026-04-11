import { Handle, type NodeProps, Position } from '@xyflow/react';
import styles from './NetLabelNode.module.css';
import type { CircuitNodeData } from './types';

/**
 * React Flow node type for net labels (Phase 5 Pillar 1 — Schematic Honesty).
 *
 * A net label is a pseudo-component on the canvas whose sole purpose is to
 * override the name of the net it sits on. The owner Component's `netLabel`
 * field propagates through `circuitToNodes` → `data.netLabel` → this node's
 * display → `computeNets` (via the graph algorithm reading the Component).
 *
 * Net labels expose a single `pin1` handle with `pinType: 'signal'` +
 * `direction: 'inout'` so the compat matrix reports neutral/ok against
 * signal/supply/ground pins.
 */
export function NetLabelNode({ data, selected }: NodeProps) {
  const nodeData = data as CircuitNodeData & { netLabel?: string };
  const label = nodeData.netLabel ?? nodeData.value ?? 'NET';
  return (
    <div
      className={styles.label}
      data-selected={selected ? 'true' : 'false'}
      data-testid="net-label-node"
    >
      <Handle type="target" position={Position.Left} id="pin1" className="pin pin-type-signal" />
      <span className={styles.netName}>{label}</span>
      <span className={styles.arrow}>▸</span>
    </div>
  );
}
