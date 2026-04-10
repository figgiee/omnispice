import { ReactFlow, Background, Controls, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Circuit } from '@/circuit/types';
import { circuitToNodes, circuitToEdges } from '@/canvas/circuitToFlow';
import { nodeTypes } from '@/canvas/components/nodeTypes';
import { edgeTypes } from '@/canvas/edges/edgeTypes';

interface Props {
  circuit: Circuit;
}

/**
 * Read-only React Flow canvas for submission viewing.
 * Per D-24: no interaction affordances (non-owning instructor viewing student work).
 * Pan/zoom enabled so the viewer can inspect — that's not editing.
 */
function ReadOnlyCircuitCanvasInner({ circuit }: Props) {
  const nodes = circuitToNodes(circuit);
  const edges = circuitToEdges(circuit);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 400 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        panOnDrag
        zoomOnScroll
        fitView
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

/**
 * Wraps the viewer in a ReactFlowProvider (required by ReactFlow).
 */
export function ReadOnlyCircuitCanvas({ circuit }: Props) {
  return (
    <ReactFlowProvider>
      <ReadOnlyCircuitCanvasInner circuit={circuit} />
    </ReactFlowProvider>
  );
}
