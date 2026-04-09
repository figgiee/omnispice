import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CircuitNodeData } from './types';
import { useValueEdit } from './useValueEdit';
import styles from './ComponentNode.module.css';

/**
 * BJT transistor symbol (NPN/PNP).
 * NPN: arrow on emitter points outward. PNP: arrow on emitter points inward.
 * viewBox: 48x48, three pins (base left, collector top, emitter bottom).
 */
export function BjtNode({ data, selected }: NodeProps) {
  const nodeData = data as CircuitNodeData;
  const isPnp = nodeData.type === 'pnp_bjt';
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
        {/* Circle */}
        <circle cx={28} cy={24} r={18} stroke="var(--component-stroke)" strokeWidth={2} fill="none" />
        {/* Base lead */}
        <line x1={0} y1={24} x2={16} y2={24} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* Base vertical line */}
        <line x1={16} y1={12} x2={16} y2={36} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* Collector line */}
        <line x1={16} y1={16} x2={36} y2={4} stroke="var(--component-stroke)" strokeWidth={2} />
        <line x1={36} y1={4} x2={36} y2={0} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* Emitter line */}
        <line x1={16} y1={32} x2={36} y2={44} stroke="var(--component-stroke)" strokeWidth={2} />
        <line x1={36} y1={44} x2={36} y2={48} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* Arrow on emitter */}
        {isPnp ? (
          // PNP: arrow pointing inward (toward base)
          <polygon points="20,29 26,33 22,37" fill="var(--component-stroke)" />
        ) : (
          // NPN: arrow pointing outward (away from base)
          <polygon points="32,41 26,37 30,33" fill="var(--component-stroke)" />
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

      <Handle type="target" position={Position.Left} id="base" className={styles.pin} />
      <Handle type="source" position={Position.Top} id="collector" className={styles.pin} />
      <Handle type="source" position={Position.Bottom} id="emitter" className={styles.pin} />
    </div>
  );
}
