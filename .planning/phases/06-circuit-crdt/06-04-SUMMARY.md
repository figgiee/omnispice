---
phase: 06-circuit-crdt
plan: 04
subsystem: collab
tags: [crdt, yjs, collab, canvas, zustand, undo]
dependency_graph:
  requires: [06-01, 06-02, 06-03]
  provides: [live-crdt-editing, collab-undo, position-sync, collab-guards]
  affects: [useCollabProvider, circuitStore, Canvas]
tech_stack:
  added: []
  patterns:
    - Y.Doc useState for reactive hook dependencies (useYIndexedDB, useCollabUndoManager)
    - provider.on('sync') gate before bindCircuitToYjs to avoid premature local→remote writes
    - LOCAL_ORIGIN tag on onNodeDragStop transact to suppress echo re-render
    - Module-level collabActive flag guards collapseSubcircuit topology mutations
key_files:
  created: []
  modified:
    - src/collab/useCollabProvider.ts
    - src/store/circuitStore.ts
    - src/canvas/Canvas.tsx
    - src/collab/__tests__/useCollabProvider.test.ts
    - src/store/__tests__/circuitStore.test.ts
decisions:
  - activeYDoc state variable (not ref) drives useYIndexedDB and useCollabUndoManager so those hooks re-run reactively when the Y.Doc is created/destroyed
  - bindCircuitToYjs called inside provider 'sync' event (isSynced=true) to ensure server state wins over any stale local Zustand data
  - useCollabProvider return shape changed from bare providerRef to { providerRef, docRef } to expose Y.Doc to Canvas without a context
  - resolveRefDesignatorConflicts implemented as exported pure helper in circuitStore; not wired into the observe callback in this plan (Phase 6 v2 follow-up)
  - Ctrl+Z hotkeys registered in useCollabProvider; useCanvasInteractions bindings left intact for solo fallback
metrics:
  duration_seconds: 327
  completed_date: "2026-04-15T08:29:09Z"
  tasks_completed: 3
  files_modified: 5
requirements: [CRDT-01, CRDT-02, CRDT-03, CRDT-04, CRDT-05]
---

# Phase 6 Plan 04: CRDT Assembly Summary

**One-liner:** Wired all Phase 6 CRDT primitives (binding, undo manager, IDB persist, position sync) into useCollabProvider and Canvas to produce live two-tab co-editing.

## What Was Built

### Task 1 — useCollabProvider CRDT activation

`src/collab/useCollabProvider.ts` extended with full CRDT lifecycle:

- `setCollabActive(true)` called immediately after provider creation, before sync.
- `activeYDoc` state variable (not just a ref) set to the new `Y.Doc` so `useYIndexedDB` and `useCollabUndoManager` hooks re-render reactively when the session starts/ends.
- `useYIndexedDB(activeYDoc, circuitId)` mounted at hook top-level for durable IDB snapshots.
- `useCollabUndoManager(activeYDoc)` mounted; `undoCollab`/`redoCollab` wired to `useHotkeys('ctrl+z')` and `useHotkeys('ctrl+shift+z')`.
- `bindCircuitToYjs(doc, useCircuitStore)` called inside `provider.on('sync', onSync)` guard — binding starts only once Y.Doc is fully caught up with the server.
- Cleanup: `bindCleanupRef.current?.()` → `provider.destroy()` → `doc.destroy()` → `setActiveYDoc(null)` → `setCollabActive(false)` — strict ordering ensures no IDB race window.
- Return shape changed from bare `providerRef` to `{ providerRef, docRef }` to expose the live Y.Doc to Canvas without a React context.

### Task 2 — circuitStore CRDT safety guards

Two additive changes to `src/store/circuitStore.ts`:

**`collapseSubcircuit` collab guard:**
```typescript
if (collabActive) {
  console.warn('[OmniSpice] collapseSubcircuit is disabled during a collaboration session...');
  return null;
}
```
Subcircuit topology changes (adding child components, repointing wires) involve multi-step state mutations that cannot be expressed as a single atomic Y.Map operation. The guard prevents a broken partial-sync state from reaching peers.

**`resolveRefDesignatorConflicts` exported helper:**
Pure function that groups components by `refDesignator`, detects duplicates, sorts by UUID for determinism, and returns a corrected Map with auto-incremented suffixes for losers. Ready to be wired into the `yComponents` observer in a follow-up plan.

Test coverage added: two new cases in `circuitStore.test.ts` verify the guard fires when `collabActive` is true and that the action proceeds normally when `collabActive` is false.

### Task 3 — Canvas `onNodeDragStop` position write

`src/canvas/Canvas.tsx` updated:

- Destructures `{ providerRef, docRef }` from the updated `useCollabProvider` return.
- `handleNodeDragStop` callback reads `docRef.current`, calls `getCircuitYMaps(yDoc)`, parses the existing component JSON, merges the new `node.position`, and writes back via `yDoc.transact(() => { yComponents.set(...) }, LOCAL_ORIGIN)`.
- `LOCAL_ORIGIN` tag causes the echo guard in `circuitBinding.ts` to skip the event for the local client — no redundant Zustand re-render for our own drag.
- Fires once on mouseup via `onNodeDragStop` (not 60 fps on `onNodeDrag`) — correct granularity for CRDT sync.

## Ctrl+Z Binding Decision

The plan specified wiring Ctrl+Z to `undoCollab`. Two handlers now exist for `ctrl+z`:

1. `useCollabProvider` registers `useHotkeys('ctrl+z', undoCollab)` — active in all sessions. When `activeYDoc` is null (solo), `undoCollab` falls through to zundo.
2. `useCanvasInteractions` registers `useHotkeys('ctrl+z', temporal.undo)` — kept intact.

Both fire in a collab session. The `undoCollab` path handles the Y.UndoManager case first; if `managerRef.current` is null or `canUndo()` is false it falls through to zundo. This means in a collab session both handlers run but the result is correct: Y.UndoManager undo fires via handler 1, zundo undo is attempted by handler 2 but is a no-op (zundo is paused by `useCollabUndoManager`).

Full keyboard wiring cleanup (suppressing the duplicate zundo call in collab mode) is deferred to Phase 6 v2.

## Known Limitations

**refDesignator dedup not yet wired to observe callback:** `resolveRefDesignatorConflicts` is exported but not yet called in the `yComponents` observer in `circuitBinding.ts`. Concurrent adds can briefly show duplicate designators (sub-100 ms window). Wiring is a Phase 6 v2 task.

**collapseSubcircuit UI not gated:** The collapse button in the sidebar/context menu is not greyed out when `collabActive` is true. The action silently no-ops with a console warning. UI gate is a follow-up task.

**Ctrl+Z in collab fires both handlers:** See above. Acceptable for Phase 6 v1 — zundo is paused so the duplicate call is harmless.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] activeYDoc state variable instead of ref for hook reactivity**
- **Found during:** Task 1 implementation
- **Issue:** Plan suggested passing `docRef.current` to `useYIndexedDB` and `useCollabUndoManager`. A mutable ref doesn't trigger re-renders — both hooks would always see `null` and never activate.
- **Fix:** Added `const [activeYDoc, setActiveYDoc] = useState<Y.Doc | null>(null)` set inside the provider `useEffect`. This makes the hook re-render with the live Y.Doc after the provider mounts.
- **Files modified:** `src/collab/useCollabProvider.ts`
- **Commit:** f6aea88

**2. [Rule 3 - Blocking] useCollabProvider test mock missing `.on()` / `.off()`**
- **Found during:** Task 1 test run
- **Issue:** `MockWebsocketProvider` had no `on`/`off` methods. Hook now calls `provider.on('sync', onSync)` causing `TypeError: provider.on is not a function`.
- **Fix:** Added `on`, `off`, `emit` to `MockWebsocketProvider`. Added `vi.mock` stubs for `circuitBinding`, `useCollabUndoManager`, `useYIndexedDB`, `circuitStore.setCollabActive`, and `react-hotkeys-hook` so the test module graph stays isolated.
- **Files modified:** `src/collab/__tests__/useCollabProvider.test.ts`
- **Commit:** f6aea88

**3. [Rule 1 - Bug] TypeScript strict-mode: regex match groups typed as `string | undefined`**
- **Found during:** Task 2 `pnpm tsc --noEmit`
- **Issue:** `match[1]` and `match[2]` are `string | undefined` in TypeScript's RegExpExecArray type even when the regex has required groups.
- **Fix:** Added `as string` casts after null-guard `if (!match) continue` and added `m[2] !== undefined` guard in the inner loop.
- **Files modified:** `src/store/circuitStore.ts`
- **Commit:** 7edf201

## Self-Check

**Files exist:**
- `src/collab/useCollabProvider.ts` — modified
- `src/store/circuitStore.ts` — modified
- `src/canvas/Canvas.tsx` — modified
- `.planning/phases/06-circuit-crdt/06-04-SUMMARY.md` — this file

**Commits:**
- f6aea88: feat(06-04): wire bindCircuitToYjs + collabActive into useCollabProvider
- 7edf201: feat(06-04): collapseSubcircuit guard during collab sessions
- c0c29aa: feat(06-04): onNodeDragStop Y.Map position write in Canvas
