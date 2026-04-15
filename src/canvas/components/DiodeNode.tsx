import { Handle, type NodeProps, Position } from '@xyflow/react';
import { useOverlayStore } from '@/overlay/overlayStore';
import styles from './ComponentNode.module.css';
import type { CircuitNodeData } from './types';
import { usePinClassName } from './usePinClassName';
import { useValueEdit } from './useValueEdit';

/**
 * Diode symbol: triangle pointing right + vertical bar.
 * Variants: standard diode, zener (bent bar), schottky (S-bar).
 * viewBox: 40x32, two pins (anode left, cathode right).
 */
export function DiodeNode({ id, data, selected }: NodeProps) {
  const nodeData = data as CircuitNodeData;
  const anodeClass = usePinClassName(nodeData.type ?? 'diode', 'anode', id);
  const cathodeClass = usePinClassName(nodeData.type ?? 'diode', 'cathode', id);
  const { isEditing, editValue, setEditValue, inputRef, startEditing, handleKeyDown } =
    useValueEdit(nodeData.value);
  const { isVisible, branchCurrents } = useOverlayStore();
  const current = branchCurrents[nodeData.refDesignator?.toLowerCase() ?? ''];

  const renderBar = () => {
    const diodeType = nodeData.type;
    if (diodeType === 'zener_diode') {
      // Zener: bent bar ends
      return (
        <path
          d="M32,4 L28,4 L28,4 M28,4 L32,4 L32,28 L36,28"
          stroke="var(--component-stroke)"
          strokeWidth={2}
          fill="none"
        />
      );
    }
    if (diodeType === 'schottky_diode') {
      // Schottky: S-shaped bar ends
      return (
        <path
          d="M28,4 L28,8 L32,8 L32,4 L32,28 L32,24 L36,24 L36,28"
          stroke="var(--component-stroke)"
          strokeWidth={2}
          fill="none"
        />
      );
    }
    // Standard diode: straight bar
    return <line x1={32} y1={4} x2={32} y2={28} stroke="var(--component-stroke)" strokeWidth={2} />;
  };

  return (
    <div
      className={styles.node}
      data-selected={selected}
      style={{ '--node-rotation': `${nodeData.rotation ?? 0}deg` } as React.CSSProperties}
    >
      <span className={styles.refLabel}>{nodeData.refDesignator}</span>

      <svg viewBox="0 0 40 32" width={40} height={32}>
        {/* Lead lines */}
        <line x1={0} y1={16} x2={8} y2={16} stroke="var(--component-stroke)" strokeWidth={2} />
        <line x1={32} y1={16} x2={40} y2={16} stroke="var(--component-stroke)" strokeWidth={2} />
        {/* Triangle */}
        <path
          d="M8,4 L8,28 L32,16 Z"
          stroke="var(--component-stroke)"
          strokeWidth={2}
          fill="none"
        />
        {/* Cathode bar (variant-specific) */}
        {renderBar()}
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

      <Handle type="target" position={Position.Left} id="anode" className={anodeClass} />
      <Handle type="source" position={Position.Right} id="cathode" className={cathodeClass} />
    </div>
  );
}
