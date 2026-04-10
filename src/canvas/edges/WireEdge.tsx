/**
 * Custom React Flow edge for circuit wires.
 *
 * Renders orthogonal (90-degree angle) wire paths per D-10.
 * T-junction dots are rendered at intersection points per D-13.
 * Uses getSmoothStepPath with borderRadius: 0 for sharp corners.
 */

import { BaseEdge, type Edge, type EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { useOverlayStore } from '@/overlay/overlayStore';
import styles from './WireEdge.module.css';

/**
 * Custom data attached to wire edges.
 * junctionPoints: coordinates where T-junctions should render filled dots.
 */
export interface WireEdgeData {
  junctionPoints?: { x: number; y: number }[];
  [key: string]: unknown;
}

export type WireEdgeType = Edge<WireEdgeData, 'wire'>;

export function WireEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  data,
}: EdgeProps<WireEdgeType>) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 0, // Sharp 90-degree corners per D-10
  });

  const junctionPoints = data?.junctionPoints ?? [];
  const edgeClassName = selected ? `${styles.wireEdge} ${styles.selected}` : styles.wireEdge;

  const edgeVoltages = useOverlayStore((s) => s.edgeVoltages);
  const isVisible = useOverlayStore((s) => s.isVisible);
  const voltage = edgeVoltages[id];
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  return (
    <g className={edgeClassName}>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: selected ? 'var(--wire-selected)' : 'var(--wire-stroke)',
          strokeWidth: 2,
        }}
        markerEnd={markerEnd}
        interactionWidth={20} // Easier clicking per D-14
      />
      {junctionPoints.map((point, index) => (
        <circle
          key={`${id}-junction-${index}`}
          cx={point.x}
          cy={point.y}
          r={5}
          className={styles.tjunctionDot}
        />
      ))}
      {isVisible && voltage !== undefined && (
        <text x={midX} y={midY - 6} textAnchor="middle" className={styles.voltageLabel}>
          {voltage.toFixed(2)} V
        </text>
      )}
    </g>
  );
}
