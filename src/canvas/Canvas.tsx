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
  ConnectionMode,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type OnConnect,
  type OnConnectStart,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
  useReactFlow,
  useStore as useReactFlowStore,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@xyflow/react/dist/style.css';
import type { ComponentType } from '@/circuit/types';
import { getCircuitYMaps, LOCAL_ORIGIN } from '@/collab/circuitBinding';
import { PresenceLayer } from '@/collab/PresenceLayer';
import { PresenceList } from '@/collab/PresenceList';
import { useCollabRoomId, useCollabUser } from '@/collab/useCollabIdentity';
import {
  publishCursor,
  publishSelection,
  publishViewport,
  useCollabProvider,
} from '@/collab/useCollabProvider';
import { useCircuitStore } from '@/store/circuitStore';
import { useUiStore } from '@/store/uiStore';
import { ChangeCalloutLayer } from '@/ui/ChangeCalloutLayer';
import { Breadcrumb } from './Breadcrumb';
import styles from './Canvas.module.css';
import { CanvasContextMenu, type ContextMenuTarget } from './CanvasContextMenu';
import { nodeTypes } from './components/nodeTypes';
import { pinTypeFor } from './components/usePinClassName';
import { edgeTypes } from './edges/edgeTypes';
import { useCanvasInteractions } from './hooks/useCanvasInteractions';
import { useMagneticSnap } from './hooks/useMagneticSnap';
import { useNetLabelInput } from './hooks/useNetLabelInput';
import { useTypeToPlace } from './hooks/useTypeToPlace';
import { useWireRouting } from './hooks/useWireRouting';
import { ValidationWarnings } from './overlays/ValidationWarnings';
import { useWireDragStore } from './stores/wireDragStore';

/** MIME type for drag-and-drop component transfers from sidebar. */
const DND_MIME_TYPE = 'application/omnispice-component';

/**
 * Plan 05-09 — minimal leading-edge throttle. Calls `fn` immediately on
 * the first call, then silently drops every subsequent call until `ms`
 * have elapsed. We use this (instead of pulling in lodash) to cap the
 * Yjs awareness cursor publish rate at 20 Hz per the plan's locked spec.
 */
function throttle<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let last = 0;
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  }) as T;
}

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

  // Phase 5-09: Yjs presence-only collaboration provider lifecycle.
  // Clerk identity is provided by a test override / guest fallback;
  // Clerk hook injection is deliberately kept out of Canvas to avoid
  // dragging Clerk into the canvas module's test closure (Clerk needs
  // a <ClerkProvider> which Canvas tests don't mount).
  const collabRoomId = useCollabRoomId();
  const collabUser = useCollabUser();
  // Plan 06-04: useCollabProvider now returns { providerRef, docRef }.
  // docRef is used by onNodeDragStop to write position changes to Y.Map.
  const { providerRef, docRef } = useCollabProvider(collabRoomId, collabUser);
  // Subscribe to React Flow transform so viewport publishing is reactive.
  const rfTransform = useReactFlowStore((s) => s.transform) as readonly [number, number, number];
  // Selection ids for remote selection broadcasting.
  const selectedComponentIds = useUiStore((s) => s.selectedComponentIds);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null);

  // Ref to track the highlight timeout for cleanup
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Canvas hooks
  const { onDragOver } = useCanvasInteractions();
  const { isRouting, cancelRouting } = useWireRouting();
  const { isSnapping, snapTarget, checkSnap, clearSnap } = useMagneticSnap();
  // Plan 05-06 Task 4: type-to-place gesture. Listens for printable letters
  // while uiStore.insertCursor is active + no component selected.
  useTypeToPlace();
  // Plan 05-02 Task 4: type-on-selected-wire → creates a net label. This hook
  // MUST run after useTypeToPlace so that when a wire is selected, the net
  // label capture claims the key first (both hooks use window capture-phase
  // listeners but react in selection-guarded branches).
  useNetLabelInput();

  /**
   * Plan 05-09 — publish local selection to remote peers whenever the
   * uiStore selection changes. Cheap: awareness only fires when the
   * publisher changes state.
   */
  useEffect(() => {
    publishSelection(providerRef.current, selectedComponentIds);
  }, [selectedComponentIds, providerRef]);

  /**
   * Plan 05-09 — publish local React Flow viewport (pan + zoom) to
   * remote peers whenever it changes. Consumers of the peer viewport:
   * PresenceList click-to-frame action.
   */
  useEffect(() => {
    const [x, y, zoom] = rfTransform;
    publishViewport(providerRef.current, { x, y, zoom });
  }, [rfTransform, providerRef]);

  /**
   * Plan 05-09 — throttled cursor publisher. 50 ms window = 20 Hz cap
   * per the plan's locked awareness rate spec. The throttled function
   * is stable for the lifetime of the component (useMemo, empty deps)
   * so the leading-edge state is preserved across mouse moves.
   */
  const publishCursorThrottled = useMemo(
    () =>
      throttle((x: unknown, y: unknown) => {
        publishCursor(providerRef.current, x as number, y as number);
      }, 50),
    [providerRef],
  );

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
   *
   * React Flow's `connection.sourceHandle` is the `<Handle id="...">` attribute
   * (which every node component sets to the port NAME like "pin1", "base").
   * The circuit store, however, keys ports by their globally-unique UUID. We
   * resolve the port name → UUID via the source/target nodes' `Component.ports`
   * so wires survive circuitToEdges lookups and render on screen.
   *
   * Plan 05-02 Rule 1 fix: previously this passed the port NAME directly to
   * addWire, which broke the circuitToEdges source/target resolution and
   * prevented edges from rendering at all.
   */
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (
        connection.source &&
        connection.target &&
        connection.sourceHandle &&
        connection.targetHandle
      ) {
        const circuit = useCircuitStore.getState().circuit;
        const sourceComp = circuit.components.get(connection.source);
        const targetComp = circuit.components.get(connection.target);
        const sourcePort = sourceComp?.ports.find((p) => p.name === connection.sourceHandle);
        const targetPort = targetComp?.ports.find((p) => p.name === connection.targetHandle);
        if (sourcePort && targetPort) {
          addWire(sourcePort.id, targetPort.id);
        }
      }
      onConnect(connection);
    },
    [addWire, onConnect],
  );

  /**
   * Phase 5 Pillar 1 — wire drag lifecycle.
   *
   * onConnectStart: look up the source handle's pinType in the component
   * library via the node's ComponentType, push into wireDragStore. Every
   * subscribed pin re-colors live via `usePinClassName`.
   *
   * onConnectEnd: clear the store so pins revert to their base colours.
   *
   * isValidConnection: always `true` per locked decision D-01 — students
   * must be allowed to complete any wire, even electrically wrong ones.
   * The compat matrix drives VISUAL feedback only.
   */
  const handleConnectStart: OnConnectStart = useCallback(
    (_event, { nodeId, handleId }) => {
      if (!nodeId || !handleId) return;
      const node = getNode(nodeId);
      if (!node) return;
      const pinType = pinTypeFor(node.type as ComponentType, handleId);
      useWireDragStore.getState().start(`${nodeId}:${handleId}`, pinType);
    },
    [getNode],
  );

  const handleConnectEnd = useCallback(() => {
    useWireDragStore.getState().end();
  }, []);

  const isValidConnection = useCallback(() => true, []);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, []);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id });
  }, []);

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      const e = event as React.MouseEvent;
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setContextMenu({ x: e.clientX, y: e.clientY, flowX: flowPos.x, flowY: flowPos.y });
    },
    [screenToFlowPosition],
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
   * Handle mouse move for wire routing preview, magnetic snap, live
   * cursor-position tracking (Plan 05-06: template insertion uses this
   * as a fallback anchor when there is no explicit click cursor), and
   * Plan 05-09 throttled remote cursor publishing.
   */
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      useUiStore.getState().setCursorPosition(position);
      // Plan 05-09: throttled to 20 Hz to avoid WebSocket flood.
      publishCursorThrottled(position.x, position.y);
      if (isRouting) {
        checkSnap(position);
      }
    },
    [isRouting, screenToFlowPosition, checkSnap, publishCursorThrottled],
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

  /**
   * Plan 06-04 — write the dragged node's final position into Y.Map so peers
   * receive the update via Yjs sync. Fires once on mouseup (not 60 fps during
   * drag). Uses LOCAL_ORIGIN so the echo guard in circuitBinding skips the
   * event for the local client, avoiding a redundant Zustand re-render.
   *
   * No-op when docRef.current is null (offline / collab disabled).
   */
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const yDoc = docRef.current;
      if (!yDoc) return;
      const { yComponents } = getCircuitYMaps(yDoc);
      const existing = yComponents.get(node.id);
      if (!existing) return; // component not yet in Y.Map (shouldn't happen)
      const parsed = JSON.parse(existing) as Record<string, unknown>;
      yDoc.transact(() => {
        yComponents.set(node.id, JSON.stringify({ ...parsed, position: node.position }));
      }, LOCAL_ORIGIN);
    },
    [docRef],
  );

  return (
    <div className={styles.canvas}>
      {/* Plan 05-03: hierarchy breadcrumb (renders null at top level). */}
      <Breadcrumb />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={40}
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
          // Plan 05-03: double-clicking a subcircuit block descends into it.
          // All other node types keep the Phase 1 frame-node behaviour.
          if (node.type === 'subcircuit') {
            useUiStore.getState().setCurrentSubcircuitId(node.id);
            return;
          }
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
        onNodeDragStop={handleNodeDragStop}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
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
        {/* Plan 05-09: remote peer cursors, selection tints, ghost chips. */}
        <PresenceLayer />
        {/* Plan 05-09: top-right peer avatar bar (click-to-frame). */}
        <PresenceList />
        {/* Plan 05-11: transient mutation feedback pills anchored above components. */}
        <ChangeCalloutLayer />
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
      {contextMenu && (
        <CanvasContextMenu target={contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
}
