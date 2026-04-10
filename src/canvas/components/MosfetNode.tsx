import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CircuitNodeData } from './types';
import { useValueEdit } from './useValueEdit';
import styles from './ComponentNode.module.css';

/**
 * MOSFET symbol (NMOS/PMOS).
 * PMOS has an inversion bubble on the gate.
 * viewBox: 48x48, three pins (gate left, drain top, source bottom).
 */
export function MosfetNode({ data, selected }: NodeProps) {
  const nodeData = data as CircuitNodeData;
  const isPmos = nodeData.type === 'pmos';
  const { isEditing, editValue, setEditValue, inputRef, startEditing, handleKeyDown } =
    useValueEdit(nodeData.value);

  return (
    <div
      className={styles.node}
      data-selected={selected}
      style={{ transform: `rotate(${nodeData.rotation ?? 0}deg)` }}
    >
      <span className={styles.refLabel}>{nodeData.refDesignator}</span>

      <svg viewBox="0 0 48 48" width={48} height={48}>
        {/* Gate lead */}
        <line x1={0} y1={24} x2={14} y2={24} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* Gate vertical line */}
        <line x1={14} y1={10} x2={14} y2={38} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* Channel vertical line (gap between gate and channel) */}
        <line x1={20} y1={10} x2={20} y2={18} stroke="var(--component-stroke)" strokeWidth={2} />
        <line x1={20} y1={22} x2={20} y2={26} stroke="var(--component-stroke)" strokeWidth={2} />
        <line x1={20} y1={30} x2={20} y2={38} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* Drain line */}
        <line x1={20} y1={14} x2={36} y2={14} stroke="var(--component-stroke)" strokeWidth={2} />
        <line x1={36} y1={0} x2={36} y2={14} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* Source line */}
        <line x1={20} y1={34} x2={36} y2={34} stroke="var(--component-stroke)" strokeWidth={2} />
        <line x1={36} y1={34} x2={36} y2={48} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* Body connection */}
        <line x1={20} y1={24} x2={36} y2={24} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* Arrow on source (direction indicates NMOS vs PMOS) */}
        {isPmos ? (
          <>
            {/* PMOS: inversion bubble on gate */}
            <circle cx={17} cy={24} r={3} stroke="var(--component-stroke)" strokeWidth={1.5} fill="none" />
            {/* Arrow pointing outward from channel */}
            <polygon points="26,22 26,26 30,24" fill="var(--component-stroke)" />
          </>
        ) : (
          /* NMOS: arrow pointing inward toward channel */
          <polygon points="30,22 30,26 26,24" fill="var(--component-stroke)" />
        )}
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

      <Handle type="target" position={Position.Left} id="gate" className={styles.pin} />
      <Handle type="source" position={Position.Top} id="drain" className={styles.pin} />
      <Handle type="source" position={Position.Bottom} id="source" className={styles.pin} />
    </div>
  );
}
