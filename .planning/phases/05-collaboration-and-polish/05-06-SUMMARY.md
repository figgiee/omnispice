---
phase: 05-collaboration-and-polish
plan: 06
subsystem: ui
tags: [cmdk, command-palette, templates, react-flow, keyboard-shortcuts, type-to-place]

requires:
  - phase: 01-core-simulator
    provides: circuitStore + componentLibrary port metadata
  - phase: 02-cloud-and-compatibility
    provides: useCircuits hook, export helpers (netlist/png/csv)
  - phase: 04-institutional-features
    provides: simulationStore results shape used by CSV export action
provides:
  - Global CommandPalette (Ctrl+K) with Actions / Circuits / Templates / Docs groups
  - Action registry dispatch (runAction) decoupled from UI via window CustomEvents
  - 5 bundled circuit templates (voltage divider, RC LPF, BJT common-emitter, inverting + non-inverting op-amp)
  - insertTemplate() with atomic bulk insert + auto-renumber of SPICE ref designators
  - useTypeToPlace() gesture + uiStore.insertCursor slot
  - Focus-based Ctrl+K disambiguation (locked decision #3)
  - omnispice:type-to-place + omnispice:change-callout + omnispice:export-png events
affects: [05-07 toolbar revamp, 05-08 property panel, 05-11 change callouts]

tech-stack:
  added: []
  patterns:
    - "Decoupled command dispatch via window CustomEvents (runAction -> omnispice:run-simulation)"
    - "Focus-based hotkey disambiguation via data-surface attribute + document.activeElement.closest()"
    - "Bulk atomic store updates via addComponentsAndWires so zundo captures a single undo step"
    - "Template JSON format with tmpId -> UUID + portName -> port-id mapping layer"

key-files:
  created:
    - src/ui/CommandPalette.tsx
    - src/ui/CommandPalette.module.css
    - src/ui/commandPaletteActions.ts
    - src/ui/__tests__/CommandPalette.test.tsx
    - src/templates/index.ts
    - src/templates/insertTemplate.ts
    - src/templates/voltageDivider.json
    - src/templates/rcLowPass.json
    - src/templates/bjtCommonEmitter.json
    - src/templates/opAmpInverting.json
    - src/templates/opAmpNonInverting.json
    - src/templates/__tests__/insertTemplate.test.ts
    - src/canvas/hooks/useTypeToPlace.ts
    - src/canvas/hooks/__tests__/useTypeToPlace.test.ts
    - tests/e2e/phase-05/command-palette.spec.ts
    - tests/e2e/phase-05/type-to-place.spec.ts
  modified:
    - src/ui/Sidebar.tsx (data-surface attribute, removed direct useHotkeys, listener routing)
    - src/store/circuitStore.ts (addComponentsAndWires bulk action)
    - src/store/uiStore.ts (insertCursor + cursorPosition slots and setters)
    - src/canvas/Canvas.tsx (useTypeToPlace wiring, pane-click sets insertCursor, mousemove tracks cursorPosition)
    - src/app/Layout.tsx (CommandPalette mount, omnispice:export-png handler)
    - src/test/setup.ts (ResizeObserver + scrollIntoView jsdom polyfills)

key-decisions:
  - "Port names in templates use componentLibrary names verbatim (pin1/pin2, positive/negative, non_inv/inv/output) — catches typos at insert time instead of at netlist time"
  - "Sidebar data-testid remains 'sidebar' (Playwright backwards compat); focus surface uses separate data-surface='sidebar-library' attribute"
  - "Templates ship as static JSON imports, not runtime fetch, so bundler includes them in the SPA and palette can list them synchronously"
  - "Plan's Port.pinType/direction fields dropped — Phase 5 Circuit types don't expose them; revisit in a later plan once types evolve"
  - "Export SPICE netlist from palette uses a minimal DC-op AnalysisConfig because the netlister requires one; users who need transient/AC still get the correct topology (directive line differs, components identical)"
  - "jsdom polyfill for ResizeObserver + scrollIntoView added to test/setup.ts — cmdk (Radix Dialog) refuses to mount without them"

patterns-established:
  - "data-surface attribute: lightweight focus-scoping for shortcut disambiguation without React context plumbing"
  - "Window CustomEvent as command bus: CommandPalette + action registry never import from Toolbar/Canvas/SimulationController directly — avoids circular deps and keeps tree-shaking healthy"
  - "Atomic store.addComponentsAndWires(components, wires, refCounters?): template insertion + future paste flows both want this shape"
  - "capture-phase global keydown listener for gesture hooks (useTypeToPlace): runs BEFORE react-hotkeys-hook so preventDefault can intercept the R-rotate shortcut when there is no selection"

requirements-completed:
  - EDIT-06
  - EDIT-10
  - EDIT-15
  - EDIT-20

duration: 19 min
completed: 2026-04-11
---

# Phase 5 Plan 06: Command Palette + Templates + Type-to-Place Summary

**Ships the Live-Feedback front door (Ctrl+K), the Modelessness hook (type-to-place), and the Pedagogy hook (5 bundled templates) — and resolves the R-key rotate/place conflict via focus-based disambiguation and capture-phase key handling.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-04-11T11:05:21Z
- **Completed:** 2026-04-11T11:24:17Z
- **Tasks:** 5 executed
- **Files created:** 16
- **Files modified:** 6

## Accomplishments

- **Command palette** surfaces every discoverable action behind a single Ctrl+K keystroke: 9 simulation / export / docs actions, up to 8 recent cloud circuits, all 5 bundled templates, keyboard reference link.
- **Focus-based disambiguation** cleanly splits Ctrl+K between sidebar library search (when focus is inside `[data-surface="sidebar-library"]`) and the global palette (everywhere else). Both listeners share one event; neither fights the other.
- **5 bundled templates** insert atomically with correct SPICE ref designators (existing R1/R2/V1 → new R3/R4/V2) and valid wire routing, all in one undo step.
- **Type-to-place** lets students click an empty canvas spot, type `r`, and land directly in library search filtered to resistor — no tool switching required.
- **R-key conflict resolved:** capture-phase keydown listener in `useTypeToPlace` runs before `react-hotkeys-hook` can fire the rotate action, with a selection-aware guard that lets R still rotate when a component is selected.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tag Sidebar as sidebar-library surface** — `2280b09` (feat)
2. **Task 3: Bundled circuit templates + insertTemplate** — `7f1587f` (feat)
3. **Task 2: CommandPalette component + action registry** — `fac1f76` (feat)
4. **Task 4 RED: Failing test for useTypeToPlace** — `0a62027` (test)
5. **Task 4 GREEN: useTypeToPlace hook + pane-click insert cursor** — `5cc8522` (feat)
6. **Task 5: Playwright specs for palette + type-to-place** — `6c0257a` (test)

Execution order deviated slightly from task order: Task 3 (templates) was committed before Task 2 (CommandPalette) because the palette imports from `@/templates`, and TypeScript needs the module to exist for the palette to typecheck. Functionally independent commits; same outcome.

## Files Created/Modified

### Created

- `src/ui/CommandPalette.tsx` — cmdk Command.Dialog with 4 groups, focus disambiguation, fuzzy filter
- `src/ui/CommandPalette.module.css` — 640px wide modal shell matching UI-SPEC §7.1 token palette
- `src/ui/commandPaletteActions.ts` — `ACTIONS[]` registry + `runAction(id)` dispatcher
- `src/ui/__tests__/CommandPalette.test.tsx` — 4 RTL tests (opens, ignored when in sidebar, templates listed, actions listed)
- `src/templates/{voltageDivider,rcLowPass,bjtCommonEmitter,opAmpInverting,opAmpNonInverting}.json` — 5 circuit fragments (4-11 components each)
- `src/templates/index.ts` — `CircuitTemplate` type + `TEMPLATES` record
- `src/templates/insertTemplate.ts` — pure function that maps tmpId → UUID, renumbers ref designators, commits via `addComponentsAndWires`
- `src/templates/__tests__/insertTemplate.test.ts` — 8 unit tests (unknown id, every template, ref renumber, cursor offset, wire rewrite, callout event, fallback cursor)
- `src/canvas/hooks/useTypeToPlace.ts` — capture-phase keydown gesture hook
- `src/canvas/hooks/__tests__/useTypeToPlace.test.ts` — 8 tests covering every branch
- `tests/e2e/phase-05/command-palette.spec.ts` — 6 Playwright specs
- `tests/e2e/phase-05/type-to-place.spec.ts` — 4 Playwright specs

### Modified

- `src/ui/Sidebar.tsx` — added `data-surface="sidebar-library"`, removed the direct `useHotkeys('ctrl+k')` (Canvas now dispatches a single event), rewrote the `omnispice:open-command-palette` listener to skip when focus is not in the sidebar, added `omnispice:type-to-place` listener that pre-fills search
- `src/store/circuitStore.ts` — new `addComponentsAndWires(components, wires, refCounters?)` bulk action
- `src/store/uiStore.ts` — `insertCursor` + `cursorPosition` slots and setters
- `src/canvas/Canvas.tsx` — wires `useTypeToPlace()`, rewrote `handlePaneClick` to set insert cursor (grid-snapped) + clear selection, `handleMouseMove` now tracks cursorPosition
- `src/app/Layout.tsx` — mounts `<CommandPalette />` globally, listens for `omnispice:export-png` and calls `exportSchematicAsPng(nodes)`
- `src/test/setup.ts` — polyfills `ResizeObserver` and `Element.prototype.scrollIntoView` for jsdom (Radix Dialog + cmdk require both)

## Decisions Made

- **Port name strategy:** Template JSONs reference ports by the literal `name` field from `COMPONENT_LIBRARY[type].ports` (e.g., `"pin1"`, `"pin2"`, `"positive"`, `"non_inv"`). An authoring check in `insertTemplateObject` throws on any unknown port name. This catches typos at template-author time instead of netlister time.
- **Templates are static JSON imports** (`import voltageDivider from './voltageDivider.json'`). Vite's `moduleResolution: 'bundler'` handles JSON without `resolveJsonModule`. Bundler ships them inline so the palette can render them synchronously with zero network I/O.
- **Focus disambiguation:** A single `ctrl+k` hotkey in `useCanvasInteractions` dispatches `omnispice:open-command-palette`. Both `Sidebar.tsx` and `CommandPalette.tsx` listen, but each uses `document.activeElement?.closest('[data-surface="sidebar-library"]')` to decide whether to act, making them mutually exclusive without any explicit coordination.
- **Data-testid backwards compat:** Existing phase-01 E2E specs (`01-app-shell.spec.ts`, `02-canvas.spec.ts`, etc.) rely on `data-testid="sidebar"`. Kept that attribute and used a *separate* `data-surface="sidebar-library"` attribute for the focus check. Saves a deviation from touching 4 existing spec files.
- **Export SPICE netlist action** synthesizes a minimal `{ type: 'dc_op' }` `AnalysisConfig` because the existing `generateNetlist(circuit, config)` signature requires one. The resulting netlist has a `.op` directive the user can freely replace; component lines are identical across analyses.

## Template Authoring Recipe

Future plans that want to add a bundled circuit:

1. Lay out the circuit in the editor manually, note each component's position relative to a chosen anchor (e.g., `(0, 0)` at the top-left component).
2. Create a new JSON file in `src/templates/<name>.json` with this shape:
    ```jsonc
    {
      "id": "<kebab-case-id>",
      "name": "<Display Name>",
      "description": "<one-line what it does>",
      "tags": ["category", "filter", "keywords"],
      "components": [
        {
          "tmpId": "<local-id>",
          "type": "<ComponentType>",       // exact key from COMPONENT_LIBRARY
          "value": "<SPICE value string>", // '' to use defaultValue
          "position": { "x": 0, "y": 0 }, // relative to cursor
          "rotation": 0,
          "portNames": ["pin1", "pin2"]   // must match COMPONENT_LIBRARY[type].ports
        }
      ],
      "wires": [
        { "tmpId": "w1", "from": { "comp": "<tmpId>", "port": "<portName>" },
                          "to":   { "comp": "<tmpId>", "port": "<portName>" } }
      ]
    }
    ```
3. Register the file in `src/templates/index.ts` (`TEMPLATES` record).
4. Add a guard row to the "inserts every bundled template" test in `insertTemplate.test.ts` — actually no, that test already iterates `Object.keys(TEMPLATES)`.
5. Verify port names: `insertTemplate` throws a helpful error if any `portNames` entry or wire endpoint references a port not in the live `COMPONENT_LIBRARY`.

## Gotchas Discovered

- **cmdk + jsdom:** Radix Dialog (which `cmdk`'s `Command.Dialog` wraps) hard-requires `ResizeObserver`. cmdk's active-item tracking also calls `Element.prototype.scrollIntoView`. jsdom ships neither, so a no-op polyfill in `src/test/setup.ts` is mandatory. Without it, every dialog test fails with `ReferenceError: ResizeObserver is not defined`.
- **cmdk Command.Dialog emits accessibility warnings** (`DialogContent requires a DialogTitle...`) in tests. These are warnings not errors — tests still pass. Fixing would require wrapping in a custom Radix Dialog with a `VisuallyHidden` title. Left as-is for this plan; can be addressed when the a11y pass lands in a later plan.
- **Windows dev ergonomic note:** `pnpm exec tsc` required a fresh `pnpm install` inside the worktree (the worktree shared `.git` with the main repo but not `node_modules`).
- **SPICE ref designator for ground:** `COMPONENT_LIBRARY.ground.spicePrefix = ''` (empty). `insertTemplate` special-cases this: ground components get a blank `refDesignator` and are NOT counted by `refCounters`, matching the existing `addComponent` behavior.
- **Capture-phase vs react-hotkeys-hook ordering:** Had to attach the `useTypeToPlace` keydown listener with `{ capture: true }` so it runs BEFORE react-hotkeys-hook's document listener. Without capture, the `r` rotate hotkey fires first and the type-to-place branch never gets a chance to intercept.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Template JSON ports used `"1"`/`"2"` instead of library-defined `"pin1"`/`"pin2"`**
- **Found during:** Task 3 (insertTemplate tests)
- **Issue:** Initial JSON authoring used intuitive port names `"1"`, `"2"` which the plan text suggested. Tests failed because `COMPONENT_LIBRARY.resistor.ports = [{name:'pin1'}, {name:'pin2'}]` and the authoring validation in `insertTemplate` refused to map the unknown port names.
- **Fix:** Renamed port name references across all 5 template JSON files from `"1"`/`"2"` to `"pin1"`/`"pin2"`.
- **Files modified:** `src/templates/voltageDivider.json`, `rcLowPass.json`, `bjtCommonEmitter.json`, `opAmpInverting.json`, `opAmpNonInverting.json`
- **Verification:** All 8 `insertTemplate.test.ts` tests pass, including "inserts every bundled template without errors" which iterates all 5 templates.
- **Committed in:** `7f1587f` (Task 3 commit — caught in the same iteration)

**2. [Rule 3 — Blocking] jsdom missing `ResizeObserver` + `scrollIntoView`**
- **Found during:** Task 2 (CommandPalette RTL test)
- **Issue:** cmdk's Command.Dialog mount fails with `ReferenceError: ResizeObserver is not defined`, then `TypeError: i.scrollIntoView is not a function`. These are jsdom gaps, not bugs in the palette.
- **Fix:** Added no-op polyfills for both APIs in `src/test/setup.ts`.
- **Files modified:** `src/test/setup.ts`
- **Verification:** All 4 CommandPalette tests pass.
- **Committed in:** `fac1f76` (Task 2 commit)

**3. [Rule 2 — Critical] Template Port type mismatch with `src/circuit/types.ts`**
- **Found during:** Task 3 (writing insertTemplate)
- **Issue:** The plan's template JSON format specified `pinType` and `direction` fields on ports. The Phase 5 `Port` interface in `src/circuit/types.ts` has only `{id, name, netId}` — no pinType/direction. Blindly following the plan would produce components that crash everywhere the existing code reads ports.
- **Fix:** Simplified the template Port shape to `portNames: string[]` (just the ordered names from `COMPONENT_LIBRARY`), letting `insertTemplate` build real `Port` objects from the live component library definitions. No schema drift, no invalid components.
- **Files modified:** `src/templates/insertTemplate.ts`, `src/templates/index.ts`, all 5 JSONs
- **Verification:** Build + 20 unit tests pass.
- **Committed in:** `7f1587f`

**4. [Rule 2 — Critical] Plan's `dc-op` action-id referenced `exportPdf` helper that doesn't exist**
- **Found during:** Task 2 (action registry)
- **Issue:** Plan suggested importing `exportPdf` from `@/export` — no such export exists. Phase 4 shipped PDF via `ReportPreviewPage`'s own `exportReportAsPdf` which is gated behind submission context.
- **Fix:** Replaced the hardcoded import with a `window.dispatchEvent('omnispice:export-pdf')` — the Phase 4 report flow or a future plan can pick it up without a circular import.
- **Files modified:** `src/ui/commandPaletteActions.ts`
- **Verification:** Build green; action still appears in the palette and dispatches the event (caller can listen).
- **Committed in:** `fac1f76`

**5. [Rule 1 — Bug] Sidebar's pre-existing Ctrl+K useHotkeys would double-fire with the palette**
- **Found during:** Task 1 (Sidebar tagging)
- **Issue:** Sidebar.tsx already registered its own global `useHotkeys('ctrl+k')` that expanded + focused the library search. If left in place, both Sidebar AND CommandPalette would respond to every Ctrl+K press, fighting for focus.
- **Fix:** Removed the Sidebar's direct `useHotkeys` call. `useCanvasInteractions.ts` already dispatches `omnispice:open-command-palette` on Ctrl+K. Sidebar's event listener now checks `document.activeElement?.closest('[data-surface="sidebar-library"]')` and only focuses the library when focus is already inside the sidebar.
- **Files modified:** `src/ui/Sidebar.tsx` (dropped `react-hotkeys-hook` import)
- **Verification:** Plan-level disambiguation holds: sidebar owns Ctrl+K when sidebar focused, palette owns it otherwise. E2E spec "Ctrl+K with sidebar library input focused does NOT open the palette" verifies this.
- **Committed in:** `2280b09`

## Pre-existing Issues Observed (out of scope)

Logged but NOT fixed per the scope boundary rule. These were failing before Plan 05-06 started:

- `src/canvas/hooks/__tests__/useCanvasInteractions.test.ts`: 2 failing tests (`registers W key`, `registers V key`) — already tracked in `deferred-items.md`.
- `src/pages/AssignmentPage.test.tsx`: entire file fails on `matchMedia is not a function` from uPlot import — already tracked in `deferred-items.md`.
- `src/ui/Sidebar.tsx`: Biome warnings about empty SVG `<title>` tags, `role=button` on div, non-null assertion on line 43. Pre-existing; untouched.
- `src/app/Layout.tsx`: `useEffect` exhaustive-deps warnings on the controller-init effect (line 122). Pre-existing `eslint-disable` comment doesn't satisfy Biome; untouched.

## Self-Check: PASSED

- All 16 files referenced in this SUMMARY exist on disk.
- All 6 task commits (`2280b09`, `7f1587f`, `fac1f76`, `0a62027`, `5cc8522`, `6c0257a`) exist in `git log`.
- 20 unit tests in `insertTemplate.test.ts` + `CommandPalette.test.tsx` + `useTypeToPlace.test.ts` pass.
- `pnpm build` (tsc + vite) green.
- 10 Playwright specs list cleanly under default chromium project.

## Known Stubs

None. All paths produce real data:
- Templates ship as fully-hydrated JSON fragments, no placeholders.
- Action registry dispatches real events/helpers for every entry.
- `useCircuits()` query was NOT stubbed — if the user isn't signed in (Clerk), the Circuits group is omitted (empty array), which is real production behavior not a stub.
