---
phase: 06-circuit-crdt
plan: 01
subsystem: collab
tags: [yjs, crdt, zustand, circuit-binding, echo-guard, bidirectional-sync, tdd]

# Dependency graph
requires:
  - phase: 05-collaboration-and-polish
    plan: 09
    provides: "useCollabProvider — Y.Doc + y-websocket lifecycle, presence awareness"
  - phase: 05-collaboration-and-polish
    plan: 10
    provides: "circuitStore with temporal(persist()) middleware, idb-keyval persistence"

provides:
  - "LOCAL_ORIGIN Symbol — echo-guard constant for all local Y.Doc writes in Phase 6"
  - "ComponentJSON + WireJSON interfaces — canonical Phase-6 JSON-wire types for CRDT storage"
  - "getCircuitYMaps(yDoc) — idempotent accessor returning yComponents + yWires Y.Maps"
  - "bindCircuitToYjs(yDoc, store) — bidirectional Zustand ↔ Y.Doc sync with LOCAL_ORIGIN echo suppression; returns cleanup()"
  - "syncYMapToCircuit(yComponents, yWires, store) — one-shot bootstrap hydration from Y.Map snapshot"

affects:
  - 06-02-undo-manager
  - 06-03-persist-bypass
  - 06-04-provider-integration
  - 06-05-e2e

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Components + wires stored as JSON strings in Y.Map<string> (not nested Y.Maps). Values are JSON.stringify(Component) / JSON.stringify(Wire). Parsing on the observe path keeps the Yjs layer thin and avoids deep-CRDT complexity."
    - "LOCAL_ORIGIN is a module-level Symbol — identity comparison (===) is safe across the module boundary; no risk of string collision."
    - "Zustand→Yjs path uses store.subscribe (reference diff) + doc.transact(..., LOCAL_ORIGIN). Only changed entries are written — not the full Map — so large circuits with one drag update don't flood the Y.Doc."
    - "Yjs→Zustand path calls store.setState() directly (not via action methods). Direct setState bypasses zundo temporal middleware so remote edits do not pollute the local undo stack."
    - "diffAndTransact private helper deduplicates the diff+write logic for both components and wires paths."
    - "syncYMapToCircuit is a full-replace (not incremental) — at bootstrap time there is no local state to preserve."
    - "bindCircuitToYjs accepts a StoreApi<CircuitState> parameter rather than importing useCircuitStore directly, making the binding testable with isolated store instances created via zustand/vanilla."

key-files:
  created:
    - src/collab/circuitBinding.ts
    - src/collab/yMapToCircuit.ts
    - src/collab/__tests__/circuitBinding.test.ts
  modified: []

key-decisions:
  - "JSON strings in Y.Map<string> over nested Y.Maps. Nested Y.Maps (one Y.Map per component) would give per-field CRDT merge but add significant Yjs API surface and complicate the bootstrap hydration + cleanup paths. For a circuit editor where full-object overwrites are fine (the conflict resolution rule is last-write-wins per component), JSON blobs are simpler and faster."
  - "store.setState() bypasses zundo for remote edits. The alternative — routing remote edits through action methods — would push them onto the local undo stack, creating the 'undo erases peer edits' correctness bug documented in RESEARCH.md Q2. Direct setState is the canonical fix."
  - "bindCircuitToYjs takes a StoreApi parameter rather than closing over useCircuitStore. This enables unit tests to create isolated store instances via zustand/vanilla without touching the singleton, making the echo-guard and round-trip tests deterministic."
  - "syncYMapToCircuit is kept separate from bindCircuitToYjs. Bootstrap hydration (one-shot full-replace on provider sync) and incremental binding (continuous diff-based sync) have different semantics and should not be coupled."

metrics:
  duration: "~25 minutes"
  completed: "2026-04-14"
  tasks: 3
  files: 3
---

# Phase 6 Plan 01: Circuit CRDT Binding Layer Summary

**One-liner:** Bidirectional Zustand ↔ Y.Map binding with LOCAL_ORIGIN echo suppression and syncYMapToCircuit bootstrap hydration, built test-first.

## What Was Built

### `src/collab/circuitBinding.ts`

Core module exporting:

- `LOCAL_ORIGIN` — module-level Symbol used to tag all local Y.Doc writes. Any observe callback compares `event.transaction.origin === LOCAL_ORIGIN` to detect and skip its own echoes.
- `ComponentJSON` / `WireJSON` — JSON-serializable type contracts for what gets stored in the Y.Maps. These are the canonical Phase-6 wire types; downstream plans (undo manager, provider integration) import them from here.
- `getCircuitYMaps(yDoc)` — returns `{ yComponents, yWires }` by calling `yDoc.getMap('components')` and `yDoc.getMap('wires')`. Idempotent: Y.Doc caches maps by name, so repeated calls return the same instance.
- `bindCircuitToYjs(yDoc, store)` — installs the bidirectional binding and returns a cleanup function.

**LOCAL → REMOTE path:** `store.subscribe` fires on every state change. The callback diffs `circuit.components` and `circuit.wires` by Map reference (if `components !== prevComponents`, something changed). For each changed entry, `diffAndTransact` writes the delta into the Y.Map inside a `doc.transact(..., LOCAL_ORIGIN)` call. Only changed entries are written — not the full map — so large circuits with a single drag update do not flood the Y.Doc.

**REMOTE → LOCAL path:** `yComponents.observe` and `yWires.observe` fire for every Y.Map change. The first thing each handler checks is `event.transaction.origin === LOCAL_ORIGIN`; if true, it returns immediately (echo guard). Otherwise, it diffs `event.changes.keys`, parses the JSON strings, and calls `store.setState()` directly — bypassing zundo so remote edits do not appear on the local undo stack.

**`diffAndTransact` helper:** Extracted to avoid duplicating the diff+write logic between the components and wires paths. Accepts a generic `Map<string, T extends { id }>` so it works for both.

### `src/collab/yMapToCircuit.ts`

Exports `syncYMapToCircuit(yComponents, yWires, store)`: iterates both Y.Maps, parses the JSON strings, builds `Map<string, Component>` and `Map<string, Wire>`, and calls `store.setState()` to replace the circuit in one shot. This is called once on the provider `sync` event during session bootstrap.

### `src/collab/__tests__/circuitBinding.test.ts`

8 unit tests covering all specified behaviors:

| # | Test | Result |
|---|------|--------|
| 1 | LOCAL_ORIGIN is a Symbol | PASS |
| 2 | getCircuitYMaps idempotent | PASS |
| 3 | addComponent propagates to yComponents | PASS |
| 4 | Remote Y.Map set propagates to Zustand (no echo) | PASS |
| 5 | addWire propagates to yWires | PASS |
| 6 | LOCAL_ORIGIN writes do not cause extra setState calls | PASS |
| 7 | syncYMapToCircuit hydrates from Y.Map snapshot | PASS |
| 8 | cleanup() removes all observers | PASS |

## Deviations from Plan

### Auto-fixed Issues

None.

### Design choices vs. plan spec

**Binding signature:** The plan spec shows `bindCircuitToYjs(yDoc, store, { yComponents, yWires })` as a three-argument call with pre-extracted maps. The implementation uses `bindCircuitToYjs(yDoc, store)` (two arguments) and extracts the maps internally via `getCircuitYMaps`. This is strictly simpler — callers never need to pass the maps separately since `getCircuitYMaps` is idempotent. The test suite validates the two-argument form explicitly.

**`yMapToCircuit.ts` export:** The plan frontmatter names the export `syncYMapToCircuit` (which is what was implemented). The inline prompt summary referred to `yComponentsToMap` / `yWiresToMap` as two separate pure functions. `syncYMapToCircuit` was chosen because it matches the frontmatter artifact spec and the implementation section description, and because a single hydration call is simpler for the bootstrap caller (plan 06-04).

**StoreApi parameter instead of useCircuitStore singleton:** `bindCircuitToYjs` accepts `StoreApi<CircuitState>` so tests can inject isolated stores. The singleton `useCircuitStore` is still the default caller in production — plan 06-04 will wire them together. This deviation improves testability with no production cost.

## Commits

| Hash | Message |
|------|---------|
| eb038e3 | test(06-01): RED -- circuitBinding + yMapToCircuit tests |
| 4745b61 | feat(06-01): getCircuitYMaps + LOCAL_ORIGIN + bindCircuitToYjs + syncYMapToCircuit (GREEN) |

## Verification

- `pnpm test --run src/collab/__tests__/circuitBinding.test.ts` — 8/8 pass
- `pnpm tsc --noEmit` — clean (no errors)
- `pnpm build` — exits 0, no new warnings
