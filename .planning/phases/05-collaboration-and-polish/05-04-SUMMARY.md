---
phase: 05-collaboration-and-polish
plan: 04
subsystem: simulation
tags: [ngspice, wasm, web-worker, debounce, zustand, request-correlation, hash]

# Dependency graph
requires:
  - phase: 01-core-simulator
    provides: SimulationController + worker pipe-mode + parser + netlister
  - phase: 02-cloud-and-compatibility
    provides: overlayStore + useOverlaySync DC op-point overlay pipeline
provides:
  - TieredSimulationController four-lane engine (DC always-live, AC debounced, transient commit-on-release, sweep cached)
  - simulationOrchestrator singleton bridging circuitStore to the controller
  - Extended SimCommand/SimResponse protocol with requestId, circuitHash, RESET_CIRCUIT, per-analysis discriminants
  - hashNetlist structural Circuit hash (FNV-1a 64, ignores position/rotation)
  - Worker circuit-hash cache (fast-path LOAD_CIRCUIT)
  - Window event contract `omnispice:scrub-committed` consumed by Plan 05-05
affects: [05-05, 05-07, 05-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-request correlation via requestId for concurrent worker dispatches"
    - "FNV-1a 64-bit hashing for short deterministic circuit cache keys (both structural and netlist-string variants)"
    - "vi.hoisted() for vi.mock factories to reference captured spies"
    - "Driving worker self.onmessage directly in jsdom tests (no real Worker spawn)"
    - "Sliding debounce + max-deferral starvation protection"

key-files:
  created:
    - src/simulation/TieredSimulationController.ts
    - src/simulation/simulationOrchestrator.ts
    - src/simulation/__tests__/TieredSimulationController.test.ts
    - src/simulation/__tests__/simulationOrchestrator.test.ts
    - src/simulation/__tests__/worker.test.ts
    - src/simulation/__tests__/mockWorker.ts
    - src/circuit/netlistHash.ts
    - src/circuit/__tests__/netlistHash.test.ts
  modified:
    - src/simulation/protocol.ts
    - src/simulation/worker/simulation.worker.ts
    - src/simulation/controller.ts
    - src/App.tsx

key-decisions:
  - "TieredSimulationController owns its own Worker instance; simulationOrchestrator is a module-level singleton mounted via useEffect — mirrors useOverlaySync pattern already established in the codebase"
  - "Protocol extended in a backwards-compatible way: every new field (requestId, circuitHash, protocolAnalysis, params) is optional, so legacy controller.ts + controller.test.ts keep working unchanged"
  - "ProtocolAnalysis type ('op'|'tran'|'ac'|'dc') is a new short-code enum distinct from circuit/types AnalysisType ('dc_op'|'transient'|...) — the latter is domain-facing, the former maps 1:1 to ngspice pipe-mode keywords"
  - "AC debounce: 60ms sliding window + 500ms max-deferral. Implemented as clearTimeout+setTimeout with a Math.min(debounce, remainingDeferral) computed per schedule call, so starvation protection is deterministic and timer-stubbed testable"
  - "Sweep cache keyed on fastHash(netlist)+paramName+value, not on structural hashNetlist(circuit). The sweep lane receives netlist strings from the caller; a second structural hash would just be extra work"
  - "Worker circuit-hash cache: LOAD_CIRCUIT with a matching hash skips the MEMFS writeFile entirely and responds with a 'cached' STDOUT line. The main-side controller ALSO tracks its own lastLoadedHash so it doesn't even SEND a redundant LOAD_CIRCUIT"
  - "CANCEL semantics are cooperative: pre-marking a requestId causes the eventual RESULT to be re-emitted as CANCELLED. Mid-run termination still requires killing the worker (which Plan 05-04 intentionally does NOT do because WASM re-init costs ~200-400ms per RESEARCH 3.7)"
  - "simulationOrchestrator silently debug-logs DC/AC/transient failures instead of toasting — prevents the 'live-simulator vomit' anti-pattern where convergence warnings flood the UI as the user types"
  - "controller.ts legacy is tagged @deprecated rather than refactored — Plan 05-07 will delete it when F5 manual run is migrated through the orchestrator. Refactoring now would force rewriting controller.test.ts which encodes the exact existing LOAD_CIRCUIT→STDOUT→RUN handshake semantics"

patterns-established:
  - "Pattern: Per-request promise maps in worker-facing controllers — every RUN carries a unique requestId, Map<id, Deferred> dispatches results, stale ids are dropped silently"
  - "Pattern: Sliding debounce with max-deferral — prevents starvation under continuous scrubbing while still coalescing rapid edits"
  - "Pattern: Two-level circuit-hash cache (controller main-side + worker-side) — main side skips sending the command, worker side skips parsing if the command still arrives"
  - "Pattern: Orchestrator module singleton mounted via useEffect in App root — matches the existing useOverlaySync shape, no Provider plumbing"

requirements-completed: [EDIT-11, EDIT-12, EDIT-13, EDIT-14]

# Metrics
duration: 40min
completed: 2026-04-11
---

# Phase 05 Plan 04: Tiered Simulation Controller Summary

**Four-lane simulation backbone — DC op-point always-live, AC sweep debounced to 60ms with 500ms starvation protection, transient commit-on-release, parameter sweep cached — plus per-request correlation via requestId so concurrent analyses never collide.**

## Performance

- **Duration:** ~40 minutes
- **Started:** 2026-04-11T10:36:00Z (approx)
- **Completed:** 2026-04-11T11:16:48Z
- **Tasks:** 4 (all autonomous)
- **Files modified:** 12 (8 created, 4 modified)

## Accomplishments

- **TieredSimulationController** — four concurrent lanes, each with its own dispatch discipline, sharing a single worker behind a per-request correlation map. Stale responses are dropped silently so Plan 05-05's scrubber can fire hundreds of AC sweeps in a row without result confusion.
- **simulationOrchestrator** — zero-Provider singleton that subscribes to `circuitStore` and drives the controller. Mounted once from `App.tsx` via `useEffect`. Fires DC op-point on every store change, AC sweep only when the circuit has an AC source, transient only on the `omnispice:scrub-committed` window event.
- **Extended wire protocol** with `requestId`, `circuitHash`, `RESET_CIRCUIT`, and per-analysis discriminants — fully backwards-compatible so the legacy `SimulationController` + `controller.test.ts` suite keeps passing unchanged.
- **Structural circuit hash** (`hashNetlist`) that ignores layout-only fields, letting the controller skip `LOAD_CIRCUIT` on pure-drag updates.
- **Worker-side cache fast-path** — even if a `LOAD_CIRCUIT` does arrive with a matching hash, the worker skips the `FS.writeFile` entirely and responds with a `'cached'` STDOUT line.

## Task Commits

Each task was committed atomically (per `parallel_execution` guidance, though `--no-verify` is blocked by a `PreToolUse` hook, so commits go through the normal path):

1. **Task 1: Extend protocol + hashNetlist helper** — `746ebfd` (feat, TDD-first)
   - 10 behavior tests covering determinism, value changes, position-invariance, rotation-invariance, Map insertion-order insensitivity, topology changes, and pulse-source parameters
2. **Task 2: Worker extended protocol** — `1b0c9fc` (feat, test-after)
   - 5 tests driving `self.onmessage` directly with a mocked `ngspice-wrapper`: cache fast-path, reset-then-reload, per-request tagging, cancel-before-run, legacy-compat path
3. **Task 3: TieredSimulationController** — `444d5e8` (feat, TDD-first)
   - 9 behavior tests via `vi.useFakeTimers` + `MockWorker`: all four lanes + stale-result dropping + dispose cleanup
4. **Task 4: simulationOrchestrator + App.tsx mount + controller.ts deprecation** — `5b33dbd` (feat)
   - 5 orchestrator tests via `vi.hoisted` mock of `TieredSimulationController`: DC-on-every-change, AC-only-with-AC-source, transient-only-on-scrub-committed, silent-failure, stopOrchestrator-unsubscribes

**Plan metadata:** `29a3506` (docs — deferred-items update)

## Files Created/Modified

### Created

- `src/simulation/TieredSimulationController.ts` — 4-lane controller, ~340 lines including docs
- `src/simulation/simulationOrchestrator.ts` — singleton bridge, ~220 lines
- `src/simulation/__tests__/TieredSimulationController.test.ts` — 9 behavior tests
- `src/simulation/__tests__/simulationOrchestrator.test.ts` — 5 tests with hoisted mock
- `src/simulation/__tests__/worker.test.ts` — 5 tests driving `self.onmessage` directly
- `src/simulation/__tests__/mockWorker.ts` — shared mock Worker class for controller tests
- `src/circuit/netlistHash.ts` — FNV-1a 64 structural hash
- `src/circuit/__tests__/netlistHash.test.ts` — 10 behavior tests

### Modified

- `src/simulation/protocol.ts` — extended `SimCommand`/`SimResponse` with optional `requestId`, `circuitHash`, `protocolAnalysis`, `params`, `RESET_CIRCUIT`
- `src/simulation/worker/simulation.worker.ts` — persistent `currentCircuitHash`, per-request result tagging, RESET_CIRCUIT handling, cancellable request tracking
- `src/simulation/controller.ts` — `@deprecated` JSDoc pointing at the tiered controller; internals unchanged (controller.test.ts still passes)
- `src/App.tsx` — `startOrchestrator` / `stopOrchestrator` via `useEffect`

## Decisions Made

All decisions recorded in frontmatter `key-decisions`. The most consequential:

1. **Protocol backwards compatibility is preserved via optional fields.** Every new field is `?: T` so the legacy `controller.ts` can keep sending its old-shape commands and continue to pass its existing test suite.
2. **Two-level circuit-hash cache.** The controller's main-side cache (`lastLoadedHash`) and the worker's cache (`currentCircuitHash`) both track the same hash. Main side avoids *sending* redundant commands; worker side avoids *parsing* them if they do get sent. Different code paths, same invariant.
3. **Orchestrator silent-fails by design.** Live simulation UIs become unusable if every convergence failure toasts. Per RESEARCH §3.7, the orchestrator `console.debug`s and moves on.
4. **controller.ts stays put with `@deprecated`.** Refactoring it to delegate through the tiered controller would force rewriting `controller.test.ts`, which encodes the exact LOAD_CIRCUIT→STDOUT→RUN handshake the legacy F5 path expects. Plan 05-07 will migrate F5 through the orchestrator and then this file can be deleted outright.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Plan referenced APIs that don't exist in the codebase**
- **Found during:** Task 4 (simulationOrchestrator scaffold)
- **Issue:** The plan's orchestrator skeleton referenced:
  - `useOverlayStore.setFromDcVectors(vectors, portToNetMap)` — actual API is `setOverlay(voltages, currents, edgeVoltages)`
  - `useSimulationStore.setAcVectors / setTransientVectors / setError` — actual API is `setResults(results, netMap)` and `setErrors(errors)`
  - `generateNetlistWithMap(circuit)` single-arg — actual signature is `(circuit, config)` returning `{netlist, netMap}` not `{netlist, portToNetMap}`
  - `{ componentId }` payload on the scrub event — not required for this plan, Plan 05-05 will define it
  - `useCircuitStore.subscribe((s)=>s.circuit, ...)` two-arg selector form — requires `subscribeWithSelector` middleware which is not wrapped around `circuitStore`
  - `Component.type === 'voltage-source'` for AC-probe detection — actual types are `'ac_voltage'` / `'dc_voltage'` / etc.
- **Fix:**
  - Wrote `writeDcOverlay(circuit, vectors)` that computes voltages/currents/edgeVoltages inline (mirrors `useOverlaySync` logic) and calls the real `setOverlay` API
  - AC-success path calls `setResults(vectors)` on simulationStore
  - `generateNetlistWithMap(circuit, DC_OP_CONFIG)` with a minimal DC op config for the always-live lane, and a transient config on the scrub path
  - Scrub event accepts `Event` (no componentId coupling this plan)
  - Single-arg `subscribe((state) => ...)` with a local `lastCircuit` reference compare — identical semantics, zero middleware churn
  - `hasAcSource(circuit)` checks for `'ac_voltage'` and `'ac_current'` component types
- **Files modified:** `src/simulation/simulationOrchestrator.ts`
- **Verification:** All 5 orchestrator tests pass (including the DC-failure silent-path test)
- **Committed in:** `5b33dbd` (Task 4 commit)

**2. [Rule 3 — Blocking] `Component` type lacks `parentId` / `childComponentIds` / `ports[].pinType` fields**
- **Found during:** Task 1 (hashNetlist implementation)
- **Issue:** The plan's `hashNetlist` scaffold referenced subcircuit parent/child relationships and port pin-types that don't exist in `src/circuit/types.ts`. The actual `Component` shape is: `id, type, refDesignator, value, ports[{id,name,netId}], position, rotation, spiceModel?, parameters?`.
- **Fix:** Hash only the real fields: `id, type, refDesignator, value, spiceModel, parameters (keys sorted), ports [id+name]`. Wires are hashed on `id, sourcePortId, targetPortId`. Layout (`position`, `rotation`, `bendPoints`) intentionally excluded per the plan's behavior bullets.
- **Files modified:** `src/circuit/netlistHash.ts`
- **Verification:** 10 behavior tests cover value change, position-invariance, rotation-invariance, Map insertion-order insensitivity, and pulse-source parameter changes
- **Committed in:** `746ebfd` (Task 1 commit)

**3. [Rule 3 — Blocking] `vi.mock` factory can't close over top-level `const` spies**
- **Found during:** Task 4 (first orchestrator test run)
- **Issue:** `vi.mock('...', () => ({ ... }))` is hoisted above imports by vitest, so top-level `const runDcOpPointMock = vi.fn()` is `undefined` when the factory runs. First attempt failed with `TypeError: ... is not a constructor`.
- **Fix:** Used `vi.hoisted(() => ({ runDcOpPointMock: vi.fn(), ... }))` to create the spy container alongside the `vi.mock` hoist, then destructured it back down for the test bodies.
- **Files modified:** `src/simulation/__tests__/simulationOrchestrator.test.ts`
- **Verification:** 5/5 orchestrator tests pass
- **Committed in:** `5b33dbd`

---

**Total deviations:** 3 auto-fixed (all Rule 3 — blocking API/type mismatches with the plan draft)
**Impact on plan:** All four behavioral goals were achieved verbatim — the plan's *intent* (four lanes, debounce timing, subscription wiring, silent failure) is implemented exactly. Only the *surface-level API names* needed adapting to the real codebase.

## Issues Encountered

- **Pre-existing test failures unrelated to this plan** — full `pnpm test --run` reports 269/271 unit tests passing. The 2 failures are in `useCanvasInteractions.test.ts` (react-hotkeys-hook v5 API shape) and `AssignmentPage.test.tsx` (uPlot probing `window.matchMedia` on import). Both predate Plan 05-04; both are documented in `.planning/phases/05-collaboration-and-polish/deferred-items.md`.
- **Lint warnings in `controller.ts`** (non-null assertions, unused `_pendingAnalysisType`) are scope-boundary deferrals. Plan 05-07 will delete `controller.ts` outright when it migrates F5 through the orchestrator.

## Measurements (requested by plan `<output>`)

The plan requested measured DC op-point latency on 10-component linear and non-linear circuits "in test." These are **mock-path measurements** — the real ngspice WASM module is not built in this environment (the repo falls back to `createMockNgspice()` when `src/assets/wasm/ngspice.js` is absent). Mock DC op-point runs are essentially free on the critical path:

- **Test-measured TieredSimulationController latency** (mock worker, `vi.useFakeTimers`): every DC test completes a full INIT→LOAD_CIRCUIT→RUN→RESULT cycle within a single microtask flush (≪1 ms wall clock per the 785 ms full-suite duration across 9 tests).
- **AC debounce behavior, measured in test:** 5 back-to-back `scheduleAcSweep` calls within the 60 ms window produce **exactly 1** worker RUN. Continuous 30 ms scrubbing for 20 ticks (600 ms) produces **≥1** RUN via the max-deferral fallback — verified in `max-deferral fallback fires AC within 500ms of continuous scrubbing`.
- **Real-ngspice latency numbers** on a live BJT amplifier circuit are unmeasurable from inside this plan because the WASM binary isn't built. Plan 05-05's scrubber smoke-test (running live under `pnpm dev`) will be the first place real latency shows up, and those numbers belong in the 05-05 SUMMARY.

The critical invariant the plan was asking for — **does the backbone debounce correctly under rapid mutation and does the max-deferral prevent starvation?** — is proven true by the fake-timer tests.

## User Setup Required

None — no external services, no env vars, no model files needed. The plan is pure infra.

## Next Phase Readiness

**Ready for Plan 05-05 (scrubber) consumption:**

- `window.dispatchEvent(new CustomEvent('omnispice:scrub-committed'))` is the scrubber's pointer-up contract. Orchestrator is already listening.
- `TieredSimulationController` is instantiated and held by the orchestrator — 05-05 does not need to construct its own.
- If 05-05 needs to push intermediate AC sweeps during drag, it can call `orchestratorInternals.controller.scheduleAcSweep(...)` (a small helper export may be added then), or drive the scrubber state through `circuitStore` and let the existing store-change subscription handle it.

**Ready for Plan 05-07 (hover probe):**

- Probe tooltip can grab cached DC op-point vectors off `overlayStore` directly (already wired).
- For AC probe, read the most recent AC sweep result off `simulationStore.results`.

**Ready for Plan 05-08 (parameter sweep):**

- `controller.runSweepPoint(netlist, paramName, value)` is already cached by `{netlistHash}:{paramName}:{value}`. Plan 05-08 will layer linear interpolation on top.

**Blockers/concerns:**

- `src/simulation/controller.ts` legacy lint warnings — will be resolved by deletion in 05-07, not before
- Pre-existing `matchMedia` polyfill gap in `src/test/setup.ts` affects the full-suite green state but doesn't affect Plan 05-04 tests

## Self-Check: PASSED

Verification commands run at end of plan execution:

```
$ pnpm test --run src/simulation/ src/circuit/__tests__/netlistHash.test.ts
Test Files  8 passed (8)
     Tests  69 passed (69)

$ npx tsc --noEmit
(clean — no output)
```

**Created files (all verified present):**
- `src/simulation/TieredSimulationController.ts` — FOUND
- `src/simulation/simulationOrchestrator.ts` — FOUND
- `src/simulation/__tests__/TieredSimulationController.test.ts` — FOUND
- `src/simulation/__tests__/simulationOrchestrator.test.ts` — FOUND
- `src/simulation/__tests__/worker.test.ts` — FOUND
- `src/simulation/__tests__/mockWorker.ts` — FOUND
- `src/circuit/netlistHash.ts` — FOUND
- `src/circuit/__tests__/netlistHash.test.ts` — FOUND

**Commits (all verified in `git log`):**
- `746ebfd` — Task 1 protocol + hashNetlist — FOUND
- `1b0c9fc` — Task 2 worker extended protocol — FOUND
- `444d5e8` — Task 3 TieredSimulationController — FOUND
- `5b33dbd` — Task 4 orchestrator + App.tsx mount — FOUND
- `29a3506` — deferred-items doc update — FOUND

---
*Phase: 05-collaboration-and-polish*
*Completed: 2026-04-11*
