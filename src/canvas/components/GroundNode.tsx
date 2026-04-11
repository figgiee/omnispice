import { Handle, type NodeProps, Position } from '@xyflow/react';
import { useOverlayStore } from '@/overlay/overlayStore';
import styles from './ComponentNode.module.css';
import { usePinClassName } from './usePinClassName';

/**
 * Ground symbol: three horizontal lines decreasing in width.
 * viewBox: 24x24, single pin at top.
 * Maps to node 0 in SPICE.
 *
 * Ground pin is typed `ground` in COMPONENT_LIBRARY; usePinClassName will
 * match the library entry `pin1` even though the React Flow handle id is
 * `gnd` — we call it with the library name directly.
 */
export function GroundNode({ id, data, selected }: NodeProps) {
  const { isVisible, nodeVoltages } = useOverlayStore();
  const gndClass = usePinClassName('ground', 'pin1', id);
  // Ground is always node 0 in SPICE; show "0 V" when any simulation data exists
  const hasData = Object.keys(nodeVoltages).length > 0;

  return (
    <div
      className={styles.node}
      data-selected={selected}
      style={
        {
          '--node-rotation': `${((data as Record<string, unknown>).rotation as number) ?? 0}deg`,
        } as React.CSSProperties
      }
    >
      <svg viewBox="0 0 24 24" width={24} height={24}>
        {/* Vertical lead from top */}
        <line x1={12} y1={0} x2={12} y2={8} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* Three horizontal lines decreasing width */}
        <line x1={4} y1={8} x2={20} y2={8} stroke="var(--component-stroke)" strokeWidth={2} />
        <line x1={7} y1={14} x2={17} y2={14} stroke="var(--component-stroke)" strokeWidth={2} />
        <line x1={10} y1={20} x2={14} y2={20} stroke="var(--component-stroke)" strokeWidth={2} />
      </svg>

      {isVisible && hasData && <span className={styles.overlayLabel}>0 V</span>}

      <Handle type="target" position={Position.Top} id="gnd" className={gndClass} />
    </div>
  );
}
