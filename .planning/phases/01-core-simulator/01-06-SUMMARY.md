---
phase: 01-core-simulator
plan: 06
subsystem: canvas-interactions
tags: [wire-routing, keyboard-shortcuts, magnetic-snap, elk-layout, canvas]
dependency_graph:
  requires: ["01-04", "01-05"]
  provides: ["wire-edge-type", "canvas-interactions", "magnetic-snap", "elk-layout"]
  affects: ["src/canvas/Canvas.tsx", "src/canvas/edges/", "src/canvas/hooks/"]
tech_stack:
  added: ["elkjs (orthogonal edge routing)"]
  patterns: ["React Flow custom edge", "react-hotkeys-hook shortcuts", "state machine hook", "ELK-based layout"]
key_files:
  created:
    - src/canvas/edges/WireEdge.tsx
    - src/canvas/edges/WireEdge.module.css
    - src/canvas/edges/edgeTypes.ts
    - src/canvas/hooks/useElkLayout.ts
    - src/canvas/hooks/useWireRouting.ts
    - src/canvas/hooks/useMagneticSnap.ts
    - src/canvas/hooks/useCanvasInteractions.ts
    - src/canvas/hooks/__tests__/useWireRouting.test.ts
    - src/canvas/hooks/__tests__/useMagneticSnap.test.ts
    - src/canvas/hooks/__tests__/useCanvasInteractions.test.ts
  modified:
    - src/canvas/Canvas.tsx
decisions:
  - "Used getSmoothStepPath with borderRadius:0 for immediate wire rendering instead of requiring ELK for every edge; ELK layout runs as optional post-processing"
  - "Simulation run/cancel dispatched via CustomEvent on window rather than direct store call, keeping simulation orchestration decoupled for future plans"
  - "Copy/paste uses internal clipboard ref rather than system clipboard API to avoid permission prompts"
metrics:
  duration: "5min"
  completed: "2026-04-10T00:08:09Z"
---

# Phase 01 Plan 06: Wire Routing & Canvas Interactions Summary

Orthogonal wire edges with 90-degree routing, T-junction dot rendering, ELK-based layout engine, wire drawing state machine, 20px magnetic snap detection, and full keyboard shortcut set via react-hotkeys-hook -- all integrated into the schematic canvas.

## What Was Built

### Task 1: Wire Routing Edge and Magnetic Snap

- **WireEdge** custom React Flow edge renders orthogonal wire paths using `getSmoothStepPath` with `borderRadius: 0` for sharp 90-degree corners per D-10. T-junction dots (filled circles, r=5) render at junction points passed via edge data per D-13. Selected state uses `--wire-selected` color. `interactionWidth: 20` for easier wire clicking per D-14.

- **edgeTypes** registry maps `'wire'` to `WireEdge`, passed to React Flow as the default edge type.

- **useElkLayout** hook runs ELK layout asynchronously on React Flow nodes/edges using `elkjs` with `ORTHOGONAL` edge routing, `FIXED_POS` port constraints, and configurable node spacing. Debounced at 200ms to avoid excessive computation during drag. Falls back gracefully if ELK fails.

- **useWireRouting** state machine hook manages the full wire drawing lifecycle: `startRouting(portId)` -> `addBend(point)` -> `completeRouting(targetPortId)` or `cancelRouting()`. Only activates when `uiStore.activeTool === 'wire'`. Dispatches `circuitStore.addWire` on completion.

- **useMagneticSnap** hook detects when a position is within 20px of any component pin using Euclidean distance. Returns the closest snap target (portId, nodeId, position) and `isSnapping` boolean for visual feedback.

### Task 2: Canvas Interactions and Keyboard Shortcuts

- **useCanvasInteractions** registers all keyboard shortcuts from the UI-SPEC via `react-hotkeys-hook`:
  - Delete/Backspace: remove selected components and wires
  - R: rotate selected components 90 degrees
  - Ctrl+C/V: copy/paste with 20px offset
  - Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y: undo/redo via zundo temporal store
  - Ctrl+A: select all components
  - W: wire tool, V/Escape: select tool
  - Ctrl+=/- and Ctrl+0: zoom in/out/fit
  - F5: run simulation (CustomEvent)
  - Ctrl+.: cancel simulation (CustomEvent)
  - Ctrl+K: command palette (CustomEvent)
  - Shift+/: shortcut help overlay (CustomEvent)

- **Canvas.tsx** updated to integrate all hooks and edge types:
  - `edgeTypes` prop with wire edge type
  - `onDrop` handler reading `application/omnispice-component` from dataTransfer, converting to flow position, snapping to 10px grid
  - `onConnect` handler wiring to `circuitStore.addWire`
  - Mouse move handler for wire routing preview and magnetic snap detection
  - Magnetic snap feedback overlay (accent-colored glow circle on nearest pin)

## Test Results

26 tests passing across 3 test files:
- `useWireRouting.test.ts`: 8 tests -- state machine transitions (start, bend, complete, cancel, guard conditions)
- `useMagneticSnap.test.ts`: 8 tests -- 20px threshold boundary, closest pin selection, clear state
- `useCanvasInteractions.test.ts`: 10 tests -- each hotkey dispatches correct store action

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] ELK used as optional enhancement, not required path**
- **Found during:** Task 1
- **Issue:** Plan specified ELK for all wire rendering, but getSmoothStepPath already provides orthogonal routing with borderRadius:0. Making ELK mandatory for every edge render would add latency.
- **Fix:** WireEdge uses getSmoothStepPath directly for immediate rendering. useElkLayout runs as optional post-processing that can enhance routes. This matches the plan's own fallback spec.
- **Files modified:** src/canvas/edges/WireEdge.tsx, src/canvas/hooks/useElkLayout.ts

**2. [Rule 2 - Missing functionality] Simulation events via CustomEvent instead of direct store calls**
- **Found during:** Task 2
- **Issue:** F5/Ctrl+. shortcuts need to trigger simulation but simulation store doesn't exist yet (future plan).
- **Fix:** Dispatched as `CustomEvent` on window, keeping the hooks decoupled from unbuilt simulation orchestration.
- **Files modified:** src/canvas/hooks/useCanvasInteractions.ts

## Known Stubs

None. All files implement their specified functionality. Wire routing, magnetic snap, and keyboard shortcuts are fully functional.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | b2da8c3 | feat(01-06): wire routing edge, ELK layout, magnetic snap, and routing state machine |
| 2 | d43fc50 | feat(01-06): canvas interactions, keyboard shortcuts, and integrated wire/snap hooks |

## Self-Check: PASSED

- All 11 files verified present on disk
- Both commits (b2da8c3, d43fc50) verified in git log
- 26/26 tests passing
- 0 TypeScript errors in plan files (pre-existing merge conflicts in simulation.worker.ts are out of scope)
