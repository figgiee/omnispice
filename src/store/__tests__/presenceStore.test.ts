/**
 * Plan 05-09 Task 2 — presenceStore unit coverage.
 *
 * Presence is a derived projection of the Yjs awareness map: incoming
 * peer list replaces the store map whole-cloth, self-client-id is a
 * single scalar, and clearAll drops everything on unmount. The actual
 * awareness subscription lives in useCollabProvider (tested separately).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type PeerState, usePresenceStore } from '../presenceStore';

function makePeer(clientId: number, id: string, name: string): PeerState {
  return {
    clientId,
    user: { id, name, color: 'var(--signal-0)' },
    cursor: null,
    selection: [],
    viewport: null,
    chipAnchor: null,
  };
}

describe('presenceStore', () => {
  beforeEach(() => {
    usePresenceStore.getState().clearAll();
  });
  afterEach(() => {
    usePresenceStore.getState().clearAll();
  });

  it('starts with no peers and null selfClientId', () => {
    const s = usePresenceStore.getState();
    expect(s.selfClientId).toBeNull();
    expect(s.remotePeers.size).toBe(0);
  });

  it('setSelfClientId records the local Yjs client id', () => {
    usePresenceStore.getState().setSelfClientId(42);
    expect(usePresenceStore.getState().selfClientId).toBe(42);
  });

  it('setRemotePeers replaces the peer map whole-cloth', () => {
    const alice = makePeer(1, 'alice', 'Alice');
    const bob = makePeer(2, 'bob', 'Bob');
    usePresenceStore.getState().setRemotePeers([alice, bob]);
    const peers = usePresenceStore.getState().remotePeers;
    expect(peers.size).toBe(2);
    expect(peers.get(1)?.user.name).toBe('Alice');
    expect(peers.get(2)?.user.name).toBe('Bob');
  });

  it('setRemotePeers with a new list removes old peers', () => {
    const alice = makePeer(1, 'alice', 'Alice');
    const bob = makePeer(2, 'bob', 'Bob');
    const carol = makePeer(3, 'carol', 'Carol');
    usePresenceStore.getState().setRemotePeers([alice, bob]);
    usePresenceStore.getState().setRemotePeers([carol]);
    const peers = usePresenceStore.getState().remotePeers;
    expect(peers.size).toBe(1);
    expect(peers.get(3)?.user.name).toBe('Carol');
    expect(peers.has(1)).toBe(false);
    expect(peers.has(2)).toBe(false);
  });

  it('clearAll resets remotePeers AND selfClientId', () => {
    usePresenceStore.getState().setSelfClientId(99);
    usePresenceStore.getState().setRemotePeers([makePeer(1, 'a', 'A')]);
    usePresenceStore.getState().clearAll();
    const s = usePresenceStore.getState();
    expect(s.selfClientId).toBeNull();
    expect(s.remotePeers.size).toBe(0);
  });

  it('peer cursor and selection fields round-trip through setRemotePeers', () => {
    const alice: PeerState = {
      clientId: 1,
      user: { id: 'alice', name: 'Alice', color: 'var(--signal-3)' },
      cursor: { x: 120, y: 80 },
      selection: ['comp-1', 'comp-2'],
      viewport: { x: -100, y: -50, zoom: 1.5 },
      chipAnchor: 'comp-1',
    };
    usePresenceStore.getState().setRemotePeers([alice]);
    const peer = usePresenceStore.getState().remotePeers.get(1);
    expect(peer).toBeDefined();
    expect(peer?.cursor).toEqual({ x: 120, y: 80 });
    expect(peer?.selection).toEqual(['comp-1', 'comp-2']);
    expect(peer?.viewport).toEqual({ x: -100, y: -50, zoom: 1.5 });
    expect(peer?.chipAnchor).toBe('comp-1');
  });
});
