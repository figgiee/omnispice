/**
 * Plan 06-01 — Bidirectional Zustand ↔ Y.Doc circuit binding.
 *
 * Exports:
 *   LOCAL_ORIGIN     — module-level Symbol used to tag all local Y.Doc
 *                      writes so the observe callbacks can skip them
 *                      (echo guard).
 *   ComponentJSON    — JSON-serializable representation of Component.
 *   WireJSON         — JSON-serializable representation of Wire.
 *   getCircuitYMaps  — Idempotent accessor for the two shared Y.Maps.
 *   bindCircuitToYjs — Wires a circuitStore to a Y.Doc bidirectionally.
 *                      Returns a cleanup function.
 *
 * Architecture (bidirectional with origin-tagged echo suppression):
 *
 *   LOCAL → REMOTE:
 *     useCircuitStore.subscribe detects reference changes in
 *     circuit.components / circuit.wires, diffs them, and writes the
 *     delta into the Y.Map wrapped in a doc.transact(..., LOCAL_ORIGIN)
 *     so remote peers receive the change.
 *
 *   REMOTE → LOCAL:
 *     yComponents.observe / yWires.observe fire for every Y.Map change.
 *     If event.transaction.origin === LOCAL_ORIGIN we skip (echo guard).
 *     Otherwise we apply the diff to Zustand via setState() — direct
 *     setState bypasses zundo so remote edits don't pollute the local
 *     undo stack.
 */

import * as Y from 'yjs';
import type { StoreApi } from 'zustand';
import type { CircuitState } from '@/store/circuitStore';
import type { Component, Wire } from '@/circuit/types';

// ---------------------------------------------------------------------------
// Echo guard origin symbol
// ---------------------------------------------------------------------------

/**
 * All local writes into the Y.Doc are tagged with this Symbol so the
 * observe callbacks can detect their own echoes and skip them.
 * Identity comparison: `event.transaction.origin === LOCAL_ORIGIN`.
 */
export const LOCAL_ORIGIN = Symbol('omnispice-local');

// ---------------------------------------------------------------------------
// JSON wire types (canonical Phase-6 contracts)
// ---------------------------------------------------------------------------

/**
 * JSON-safe representation of a Component stored in the Y.Map.
 * Values are stored as JSON strings: yComponents.get(id) → JSON string.
 */
export interface ComponentJSON {
  id: string;
  type: string;
  refDesignator: string;
  value: string;
  ports: unknown[]; // Port[] serialized as plain JSON
  position: { x: number; y: number };
  rotation: number;
  spiceModel?: string;
  parameters?: Record<string, string>;
  netLabel?: string;
  parentId?: string;
  subcircuitName?: string;
  childComponentIds?: string[];
  exposedPinMapping?: Record<string, string>;
}

/**
 * JSON-safe representation of a Wire stored in the Y.Map.
 */
export interface WireJSON {
  id: string;
  sourcePortId: string;
  targetPortId: string;
  bendPoints: { x: number; y: number }[];
}

// ---------------------------------------------------------------------------
// Y.Map accessor
// ---------------------------------------------------------------------------

export interface CircuitYMaps {
  /** componentId → JSON.stringify(Component) */
  yComponents: Y.Map<string>;
  /** wireId → JSON.stringify(Wire) */
  yWires: Y.Map<string>;
}

/**
 * Returns the two shared Y.Map containers from a Y.Doc.
 * Idempotent — calling multiple times with the same doc returns the
 * same Y.Map instances (Y.Doc caches by name internally).
 */
export function getCircuitYMaps(yDoc: Y.Doc): CircuitYMaps {
  return {
    yComponents: yDoc.getMap<string>('components'),
    yWires: yDoc.getMap<string>('wires'),
  };
}

// ---------------------------------------------------------------------------
// Bidirectional binding
// ---------------------------------------------------------------------------

/**
 * Type alias for a circuitStore reference — supports both the singleton
 * useCircuitStore and freshly-created test store instances.
 */
export type CircuitStoreApi = StoreApi<CircuitState>;

/**
 * Binds a circuitStore to a Y.Doc bidirectionally.
 *
 * LOCAL → REMOTE:
 *   Subscribes to the store; on each state change diffs the component
 *   and wire Maps by reference and writes deltas into the Y.Maps tagged
 *   with LOCAL_ORIGIN.
 *
 * REMOTE → LOCAL:
 *   Observes the two Y.Maps; ignores events whose origin is LOCAL_ORIGIN
 *   (echo guard); applies remote diffs directly to the store via setState.
 *
 * Returns a cleanup function that removes all observers and unsubscribes.
 */
export function bindCircuitToYjs(yDoc: Y.Doc, store: CircuitStoreApi): () => void {
  const { yComponents, yWires } = getCircuitYMaps(yDoc);

  // ── REMOTE → LOCAL observers ──────────────────────────────────────────

  const onComponentsChange = (event: Y.YMapEvent<string>) => {
    if (event.transaction.origin === LOCAL_ORIGIN) return; // echo guard

    const current = store.getState().circuit.components;
    const next = new Map(current);

    for (const [key, { action }] of event.changes.keys) {
      if (action === 'delete') {
        next.delete(key);
      } else {
        const raw = yComponents.get(key);
        if (raw != null) {
          const parsed: ComponentJSON = JSON.parse(raw);
          next.set(key, parsed as unknown as Component);
        }
      }
    }

    store.setState((s) => ({
      circuit: { ...s.circuit, components: next },
    }));
  };

  const onWiresChange = (event: Y.YMapEvent<string>) => {
    if (event.transaction.origin === LOCAL_ORIGIN) return; // echo guard

    const current = store.getState().circuit.wires;
    const next = new Map(current);

    for (const [key, { action }] of event.changes.keys) {
      if (action === 'delete') {
        next.delete(key);
      } else {
        const raw = yWires.get(key);
        if (raw != null) {
          const parsed: WireJSON = JSON.parse(raw);
          next.set(key, parsed as unknown as Wire);
        }
      }
    }

    store.setState((s) => ({
      circuit: { ...s.circuit, wires: next },
    }));
  };

  yComponents.observe(onComponentsChange);
  yWires.observe(onWiresChange);

  // ── LOCAL → REMOTE subscriber ─────────────────────────────────────────

  let prevComponents = store.getState().circuit.components;
  let prevWires = store.getState().circuit.wires;

  const unsubscribe = store.subscribe((state) => {
    const { components, wires } = state.circuit;

    if (components !== prevComponents) {
      diffAndTransact(yDoc, yComponents, prevComponents, components);
      prevComponents = components;
    }

    if (wires !== prevWires) {
      diffAndTransact(yDoc, yWires, prevWires, wires);
      prevWires = wires;
    }
  });

  return () => {
    yComponents.unobserve(onComponentsChange);
    yWires.unobserve(onWiresChange);
    unsubscribe();
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Diffs two Maps by reference and writes additions/updates/deletions into
 * the Y.Map inside a LOCAL_ORIGIN-tagged transaction so the echo guard fires.
 *
 * Values are stored as JSON strings.
 */
function diffAndTransact<T extends { id: string }>(
  yDoc: Y.Doc,
  yMap: Y.Map<string>,
  prev: Map<string, T>,
  next: Map<string, T>,
): void {
  yDoc.transact(() => {
    // Additions + updates (reference inequality means the object changed).
    for (const [id, item] of next) {
      if (prev.get(id) !== item) {
        yMap.set(id, JSON.stringify(item));
      }
    }
    // Deletions.
    for (const id of prev.keys()) {
      if (!next.has(id)) {
        yMap.delete(id);
      }
    }
  }, LOCAL_ORIGIN);
}
