import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CircuitNodeData } from './types';
import { useValueEdit } from './useValueEdit';
import styles from './ComponentNode.module.css';

/**
 * Voltage source symbol: circle with +/- labels.
 * viewBox: 36x36, two pins (positive top, negative bottom).
 */
export function VoltageSourceNode({ data, selected }: NodeProps) {
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
        {/* + sign at top */}
        <text
          x={18}
          y={14}
          fill="var(--component-stroke)"
          fontSize={12}
          fontFamily="var(--font-body)"
          textAnchor="middle"
        >
          +
        </text>
        {/* - sign at bottom */}
        <text
          x={18}
          y={28}
          fill="var(--component-stroke)"
          fontSize={12}
          fontFamily="var(--font-body)"
          textAnchor="middle"
        >
          &minus;
        </text>
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

      <Handle type="source" position={Position.Top} id="positive" className={styles.pin} />
      <Handle type="target" position={Position.Bottom} id="negative" className={styles.pin} />
    </div>
  );
}
