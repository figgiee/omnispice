/**
 * Main application layout shell.
 *
 * Uses react-resizable-panels (v4) for resizable/collapsible panel management.
 * Owns the SimulationController lifecycle (init/destroy).
 * Bridges the circuit store data model to React Flow nodes/edges.
 *
 * Layout:
 * +--------+------------------------------------------+
 * |        |              Toolbar (48px)               |
 * |  Side  +------------------------------------------+
 * |  bar   |                                           |
 * | 240px  |         Canvas (fills remaining)          |
 * |        |                                           |
 * |        +------------------------------------------+
 * |        |         Bottom Panel (collapsible)        |
 * +--------+------------------------------------------+
 */

import {
  type Edge,
  type Node,
  type NodeChange,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Group,
  Panel,
  type PanelImperativeHandle,
  Separator,
  usePanelRef,
} from 'react-resizable-panels';
import { Canvas } from '@/canvas/Canvas';
import { circuitToEdges, circuitToNodes } from '@/canvas/circuitToFlow';
import type { CircuitNodeData } from '@/canvas/components/types';
import { ClassroomModeBar } from '@/components/classroom/ClassroomModeBar';
import { exportSchematicAsPng } from '@/export/exportPng';
import { SimulationController } from '@/simulation/controller';
import type { TranslatedError } from '@/simulation/errorTranslator';
import { useCircuitStore } from '@/store/circuitStore';
import { useClassroomStore } from '@/store/classroomStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useUiStore } from '@/store/uiStore';
import { BottomPanel } from '@/ui/BottomPanel';
import { CommandPalette } from '@/ui/CommandPalette';
import { Sidebar } from '@/ui/Sidebar';
import { Toolbar } from '@/ui/Toolbar';
import styles from './Layout.module.css';

/**
 * Helper to safely call imperative panel methods via ref.
 */
function getPanelHandle(ref: ReturnType<typeof usePanelRef>): PanelImperativeHandle | null {
  return (ref as React.RefObject<PanelImperativeHandle | null>).current ?? null;
}

/**
 * Inner layout content -- must be inside ReactFlowProvider.
 */
function LayoutContent() {
  const controllerRef = useRef<SimulationController | null>(null);
  const [controllerReady, setControllerReady] = useState(false);

  const bottomPanelRef = usePanelRef();
  const sidebarPanelRef = usePanelRef();

  const setStatus = useSimulationStore((s) => s.setStatus);
  const setResults = useSimulationStore((s) => s.setResults);
  const setErrors = useSimulationStore((s) => s.setErrors);
  const setElapsedTime = useSimulationStore((s) => s.setElapsedTime);
  const simStatus = useSimulationStore((s) => s.status);

  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setBottomTab = useUiStore((s) => s.setBottomTab);

  const classroomMode = useClassroomStore((s) => s.classroomMode);
  const activeAssignmentId = useClassroomStore((s) => s.activeAssignmentId);

  const circuit = useCircuitStore((s) => s.circuit);
  // Plan 05-03: subcircuit hierarchy — the converter filters by level so
  // only the current level's components / wires are emitted to React Flow.
  const currentSubcircuitId = useUiStore((s) => s.currentSubcircuitId);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CircuitNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Sync circuit store -> React Flow nodes
  useEffect(() => {
    const newNodes = circuitToNodes(circuit, currentSubcircuitId);
    setNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]));
      return newNodes.map((n) => {
        const existing = prevMap.get(n.id);
        if (existing) {
          return { ...existing, position: n.position, data: n.data };
        }
        return n;
      });
    });
  }, [circuit, currentSubcircuitId, setNodes]);

  // Sync circuit store -> React Flow edges
  useEffect(() => {
    setEdges(circuitToEdges(circuit, currentSubcircuitId));
  }, [circuit, currentSubcircuitId, setEdges]);

  // Sync React Flow node position changes back to circuit store
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes as NodeChange<Node<CircuitNodeData>>[]);
      const updatePosition = useCircuitStore.getState().updateComponentPosition;
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          updatePosition(change.id, change.position);
        }
      }
    },
    [onNodesChange],
  );

  // Initialize SimulationController
  useEffect(() => {
    const controller = new SimulationController(
      (elapsed) => {
        setElapsedTime(elapsed);
      },
      (vectors) => {
        setResults(vectors);
        setStatus('complete');
        setBottomTab('waveform');
        getPanelHandle(bottomPanelRef)?.expand();
      },
      (error) => {
        const adapted: TranslatedError = {
          message: error.message,
          suggestion: '',
          severity: 'error',
          raw: error.raw,
        };
        setErrors([adapted]);
        setStatus('error');
        setBottomTab('errors');
        getPanelHandle(bottomPanelRef)?.expand();
      },
      () => {
        setStatus('idle');
        setControllerReady(true);
      },
    );

    controllerRef.current = controller;
    setStatus('loading_engine');
    controller.initialize().catch(() => {
      // Error handled by onError callback
    });

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand bottom panel on sim complete/error
  useEffect(() => {
    if (simStatus === 'complete' || simStatus === 'error') {
      getPanelHandle(bottomPanelRef)?.expand();
    }
  }, [simStatus, bottomPanelRef]);

  // Plan 05-06: command palette "Export Schematic as PNG" action dispatches
  // `omnispice:export-png`; Layout owns `nodes` so it can pass them in.
  useEffect(() => {
    const handler = () => {
      void exportSchematicAsPng(nodes);
    };
    window.addEventListener('omnispice:export-png', handler);
    return () => window.removeEventListener('omnispice:export-png', handler);
  }, [nodes]);

  // Sync sidebar collapse state
  const prevSidebarCollapsedRef = useRef(sidebarCollapsed);
  useEffect(() => {
    if (prevSidebarCollapsedRef.current === sidebarCollapsed) return;
    prevSidebarCollapsedRef.current = sidebarCollapsed;
    if (sidebarCollapsed) {
      getPanelHandle(sidebarPanelRef)?.collapse();
    } else {
      getPanelHandle(sidebarPanelRef)?.expand();
    }
  }, [sidebarCollapsed, sidebarPanelRef]);

  const handleConnect = useCallback(() => {
    // Wire connection is handled by Canvas via circuitStore.addWire
  }, []);

  const controller = controllerReady ? controllerRef.current : null;

  return (
    <div className={styles.layout}>
      {classroomMode === 'student' && activeAssignmentId && (
        <ClassroomModeBar assignmentId={activeAssignmentId} />
      )}
      <Group orientation="horizontal" className={styles.outerGroup}>
        {/* Sidebar panel */}
        <Panel
          defaultSize={240}
          minSize={200}
          maxSize={320}
          collapsible
          collapsedSize={40}
          panelRef={sidebarPanelRef}
          onResize={(size) => {
            if (size.inPixels < 50 && !sidebarCollapsed) {
              toggleSidebar();
            } else if (size.inPixels >= 50 && sidebarCollapsed) {
              toggleSidebar();
            }
          }}
        >
          <Sidebar />
        </Panel>

        <Separator className={`${styles.resizeHandle} ${styles.resizeHandleHorizontal}`} />

        {/* Main content panel */}
        <Panel>
          <div className={styles.mainContent}>
            <div className={styles.toolbar}>
              <Toolbar controller={controller} />
            </div>

            <Group orientation="vertical" className={styles.verticalGroup}>
              <Panel minSize={150}>
                <Canvas
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={handleConnect}
                />
              </Panel>

              <Separator className={`${styles.resizeHandle} ${styles.resizeHandleVertical}`} />

              <Panel
                defaultSize={280}
                minSize={80}
                maxSize="55%"
                collapsible
                collapsedSize={32}
                panelRef={bottomPanelRef}
              >
                <BottomPanel controller={controller} />
              </Panel>
            </Group>
          </div>
        </Panel>
      </Group>
      {/* Global command palette — Ctrl+K front door (Plan 05-06). */}
      <CommandPalette />
    </div>
  );
}

export function Layout() {
  return (
    <ReactFlowProvider>
      <LayoutContent />
    </ReactFlowProvider>
  );
}
