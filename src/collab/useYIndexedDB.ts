/**
 * Plan 06-03 — y-indexeddb persistence hook for collab sessions.
 *
 * When a collab session is active this hook mounts an `IndexeddbPersistence`
 * provider that keeps a local snapshot of the Y.Doc in IndexedDB under the
 * key `circuit-${circuitId}`. This is separate from the Zustand persist key
 * (`omnispice-circuit`) — the two never write to the same slot.
 *
 * Lifecycle:
 *   1. setCollabActive(true)  — called by the collab lifecycle before mounting
 *      this hook, so Zustand persist stops writing.
 *   2. Mount: IndexeddbPersistence loads the local Y.Doc snapshot from IDB.
 *   3. 'synced' event: local IDB is loaded; syncYMapToCircuit hydrates Zustand
 *      from the Y.Doc state (rather than from the stale Zustand persist data).
 *      onSynced() is called so the caller can trigger WebSocket connection.
 *   4. WebSocket provider delta-syncs from the server on top of the local base.
 *   5. Unmount: persistence.destroy() is called; setCollabActive(false) is
 *      called by the collab lifecycle separately.
 */

import { useEffect } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useCircuitStore } from '@/store/circuitStore';
import { getCircuitYMaps } from './circuitBinding';
import { syncYMapToCircuit } from './yMapToCircuit';

/**
 * Mounts a y-indexeddb provider that gives the Y.Doc durable local storage
 * during collab sessions.
 *
 * @param yDoc       The shared Y.Doc for the active collab session. Pass null
 *                   to disable (hook becomes a no-op until both are set).
 * @param circuitId  The circuit's persistent ID (UUID or slug). Used as the
 *                   IDB key: `circuit-${circuitId}`.
 * @param onSynced   Optional callback fired once the local IDB snapshot has
 *                   been loaded into the Y.Doc (before WebSocket delta arrives).
 */
export function useYIndexedDB(
  yDoc: Y.Doc | null,
  circuitId: string | null,
  onSynced?: () => void,
): void {
  useEffect(() => {
    if (!yDoc || !circuitId) return;

    const persistence = new IndexeddbPersistence(`circuit-${circuitId}`, yDoc);

    persistence.on('synced', () => {
      // Local IDB snapshot loaded — hydrate Zustand from the Y.Doc state so
      // the UI reflects the persisted circuit before the WebSocket delta arrives.
      const { yComponents, yWires } = getCircuitYMaps(yDoc);
      syncYMapToCircuit(yComponents, yWires, useCircuitStore);
      onSynced?.();
    });

    return () => {
      persistence.destroy();
    };
  }, [yDoc, circuitId, onSynced]);
}
