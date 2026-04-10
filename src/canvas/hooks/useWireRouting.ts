/**
 * Wire routing state machine hook.
 *
 * Manages the wire drawing lifecycle per UI-SPEC Wire Routing interactions:
 * 1. User clicks pin in wire mode -> starts wire from that pin
 * 2. Mouse moves -> preview wire follows cursor with orthogonal routing
 * 3. Click at intermediate point -> fixes a bend point (D-12)
 * 4. Click on destination pin -> completes wire connection
 * 5. Escape or right-click -> cancels wire routing
 */

import { useCallback, useState } from 'react';
import { useCircuitStore } from '@/store/circuitStore';
import { useUiStore } from '@/store/uiStore';

export interface WireRoutingState {
  /** Whether wire routing is currently in progress. */
  isRouting: boolean;
  /** The source port ID where the wire originates. */
  sourcePortId: string | null;
  /** Fixed bend points placed by user clicks (D-12). */
  bendPoints: { x: number; y: number }[];
  /** Current preview path including cursor position. */
  previewPath: { x: number; y: number }[] | null;
}

const INITIAL_STATE: WireRoutingState = {
  isRouting: false,
  sourcePortId: null,
  bendPoints: [],
  previewPath: null,
};

/**
 * Hook that manages wire drawing state machine.
 *
 * Only active when uiStore.activeTool === 'wire'.
 * Dispatches circuitStore.addWire on successful completion.
 */
export function useWireRouting() {
  const [state, setState] = useState<WireRoutingState>(INITIAL_STATE);
  const addWire = useCircuitStore((s) => s.addWire);
  const activeTool = useUiStore((s) => s.activeTool);

  /** Begin routing from a source port/pin. */
  const startRouting = useCallback(
    (portId: string) => {
      if (activeTool !== 'wire') return;
      setState({
        isRouting: true,
        sourcePortId: portId,
        bendPoints: [],
        previewPath: null,
      });
    },
    [activeTool]
  );

  /** Add a fixed bend point at an intermediate click position (D-12). */
  const addBend = useCallback(
    (point: { x: number; y: number }) => {
      if (!state.isRouting) return;
      setState((prev) => ({
        ...prev,
        bendPoints: [...prev.bendPoints, point],
      }));
    },
    [state.isRouting]
  );

  /** Update the preview path to follow cursor movement. */
  const updatePreview = useCallback(
    (cursorPosition: { x: number; y: number }) => {
      if (!state.isRouting) return;
      setState((prev) => ({
        ...prev,
        previewPath: [...prev.bendPoints, cursorPosition],
      }));
    },
    [state.isRouting]
  );

  /** Complete wire routing by connecting to a target port. */
  const completeRouting = useCallback(
    (targetPortId: string) => {
      if (!state.isRouting || !state.sourcePortId) return;
      addWire(state.sourcePortId, targetPortId);
      setState(INITIAL_STATE);
    },
    [state.isRouting, state.sourcePortId, addWire]
  );

  /** Cancel wire routing and reset state. */
  const cancelRouting = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    isRouting: state.isRouting,
    sourcePortId: state.sourcePortId,
    bendPoints: state.bendPoints,
    previewPath: state.previewPath,
    startRouting,
    addBend,
    updatePreview,
    completeRouting,
    cancelRouting,
  };
}
