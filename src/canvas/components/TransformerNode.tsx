import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CircuitNodeData } from './types';
import { useValueEdit } from './useValueEdit';
import styles from './ComponentNode.module.css';

/**
 * Transformer symbol: two coupled inductors with polarity dots.
 * viewBox: 60x48, four pins (pri_plus top-left, pri_minus bottom-left,
 * sec_plus top-right, sec_minus bottom-right).
 */
export function TransformerNode({ data, selected }: NodeProps) {
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

      <svg viewBox="0 0 60 48" width={60} height={48}>
        {/* Primary coil (left side) */}
        <line x1={0} y1={6} x2={16} y2={6} stroke="var(--component-stroke)" strokeWidth={2} />
        <path
          d="M16,6 A4,4 0 0,1 16,14 A4,4 0 0,1 16,22 A4,4 0 0,1 16,30 A4,4 0 0,1 16,38"
          stroke="var(--component-stroke)"
          strokeWidth={2}
          fill="none"
        />
        <line x1={0} y1={42} x2={16} y2={42} stroke="var(--component-stroke)" strokeWidth={2} />

        {/* Core lines (parallel vertical bars between coils) */}
        <line x1={26} y1={4} x2={26} y2={44} stroke="var(--component-stroke)" strokeWidth={1.5} />
        <line x1={34} y1={4} x2={34} y2={44} stroke="var(--component-stroke)" strokeWidth={1.5} />

        {/* Secondary coil (right side) */}
        <line x1={44} y1={6} x2={60} y2={6} stroke="var(--component-stroke)" strokeWidth={2} />
        <path
          d="M44,6 A4,4 0 0,0 44,14 A4,4 0 0,0 44,22 A4,4 0 0,0 44,30 A4,4 0 0,0 44,38"
          stroke="var(--component-stroke)"
          strokeWidth={2}
          fill="none"
        />
        <line x1={44} y1={42} x2={60} y2={42} stroke="var(--component-stroke)" strokeWidth={2} />

        {/* Polarity dots */}
        <circle cx={12} cy={10} r={2} fill="var(--component-stroke)" />
        <circle cx={48} cy={10} r={2} fill="var(--component-stroke)" />
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
        id="pri_plus"
        className={styles.pin}
        style={{ top: '12.5%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="pri_minus"
        className={styles.pin}
        style={{ top: '87.5%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="sec_plus"
        className={styles.pin}
        style={{ top: '12.5%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="sec_minus"
        className={styles.pin}
        style={{ top: '87.5%' }}
      />
    </div>
  );
}
