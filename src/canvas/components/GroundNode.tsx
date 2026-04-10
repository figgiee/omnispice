import { Handle, Position, type NodeProps } from '@xyflow/react';
import styles from './ComponentNode.module.css';

/**
 * Ground symbol: three horizontal lines decreasing in width.
 * viewBox: 24x24, single pin at top.
 * Maps to node 0 in SPICE.
 */
export function GroundNode({ data, selected }: NodeProps) {
  return (
    <div
      className={styles.node}
      data-selected={selected}
      style={{ '--node-rotation': `${(data as Record<string, unknown>).rotation as number ?? 0}deg` } as React.CSSProperties}
    >
      <svg viewBox="0 0 24 24" width={24} height={24}>
        {/* Vertical lead from top */}
        <line x1={12} y1={0} x2={12} y2={8} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* Three horizontal lines decreasing width */}
        <line x1={4} y1={8} x2={20} y2={8} stroke="var(--component-stroke)" strokeWidth={2} />
        <line x1={7} y1={14} x2={17} y2={14} stroke="var(--component-stroke)" strokeWidth={2} />
        <line x1={10} y1={20} x2={14} y2={20} stroke="var(--component-stroke)" strokeWidth={2} />
      </svg>

      <Handle type="target" position={Position.Top} id="gnd" className={styles.pin} />
    </div>
  );
}
