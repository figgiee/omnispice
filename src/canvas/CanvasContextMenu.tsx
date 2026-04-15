/**
 * Right-click context menu for the schematic canvas.
 *
 * Shows contextually relevant actions based on what was right-clicked:
 *   - Node: Rotate, Delete
 *   - Edge: Delete wire
 *   - Pane: Place Ground at position
 */

import { MousePointerClick, RotateCw, Trash2, ZapOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useCircuitStore } from '@/store/circuitStore';
import styles from './CanvasContextMenu.module.css';

export interface ContextMenuTarget {
  x: number; // screen px
  y: number;
  flowX?: number; // canvas-space coords for pane clicks
  flowY?: number;
  nodeId?: string;
  edgeId?: string;
}

interface Props {
  target: ContextMenuTarget;
  onClose: () => void;
}

export function CanvasContextMenu({ target, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const act = (fn: () => void) => {
    fn();
    onClose();
  };

  const { nodeId, edgeId } = target;

  return (
    <div ref={menuRef} className={styles.menu} style={{ left: target.x, top: target.y }}>
      {nodeId && (
        <>
          <button
            type="button"
            className={styles.item}
            onClick={() => act(() => useCircuitStore.getState().rotateComponent(nodeId))}
          >
            <RotateCw size={13} />
            Rotate 90°
          </button>
          <div className={styles.divider} />
          <button
            type="button"
            className={`${styles.item} ${styles.danger}`}
            onClick={() => act(() => useCircuitStore.getState().removeComponent(nodeId))}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </>
      )}

      {edgeId && (
        <button
          type="button"
          className={`${styles.item} ${styles.danger}`}
          onClick={() => act(() => useCircuitStore.getState().removeWire(edgeId))}
        >
          <Trash2 size={13} />
          Delete wire
        </button>
      )}

      {!nodeId && !edgeId && (
        <>
          <button
            type="button"
            className={styles.item}
            onClick={() =>
              act(() =>
                useCircuitStore
                  .getState()
                  .addComponent('ground', { x: target.flowX ?? 100, y: target.flowY ?? 100 }),
              )
            }
          >
            <ZapOff size={13} />
            Place ground here
          </button>
          <div className={styles.divider} />
          <div className={styles.hint}>
            <MousePointerClick size={12} />
            Press Ctrl+K to place a component
          </div>
        </>
      )}
    </div>
  );
}
