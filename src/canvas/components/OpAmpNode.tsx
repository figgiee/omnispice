import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CircuitNodeData } from './types';
import { useValueEdit } from './useValueEdit';
import styles from './ComponentNode.module.css';

/**
 * Op-Amp symbol: triangle with +/- inputs.
 * viewBox: 56x48, three pins (non_inv + at left-top, inv - at left-bottom, output at right).
 * Power pins are implicit (not rendered per plan).
 */
export function OpAmpNode({ data, selected }: NodeProps) {
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

      <svg viewBox="0 0 56 48" width={56} height={48}>
        {/* Triangle body */}
        <path d="M0,0 L0,48 L56,24 Z" stroke="var(--component-stroke)" strokeWidth={2} fill="none" />
        {/* + sign (non-inverting input) */}
        <text
          x={8}
          y={16}
          fill="var(--component-stroke)"
          fontSize={14}
          fontFamily="var(--font-body)"
          textAnchor="middle"
        >
          +
        </text>
        {/* - sign (inverting input) */}
        <text
          x={8}
          y={40}
          fill="var(--component-stroke)"
          fontSize={14}
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

      <Handle
        type="target"
        position={Position.Left}
        id="non_inv"
        className={styles.pin}
        style={{ top: '25%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="inv"
        className={styles.pin}
        style={{ top: '75%' }}
      />
      <Handle type="source" position={Position.Right} id="output" className={styles.pin} />
    </div>
  );
}
