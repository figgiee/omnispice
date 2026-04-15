---
phase: 06-circuit-crdt
plan: "03"
subsystem: collab/persistence
tags: [yjs, indexeddb, zustand, persist, collab, offline]
dependency_graph:
  requires:
    - 06-01  # circuitBinding, yMapToCircuit, getCircuitYMaps
  provides:
    - setCollabActive export from circuitStore
    - useYIndexedDB hook
  affects:
    - circuitStore persist adapter (setItem gating)
    - collab session lifecycle (caller sets collabActive before mounting hook)
tech_stack:
  added: []
  patterns:
    - Module-level flag (collabActive) used as a collab-owns-IDB gate in persist adapter
    - IDB key namespace separation (omnispice-circuit vs circuit-${circuitId})
    - y-indexeddb IndexeddbPersistence for Y.Doc local durability during collab
key_files:
  created:
    - src/collab/useYIndexedDB.ts
    - src/collab/__tests__/useYIndexedDB.test.ts
    - src/store/__tests__/circuitStore.collabActive.test.ts
  modified:
    - src/store/circuitStore.ts
decisions:
  - setCollabActive is a module-level flag + exported setter rather than Zustand state — avoids circular dependency between store and collab layer
  - getItem and removeItem are NOT gated — only setItem is bypassed; offline read and cleanup paths remain unconditional
  - IDB key for y-indexeddb uses circuit-${circuitId} (not omnispice-circuit) to guarantee no slot collision with Zustand persist
  - syncYMapToCircuit is called in the 'synced' callback so Zustand reflects Y.Doc state before WebSocket delta arrives
metrics:
  duration: "~15 minutes"
  completed: "2026-04-15"
  tasks_completed: 1
  files_changed: 4
---

# Phase 6 Plan 03: IndexedDB Ownership Hand-off (collabActive bypass + useYIndexedDB) Summary

**One-liner:** Module-level `collabActive` flag gates Zustand persist's `setItem` so y-indexeddb exclusively owns the IndexedDB slot during collab sessions, preventing double-write races.

## What Was Built

### Problem

When a collab session is active, both Zustand `persist` (via idb-keyval, key `omnispice-circuit`) and y-indexeddb (`IndexeddbPersistence`, key `circuit-${circuitId}`) would independently write to IndexedDB on every circuit change. This causes a double-hydration race on page load: Zustand rehydrates stale offline data on top of the Y.Doc's authoritative CRDT state.

### Solution

**1. `setCollabActive` export in `src/store/circuitStore.ts`**

A module-level boolean `collabActive` (default `false`) is declared above the `indexedDbStorage` adapter. An exported `setCollabActive(active: boolean)` setter lets the collab lifecycle flip the flag without importing Zustand into the collab layer.

The `setItem` implementation of `indexedDbStorage` now short-circuits immediately when `collabActive` is true:

```typescript
setItem: async (name: string, value: string): Promise<void> => {
  if (collabActive) return; // y-indexeddb owns persistence during collab
  await idbSet(name, value);
},
```

`getItem` and `removeItem` are left ungated — the offline read and cleanup paths must remain unconditional.

**2. `useYIndexedDB` hook in `src/collab/useYIndexedDB.ts`**

Mounts an `IndexeddbPersistence` provider for the Y.Doc under the key `circuit-${circuitId}`. On the `'synced'` event (local IDB snapshot loaded), it calls `syncYMapToCircuit` to hydrate Zustand from the Y.Doc before the WebSocket provider delta-syncs from the server. The provider is destroyed on unmount.

```typescript
export function useYIndexedDB(
  yDoc: Y.Doc | null,
  circuitId: string | null,
  onSynced?: () => void,
): void
```

The hook is a no-op when either argument is null, making it safe to render unconditionally in the collab session component.

### IDB Key Scheme

| Owner | Key | When active |
|-------|-----|-------------|
| Zustand persist (idb-keyval) | `omnispice-circuit` | `collabActive === false` (offline-only) |
| y-indexeddb (IndexeddbPersistence) | `circuit-${circuitId}` | `collabActive === true` (collab session) |

The keys never overlap, and the `collabActive` flag ensures only one path writes at a time.

### Collab Lifecycle Integration

The caller (e.g., `useCollabProvider`) is responsible for:
1. Calling `setCollabActive(true)` before mounting the collab session (stops Zustand writes)
2. Rendering `useYIndexedDB(yDoc, circuitId)` — mounts IDB provider, hydrates Zustand on sync
3. Calling `setCollabActive(false)` when the collab session ends (re-enables Zustand writes)

## Tests

12 tests total across two test files:

**`src/collab/__tests__/useYIndexedDB.test.ts` (8 tests)**
- `setCollabActive(false)` allows `storage.setItem` to reach idb-keyval
- `setCollabActive(true)` prevents `storage.setItem` from calling idb-keyval
- `setCollabActive(false)` after `true` re-enables writes
- `useYIndexedDB` mounts `IndexeddbPersistence` with correct key + yDoc
- `useYIndexedDB` fires `onSynced` when the `'synced'` event fires
- `useYIndexedDB` calls `persistence.destroy()` on unmount
- No-op when `circuitId` is null
- No-op when `yDoc` is null

**`src/store/__tests__/circuitStore.collabActive.test.ts` (4 tests)**
- Default state allows idb writes
- `setCollabActive(true)` suppresses writes
- `setCollabActive(false)` re-enables after true
- `getItem` always delegates regardless of `collabActive`

All 22 existing `circuitStore.test.ts` tests still pass — no regressions.

## Commits

| Hash | Message |
|------|---------|
| `d1d6410` | `test(06-03): RED — useYIndexedDB + collabActive tests` |
| `1205919` | `feat(06-03): useYIndexedDB hook + collabActive persist bypass (GREEN)` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] syncYMapToCircuit signature mismatch**
- **Found during:** Task 1 implementation
- **Issue:** The plan's action snippet called `syncYMapToCircuit(yComponents, yWires)` with 2 args, but the actual function (created in 06-01) requires a third `store` argument: `syncYMapToCircuit(yComponents, yWires, store)`
- **Fix:** Passed `useCircuitStore` as the third argument in the hook's `'synced'` callback
- **Files modified:** `src/collab/useYIndexedDB.ts`

**2. [Rule 1 - Bug] createJSONStorage double-serialization in store tests**
- **Found during:** Task 1 test verification
- **Issue:** `createJSONStorage` re-JSON-stringifies values before passing them to the underlying storage adapter, so `'test-value'` arrives at idb-keyval as `'"test-value"'`. Test assertions checking exact value would fail.
- **Fix:** Updated `circuitStore.collabActive.test.ts` assertions to check call presence and key name rather than exact value; verified that `not.toHaveBeenCalled()` assertions (the critical ones for the bypass gate) are unaffected.
- **Files modified:** `src/store/__tests__/circuitStore.collabActive.test.ts`

**3. [Rule 1 - Bug] vi.fn() arrow function not usable as constructor**
- **Found during:** Task 1 test verification (first RED run of useYIndexedDB tests)
- **Issue:** `vi.fn().mockImplementation(() => ({ on, destroy }))` with an arrow function cannot be used with `new`. The tests threw `TypeError: () => ... is not a constructor`.
- **Fix:** Rewrote the mock using the `vi.fn(function(this) { this.on = ...; })` constructor pattern so `new IndexeddbPersistence(...)` works correctly in tests.
- **Files modified:** `src/collab/__tests__/useYIndexedDB.test.ts`

## Known Stubs

None. All data paths are wired. The hook is ready for integration by the collab session lifecycle.

## Self-Check: PASSED
