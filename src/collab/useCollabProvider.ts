/**
 * Plan 05-09 — Yjs collaboration provider hook.
 *
 * Opens a Y.Doc + y-websocket provider for the given circuitId, publishes
 * self awareness with the supplied user payload, and mirrors peer
 * awareness into the `presenceStore`. This hook is the single owner of
 * the Yjs provider lifecycle for the Canvas.
 *
 * Plan 06-04 — CRDT activation extension.
 *
 * After provider creation, this hook now:
 *   1. Calls setCollabActive(true) to halt Zustand persist writes.
 *   2. Mounts useYIndexedDB for durable local Y.Doc snapshots.
 *   3. Calls bindCircuitToYjs after the provider 'sync' event fires, so
 *      the bidirectional Zustand ↔ Y.Doc binding starts only once the doc
 *      is caught up with the server.
 *   4. Mounts useCollabUndoManager to replace zundo with Y.UndoManager
 *      during the session and registers Ctrl+Z / Ctrl+Shift+Z hotkeys.
 *   5. On cleanup: tears down the binding, then calls setCollabActive(false)
 *      so Zustand persist resumes only after the binding is fully removed.
 *
 * The existing awareness publisher and presenceStore logic (Phase 5) is
 * fully preserved — this plan only ADDS to useCollabProvider.
 *
 * Environment toggles:
 *   VITE_COLLAB_ENABLED=false  disables the hook entirely (no provider,
 *                              no websocket). Useful for offline mode +
 *                              the Phase 6 graduation spike branch.
 *   VITE_COLLAB_WS_URL=...     override the default ws url. Production
 *                              should point at wss://api.omnispice.app.
 */

import { useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { setCollabActive, useCircuitStore } from '@/store/circuitStore';
import type { PeerUser } from '@/store/presenceStore';
import { type PeerState, usePresenceStore } from '@/store/presenceStore';
import { bindCircuitToYjs } from './circuitBinding';
import { useCollabUndoManager } from './useCollabUndoManager';
import { useYIndexedDB } from './useYIndexedDB';

export interface CollabUser {
  id: string;
  name: string;
}

const DEFAULT_WS_URL = 'ws://localhost:8787/editor';

function isCollabEnabled(): boolean {
  // Explicit false disables; any other value (including undefined) leaves
  // collab on. This matches how Vite exposes string env vars.
  return (import.meta.env?.VITE_COLLAB_ENABLED as string | undefined) !== 'false';
}

function collabWsUrl(): string {
  return (import.meta.env?.VITE_COLLAB_WS_URL as string | undefined) ?? DEFAULT_WS_URL;
}

/**
 * Stable per-user color hash: maps user id to one of the eight
 * `--signal-*` CSS vars defined in `src/styles/variables.css`.
 */
function assignPresenceColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash + userId.charCodeAt(i)) | 0;
  }
  const bucket = Math.abs(hash) % 8;
  return `var(--signal-${bucket})`;
}

/**
 * Wire the Yjs collab provider lifecycle to a Canvas mount.
 *
 * Returns:
 *   providerRef — ref to the live WebsocketProvider (for awareness publishers).
 *   docRef      — ref to the live Y.Doc (for onNodeDragStop Y.Map writes).
 *
 * Plan 06-04: The hook now activates CRDT binding (bindCircuitToYjs),
 * durable local persistence (useYIndexedDB), and the collab undo manager
 * (useCollabUndoManager) in addition to the Phase 5 presence layer.
 */
export function useCollabProvider(
  circuitId: string | null,
  user: CollabUser | null,
): {
  providerRef: React.RefObject<WebsocketProvider | null>;
  docRef: React.RefObject<Y.Doc | null>;
} {
  const providerRef = useRef<WebsocketProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);

  // yDoc state drives useYIndexedDB and useCollabUndoManager re-renders.
  // We need a state variable (not just a ref) so those hooks see the updated
  // Y.Doc after the provider useEffect fires.
  const [activeYDoc, setActiveYDoc] = useState<Y.Doc | null>(null);

  // Ref to hold the binding cleanup so we can invoke it in the useEffect cleanup.
  const bindCleanupRef = useRef<(() => void) | null>(null);

  // Plan 06-04 — mount y-indexeddb for durable local Y.Doc snapshots.
  // No-op when activeYDoc is null (collab disabled or not yet connected).
  useYIndexedDB(activeYDoc, circuitId);

  // Plan 06-04 — mount Y.UndoManager tied to the active Y.Doc. When non-null
  // this pauses zundo and creates a Y.UndoManager scoped to LOCAL_ORIGIN writes.
  const { undoCollab, redoCollab } = useCollabUndoManager(activeYDoc);

  // Plan 06-04 — Ctrl+Z / Ctrl+Shift+Z hotkeys wired to Y.UndoManager.
  // When activeYDoc is null, undoCollab / redoCollab fall back to zundo
  // (see useCollabUndoManager implementation), so these bindings are safe
  // in both solo and collab sessions.
  //
  // Note: useCanvasInteractions.ts also registers ctrl+z / ctrl+shift+z.
  // react-hotkeys-hook resolves conflicts by calling the most-recently-
  // registered handler first. These registrations happen inside
  // useCollabProvider which mounts before useCanvasInteractions, so in
  // practice both handlers fire; undoCollab handles the collab case and
  // the useCanvasInteractions handler is a no-op duplicate in that path.
  // The useCanvasInteractions Ctrl+Z bindings are documented as superseded
  // by useCollabUndoManager in Phase 6 but left in place for solo sessions.
  useHotkeys(
    'ctrl+z, meta+z',
    (e) => {
      e.preventDefault();
      undoCollab();
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    'ctrl+shift+z, meta+shift+z',
    (e) => {
      e.preventDefault();
      redoCollab();
    },
    { enableOnFormTags: false },
  );

  useEffect(() => {
    if (!isCollabEnabled()) return;
    if (!circuitId || !user) return;

    const doc = new Y.Doc();
    docRef.current = doc;
    const provider = new WebsocketProvider(collabWsUrl(), circuitId, doc);
    providerRef.current = provider;

    // Plan 06-04 — step 1: stop Zustand persist from racing with y-indexeddb.
    setCollabActive(true);

    // Expose the Y.Doc to useYIndexedDB and useCollabUndoManager via state.
    setActiveYDoc(doc);

    // Publish self-awareness. Only the `user` field ships on mount —
    // cursor/selection/viewport update via `publishCursor` et al. from
    // the Canvas interaction handlers.
    provider.awareness.setLocalStateField('user', {
      id: user.id,
      name: user.name,
      color: assignPresenceColor(user.id),
    });
    usePresenceStore.getState().setSelfClientId(provider.awareness.clientID);

    const onAwarenessChange = () => {
      const states = provider.awareness.getStates();
      const peers: PeerState[] = [];
      for (const [clientId, raw] of states.entries()) {
        if (clientId === provider.awareness.clientID) continue; // skip self
        const state = raw as Partial<PeerState> & {
          user?: PeerUser | undefined;
        };
        // Defensive: drop peers that haven't published a user field yet.
        if (!state.user) continue;
        peers.push({
          clientId,
          user: state.user,
          cursor: state.cursor ?? null,
          selection: Array.isArray(state.selection) ? state.selection : [],
          viewport: state.viewport ?? null,
          chipAnchor: state.chipAnchor ?? null,
        });
      }
      usePresenceStore.getState().setRemotePeers(peers);
    };
    provider.awareness.on('change', onAwarenessChange);
    // Seed an initial snapshot so late joiners see existing peers at once.
    onAwarenessChange();

    // Plan 06-04 — step 3: start the bidirectional Zustand ↔ Y.Doc binding
    // only after the Y.Doc is fully synced with the server. This ensures
    // that the local store is populated from the authoritative server state
    // before we start propagating local edits outward.
    const onSync = (isSynced: boolean) => {
      if (!isSynced) return;
      // Tear down any prior binding before installing a fresh one.
      bindCleanupRef.current?.();
      bindCleanupRef.current = bindCircuitToYjs(doc, useCircuitStore);
      // Testing hook: signal to Playwright that the Yjs provider is synced.
      // This attribute is read by E2E specs (phase6/crdt.spec.ts) via
      // waitForFunction(() => document.querySelector('[data-collab-connected="true"]') !== null)
      // It has no effect on production behavior.
      document.documentElement.setAttribute('data-collab-connected', 'true');
    };
    provider.on('sync', onSync);

    return () => {
      provider.off('sync', onSync);
      provider.awareness.off('change', onAwarenessChange);
      document.documentElement.removeAttribute('data-collab-connected');

      // Plan 06-04 — tear down binding before destroying provider/doc.
      bindCleanupRef.current?.();
      bindCleanupRef.current = null;

      provider.destroy();
      doc.destroy();
      usePresenceStore.getState().clearAll();
      providerRef.current = null;
      docRef.current = null;

      // Clear state so useYIndexedDB and useCollabUndoManager clean up.
      setActiveYDoc(null);

      // Plan 06-04 — step 5: resume Zustand persist after binding is fully
      // torn down so there is no window where both write to IDB simultaneously.
      setCollabActive(false);
    };
    // Only re-connect when circuit or user identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuitId, user?.id]);

  return { providerRef, docRef };
}

// --- Awareness publishers ------------------------------------------------
// Thin wrappers called by Canvas interaction handlers. Kept as plain
// functions so they can be throttled/debounced at the call site without
// fighting React closures.

export function publishCursor(provider: WebsocketProvider | null, x: number, y: number): void {
  provider?.awareness.setLocalStateField('cursor', { x, y });
}

export function publishSelection(provider: WebsocketProvider | null, ids: string[]): void {
  provider?.awareness.setLocalStateField('selection', ids);
}

export function publishViewport(
  provider: WebsocketProvider | null,
  viewport: { x: number; y: number; zoom: number },
): void {
  provider?.awareness.setLocalStateField('viewport', viewport);
}

export function publishChipAnchor(
  provider: WebsocketProvider | null,
  componentId: string | null,
): void {
  provider?.awareness.setLocalStateField('chipAnchor', componentId);
}
