---
phase: 05-collaboration-and-polish
plan: 03
subsystem: schematic-editor
tags: [react-flow, hierarchy, subcircuit, netlister, spice, zustand]

requires:
  - phase: 05-collaboration-and-polish
    provides: "Port.pinType + Port.direction metadata from Plan 05-02 (exposed pins inherit inner-port pin types)"
  - phase: 01-core-simulator
    provides: "computeNets union-find + componentToSpiceLine / COMPONENT_LIBRARY (netlister backbone)"
provides:
  - "Single-level subcircuit hierarchy: Ctrl+G collapse, double-click descend, Esc / Breadcrumb Home ascend"
  - "Component.parentId / subcircuitName / childComponentIds / exposedPinMapping data model extensions"
  - "circuitStore.collapseSubcircuit + expandSubcircuit actions (with round-trip invariants)"
  - "uiStore.currentSubcircuitId view-state + setCurrentSubcircuitId / ascendSubcircuit actions"
  - "circuitToFlow currentSubcircuitId filter (top-level vs descended level rendering)"
  - "SubcircuitNode React Flow node type with exposed-pin handles"
  - "Breadcrumb component (Home ▸ {subName})"
  - "Netlister .subckt/.ends block emission + X{ref} instantiation"
  - "V1 single-level guard (Ctrl+G blocked while descended; netlister throws on nested subcircuits)"
affects: [05-04 tiered simulation, 05-05 live-run overlays, 05-08 classroom-view]

tech-stack:
  added: []
  patterns:
    - "Per-instance exposed-pin derivation: collapseSubcircuit walks boundary wires and creates exposed ports that inherit pinType from the inner port they represent"
    - "Scoped-net naming inside .subckt: narrow computeNets to children + internal wires, prefix internal nets with `{subref.toLowerCase()}_net_N`, reserve formal-parameter names for exposed ports"
    - "Structural view-state via uiStore — currentSubcircuitId is intentionally excluded from zundo temporal so descending is not an undoable action"
    - "Programmatic-selection E2E pattern — drive uiStore.setSelectedComponentIds from Playwright for multi-select instead of rubber-band clicks"

key-files:
  created:
    - "src/canvas/components/SubcircuitNode.tsx"
    - "src/canvas/components/SubcircuitNode.module.css"
    - "src/canvas/Breadcrumb.tsx"
    - "src/canvas/Breadcrumb.module.css"
    - "src/canvas/__tests__/circuitToFlow.test.ts"
    - "tests/e2e/phase5/subcircuits.spec.ts"
  modified:
    - "src/circuit/types.ts"
    - "src/circuit/componentLibrary.ts"
    - "src/circuit/netlister.ts"
    - "src/circuit/__tests__/netlister.test.ts"
    - "src/store/circuitStore.ts"
    - "src/store/__tests__/circuitStore.test.ts"
    - "src/store/uiStore.ts"
    - "src/canvas/circuitToFlow.ts"
    - "src/canvas/Canvas.tsx"
    - "src/canvas/hooks/useCanvasInteractions.ts"
    - "src/canvas/hooks/__tests__/useCanvasInteractions.test.ts"
    - "src/canvas/components/nodeTypes.ts"
    - "src/canvas/components/__tests__/nodes.test.tsx"
    - "src/app/Layout.tsx"
    - "src/main.tsx"

key-decisions:
  - "collapseSubcircuit accepts an isNested boolean from the caller (useCanvasInteractions) rather than reading uiStore from the store action — keeps the store free of UI-layer imports and makes the guard explicit at the call site"
  - "Subcircuit exposed ports dedupe by inner-port id (one exposed pin per inner port), so fan-out wires sharing a single inner pin collapse to a single exposed pin"
  - "currentSubcircuitId lives in uiStore (never in zundo) because descending is a view operation, not a circuit mutation"
  - ".subckt internal net names are namespaced `{subref}_net_N` to prevent collision with top-level net names"
  - "Formal parameter names of a .subckt block use the exposed port's `name` field (`p_{name}`) so the block header and X{ref} instantiation line line up pin-for-pin"
  - "SubcircuitNode data is forwarded via node.data.ports so the custom node component can render Handles for the per-instance exposed pins without re-reading the circuit store"
  - "Nested subcircuit detection is defense-in-depth: UI path blocks nesting via isNested; netlister also throws a clear single-level error if a malformed circuit slips through"
  - "E2E spec exposes useCircuitStore / useUiStore / generateNetlist on window only under import.meta.env.DEV — production builds do not leak store internals"

patterns-established:
  - "Level-filter converter: circuitToNodes/Edges accept an optional currentSubcircuitId parameter; read-only viewers (SharedCircuitViewer, ReadOnlyCircuitCanvas) keep flat-circuit behaviour because they call without the arg"
  - "Boundary-wire re-pointing: when collapsing, wires whose inside-end belongs to the selection are mutated in place to terminate at the subcircuit's exposed port; expandSubcircuit reverses the mapping via exposedPinMapping"
  - "Deduped .subckt emission by subcircuitName: multiple instances of the same subcircuit share one .subckt block (standard SPICE practice, and required for the tiered-simulation plan that consumes this output)"

requirements-completed:
  - EDIT-04

duration: 21min
completed: 2026-04-15
---

# Phase 05 Plan 03: Subcircuits (Single-Level Hierarchy) Summary

**Single-level subcircuit hierarchy with Ctrl+G collapse, descend-on-double-click, Esc/Breadcrumb ascend, and `.subckt`/X-instance netlist emission.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-04-15T05:53:11Z
- **Completed:** 2026-04-15T06:14:00Z (approx)
- **Tasks:** 5 of 5
- **Files modified/created:** 20

## Accomplishments

- **Collapse/expand round-trip:** `collapseSubcircuit` derives exposed pins from boundary-crossing wires, assigns `parentId` to children, and centroid-places the block; `expandSubcircuit` is the exact inverse via `exposedPinMapping`. Structural-equivalence round-trip test verifies component and wire counts are preserved.
- **Level-filtered canvas rendering:** `circuitToFlow` now accepts an optional `currentSubcircuitId` so the top level shows collapsed blocks (hiding children) and descended level shows only the block's children. Read-only viewers (SharedCircuitViewer, ReadOnlyCircuitCanvas) keep flat behaviour because they call the converter without the argument.
- **Netlister `.subckt` emission:** For every top-level subcircuit component, the netlister emits a deduped `.subckt {name} {formal_params} ... .ends` block BEFORE the top-level component lines, then a `X{ref} {top_nets} {name}` instantiation line. Internal nets are namespaced `{subref}_net_N` to avoid collision with top-level names; formal parameters use exposed-port names so the block header and X line line up pin-for-pin.
- **V1 single-level guard:** Ctrl+G is a silent no-op while already descended into a subcircuit (per UI-SPEC §9.3 + locked decision #2). Defense-in-depth: the netlister also throws a clear `single-level` error if any child of a subcircuit is itself a subcircuit, so malformed imported circuits fail loudly rather than emitting broken SPICE.
- **Full UX loop:** Ctrl+G (collapse with prompt), double-click (descend), Esc (ascend), Breadcrumb Home (ascend). All covered by 6 Playwright tests on the phase5 project.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Component type + collapse/expand actions + unit tests** — `db246d7` (feat — TDD)
2. **Task 2: uiStore currentSubcircuitId + circuitToFlow filter** — `8c4d0e9` (feat)
3. **Task 3: SubcircuitNode + Breadcrumb + Ctrl+G / double-click / Esc wiring** — `04d6e2e` (feat)
4. **Task 4: Netlister .subckt emission + unit tests** — `79541ae` (feat — TDD)
5. **Task 5: E2E subcircuits spec** — `3b31dda` (test)

## Files Created

- `src/canvas/components/SubcircuitNode.tsx` — Visual block for collapsed subcircuits with exposed-pin handles distributed along left/right edges and a fold-corner glyph per UI-SPEC §7.12
- `src/canvas/components/SubcircuitNode.module.css` — Block styling using existing component-stroke / accent-primary tokens
- `src/canvas/Breadcrumb.tsx` — Top-of-canvas navigation (Home ▸ {subName}); renders null at top level
- `src/canvas/Breadcrumb.module.css` — 28px-tall strip with border-bottom + Home button hover/focus states
- `src/canvas/__tests__/circuitToFlow.test.ts` — 4 unit tests for level-filter behaviour
- `tests/e2e/phase5/subcircuits.spec.ts` — 6 Playwright tests covering the full UX loop

## Files Modified

- `src/circuit/types.ts` — Add `'subcircuit'` to ComponentType; add `parentId`, `subcircuitName`, `childComponentIds`, `exposedPinMapping` optional Component fields
- `src/circuit/componentLibrary.ts` — Add `subcircuit` placeholder entry (spicePrefix 'X', empty ports; real exposed pins derived per-instance at collapse time)
- `src/circuit/netlister.ts` — Add `emitSubcircuitBlock` helper + `subcircuitInstanceLine`; update `generateNetlist` to emit `.subckt`/`.ends` before top-level and `X{ref}` instantiation lines at the top level
- `src/circuit/__tests__/netlister.test.ts` — 6 new tests (`.subckt` block, inner R lines, X top-level line, ordering, flat-circuit regression, nested-subcircuit throws); existing library coverage test now allows `subcircuit` to have empty ports
- `src/store/circuitStore.ts` — Add `collapseSubcircuit(ids, name, isNested?)` and `expandSubcircuit(subId)` actions
- `src/store/__tests__/circuitStore.test.ts` — 10 new tests (collapse exposed ports, parentId assignment, pinType inheritance, boundary-wire re-pointing, no-op guards, expand inverse, round-trip)
- `src/store/uiStore.ts` — Add `currentSubcircuitId`, `setCurrentSubcircuitId`, `ascendSubcircuit`
- `src/canvas/circuitToFlow.ts` — Add optional `currentSubcircuitId` parameter; filter helpers `isVisibleAtLevel` and `isVisibleWire`
- `src/canvas/Canvas.tsx` — Mount `<Breadcrumb />` above ReactFlow; `onNodeDoubleClick` descends into subcircuit nodes
- `src/canvas/hooks/useCanvasInteractions.ts` — Add `Ctrl+G` hotkey (collapse with prompt for name); extend `Escape` to ascend when `currentSubcircuitId !== null`
- `src/canvas/hooks/__tests__/useCanvasInteractions.test.ts` — Mock `currentSubcircuitId`, `ascendSubcircuit`, and `collapseSubcircuit` to keep existing tests green
- `src/canvas/components/nodeTypes.ts` — Register `subcircuit: SubcircuitNode`
- `src/canvas/components/__tests__/nodes.test.tsx` — Extend expected nodeTypes count to 24 (add 'subcircuit')
- `src/app/Layout.tsx` — Subscribe to `currentSubcircuitId`; pass into `circuitToNodes` / `circuitToEdges`
- `src/main.tsx` — Expose `useCircuitStore` / `useUiStore` / `generateNetlist` on window under `import.meta.env.DEV` for Playwright specs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing COMPONENT_LIBRARY coverage test broke after adding `subcircuit` entry with empty ports**
- **Found during:** Task 3 post-build verification
- **Issue:** `netlister.test.ts` had `expect(def.ports.length).toBeGreaterThan(0)` as a library invariant that every entry must have at least one port. The new `subcircuit` library placeholder intentionally has empty ports (real exposed pins are derived per-instance), breaking the test.
- **Fix:** Exempted `'subcircuit'` from the ports-length check with a comment explaining per-instance pin derivation.
- **Files modified:** `src/circuit/__tests__/netlister.test.ts`
- **Commit:** `04d6e2e`

**2. [Rule 3 - Blocking] nodeTypes registry test expected 23 entries**
- **Found during:** Task 3 post-build verification
- **Issue:** `src/canvas/components/__tests__/nodes.test.tsx` asserted `Object.keys(nodeTypes).length === 23`. Adding the `subcircuit` entry bumped the count to 24.
- **Fix:** Updated the expected count and added `'subcircuit'` to the `allComponentTypes` coverage list.
- **Files modified:** `src/canvas/components/__tests__/nodes.test.tsx`
- **Commit:** `04d6e2e`

**3. [Rule 3 - Blocking] useCanvasInteractions mocked uiStore missing new fields**
- **Found during:** Task 3 post-build verification
- **Issue:** The existing test file mocks `useUiStore` with a hand-written object that did not include `currentSubcircuitId` or `ascendSubcircuit`, so the Esc handler crashed with `ascendSubcircuit is not a function` during the existing "registers Escape" test.
- **Fix:** Added `mockCurrentSubcircuitId`, `mockAscendSubcircuit`, and `mockCollapseSubcircuit` to the mocks; reset `mockCurrentSubcircuitId` in `beforeEach`.
- **Files modified:** `src/canvas/hooks/__tests__/useCanvasInteractions.test.ts`
- **Commit:** `04d6e2e`

**4. [Rule 3 - Blocking] E2E spec could not find sidebar testid**
- **Found during:** Task 5 Playwright run
- **Issue:** The existing `helpers/canvas.ts` + `quick-wins.spec.ts` wait for `[data-testid="sidebar"]`, but the current `Sidebar.tsx` only sets `data-testid="sidebar-library"` (renamed in Plan 05-06). This is a pre-existing breakage in older phase5 specs, but would have blocked my new spec too.
- **Fix:** The new subcircuits.spec.ts waits for `sidebar-library` with a fallback to the legacy `sidebar` id. Did not touch the existing quick-wins tests (out of scope).
- **Files modified:** `tests/e2e/phase5/subcircuits.spec.ts`
- **Commit:** `3b31dda`

**5. [Rule 2 - Missing critical] Playwright spec needed store access for programmatic selection**
- **Found during:** Task 5 authoring
- **Issue:** The test needs to multi-select 2+ components to drive `Ctrl+G`. Playwright cannot reliably synthesise React Flow's rubber-band or shift-click selection across the canvas without flakiness.
- **Fix:** Exposed `useCircuitStore`, `useUiStore`, and `generateNetlist` on `window` under `import.meta.env.DEV`. Production builds do NOT expose these (the guard condition short-circuits for MODE=production). This is the standard pattern already used by several Phase 4 / Phase 5 plans for state-driven E2E.
- **Files modified:** `src/main.tsx`
- **Commit:** `3b31dda`

## Authentication Gates

None — no auth required for this plan.

## Deferred Issues

**Out of scope — not caused by 05-03 changes:**

- `src/pages/AssignmentPage.test.tsx` pre-existing failure: `matchMedia is not a function` in uPlot CJS module when loaded in jsdom. Verified pre-existing by running at HEAD before applying any 05-03 changes. Already tracked in `deferred-items.md` (Plan 05-10 annotation).
- Pre-existing `useCanvasInteractions.test.ts` failures for 'w' and 'v' hotkey registration tests — tracked in `deferred-items.md`. My changes did not touch those hotkeys.

## Edge Cases Found in Port Exposure

- **Shared inner pin fan-out:** When multiple boundary-crossing wires terminate on the same inner port (e.g. a BJT collector feeding both an output stage and a feedback loop), `collapseSubcircuit` dedupes via `innerPortToExposed` and creates a single exposed pin that all fan-out wires share. This preserves the original topology on expand.
- **Single-item selection:** Silent no-op per UI-SPEC §9.3. Creating a subcircuit of 1 component provides no hierarchical benefit and would just add a layer of indirection.
- **Empty inner net:** If a boundary-inside port is isolated (no wires to other inner ports), `computeNets` still returns it as a singleton group; the .subckt emission names it after the exposed-port formal parameter so the child SPICE line resolves correctly.
- **Centroid placement:** The new subcircuit block is positioned at the snap-grid-rounded centroid of the selection bbox. This places the block visually where the cluster used to be, minimizing the "jump" the user sees when collapsing.

## Multi-level Nesting Backlog Reference

Per locked decision #2, V1 ships single-level only. Multi-level nesting is deferred to the Phase 5 backlog. When unlocked, the following must change:

- `collapseSubcircuit` isNested guard becomes a recursive check (allow nesting N deep, track depth in uiStore breadcrumb trail)
- `uiStore.currentSubcircuitId` becomes `currentSubcircuitPath: string[]`
- `Breadcrumb` renders the full path (Home ▸ L1 ▸ L2 ▸ L3)
- Netlister `emitSubcircuitBlock` recurses into child subcircuits (emit their .subckt definitions first)
- E2E spec adds a "collapse inside a subcircuit creates a nested .subckt" assertion

## Self-Check: PASSED

- [x] SubcircuitNode.tsx — FOUND
- [x] SubcircuitNode.module.css — FOUND
- [x] Breadcrumb.tsx — FOUND
- [x] Breadcrumb.module.css — FOUND
- [x] tests/e2e/phase5/subcircuits.spec.ts — FOUND
- [x] Commit db246d7 — FOUND
- [x] Commit 8c4d0e9 — FOUND
- [x] Commit 04d6e2e — FOUND
- [x] Commit 79541ae — FOUND
- [x] Commit 3b31dda — FOUND
- [x] 243 vitest tests passing across src/circuit src/store src/canvas
- [x] 6/6 Playwright subcircuits.spec.ts passing
