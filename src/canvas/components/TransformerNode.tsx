import { Handle, type NodeProps, Position } from '@xyflow/react';
import styles from './ComponentNode.module.css';
import type { CircuitNodeData } from './types';
import { usePinClassName } from './usePinClassName';
import { useValueEdit } from './useValueEdit';

/**
 * Transformer symbol: two coupled inductors with polarity dots.
 * viewBox: 60x48, four pins (pri_plus top-left, pri_minus bottom-left,
 * sec_plus top-right, sec_minus bottom-right).
 *
 * Note: handle ids use `pri_plus` etc, but COMPONENT_LIBRARY.transformer.ports
 * uses `pri+` / `pri-` / `sec+` / `sec-` names. usePinClassName falls back
 * to 'signal' when the lookup misses, which is correct for transformers.
 */
export function TransformerNode({ id, data, selected }: NodeProps) {
  const nodeData = data as CircuitNodeData;
  // Transformer library ports are named pri+/pri-/sec+/sec- but the Handle
  // ids use underscores. Lookup falls back to 'signal' (correct default for
  // transformer coils) when the lookup misses — every transformer pin is
  // signal inout in the library anyway.
  const priPlusClass = usePinClassName('transformer', 'pri+', id);
  const priMinusClass = usePinClassName('transformer', 'pri-', id);
  const secPlusClass = usePinClassName('transformer', 'sec+', id);
  const secMinusClass = usePinClassName('transformer', 'sec-', id);
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
        className={priPlusClass}
        style={{ top: '12.5%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="pri_minus"
        className={priMinusClass}
        style={{ top: '87.5%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="sec_plus"
        className={secPlusClass}
        style={{ top: '12.5%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="sec_minus"
        className={secMinusClass}
        style={{ top: '87.5%' }}
      />
    </div>
  );
}
