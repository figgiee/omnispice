# Deferred Items — Phase 05 (collaboration-and-polish)

Pre-existing unit-test failures surfaced while running the full Vitest
suite during Plan 05-10 execution. Out of scope for 05-10 (offline/persist),
tracked here so a later plan can fix them.

## Unrelated failing tests (pre-existing — not caused by 05-10)

1. **`src/canvas/hooks/__tests__/useCanvasInteractions.test.ts`** — 2 failures
   - "registers W key to switch to wire tool"
   - "registers V key to switch to select tool"
   - Failure mode: `registeredHotkeys.get('w'|'v')` returns undefined
   - Also emits `TypeError: matchMedia is not a function` from uPlot on
     import when the test environment probes window.matchMedia
   - Root cause: Hotkey registration spy relies on internal shape that no
     longer matches `react-hotkeys-hook` v5 API and jsdom lacks matchMedia
     which uPlot needs at module load.
   - Confirmed pre-existing by running the same test at HEAD before Plan
     05-10 changes were applied — still fails.

Total: 2 failing tests / 255 total (253 pass).

## Additional pre-existing failures (observed during 05-04 full-suite run)

2. **`src/pages/AssignmentPage.test.tsx`** — entire suite fails to load
   - Failure mode: `TypeError: matchMedia is not a function` at
     `uPlot.cjs.js:80` (`setPxRatio`)
   - Same underlying cause as the useCanvasInteractions failures — uPlot
     probes `window.matchMedia` on module import and jsdom does not
     install a matchMedia polyfill in this project's test setup.
   - NOT caused by Plan 05-04 (the orchestrator does not import uPlot).
   - Fix: add `window.matchMedia = vi.fn(...)` polyfill to
     `src/test/setup.ts`, likely part of a general test-harness cleanup.

Full-suite snapshot as of Plan 05-04 completion:
- 269 passing / 271 unit tests (2 failing — all pre-existing)
- 1 suite failing to load (AssignmentPage — pre-existing)


## Pre-existing lint warnings in `src/simulation/controller.ts` (observed during 05-04)

- Line 74, 78: Non-null assertions on `this.pendingReject` / `this.pendingResolve`
- Line 125: `_pendingAnalysisType` declared but not used

These predate Plan 05-04 (controller.ts is the legacy single-shot
controller; Plan 05-04 added a deprecation comment but intentionally
does NOT refactor its internals because the existing `controller.test.ts`
suite encodes the current message-sequence semantics). They will be
deleted outright when Plan 05-07 migrates the F5 manual-run path
through `simulationOrchestrator`.

