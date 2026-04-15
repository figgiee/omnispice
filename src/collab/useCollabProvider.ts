/**
 * Plan 05-09 — Yjs collaboration provider hook.
 *
 * Opens a Y.Doc + y-websocket provider for the given circuitId, publishes
 * self awareness with the supplied user payload, and mirrors peer
 * awareness into the `presenceStore`. This hook is the single owner of
 * the Yjs provider lifecycle for the Canvas.
 *
 * Circuit data is NEVER written into the Yjs doc — this is presence only
 * per locked Plan 05-09 scope.
 *
 * Environment toggles:
 *   VITE_COLLAB_ENABLED=false  disables the hook entirely (no provider,
 *                              no websocket). Useful for offline mode +
 *                              the Phase 6 graduation spike branch.
 *   VITE_COLLAB_WS_URL=...     override the default ws url. Production
 *                              should point at wss://api.omnispice.app.
 */

import { useEffect, useRef } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { type PeerState, usePresenceStore } from '@/store/presenceStore';

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
  return (
    (import.meta.env?.VITE_COLLAB_WS_URL as string | undefined) ?? DEFAULT_WS_URL
  );
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
 * Wire the Yjs collab provider lifecycle to a Canvas mount. Returns a ref
 * pointing at the live `WebsocketProvider` so the Canvas can publish its
 * own cursor/selection/viewport awareness fields via the helpers below.
 */
export function useCollabProvider(
  circuitId: string | null,
  user: CollabUser | null,
) {
  const providerRef = useRef<WebsocketProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);

  useEffect(() => {
    if (!isCollabEnabled()) return;
    if (!circuitId || !user) return;

    const doc = new Y.Doc();
    docRef.current = doc;
    const provider = new WebsocketProvider(collabWsUrl(), circuitId, doc);
    providerRef.current = provider;

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

    return () => {
      provider.awareness.off('change', onAwarenessChange);
      provider.destroy();
      doc.destroy();
      usePresenceStore.getState().clearAll();
      providerRef.current = null;
      docRef.current = null;
    };
    // Only re-connect when circuit or user identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuitId, user?.id]);

  return providerRef;
}

// --- Awareness publishers ------------------------------------------------
// Thin wrappers called by Canvas interaction handlers. Kept as plain
// functions so they can be throttled/debounced at the call site without
// fighting React closures.

import type { PeerUser } from '@/store/presenceStore';

export function publishCursor(
  provider: WebsocketProvider | null,
  x: number,
  y: number,
): void {
  provider?.awareness.setLocalStateField('cursor', { x, y });
}

export function publishSelection(
  provider: WebsocketProvider | null,
  ids: string[],
): void {
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
