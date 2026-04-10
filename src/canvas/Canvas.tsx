import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './components/nodeTypes';
import styles from './Canvas.module.css';

export interface CanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
}

export function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
}: CanvasProps) {
  return (
    <div className={styles.canvas}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        snapToGrid
        snapGrid={[10, 10]}
        minZoom={0.25}
        maxZoom={4}
        panOnDrag={[1]}
        selectionOnDrag
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode="Shift"
        fitView
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={10}
          color="var(--canvas-grid-dot)"
          size={1}
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}
