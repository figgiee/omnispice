/**
 * Plan 06-01 — One-shot Y.Map → Zustand hydration.
 *
 * Used at session bootstrap: when the y-websocket provider fires a 'sync'
 * event the caller invokes `syncYMapToCircuit` to replace the local
 * (empty) store state with the authoritative server snapshot.
 *
 * This is intentionally a full-replace rather than an incremental diff —
 * at bootstrap time there is no meaningful local state to preserve.
 *
 * Exports:
 *   syncYMapToCircuit — reads yComponents + yWires and calls setState
 *                       on the provided store to replace the circuit.
 */

import * as Y from 'yjs';
import type { StoreApi } from 'zustand';
import type { Component, Wire } from '@/circuit/types';
import type { CircuitState } from '@/store/circuitStore';
import type { ComponentJSON, WireJSON } from './circuitBinding';

/**
 * Hydrates the Zustand circuit store from a Y.Map snapshot.
 *
 * Parses each JSON string value stored in the Y.Maps and builds the
 * `Map<string, Component>` and `Map<string, Wire>` the store expects.
 * Calls `store.setState` directly to bypass zundo temporal history
 * (bootstrap is not an undoable user action).
 *
 * @param yComponents  Y.Map<string> from `getCircuitYMaps(doc).yComponents`
 * @param yWires       Y.Map<string> from `getCircuitYMaps(doc).yWires`
 * @param store        The circuitStore (singleton or test instance)
 */
export function syncYMapToCircuit(
  yComponents: Y.Map<string>,
  yWires: Y.Map<string>,
  store: StoreApi<CircuitState>,
): void {
  const components = new Map<string, Component>();
  for (const [id, raw] of yComponents.entries()) {
    const json: ComponentJSON = JSON.parse(raw);
    components.set(id, json as unknown as Component);
  }

  const wires = new Map<string, Wire>();
  for (const [id, raw] of yWires.entries()) {
    const json: WireJSON = JSON.parse(raw);
    wires.set(id, json as unknown as Wire);
  }

  store.setState((s) => ({
    circuit: {
      ...s.circuit,
      components,
      wires,
    },
  }));
}
