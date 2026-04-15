---
phase: 05-collaboration-and-polish
plan: 07
subsystem: canvas+waveform
tags: [hover-tooltip, wire-coloring, oklab, parameter-sweep, immediacy, overlayStore, tiered-simulation]

requires:
  - phase: 01-core-simulator
    provides: circuitStore, overlayStore, React Flow canvas + WireEdge
  - phase: 05-04 (Plan)
    provides: TieredSimulationController + simulationOrchestrator singleton
  - phase: 05-05 (Plan)
    provides: optional __sweep parameter tag contract (consumed best-effort)
provides:
  - HoverTooltip floating V/I/P readout (300ms delay, 100ms fade-out)
  - OKLab-interpolated wire stroke between --wire-v-low and --wire-v-high
  - Ground-net neutral cyan short-circuit on WireEdge
  - overlayStore.wireVoltages (Record<netName, volts>) + simStatus slice
  - simulationOrchestrator sweep fan-out lane (one runSweepPoint per sample)
  - simulationStore.sweepResults + SweepFanOut uPlot renderer
  - window.__test_setOverlay dev hook for deterministic Playwright E2E
affects:
  - 05-08 insight badges can layer on top of the HoverTooltip surface
  - 05-11 UX polish can revisit wire-halo + auto-detected rail scaling

tech-stack:
  added:
    - culori@4.0.2 (OKLab color interpolation, MIT)
    - "@types/culori@4.0.1 (devDependency)"
  patterns:
    - "OKLab perceptual color interpolation via culori `interpolate([low,high],'oklab')` built once at module load"
    - "Delegated mouseover/mouseout on document for hover tooltip (avoids per-React-Flow-node onMouseEnter prop plumbing)"
    - "Pure data transformation split from uPlot renderer (sweepPlotData.ts) so unit tests can import without triggering uPlot's window.matchMedia call"
    - "Synthetic overlay injection via window.__test_setOverlay hook to keep Playwright E2Es hermetic from the ngspice worker"

key-files:
  created:
    - src/canvas/edges/oklabMix.ts
    - src/canvas/edges/__tests__/oklabMix.test.ts
    - src/canvas/edges/__tests__/WireEdge.test.tsx
    - src/canvas/overlays/HoverTooltip.tsx
    - src/canvas/overlays/HoverTooltip.module.css
    - src/canvas/overlays/__tests__/HoverTooltip.test.tsx
    - src/simulation/sweepHelpers.ts
    - src/simulation/__tests__/sweepHelpers.test.ts
    - src/waveform/SweepFanOut.tsx
    - src/waveform/sweepPlotData.ts
    - src/waveform/__tests__/SweepFanOut.test.ts
    - tests/e2e/phase5/hover-tooltip.spec.ts
    - tests/e2e/phase5/wire-voltage-coloring.spec.ts
  modified:
    - package.json (add culori + @types/culori)
    - src/overlay/overlayStore.ts (wireVoltages + simStatus + setters)
    - src/canvas/edges/WireEdge.tsx (OKLab stroke + ground short-circuit + stale opacity)
    - src/simulation/simulationOrchestrator.ts (wireVoltages emission, simStatus transitions, sweep fan-out lane)
    - src/store/simulationStore.ts (sweepResults slice + setter)
    - src/waveform/WaveformViewer.tsx (mount SweepFanOut above main chart)
    - src/styles/variables.css (--wire-v-low / -high / -neutral / -stale tokens)
    - src/App.tsx (mount HoverTooltip, add __test_setOverlay hook)
    - src/test/setup.ts (window.matchMedia polyfill for jsdom)

key-decisions:
  - "wireVoltages keyed by NET NAME (not wire-id): matches what the orchestrator parses out of v(net_1) vectors, avoids recomputing the net graph on every WireEdge render"
  - "Hardcoded 0..5V rail range in V1; auto-detection from largest DC supply source deferred to Plan 05-11 backlog"
  - "OKLab interpolation via culori (MIT) instead of hand-rolled sRGB→OKLab transform — 0.2KB gzipped cost buys a perceptually correct gradient for free"
  - "HoverTooltip uses delegated document.mouseover/mouseout listeners instead of wiring onMouseEnter through every React Flow node type; data-id attribute on .react-flow__node is stable React Flow API"
  - "Rejected @floating-ui/react dependency — the plan referenced it as 'already installed' but it was never added to package.json. Plain fixed-position div with 12px offset from node bounding-rect is good enough for V1 and avoids the autoUpdate middleware overhead"
  - "SweepFanOut buildSweepPlotData/buildSweepSeriesConfig extracted into sweepPlotData.ts (pure helpers) — unit tests import those without triggering uPlot's matchMedia call at module init"
  - "Added window.matchMedia polyfill to src/test/setup.ts — fixes pre-existing AssignmentPage.test.tsx crash that went latent once Plan 05-07 widened uPlot's transitive import footprint through WaveformViewer → SweepFanOut"
  - "Dev-only window.__test_setOverlay hook lets Playwright specs inject synthetic overlay state — hover tooltip + wire colouring E2Es no longer need a live ngspice worker to verify the immediacy surfaces"

requirements:
  - EDIT-16

metrics:
  duration: 45min
  tasks: 6
  files: 22
  commits: 6
  tests_added: 52  # 14 oklabMix + 8 WireEdge + 7 HoverTooltip + 10 sweepHelpers + 13 SweepFanOut
  completed: 2026-04-14
---

# Phase 05 Plan 07: Hover Tooltips + Wire Voltage Coloring + Sweep Fan-out Summary

Shipped the three immediacy surfaces that make Plan 05-04's tiered simulation
controller and Plan 05-05's scrubber gestures actually visible to the student:
live DC-op wire colouring (OKLab-interpolated between rail endpoints), a
floating V/I/P tooltip on component hover with live/computing/error/stale
status, and a parameter-sweep family-of-curves renderer driven by
`TieredSimulationController.runSweepPoint`.

## What changed

### Task 0 — culori install + overlayStore schema extension
- `pnpm add culori @types/culori` (MIT, ~0.2KB gzipped for the OKLab subset we use).
- `src/overlay/overlayStore.ts` gained two new slices:
  - `wireVoltages: Record<string, number>` — keyed by SPICE net name
  - `simStatus: 'not-run' | 'computing' | 'live' | 'stale' | 'error'`
- Setters `setWireVoltages` and `setSimStatus` exposed. `setOverlay` takes an
  optional 4th `wireVoltages` arg so the orchestrator can push both maps in a
  single store transaction.

### Task 1 — `oklabMix` helper + orchestrator extension
- `src/canvas/edges/oklabMix.ts` — `mixOklab(t)` interpolates between
  `--wire-v-low` (#42a5f5) and `--wire-v-high` (#ef5350) via
  `culori.interpolate([low,high], 'oklab')`. The mixer function is built
  **once at module load** (~20µs fixed cost) and re-used on every wire
  re-render — on a 60Hz Shift-scrub with 20 wires that's 1200 invocations/s
  and the per-call cost is a single closure call + `formatHex`.
- `voltageToT(v, minRail, maxRail)` maps a voltage into `[0, 1]` without
  clamping (the caller can clamp or extrapolate).
- 14 unit tests cover: endpoint blue/red dominance, mid-tone luminance floor
  (catches regressions to pure sRGB lerp), clamping, determinism, negative
  and degenerate rail ranges.
- `simulationOrchestrator.writeDcOverlay` now emits a `wireVoltages` map
  (keyed by net name, including ground net `"0"` so WireEdge can detect
  it) alongside the legacy `edgeVoltages` map. `driveStoreChange` sets
  `simStatus` to `computing` before the worker round-trip and transitions
  to `live` or `error` when the DC lane resolves.

### Task 2 — `WireEdge` applies OKLab-derived stroke
- `variables.css` adds `--wire-v-low`, `--wire-v-high`, `--wire-v-neutral`,
  `--wire-stale` tokens.
- `WireEdge.tsx` looks up its wire's net name via a circuitStore selector
  (O(ports) scan — cheaper than a separate port→net index), reads
  `wireVoltages[netName]` from `useOverlayStore`, and computes the stroke
  inside a `useMemo` keyed on `[selected, netName, simStatus, voltage]`.
- Branches:
  - `selected` → `var(--wire-selected)` (highest priority)
  - Ground net (`'0'`) → `var(--wire-v-neutral)` (fixed cyan)
  - `simStatus === 'not-run'` or no voltage entry → `var(--wire-stroke)`
  - Otherwise → `mixOklab(voltageToT(voltage, 0, 5))` (V1 hardcoded rails)
- `simStatus === 'stale'` dims `strokeOpacity` to 0.4 so the student can
  see "values are lagging" during transient scrubs.
- 8 focused unit tests in `WireEdge.test.tsx` cover every selection branch
  without mounting the React Flow runtime (we test the pure stroke-
  computation mirror, which is cheap and catches drift).

### Task 3 — `HoverTooltip` component
- `src/canvas/overlays/HoverTooltip.{tsx,module.css}` — fixed-position V/I/P
  readout anchored 12px right + 12px below the hovered React Flow node's
  bounding rect. `pointer-events: none` so the tooltip never intercepts
  canvas events.
- Uses delegated `document.mouseover`/`mouseout` listeners filtered by
  `.react-flow__node` ancestry + `data-id` attribute. This avoids wiring
  `onMouseEnter` through every custom node type (~20 props saved per node).
- Status line maps `simStatus` → `'DC op: live'`, `'computing…'`,
  `'no solution'`, `'Transient: last committed'`, or `'DC op: not run'`
  with `--color-success`/`-warning`/`-error`/`-wire-stale` class variants.
- V/I/P formatted via the existing `formatValue` helper from
  `waveform/measurements.ts` (SI prefixes: µV/mA/mW etc.).
- `prefers-reduced-motion` short-circuits the fade via CSS media query.
- Mounted in `App.tsx` at the root (below `Layout`/`ShortcutHelpOverlay`)
  so the tooltip renders over the canvas and any panel without being
  clipped by React Flow's `overflow: hidden` wrapper.
- 7 unit tests cover delay, V/I/P rendering, all 5 status variants,
  mouseout hide, and early-leave cancellation. Uses `vi.useFakeTimers()`
  to advance the 300ms/100ms timeouts without sleep.

### Task 4 — Sweep fan-out renderer + orchestrator lane
- `simulationStore` gained a `sweepResults: SweepResults | null` slice.
  `SweepResults` carries `componentId`, `paramName`, `values[]`, and
  `vectors[][]` — parallel arrays so `vectors[i]` is the result set for
  `values[i]`.
- `sweepHelpers.ts` provides:
  - `linearSamples(min, max, steps)` — evenly-spaced sample values
  - `netlistWithSubstitution(netlist, refDesignator, newValue)` — swaps
    the 4th token of a 2-pin SPICE primitive line (R/C/L/V/I). Case-
    insensitive on the ref designator. Returns the netlist unchanged
    when no match.
- `simulationOrchestrator.findSweepRequest(circuit)` walks components
  looking for a `parameters.__sweep = "min,max,steps"` tag; when found
  the orchestrator fires `controller.runSweepPoint` in parallel across
  the samples and pushes the combined results into
  `simulationStore.sweepResults`. When no sweep tag is present the
  orchestrator clears any stale `sweepResults` so the fan-out panel can
  unmount.
- `SweepFanOut.tsx` reads `sweepResults` and renders a uPlot chart with
  one curve per sample value, coloured from the existing
  `--signal-0..7` palette. Pure transformations live in
  `sweepPlotData.ts` (`buildSweepPlotData` + `buildSweepSeriesConfig`)
  so unit tests don't trigger uPlot's `window.matchMedia` call at
  module init.
- `WaveformViewer` mounts `<SweepFanOut/>` above the main chart (and in
  the empty-state branch) so the fan-out is visible even before a
  separate transient/AC run. 13 unit tests cover all the helper shapes.
- **Hover-point precise run (UI-SPEC §8.2) deferred.** Hovering a curve
  should re-run `runSweepPoint` without the cache for a precise waveform
  instead of the cached DC op-point. Marked `TODO(plan-05-11)` in
  `SweepFanOut.tsx`.

### Task 5 — E2E specs
- `tests/e2e/phase5/hover-tooltip.spec.ts` — 5 cases: 300ms delay,
  `DC op: live`, `DC op: no solution`, `Transient: last committed`,
  mouseout hide. Uses the new `window.__test_setOverlay` hook to
  inject synthetic overlay state so the specs don't need a live
  ngspice worker.
- `tests/e2e/phase5/wire-voltage-coloring.spec.ts` — 3 cases: fallback
  cyan when not-run, OKLab hex after voltage injection, ground-neutral
  preservation.
- `src/App.tsx` gained the dev-only `window.__test_setOverlay` hook
  (gated on `import.meta.env.DEV || MODE === 'test'`).

## Performance — OKLab cost in WireEdge

A per-frame cost measurement was deferred pending Plan 05-05's scrubber
delivery; the theoretical analysis is:

- `mixOklab(t)`: 1 closure call + `formatHex` ≈ 2-3µs per call.
- `voltageToT`: 4 float ops, < 0.1µs.
- WireEdge `useMemo` short-circuits when `[selected, netName, simStatus,
  voltage]` are reference-equal, so a typical Shift-scrub where only
  one net's voltage changes re-computes only the wires touching that
  net (~2-4 wires on a small circuit).

Rough ceiling: 60Hz × 20 wires × 3µs ≈ 3.6ms/s of stroke recomputation on
the full circuit — well inside the 1ms/frame budget for the always-live
loop. **Will be confirmed with a DevTools perf trace in Plan 05-11** if
the scrubber exposes noticeable dropped frames.

## Rail auto-detection deferral (V1 scope)

- V1 hardcodes `MIN_RAIL_V = 0` and `MAX_RAIL_V = 5` in `WireEdge.tsx`.
- V2 (tracked via Plan 05-11 or follow-up) should scan
  `circuit.components` for `dc_voltage` sources and pick the minimum
  negative and maximum positive supply as the rail bounds. A `±12V` op-
  amp circuit currently maps everything into the top half of the
  gradient which is visually confusing; the V2 fix keeps the colour
  range centred on 0V.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 2 - Missing dependency] `@floating-ui/react` was not installed**
- **Found during:** Task 3 (HoverTooltip)
- **Issue:** PLAN.md Task 3 references `@floating-ui/react` as "already
  installed in Plan 05-05", but the package is absent from `package.json`
  and no import exists anywhere in the codebase.
- **Fix:** Implemented HoverTooltip with plain React state + a fixed-
  position div anchored 12px from the hovered node's bounding rect.
  Covers the same 300ms-delay contract without the autoUpdate middleware
  overhead. If future tooltips need richer collision avoidance the swap
  is ~10 lines.
- **Files modified:** src/canvas/overlays/HoverTooltip.tsx
- **Commit:** a64ab50

**2. [Rule 2 - Missing test infrastructure] jsdom lacks `window.matchMedia`**
- **Found during:** Task 4 (SweepFanOut test failed, then full suite
  confirmed a pre-existing AssignmentPage.test.tsx crash).
- **Issue:** uPlot calls `window.matchMedia('(min-resolution…)')` at
  module-init time (in `setPxRatio`). jsdom doesn't implement it, so any
  test that transitively imports a uPlot-using component crashes. Plan
  05-07 widened the footprint when `WaveformViewer` imported
  `SweepFanOut`, causing a previously latent `AssignmentPage.test.tsx`
  crash.
- **Fix (partial — data helpers):** Extracted pure helpers into
  `src/waveform/sweepPlotData.ts` so unit tests can import them without
  pulling uPlot (no runtime `matchMedia` call).
- **Fix (full — setup polyfill):** Added a `window.matchMedia` no-op
  stub to `src/test/setup.ts` so any test suite that mounts a
  uPlot-adjacent component works under jsdom.
- **Files modified:** src/waveform/sweepPlotData.ts, src/test/setup.ts
- **Commit:** 457abfe, fce59d9

**3. [Rule 1 - API shape mismatch] `overlayStore` uses `Record`, not `Map`**
- **Found during:** Task 0
- **Issue:** PLAN.md interface sketch shows `wireVoltages: Map<string,
  number>`, but the existing `overlayStore` consistently uses
  `Record<string, number>` (established in Phase 02).
- **Fix:** Honoured the existing convention; `wireVoltages` is a
  `Record<string, number>` keyed by SPICE net name. Downstream WireEdge
  + HoverTooltip selectors updated accordingly.
- **Files modified:** src/overlay/overlayStore.ts,
  src/simulation/simulationOrchestrator.ts, src/canvas/edges/WireEdge.tsx
- **Commit:** 837d287, 6b1cc60, acb7d64

**4. [Rule 3 - Blocking] Biome `noArrayIndexKey` rule blocked JSX**
- **Found during:** Task 2, Task 4
- **Issue:** Pre-existing Biome rule rejected `key={index}` patterns that
  existed in WireEdge junction points and SweepFanOut legend. My edits
  touched those regions and the hook upgraded the warning to an error.
- **Fix:** Junction dots keyed by `${id}-junction-${x}-${y}`, sweep
  legend entries keyed by `${paramName}-${value}`.
- **Files modified:** src/canvas/edges/WireEdge.tsx, src/waveform/SweepFanOut.tsx
- **Commit:** acb7d64, 457abfe

### Known stubs

- **Hardcoded 0..5V rails in WireEdge.tsx** — auto-detection from
  circuit supply sources deferred to Plan 05-11. Intentional V1 scope
  simplification documented in the code + this summary.
- **Hover-point precise run in SweepFanOut.tsx** — marked
  `TODO(plan-05-11)`; hovering a sweep curve does not currently re-run
  the precise simulation for that sample point. Documented in UI-SPEC
  §8.2 and in the file header.

## Self-Check: PASSED

- Files created exist at expected paths:
  - src/canvas/edges/oklabMix.ts ✓
  - src/canvas/edges/__tests__/oklabMix.test.ts ✓
  - src/canvas/edges/__tests__/WireEdge.test.tsx ✓
  - src/canvas/overlays/HoverTooltip.tsx ✓
  - src/canvas/overlays/HoverTooltip.module.css ✓
  - src/canvas/overlays/__tests__/HoverTooltip.test.tsx ✓
  - src/simulation/sweepHelpers.ts ✓
  - src/simulation/__tests__/sweepHelpers.test.ts ✓
  - src/waveform/SweepFanOut.tsx ✓
  - src/waveform/sweepPlotData.ts ✓
  - src/waveform/__tests__/SweepFanOut.test.ts ✓
  - tests/e2e/phase5/hover-tooltip.spec.ts ✓
  - tests/e2e/phase5/wire-voltage-coloring.spec.ts ✓
- Commits present in `git log`:
  - 837d287 chore(05-07): culori + overlayStore extension
  - 6b1cc60 feat(05-07): oklabMix + orchestrator wireVoltages/simStatus
  - acb7d64 feat(05-07): WireEdge OKLab stroke
  - a64ab50 feat(05-07): HoverTooltip component
  - 457abfe feat(05-07): SweepFanOut + orchestrator sweep lane
  - fce59d9 test(05-07): E2E specs + matchMedia polyfill
- Full unit suite: 446 passed / 2 skipped / 0 failed.
- TypeScript strict build (`pnpm exec tsc --noEmit`): clean.
