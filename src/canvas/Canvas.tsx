/**
 * Schematic canvas component.
 *
 * Integrates React Flow with custom node/edge types, keyboard shortcuts,
 * wire routing, magnetic snap, and drag-and-drop component placement.
 *
 * D-21: Error navigation -- watches highlightedComponentId, pans to the
 *       component and applies a 3-second red dashed highlight.
 * D-23: Validation warnings -- renders ValidationWarnings overlay inside
 *       ReactFlow for yellow icons on problem components.
 */

import {
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import { useCallback, useEffect, useRef } from 'react';
import '@xyflow/react/dist/style.css';
import type { ComponentType } from '@/circuit/types';
import { useCircuitStore } from '@/store/circuitStore';
import { useUiStore } from '@/store/uiStore';
import styles from './Canvas.module.css';
import { nodeTypes } from './components/nodeTypes';
import { edgeTypes } from './edges/edgeTypes';
import { useCanvasInteractions } from './hooks/useCanvasInteractions';
import { useMagneticSnap } from './hooks/useMagneticSnap';
import { useTypeToPlace } from './hooks/useTypeToPlace';
import { useWireRouting } from './hooks/useWireRouting';
import { ValidationWarnings } from './overlays/ValidationWarnings';

/** MIME type for drag-and-drop component transfers from sidebar. */
const DND_MIME_TYPE = 'application/omnispice-component';

export interface CanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
}

export function Canvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect }: CanvasProps) {
  const { screenToFlowPosition, setCenter, getNode } = useReactFlow();

  // Store actions
  const addComponent = useCircuitStore((s) => s.addComponent);
  const addWire = useCircuitStore((s) => s.addWire);
  const setSelectedComponentIds = useUiStore((s) => s.setSelectedComponentIds);
  const highlightedComponentId = useUiStore((s) => s.highlightedComponentId);
  const setHighlightedComponentId = useUiStore((s) => s.setHighlightedComponentId);
  // Phase 5: Spacebar-hold temp pan (Pillar 2 modelessness)
  const tempPanActive = useUiStore((s) => s.tempPanActive);

  // Ref to track the highlight timeout for cleanup
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Canvas hooks
  const { onDragOver } = useCanvasInteractions();
  const { isRouting, cancelRouting } = useWireRouting();
  const { isSnapping, snapTarget, checkSnap, clearSnap } = useMagneticSnap();
  // Plan 05-06 Task 4: type-to-place gesture. Listens for printable letters
  // while uiStore.insertCursor is active + no component selected.
  useTypeToPlace();

  /**
   * D-21: Error navigation receive side.
   * When highlightedComponentId changes, pan to the component and
   * apply a temporary red dashed highlight for 3 seconds.
   */
  useEffect(() => {
    if (!highlightedComponentId) return;

    const node = getNode(highlightedComponentId);
    if (!node) return;

    // Pan to the component with 200ms ease-out animation
    const cx = node.position.x + (node.measured?.width ?? node.width ?? 60) / 2;
    const cy = node.position.y + (node.measured?.height ?? node.height ?? 40) / 2;

    setCenter(cx, cy, { duration: 200, zoom: 1.5 });

    // Apply highlight class to the node's DOM element
    // Use a stable class name string to avoid CSS Modules undefined issue
    const HIGHLIGHT_CLASS = 'omnispice-node-highlighted';
    const nodeEl = document.querySelector(
      `[data-id="${highlightedComponentId}"]`,
    ) as HTMLElement | null;
    if (nodeEl) {
      nodeEl.classList.add(HIGHLIGHT_CLASS);
    }

    // Clear highlight after 3 seconds
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      if (nodeEl) {
        nodeEl.classList.remove(HIGHLIGHT_CLASS);
      }
      setHighlightedComponentId(null);
    }, 3000);

    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [highlightedComponentId, getNode, setCenter, setHighlightedComponentId]);

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
    [addWire, onConnect],
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
    [screenToFlowPosition, addComponent, setSelectedComponentIds],
  );

  /**
   * Handle mouse move for wire routing preview, magnetic snap, and live
   * cursor-position tracking (Plan 05-06: template insertion uses this as
   * a fallback anchor when there is no explicit click cursor).
   */
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      useUiStore.getState().setCursorPosition(position);
      if (isRouting) {
        checkSnap(position);
      }
    },
    [isRouting, screenToFlowPosition, checkSnap],
  );

  /**
   * Handle pane click:
   * - Cancels any in-progress wire routing
   * - Sets the insert cursor at the click position in flow coordinates
   *   (Plan 05-06: Modelessness pillar — type-to-place and template insert
   *   both anchor here)
   * - Clears selection so R becomes a type-to-place letter, not rotate
   */
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (isRouting) {
        cancelRouting();
        clearSnap();
      }
      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      useUiStore.getState().setInsertCursor({
        x: Math.round(flowPos.x / 10) * 10,
        y: Math.round(flowPos.y / 10) * 10,
      });
      setSelectedComponentIds([]);
    },
    [isRouting, cancelRouting, clearSnap, screenToFlowPosition, setSelectedComponentIds],
  );

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
        panOnDrag={tempPanActive ? true : [1]}
        selectionOnDrag={!tempPanActive}
        // Phase 5 S5: Spacebar-hold temporary pan (Pillar 2 modelessness).
        // React Flow flips panOnDrag=true internally while Space is held,
        // overriding selectionOnDrag. Works in parallel with our uiStore
        // tempPanActive flag (set by the Space hotkey) which drives cursor
        // hints and any downstream UI listeners.
        panActivationKeyCode="Space"
        onNodeDoubleClick={(_event, node) => {
          const w = node.measured?.width ?? node.width ?? 0;
          const h = node.measured?.height ?? node.height ?? 0;
          setCenter(node.position.x + w / 2, node.position.y + h / 2, {
            duration: 200,
            zoom: 2,
          });
        }}
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
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          maskColor="rgba(18, 25, 46, 0.6)"
          nodeColor={(n) => (n.selected ? 'var(--accent-primary)' : 'var(--text-secondary)')}
          style={{
            background: 'var(--waveform-bg)',
            border: '1px solid var(--border-default)',
            borderRadius: '4px',
          }}
        />
        {/* D-23: Validation warning icons on problem components */}
        <ValidationWarnings />
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
