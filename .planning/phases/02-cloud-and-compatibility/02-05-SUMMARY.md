---
phase: 02-cloud-and-compatibility
plan: 05
subsystem: ltspice-import
tags: [ltspice, import, mapper, wire-topology, toolbar]
dependency_graph:
  requires: [02-03]
  provides: [ltspice-import-pipeline]
  affects: [circuit-store, toolbar]
tech_stack:
  added: []
  patterns: [union-find-net-graph, port-snap-matching, zustand-set-circuit]
key_files:
  created:
    - src/ltspice/mapper.ts
    - src/ltspice/__tests__/mapper.test.ts
    - src/ltspice/ImportMenu.tsx
    - src/ltspice/ImportMenu.module.css
  modified:
    - src/store/circuitStore.ts
    - src/ui/Toolbar.tsx
decisions:
  - "ImportMenu placed at src/ltspice/ (not src/components/toolbar/) since it imports directly from the ltspice module"
  - "setCircuit resets refCounters to {} so ref designators from imported circuits don't collide with future adds"
  - "mapper uses union-find on WIRE segment endpoints with PIN_SNAP_THRESHOLD=100 LTspice grid units for net resolution"
metrics:
  duration: ~12m
  completed: 2026-04-09
  tasks_completed: 2
  files_changed: 6
---

# Phase 02 Plan 05: LTspice Import Pipeline Summary

LTspice .asc import pipeline: parseAsc IR → union-find net graph → mapAscToCircuit Circuit → setCircuit store action → ImportMenu toolbar button.

## Tasks Completed

### Task 1 (pre-existing): Parser
- `src/ltspice/types.ts` — AscSymbol, AscWire, AscFlag, AscCircuit IR types
- `src/ltspice/parser.ts` — `parseAsc(text): AscCircuit` line-oriented parser
- `src/ltspice/__tests__/parser.test.ts` — 7 tests passing
- `src/ltspice/__tests__/fixtures/rc-circuit.asc` — RC circuit test fixture

### Task 2: Mapper, ImportMenu, Toolbar

**Part A — `src/ltspice/mapper.ts`**

`mapAscToCircuit(asc: AscCircuit): Circuit` with:
- SYMBOL_MAP covering 12 component types including voltage source value-prefix refinement (AC, PULSE, SIN, PWL)
- Coordinate normalization: `(x - minX) * 0.25 + 50` (bounding-box relative, padded)
- Union-Find net graph built from all WIRE segment endpoints
- Port-to-net snapping within PIN_SNAP_THRESHOLD = 100 LTspice grid units
- Chain-wiring: ports sharing a net root get connected via OmniSpice Wire objects
- Unknown symbols skipped with `console.warn`, no crash

**Part B — `src/ltspice/__tests__/mapper.test.ts`**

8 tests covering: component count, type mapping (res/cap/voltage), ref designators, coordinate scaling, unknown symbol handling, empty input, wire creation.

**Part C — `src/ltspice/ImportMenu.tsx` + `ImportMenu.module.css`**

File picker button (Upload icon) that reads .asc text, runs parseAsc → mapAscToCircuit, calls `setCircuit`. Error-safe with console.error fallback.

**Part D — `src/store/circuitStore.ts`**

Added `setCircuit(circuit: Circuit): void` action — replaces entire circuit and resets refCounters to {}.

**Part E — `src/ui/Toolbar.tsx`**

`<ImportMenu />` added to left group after the redo button.

## Test Results

```
Test Files  2 passed (2)
      Tests  15 passed (15)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added `setCircuit` to circuitStore**
- Found during: Task 2, Part C
- Issue: `useCircuitStore` had no `setCircuit` action; ImportMenu required it
- Fix: Added `setCircuit(circuit)` to `CircuitState` interface and implementation; resets `refCounters` to prevent designator collisions
- Files modified: `src/store/circuitStore.ts`
- Commit: 20e7c81

**2. [Rule 1 - Location deviation] ImportMenu placed in `src/ltspice/` not `src/components/toolbar/`**
- Plan listed artifact path as `src/components/toolbar/ImportMenu.tsx`
- The component imports directly from `./parser` and `./mapper` — co-locating in `src/ltspice/` avoids a circular path and keeps the ltspice module self-contained
- Toolbar import updated to `@/ltspice/ImportMenu`

## Known Stubs

None — the import pipeline is fully wired: file picker → parseAsc → mapAscToCircuit → setCircuit → canvas render.

## Self-Check: PASSED

- [x] `src/ltspice/mapper.ts` exists
- [x] `src/ltspice/__tests__/mapper.test.ts` exists
- [x] `src/ltspice/ImportMenu.tsx` exists
- [x] `src/ltspice/ImportMenu.module.css` exists
- [x] `src/store/circuitStore.ts` has `setCircuit`
- [x] `src/ui/Toolbar.tsx` renders `<ImportMenu />`
- [x] commit 20e7c81 exists
- [x] `pnpm exec tsc --noEmit` clean
- [x] 15/15 tests passing
