/**
 * Plan 05-09 — presence store.
 *
 * Holds the derived projection of remote peer awareness coming from the
 * Yjs `Awareness` protocol. The store is deliberately presence-only — it
 * never stores circuit data. Circuit state stays authoritative in
 * `circuitStore` per the locked Plan 05-09 scope (presence, not CRDT).
 *
 * Subscribers:
 *  - `src/collab/useCollabProvider.ts` writes via `setRemotePeers` on
 *    every Yjs awareness change event
 *  - `src/collab/PresenceLayer.tsx` reads to render remote cursors,
 *    selection tints, and ghost chips on the canvas
 *  - `src/collab/PresenceList.tsx` reads to render the top-right peer
 *    avatar bar
 */

import { create } from 'zustand';

export interface PeerUser {
  /** Stable user id (Clerk user id, or a random guest id). */
  id: string;
  /** Display name surfaced on cursor labels and avatar tooltips. */
  name: string;
  /** CSS custom-property reference used for cursor + tint color. */
  color: string;
}

export interface PeerState {
  /** Yjs `Awareness.clientID` — stable for the lifetime of the session. */
  clientId: number;
  user: PeerUser;
  /** Flow-space cursor coordinates; null until the peer moves the mouse. */
  cursor: { x: number; y: number } | null;
  /** Component ids the peer has selected. */
  selection: string[];
  /** React Flow viewport tuple for "frame this peer" actions. */
  viewport: { x: number; y: number; zoom: number } | null;
  /** Component id the peer currently has a parameter chip open against. */
  chipAnchor: string | null;
}

interface PresenceStore {
  /** Local Yjs client id, set once per collab session. */
  selfClientId: number | null;
  /** Remote peers keyed by Yjs clientId — self is explicitly excluded. */
  remotePeers: Map<number, PeerState>;
  setSelfClientId: (id: number) => void;
  /** Replace the peer map whole-cloth with the supplied list. */
  setRemotePeers: (peers: PeerState[]) => void;
  /** Drop every remote peer AND reset selfClientId. Called on unmount. */
  clearAll: () => void;
}

export const usePresenceStore = create<PresenceStore>()((set) => ({
  selfClientId: null,
  remotePeers: new Map(),
  setSelfClientId: (id) => set({ selfClientId: id }),
  setRemotePeers: (peers) =>
    set({
      remotePeers: new Map(peers.map((p) => [p.clientId, p])),
    }),
  clearAll: () => set({ selfClientId: null, remotePeers: new Map() }),
}));
