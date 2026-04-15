/**
 * Custom React Flow edge for circuit wires.
 *
 * Renders orthogonal (90-degree angle) wire paths per D-10.
 * T-junction dots are rendered at intersection points per D-13.
 * Uses getSmoothStepPath with borderRadius: 0 for sharp corners.
 *
 * Plan 05-07 — the wire stroke is now computed from the DC op-point
 * voltage of the wire's net: the orchestrator publishes `wireVoltages`
 * (keyed by net name) into `overlayStore`, and this component looks
 * up the current wire's net via `circuitStore`. The resulting voltage
 * is mapped into an OKLab-interpolated hex colour by `oklabMix`.
 *
 * Ground nets (SPICE name "0") short-circuit to `--wire-v-neutral`
 * regardless of their numeric voltage so the ground rail stays visually
 * distinct. When the simulation has not yet run (simStatus === 'not-run'
 * or the net has no voltage entry) we fall back to the legacy
 * `--wire-stroke` cyan. When a transient scrub is active the stroke
 * dims to ~0.4 opacity so the user can see "values are lagging".
 */

import { BaseEdge, type Edge, type EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { useMemo } from 'react';
import { useOverlayStore } from '@/overlay/overlayStore';
import { useCircuitStore } from '@/store/circuitStore';
import { mixOklab, voltageToT } from './oklabMix';
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

/**
 * V1 rails — hardcoded 0..5V range for the wire colour gradient.
 * Phase 5 Plan 05-11 (or a follow-up) will auto-detect these from the
 * largest DC supply source in the circuit. See SUMMARY.md deferrals.
 */
const MIN_RAIL_V = 0;
const MAX_RAIL_V = 5;

/** SPICE ground net name used by `computeNets` and the netlister. */
const GROUND_NET_NAME = '0';

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

  // Plan 05-07 — look up the wire's net name so we can index into
  // `wireVoltages`. The net name is already cached on each port by
  // `computeNets`, which the circuit store runs on every mutation.
  // No need to re-compute the net graph here.
  const netName = useCircuitStore((s) => {
    const wire = s.circuit.wires.get(id);
    if (!wire) return null;
    // Hunt the source port across all components; ports are tiny so an
    // O(ports) scan here is cheaper than maintaining a separate index.
    for (const comp of s.circuit.components.values()) {
      const port = comp.ports.find((p) => p.id === wire.sourcePortId);
      if (port) return port.netId;
    }
    return null;
  });

  const voltage = useOverlayStore((s) =>
    netName !== null && netName !== undefined ? s.wireVoltages[netName] : undefined,
  );
  const simStatus = useOverlayStore((s) => s.simStatus);
  const edgeVoltages = useOverlayStore((s) => s.edgeVoltages);
  const isVisible = useOverlayStore((s) => s.isVisible);

  // Derive the actual stroke colour. Memoised so React Flow's many
  // re-renders don't re-run the OKLab interpolation on every frame.
  const computedStroke = useMemo(() => {
    if (selected) return 'var(--wire-selected)';
    if (netName === GROUND_NET_NAME) return 'var(--wire-v-neutral)';
    if (simStatus === 'not-run' || voltage === undefined) return 'var(--wire-stroke)';
    const t = voltageToT(voltage, MIN_RAIL_V, MAX_RAIL_V);
    return mixOklab(t);
  }, [selected, netName, simStatus, voltage]);

  // Dim during transient scrub so the user can see "values are lagging".
  const strokeOpacity = simStatus === 'stale' ? 0.4 : 1;

  const labelVoltage = edgeVoltages[id];
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  return (
    <g className={edgeClassName}>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: computedStroke,
          strokeOpacity,
          strokeWidth: 2,
        }}
        markerEnd={markerEnd}
        interactionWidth={20} // Easier clicking per D-14
      />
      {junctionPoints.map((point) => (
        <circle
          key={`${id}-junction-${point.x}-${point.y}`}
          cx={point.x}
          cy={point.y}
          r={5}
          className={styles.tjunctionDot}
        />
      ))}
      {isVisible && labelVoltage !== undefined && (
        <text x={midX} y={midY - 6} textAnchor="middle" className={styles.voltageLabel}>
          {labelVoltage.toFixed(2)} V
        </text>
      )}
    </g>
  );
}
