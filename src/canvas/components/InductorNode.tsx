import { Handle, type NodeProps, Position } from '@xyflow/react';
import { useOverlayStore } from '@/overlay/overlayStore';
import styles from './ComponentNode.module.css';
import type { CircuitNodeData } from './types';
import { usePinClassName } from './usePinClassName';
import { useValueEdit } from './useValueEdit';

/**
 * Inductor symbol: 4 arc loops (coil).
 * viewBox: 60x24, two pins (left, right).
 */
export function InductorNode({ id, data, selected }: NodeProps) {
  const nodeData = data as CircuitNodeData;
  const pin1Class = usePinClassName(nodeData.type ?? 'inductor', 'pin1', id);
  const pin2Class = usePinClassName(nodeData.type ?? 'inductor', 'pin2', id);
  const { isEditing, editValue, setEditValue, inputRef, startEditing, handleKeyDown } =
    useValueEdit(nodeData.value);
  const { isVisible, branchCurrents } = useOverlayStore();
  const current = branchCurrents[nodeData.refDesignator?.toLowerCase() ?? ''];

  return (
    <div
      className={styles.node}
      data-selected={selected}
      style={{ '--node-rotation': `${nodeData.rotation ?? 0}deg` } as React.CSSProperties}
    >
      <span className={styles.refLabel}>{nodeData.refDesignator}</span>

      <svg viewBox="0 0 60 24" width={60} height={24}>
        {/* Lead lines */}
        <line x1={0} y1={12} x2={6} y2={12} stroke="var(--component-stroke)" strokeWidth={2} />
        <line x1={54} y1={12} x2={60} y2={12} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* 4 coil arcs */}
        <path
          d="M6,12 A6,6 0 0,1 18,12 A6,6 0 0,1 30,12 A6,6 0 0,1 42,12 A6,6 0 0,1 54,12"
          stroke="var(--component-stroke)"
          strokeWidth={2}
          fill="none"
        />
      </svg>

      {isEditing ? (
        <input
          ref={inputRef}
          className={`${styles.valueInput} nodrag`}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => startEditing()}
        />
      ) : (
        <span className={styles.valueLabel} onClick={startEditing}>
          {nodeData.value}
        </span>
      )}

      {isVisible && current !== undefined && (
        <span className={styles.overlayLabel}>
          {Math.abs(current) < 1 ? `${(current * 1000).toFixed(2)} mA` : `${current.toFixed(2)} A`}
        </span>
      )}

      <Handle type="target" position={Position.Left} id="pin1" className={pin1Class} />
      <Handle type="source" position={Position.Right} id="pin2" className={pin2Class} />
    </div>
  );
}
