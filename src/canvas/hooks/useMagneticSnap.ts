/**
 * Magnetic snap detection hook.
 *
 * Detects when a dragged component or wire endpoint is within 20px
 * of a valid connection target (pin). Provides snap feedback state
 * for visual indicators per D-01 and UI-SPEC.
 */

import { useCallback, useState } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';

/** Snap detection threshold in canvas pixels. */
export const SNAP_THRESHOLD_PX = 20;

export interface SnapTarget {
  /** The port/handle ID of the snap target. */
  portId: string;
  /** The node ID the port belongs to. */
  nodeId: string;
  /** The snapped position (center of the target pin). */
  position: { x: number; y: number };
}

export interface MagneticSnapState {
  /** The detected snap target, or null if nothing nearby. */
  snapTarget: SnapTarget | null;
  /** Whether a snap target is currently detected. */
  isSnapping: boolean;
}

/**
 * Extract handle positions from a React Flow node.
 * Handles are defined via the node's handle elements.
 */
function getHandlePositions(
  node: Node
): { portId: string; x: number; y: number }[] {
  const handles: { portId: string; x: number; y: number }[] = [];
  const nodeX = node.position.x;
  const nodeY = node.position.y;
  const width = node.measured?.width ?? 60;
  const height = node.measured?.height ?? 40;

  // React Flow handles store their positions in the internals
  // We approximate based on handle definitions from the node data
  if (node.handles) {
    for (const handle of node.handles) {
      if (handle.id) {
        // Handle positions are relative percentages or px from node origin
        const hx = nodeX + (handle.x ?? width / 2);
        const hy = nodeY + (handle.y ?? height / 2);
        handles.push({ portId: handle.id, x: hx, y: hy });
      }
    }
  }

  return handles;
}

/**
 * Compute Euclidean distance between two 2D points.
 */
function distance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Hook that detects magnetic snap targets within SNAP_THRESHOLD_PX.
 *
 * Call checkSnap with the current cursor/drag position to find the
 * nearest pin within the snap threshold. Returns snap target info
 * and isSnapping state for rendering visual feedback.
 */
export function useMagneticSnap() {
  const [state, setState] = useState<MagneticSnapState>({
    snapTarget: null,
    isSnapping: false,
  });

  const { getNodes } = useReactFlow();

  /**
   * Check if a position is within snap range of any pin.
   * Updates snap target state accordingly.
   */
  const checkSnap = useCallback(
    (position: { x: number; y: number }) => {
      const nodes = getNodes();
      let closestTarget: SnapTarget | null = null;
      let closestDistance = SNAP_THRESHOLD_PX;

      for (const node of nodes) {
        const handles = getHandlePositions(node);
        for (const handle of handles) {
          const dist = distance(position, { x: handle.x, y: handle.y });
          if (dist <= closestDistance) {
            closestDistance = dist;
            closestTarget = {
              portId: handle.portId,
              nodeId: node.id,
              position: { x: handle.x, y: handle.y },
            };
          }
        }
      }

      setState({
        snapTarget: closestTarget,
        isSnapping: closestTarget !== null,
      });
    },
    [getNodes]
  );

  /** Clear any active snap state. */
  const clearSnap = useCallback(() => {
    setState({ snapTarget: null, isSnapping: false });
  }, []);

  return {
    snapTarget: state.snapTarget,
    isSnapping: state.isSnapping,
    snapPosition: state.snapTarget?.position ?? null,
    checkSnap,
    clearSnap,
  };
}
