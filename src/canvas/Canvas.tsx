/**
 * Schematic canvas component.
 *
 * Integrates React Flow with custom node/edge types, keyboard shortcuts,
 * wire routing, magnetic snap, and drag-and-drop component placement.
 */

import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useReactFlow,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './components/nodeTypes';
import { edgeTypes } from './edges/edgeTypes';
import { useCanvasInteractions } from './hooks/useCanvasInteractions';
import { useWireRouting } from './hooks/useWireRouting';
import { useMagneticSnap } from './hooks/useMagneticSnap';
import { useCircuitStore } from '@/store/circuitStore';
import { useUiStore } from '@/store/uiStore';
import type { ComponentType } from '@/circuit/types';
import styles from './Canvas.module.css';

/** MIME type for drag-and-drop component transfers from sidebar. */
const DND_MIME_TYPE = 'application/omnispice-component';

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
  const { screenToFlowPosition } = useReactFlow();

  // Store actions
  const addComponent = useCircuitStore((s) => s.addComponent);
  const addWire = useCircuitStore((s) => s.addWire);
  const setSelectedComponentIds = useUiStore((s) => s.setSelectedComponentIds);

  // Canvas hooks
  const { onDragOver } = useCanvasInteractions();
  const { isRouting, cancelRouting } = useWireRouting();
  const { isSnapping, snapTarget, checkSnap, clearSnap } = useMagneticSnap();

  /**
   * Handle new connections from React Flow.
   * Calls circuitStore.addWire when a connection is completed.
   */
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.sourceHandle && connection.targetHandle) {
        addWire(connection.sourceHandle, connection.targetHandle);
      }
      onConnect(connection);
    },
    [addWire, onConnect]
  );

  /**
   * Handle drop events for component placement from sidebar.
   * Reads component type from dataTransfer, converts screen coordinates
   * to flow position, snaps to 10px grid per D-02.
   */
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const componentType = event.dataTransfer.getData(DND_MIME_TYPE);
      if (!componentType) return;

      // Convert screen coordinates to flow position
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Snap to 10px grid per D-02
      const snappedPosition = {
        x: Math.round(position.x / 10) * 10,
        y: Math.round(position.y / 10) * 10,
      };

      const id = addComponent(componentType as ComponentType, snappedPosition);
      setSelectedComponentIds([id]);
    },
    [screenToFlowPosition, addComponent, setSelectedComponentIds]
  );

  /**
   * Handle mouse move for wire routing preview and magnetic snap.
   */
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (isRouting) {
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        checkSnap(position);
      }
    },
    [isRouting, screenToFlowPosition, checkSnap]
  );

  /**
   * Handle pane click to cancel wire routing.
   */
  const handlePaneClick = useCallback(() => {
    if (isRouting) {
      cancelRouting();
      clearSnap();
    }
  }, [isRouting, cancelRouting, clearSnap]);

  return (
    <div className={styles.canvas}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'wire' }}
        snapToGrid
        snapGrid={[10, 10]}
        minZoom={0.25}
        maxZoom={4}
        panOnDrag={[1]}
        selectionOnDrag
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode="Shift"
        fitView
        onDrop={handleDrop}
        onDragOver={onDragOver}
        onMouseMove={handleMouseMove}
        onPaneClick={handlePaneClick}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={10}
          color="var(--canvas-grid-dot)"
          size={1}
        />
        <Controls />
        {/* Magnetic snap feedback overlay */}
        {isSnapping && snapTarget && (
          <svg
            className={styles.snapOverlay}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            <circle
              cx={snapTarget.position.x}
              cy={snapTarget.position.y}
              r={6}
              fill="var(--pin-hover)"
              opacity={0.8}
            />
          </svg>
        )}
      </ReactFlow>
    </div>
  );
}
