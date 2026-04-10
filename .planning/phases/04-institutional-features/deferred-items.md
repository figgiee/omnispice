# Phase 4 Deferred Items

Out-of-scope discoveries found during plan execution. Not touched by
the current plan — logged here so they can be addressed in a future
Phase 4 plan or phase.

## Found during 04-01 execution

### Pre-existing canvas hotkey test failures

**File:** `src/canvas/hooks/__tests__/useCanvasInteractions.test.ts`

Two tests fail:

- `registers W key to switch to wire tool`
- `registers V key to switch to select tool`

**Root cause:** unclear — the test expects `registeredHotkeys.get('v')`
to return a defined handler, but the Phase 1 `useCanvasInteractions`
hook no longer registers raw `'v'` / `'w'`. The test is stale.

**Why deferred:** Not caused by Phase 4 changes, not related to any
Phase 4 task. Touching Phase 1 canvas code is out of scope for 04-01.

**Recommended owner:** a Phase 1 follow-up or a Phase 5 cleanup pass.

### Pre-existing AssignmentPage test failure

**File:** `src/pages/AssignmentPage.test.tsx`

Fails at transform time (not in a test body). Pre-existing before 04-01
started — unrelated to any Phase 4 work.

**Why deferred:** Out of scope for 04-01.
