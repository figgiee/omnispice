/**
 * Canvas interaction handlers and keyboard shortcuts.
 *
 * Registers all keyboard shortcuts per UI-SPEC Keyboard Shortcuts table
 * using react-hotkeys-hook. Dispatches actions to circuitStore and uiStore.
 */

import { useReactFlow } from '@xyflow/react';
import { useCallback, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import type { Component } from '@/circuit/types';
import { useCircuitStore } from '@/store/circuitStore';
import { useUiStore } from '@/store/uiStore';
import { computeSelectionBbox, fitZoomForBbox } from '../framing';

/**
 * Hook that registers all canvas keyboard shortcuts and returns
 * interaction state for the canvas component.
 */
export function useCanvasInteractions() {
  const { zoomIn, zoomOut, fitView, setCenter, getNodes, getViewport } = useReactFlow();

  // Circuit store actions
  const removeComponent = useCircuitStore((s) => s.removeComponent);
  const removeWire = useCircuitStore((s) => s.removeWire);
  const rotateComponent = useCircuitStore((s) => s.rotateComponent);
  const addComponents = useCircuitStore((s) => s.addComponents);

  // UI store state and actions
  const selectedComponentIds = useUiStore((s) => s.selectedComponentIds);
  const selectedWireIds = useUiStore((s) => s.selectedWireIds);
  const setSelectedComponentIds = useUiStore((s) => s.setSelectedComponentIds);
  const setActiveTool = useUiStore((s) => s.setActiveTool);

  // Internal clipboard for copy/paste
  const clipboardRef = useRef<Component[]>([]);

  /**
   * Copy the currently-selected components into the internal clipboard.
   * Extracted so Ctrl+C and Shift+D can both reuse the same copy logic.
   */
  const doCopy = useCallback(() => {
    const circuit = useCircuitStore.getState().circuit;
    const components: Component[] = [];
    for (const id of selectedComponentIds) {
      const comp = circuit.components.get(id);
      if (comp) {
        components.push(comp);
      }
    }
    clipboardRef.current = components;
  }, [selectedComponentIds]);

  /**
   * Paste the internal clipboard, offset by (20, 20), and select the new
   * components. Extracted so Ctrl+V and Shift+D both reuse the same paste.
   */
  const doPaste = useCallback(() => {
    if (clipboardRef.current.length === 0) return;

    const newComponents: Component[] = clipboardRef.current.map((comp) => ({
      ...comp,
      id: crypto.randomUUID(),
      position: {
        x: comp.position.x + 20,
        y: comp.position.y + 20,
      },
      ports: comp.ports.map((port) => ({
        ...port,
        id: crypto.randomUUID(),
        netId: null,
      })),
    }));

    addComponents(newComponents);
    setSelectedComponentIds(newComponents.map((c) => c.id));
    // Update clipboard to point at pasted components for subsequent pastes
    clipboardRef.current = newComponents;
  }, [addComponents, setSelectedComponentIds]);

  // Delete selected components and wires (Delete / Backspace)
  useHotkeys(
    'delete, backspace',
    () => {
      for (const id of selectedComponentIds) {
        removeComponent(id);
      }
      for (const id of selectedWireIds) {
        removeWire(id);
      }
      setSelectedComponentIds([]);
    },
    { preventDefault: true },
  );

  // Rotate selected components (R key) per D-09
  useHotkeys('r', () => {
    for (const id of selectedComponentIds) {
      rotateComponent(id);
    }
  });

  // Copy selected components (Ctrl+C) per D-05
  useHotkeys(
    'ctrl+c, meta+c',
    () => {
      doCopy();
    },
    { preventDefault: true },
  );

  // Paste components offset by (20, 20) (Ctrl+V) per D-05
  useHotkeys(
    'ctrl+v, meta+v',
    () => {
      doPaste();
    },
    { preventDefault: true },
  );

  // Undo (Ctrl+Z)
  useHotkeys(
    'ctrl+z, meta+z',
    () => {
      useCircuitStore.temporal.getState().undo();
    },
    { preventDefault: true },
  );

  // Redo (Ctrl+Shift+Z or Ctrl+Y)
  useHotkeys(
    'ctrl+shift+z, meta+shift+z, ctrl+y, meta+y',
    () => {
      useCircuitStore.temporal.getState().redo();
    },
    { preventDefault: true },
  );

  // Select all (Ctrl+A)
  useHotkeys(
    'ctrl+a, meta+a',
    () => {
      const circuit = useCircuitStore.getState().circuit;
      const allIds = Array.from(circuit.components.keys());
      setSelectedComponentIds(allIds);
    },
    { preventDefault: true },
  );

  // Escape cancels any in-progress operation
  useHotkeys('escape', () => {
    setActiveTool('select');
  });

  // Zoom in (Ctrl+=)
  useHotkeys(
    'ctrl+=, meta+=',
    () => {
      zoomIn();
    },
    { preventDefault: true },
  );

  // Zoom out (Ctrl+-)
  useHotkeys(
    'ctrl+-, meta+-',
    () => {
      zoomOut();
    },
    { preventDefault: true },
  );

  // Fit view (Ctrl+0)
  useHotkeys(
    'ctrl+0, meta+0',
    () => {
      fitView();
    },
    { preventDefault: true },
  );

  // Frame selection (F) per UI-SPEC §7.5 S5
  useHotkeys('f', () => {
    const selected = getNodes().filter((n) => n.selected);
    if (selected.length === 0) return; // no-op per UI-SPEC
    const bbox = computeSelectionBbox(selected);
    const viewport = getViewport();
    // React Flow's viewport returns transform, not dimensions — use window
    // innerWidth/innerHeight as a reasonable approximation of the canvas
    // area. This is close enough for a 60%-fill zoom and keeps the helper
    // pure-math + testable.
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const zoom = fitZoomForBbox(bbox, { width: vw, height: vh });
    // touch viewport to keep it in the closure for future refinements
    void viewport;
    setCenter(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2, {
      duration: 200,
      zoom,
    });
  });

  // Frame all (A or 0) per UI-SPEC §7.5 S5
  useHotkeys('a, 0', () => {
    fitView({ duration: 200 });
  });

  // Spacebar-hold temp pan (Pillar 2 modelessness).
  // Keydown sets uiStore.tempPanActive (cursor hint + panOnDrag flip);
  // keyup clears it. We do NOT preventDefault on Space because React
  // Flow's panActivationKeyCode="Space" also needs the keydown event
  // to bubble to window for its useKeyPress listener — preventDefault
  // does not stop propagation, but some React Flow versions gate on
  // the raw event. Keep the flag here for downstream UI (Canvas reads
  // `tempPanActive` to flip `selectionOnDrag`), while React Flow's
  // built-in handles the actual pan activation.
  useHotkeys(
    'space',
    () => {
      useUiStore.getState().setTempPanActive(true);
    },
    { keydown: true, keyup: false },
  );
  useHotkeys(
    'space',
    () => {
      useUiStore.getState().setTempPanActive(false);
    },
    { keydown: false, keyup: true },
  );

  // Duplicate selection (Shift+D) — reuses copy/paste helpers so the
  // paste offset (+20,+20) matches Ctrl+C/V behavior.
  useHotkeys(
    'shift+d',
    (e) => {
      e.preventDefault();
      doCopy();
      doPaste();
    },
    { preventDefault: true },
  );

  // Run simulation (F5)
  useHotkeys(
    'f5',
    () => {
      // Emit simulation run event (handled by simulation orchestration in future plans)
      window.dispatchEvent(new CustomEvent('omnispice:run-simulation'));
    },
    { preventDefault: true },
  );

  // Cancel simulation (Ctrl+.)
  useHotkeys(
    'ctrl+., meta+.',
    () => {
      window.dispatchEvent(new CustomEvent('omnispice:cancel-simulation'));
    },
    { preventDefault: true },
  );

  // Command palette (Ctrl+K)
  useHotkeys(
    'ctrl+k, meta+k',
    () => {
      window.dispatchEvent(new CustomEvent('omnispice:open-command-palette'));
    },
    { preventDefault: true },
  );

  // Keyboard shortcut help overlay (? key)
  useHotkeys('shift+/', () => {
    window.dispatchEvent(new CustomEvent('omnispice:toggle-shortcut-help'));
  });

  /** Handle drag-over for component placement from sidebar. */
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return {
    clipboardCount: clipboardRef.current.length,
    onDragOver,
  };
}
