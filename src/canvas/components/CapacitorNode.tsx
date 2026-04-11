import { Handle, type NodeProps, Position } from '@xyflow/react';
import { useOverlayStore } from '@/overlay/overlayStore';
import styles from './ComponentNode.module.css';
import type { CircuitNodeData } from './types';
import { usePinClassName } from './usePinClassName';
import { useValueEdit } from './useValueEdit';

/**
 * Capacitor symbol: two parallel vertical plates.
 * viewBox: 40x32, two pins (left, right).
 */
export function CapacitorNode({ id, data, selected }: NodeProps) {
  const nodeData = data as CircuitNodeData;
  const compType = nodeData.type ?? 'capacitor';
  const pin1Class = usePinClassName(compType, 'pin1', id);
  const pin2Class = usePinClassName(compType, 'pin2', id);
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

      <svg viewBox="0 0 40 32" width={40} height={32}>
        {/* Lead lines */}
        <line x1={0} y1={16} x2={16} y2={16} stroke="var(--component-stroke)" strokeWidth={2} />
        <line x1={24} y1={16} x2={40} y2={16} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* Plates */}
        <line x1={16} y1={4} x2={16} y2={28} stroke="var(--component-stroke)" strokeWidth={2} />
        <line x1={24} y1={4} x2={24} y2={28} stroke="var(--component-stroke)" strokeWidth={2} />
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
