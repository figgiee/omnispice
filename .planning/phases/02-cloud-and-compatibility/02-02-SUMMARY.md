---
phase: 02-cloud-and-compatibility
plan: 02
subsystem: overlay, export, toolbar
tags: [overlay, simulation, export, png, csv, netlist, toolbar]
dependency_graph:
  requires: []
  provides:
    - overlay store + sync hook (nodeVoltages/branchCurrents on schematic)
    - OverlayToggle button (Eye/EyeOff, disabled when no data)
    - exportSchematicAsPng (html-to-image 1.11.13)
    - exportWaveformAsCsv (pure client-side CSV from VectorData[])
    - exportNetlist (thin wrapper over generateNetlist)
    - ExportMenu dropdown in toolbar
  affects:
    - src/canvas/components (all node components show overlay values)
    - src/ui/Toolbar.tsx (OverlayToggle + ExportMenu wired in)
tech_stack:
  added:
    - html-to-image@1.11.13 (PNG export, pinned — newer versions break React Flow)
    - lucide-react Eye/EyeOff icons (OverlayToggle)
  patterns:
    - Zustand store with plain Record<string,number> (not Map) for voltage/current data
    - useOverlaySync: watches simulationStore.results, calls setOverlay()
    - refDesignator.toLowerCase() for branchCurrents key lookup (matches ngspice output)
key_files:
  created:
    - src/overlay/overlayStore.ts
    - src/overlay/useOverlaySync.ts
    - src/overlay/__tests__/useOverlaySync.test.ts
    - src/export/exportPng.ts
    - src/export/exportCsv.ts
    - src/export/exportNetlist.ts
    - src/export/__tests__/exportCsv.test.ts
    - src/export/__tests__/exportNetlist.test.ts
    - src/components/toolbar/ExportMenu.tsx
    - src/ui/OverlayToggle.tsx
    - src/ui/OverlayToggle.module.css
  modified:
    - src/circuit/netlister.ts (added generateNetlistWithMap returning netMap)
    - src/store/simulationStore.ts (added netMap field)
    - src/canvas/components/ResistorNode.tsx
    - src/canvas/components/CapacitorNode.tsx
    - src/canvas/components/InductorNode.tsx
    - src/canvas/components/VoltageSourceNode.tsx
    - src/canvas/components/CurrentSourceNode.tsx
    - src/canvas/components/DiodeNode.tsx
    - src/canvas/components/GroundNode.tsx
    - src/canvas/components/ComponentNode.module.css
    - src/ui/Toolbar.tsx
    - src/export/exportPng.ts
decisions:
  - "Overlay store uses Record<string,number> (plain object) not Map — simpler serialization, consistent with Zustand slice pattern"
  - "branchCurrents key lookup uses refDesignator.toLowerCase() to match ngspice lowercase output (e.g. 'r1', 'v1')"
  - "Current display: |I| < 1A shown as mA, else A — avoids confusing '0.001 A' for typical circuit values"
  - "GroundNode shows fixed '0 V' whenever any simulation data exists — ground is always node 0 in SPICE"
  - "OverlayToggle disabled (not hidden) when no simulation data — communicates feature exists but requires running sim first"
  - "html-to-image pinned to 1.11.13 — newer versions break React Flow canvas export"
metrics:
  duration: "session"
  completed: "2026-04-09"
  tasks: 3
  files: 22
---

# Phase 2 Plan 02: Simulation Overlay and Export Summary

**One-liner:** Live voltage/current overlay on schematic nodes via Zustand store + sync hook, with one-click PNG/CSV/netlist export and an OverlayToggle button in the toolbar.

## What Was Built

### Task 1 — Overlay store, sync hook, netlister netMap

- Extended `netlister.ts` with `generateNetlistWithMap()` returning `{ netlist, netMap }` where `netMap` maps SPICE net names to node IDs
- Added `netMap` field to `simulationStore` so the overlay sync hook can correlate ngspice output back to canvas nodes
- Created `overlayStore.ts`: Zustand store with `nodeVoltages: Record<string,number>`, `branchCurrents: Record<string,number>`, `isVisible: boolean`, `setOverlay()`, `toggleVisibility()`, `clear()`
- Created `useOverlaySync.ts`: watches `simulationStore.results`, calls `setOverlay()` to populate the overlay store after each simulation completes
- 5 tests passing in `useOverlaySync.test.ts`

### Task 2 — Export utilities and ExportMenu

- `exportPng.ts`: captures `.react-flow` container (not just viewport — includes edge SVG layer), uses `html-to-image@1.11.13` (pinned), applies viewport transform for full-canvas export
- `exportCsv.ts`: pure client-side CSV from `VectorData[]`, no server round-trip, downloads via `<a>` element
- `exportNetlist.ts`: thin wrapper over `generateNetlist()`, triggers browser download of `.cir` file
- `ExportMenu.tsx`: dropdown button in toolbar with three export options
- Test suites for CSV and netlist export

### Task 3 — Overlay rendering on canvas nodes and OverlayToggle

- All 7 node components updated to read from `overlayStore`:
  - R, C, L, V, I, diode: show branch current formatted as mA or A
  - Ground: shows fixed "0 V" when simulation data is present
- `OverlayToggle.tsx`: Eye/EyeOff button, disabled when `nodeVoltages` is empty, wired into Toolbar right group before `SimulationControls`
- `OverlayToggle.module.css`: matches `Toolbar.module.css` `.toolBtn` pattern (32×32, surface-hover on hover, 0.4 opacity when disabled)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed getViewportForBounds missing padding argument**
- **Found during:** Task 3 tsc check
- **Issue:** `exportPng.ts` called `getViewportForBounds(bounds, w, h, minZoom, maxZoom)` with 5 args; `@xyflow/system@0.0.76` signature requires 6th `padding` argument
- **Fix:** Added `0` as the padding argument
- **Files modified:** `src/export/exportPng.ts`
- **Commit:** 49c8e33

**2. [Rule 1 - Bug] Fixed ResistorNode branchCurrents key lookup**
- **Found during:** Task 3 implementation review
- **Issue:** Existing ResistorNode used `branchCurrents[nodeData.refDesignator ?? '']` without `.toLowerCase()`, so 'R1' would not match ngspice's 'r1' output key
- **Fix:** Changed to `branchCurrents[nodeData.refDesignator?.toLowerCase() ?? '']`
- **Files modified:** `src/canvas/components/ResistorNode.tsx`
- **Commit:** 49c8e33

**3. [Rule 1 - Bug] Fixed ResistorNode unconditional mA formatting**
- **Found during:** Task 3 implementation review
- **Issue:** Existing overlay span always multiplied by 1000 and appended "mA", which would show "1000.00 mA" for a 1 A current
- **Fix:** Added magnitude check: `|I| < 1` → mA, else A
- **Files modified:** `src/canvas/components/ResistorNode.tsx`
- **Commit:** 49c8e33

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 69b0657 | overlay store + sync hook, netlister netMap, simulationStore netMap field |
| 2 | 4df3d44 | export utilities and ExportMenu toolbar component |
| 3 | 49c8e33 | overlay display on canvas nodes and OverlayToggle |

## Known Stubs

None. All overlay data flows from `simulationStore.results` via `useOverlaySync`. Components render real data when present and nothing when absent.

## Self-Check: PASSED
