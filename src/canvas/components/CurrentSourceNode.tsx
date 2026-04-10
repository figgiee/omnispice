import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CircuitNodeData } from './types';
import { useValueEdit } from './useValueEdit';
import styles from './ComponentNode.module.css';

/**
 * Current source symbol: circle with arrow pointing up.
 * viewBox: 36x36, two pins (in at bottom, out at top).
 */
export function CurrentSourceNode({ data, selected }: NodeProps) {
  const nodeData = data as CircuitNodeData;
  const { isEditing, editValue, setEditValue, inputRef, startEditing, handleKeyDown } =
    useValueEdit(nodeData.value);

  return (
    <div
      className={styles.node}
      data-selected={selected}
      style={{ transform: `rotate(${nodeData.rotation ?? 0}deg)` }}
    >
      <span className={styles.refLabel}>{nodeData.refDesignator}</span>

      <svg viewBox="0 0 36 36" width={36} height={36}>
        {/* Lead lines */}
        <line x1={18} y1={0} x2={18} y2={2} stroke="var(--component-stroke)" strokeWidth={2} />
        <line x1={18} y1={34} x2={18} y2={36} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* Circle */}
        <circle cx={18} cy={18} r={16} stroke="var(--component-stroke)" strokeWidth={2} fill="none" />
        {/* Arrow pointing up */}
        <line x1={18} y1={28} x2={18} y2={10} stroke="var(--component-stroke)" strokeWidth={2} />
        <polygon points="18,8 14,14 22,14" fill="var(--component-stroke)" />
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

      <Handle type="target" position={Position.Bottom} id="in" className={styles.pin} />
      <Handle type="source" position={Position.Top} id="out" className={styles.pin} />
    </div>
  );
}
