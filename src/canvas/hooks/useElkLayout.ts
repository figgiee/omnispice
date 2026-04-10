/**
 * ELK-based orthogonal edge routing for circuit wires.
 *
 * Uses elkjs to compute orthogonal edge routes that avoid node intersections.
 * Falls back to getSmoothStepPath with borderRadius:0 if ELK layout fails.
 *
 * ELK layout is async and debounced to avoid excessive re-computation
 * when nodes/edges change rapidly during drag operations.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';

const elk = new ELK();

/** ELK layout configuration for orthogonal wire routing. */
const ELK_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.spacing.nodeNode': '40',
  'elk.layered.spacing.nodeNodeBetweenLayers': '60',
  'elk.portConstraints': 'FIXED_POS',
};

/** Bend points computed by ELK for a single edge. */
export interface ElkEdgeRoute {
  edgeId: string;
  bendPoints: { x: number; y: number }[];
}

/** Debounce delay in ms before running ELK layout. */
const DEBOUNCE_MS = 200;

/**
 * Convert React Flow nodes/edges to an ELK graph, run layout,
 * and return computed bend points for each edge.
 */
async function computeElkLayout(
  nodes: Node[],
  edges: Edge[]
): Promise<ElkEdgeRoute[]> {
  const elkNodes: ElkNode[] = nodes.map((node) => ({
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? 60,
    height: node.measured?.height ?? 40,
  }));

  const elkEdges: ElkExtendedEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: ELK_OPTIONS,
    children: elkNodes,
    edges: elkEdges,
  };

  const layouted = await elk.layout(graph);

  const routes: ElkEdgeRoute[] = (layouted.edges ?? []).map((edge) => {
    const sections = 'sections' in edge ? (edge as ElkExtendedEdge).sections : undefined;
    const bendPoints =
      sections?.[0]?.bendPoints?.map((bp) => ({ x: bp.x, y: bp.y })) ?? [];
    return {
      edgeId: edge.id,
      bendPoints,
    };
  });

  return routes;
}

/**
 * Hook that runs ELK layout on React Flow nodes/edges to compute
 * orthogonal edge routes.
 *
 * Re-runs when nodes/edges change, debounced to avoid excessive computation.
 * Falls back gracefully if ELK layout fails.
 */
export function useElkLayout(nodes: Node[], edges: Edge[]) {
  const [edgeRoutes, setEdgeRoutes] = useState<ElkEdgeRoute[]>([]);
  const [isLayouting, setIsLayouting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runLayout = useCallback(async () => {
    if (nodes.length === 0 || edges.length === 0) {
      setEdgeRoutes([]);
      return;
    }

    setIsLayouting(true);
    try {
      const routes = await computeElkLayout(nodes, edges);
      setEdgeRoutes(routes);
    } catch {
      // ELK layout failed -- fall back to empty routes
      // (WireEdge will use getSmoothStepPath as fallback)
      setEdgeRoutes([]);
    } finally {
      setIsLayouting(false);
    }
  }, [nodes, edges]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      void runLayout();
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [runLayout]);

  return { edgeRoutes, isLayouting };
}
