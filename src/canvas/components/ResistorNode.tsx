import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CircuitNodeData } from './types';
import { useValueEdit } from './useValueEdit';
import styles from './ComponentNode.module.css';

/**
 * IEEE zigzag resistor symbol.
 * viewBox: 60x24, two pins (left, right).
 */
export function ResistorNode({ data, selected }: NodeProps) {
  const nodeData = data as CircuitNodeData;
  const { isEditing, editValue, setEditValue, inputRef, startEditing, handleKeyDown } =
    useValueEdit(nodeData.value);

  return (
    <div
      className={styles.node}
      data-selected={selected}
      style={{ '--node-rotation': `${nodeData.rotation ?? 0}deg` } as React.CSSProperties}
    >
      <span className={styles.refLabel}>{nodeData.refDesignator}</span>

      <svg viewBox="0 0 60 24" width={60} height={24}>
        <path
          d="M0,12 L8,12 L12,2 L20,22 L28,2 L36,22 L44,2 L48,12 L60,12"
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

      <Handle type="target" position={Position.Left} id="pin1" className={styles.pin} />
      <Handle type="source" position={Position.Right} id="pin2" className={styles.pin} />
    </div>
  );
}
