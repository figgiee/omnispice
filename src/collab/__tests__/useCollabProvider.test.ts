/**
 * Plan 05-09 Task 2 — useCollabProvider hook coverage.
 *
 * Mocks `yjs` and `y-websocket` so the hook can be driven in jsdom without
 * a real WebSocket. Asserts:
 *   - On mount, a Y.Doc + WebsocketProvider are constructed with the right
 *     room id (= circuitId)
 *   - Self awareness is published with the provided user data
 *   - presenceStore.selfClientId is seeded from provider.awareness.clientID
 *   - Awareness 'change' events filter out self and call setRemotePeers
 *   - Unmount destroys provider + doc and clears presence
 *   - VITE_COLLAB_ENABLED=false makes the hook a no-op
 */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock infrastructure -----------------------------------------------
// We capture the last constructed mock Y.Doc and WebsocketProvider so tests
// can drive the awareness change listener.

type Listener = () => void;

class MockAwareness {
  clientID = 1234;
  private state: Record<string, unknown> = {};
  private listeners = new Set<Listener>();
  // Peer states keyed by clientId, including self.
  states = new Map<number, Record<string, unknown>>();

  setLocalStateField(field: string, value: unknown) {
    this.state[field] = value;
    this.states.set(this.clientID, { ...this.state });
  }

  getStates() {
    return this.states;
  }

  on(event: string, cb: Listener) {
    if (event === 'change') this.listeners.add(cb);
  }

  off(event: string, cb: Listener) {
    if (event === 'change') this.listeners.delete(cb);
  }

  emit() {
    for (const cb of this.listeners) cb();
  }
}

class MockDoc {
  destroy = vi.fn();
}

class MockWebsocketProvider {
  awareness: MockAwareness;
  destroy = vi.fn();
  private listeners = new Map<string, Set<(arg: unknown) => void>>();
  constructor(
    public url: string,
    public room: string,
    public doc: MockDoc,
  ) {
    this.awareness = new MockAwareness();
    lastProvider = this;
  }
  on(event: string, cb: (arg: unknown) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(cb);
  }
  off(event: string, cb: (arg: unknown) => void) {
    this.listeners.get(event)?.delete(cb);
  }
  emit(event: string, arg: unknown) {
    for (const cb of this.listeners.get(event) ?? []) cb(arg);
  }
}

let lastProvider: MockWebsocketProvider | null = null;

vi.mock('yjs', () => ({
  Doc: MockDoc,
}));

vi.mock('y-websocket', () => ({
  WebsocketProvider: MockWebsocketProvider,
}));

// Plan 06-04 — mock the CRDT primitives so tests don't need a real Y.Doc
// binding, undo manager, or IndexedDB provider in jsdom.
vi.mock('@/collab/circuitBinding', () => ({
  bindCircuitToYjs: vi.fn(() => vi.fn()), // returns a cleanup no-op
  getCircuitYMaps: vi.fn(() => ({ yComponents: new Map(), yWires: new Map() })),
  LOCAL_ORIGIN: Symbol('test-local-origin'),
}));

vi.mock('@/collab/useCollabUndoManager', () => ({
  useCollabUndoManager: vi.fn(() => ({
    undoCollab: vi.fn(),
    redoCollab: vi.fn(),
    canUndo: vi.fn(() => false),
    canRedo: vi.fn(() => false),
  })),
}));

vi.mock('@/collab/useYIndexedDB', () => ({
  useYIndexedDB: vi.fn(),
}));

vi.mock('@/store/circuitStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/circuitStore')>();
  return {
    ...actual,
    setCollabActive: vi.fn(),
    useCircuitStore: actual.useCircuitStore,
  };
});

vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn(),
}));

// We dynamically import BOTH the hook under test AND the presenceStore so
// that `vi.resetModules()` in beforeEach gives us a fresh module graph —
// otherwise the static top-of-file import of presenceStore would resolve
// to a stale copy disconnected from the one the hook touches.
type PresenceStoreModule = typeof import('@/store/presenceStore');
type HookModule = typeof import('../useCollabProvider');

describe('useCollabProvider', () => {
  beforeEach(() => {
    lastProvider = null;
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function load(): Promise<{
    useCollabProvider: HookModule['useCollabProvider'];
    usePresenceStore: PresenceStoreModule['usePresenceStore'];
  }> {
    const hookMod = await import('../useCollabProvider');
    const storeMod = await import('@/store/presenceStore');
    // Reset the freshly-loaded store so each test starts clean.
    storeMod.usePresenceStore.getState().clearAll();
    return {
      useCollabProvider: hookMod.useCollabProvider,
      usePresenceStore: storeMod.usePresenceStore,
    };
  }

  it('constructs a provider with circuitId as the room key on mount', async () => {
    const { useCollabProvider } = await load();
    renderHook(() => useCollabProvider('circuit-abc', { id: 'alice', name: 'Alice' }));
    expect(lastProvider).not.toBeNull();
    expect(lastProvider?.room).toBe('circuit-abc');
  });

  it('publishes self awareness with user payload on mount', async () => {
    const { useCollabProvider } = await load();
    renderHook(() => useCollabProvider('circuit-abc', { id: 'alice', name: 'Alice Zhou' }));
    const provider = lastProvider;
    expect(provider).not.toBeNull();
    if (!provider) return;
    const selfState = provider.awareness.getStates().get(provider.awareness.clientID) as
      | { user: { id: string; name: string } }
      | undefined;
    expect(selfState).toBeDefined();
    expect(selfState?.user.id).toBe('alice');
    expect(selfState?.user.name).toBe('Alice Zhou');
  });

  it('seeds presenceStore.selfClientId from awareness.clientID', async () => {
    const { useCollabProvider, usePresenceStore } = await load();
    renderHook(() => useCollabProvider('circuit-abc', { id: 'alice', name: 'Alice' }));
    const provider = lastProvider;
    expect(provider).not.toBeNull();
    if (!provider) return;
    expect(usePresenceStore.getState().selfClientId).toBe(provider.awareness.clientID);
  });

  it('filters self from the peer list on awareness change', async () => {
    const { useCollabProvider, usePresenceStore } = await load();
    renderHook(() => useCollabProvider('circuit-abc', { id: 'alice', name: 'Alice' }));
    const provider = lastProvider;
    expect(provider).not.toBeNull();
    if (!provider) return;
    // Inject a second peer's state into the awareness map.
    provider.awareness.states.set(5678, {
      user: { id: 'bob', name: 'Bob', color: 'var(--signal-1)' },
      cursor: { x: 10, y: 20 },
      selection: ['comp-1'],
      viewport: null,
      chipAnchor: null,
    });
    provider.awareness.emit();
    const peers = usePresenceStore.getState().remotePeers;
    // Self filtered out; only bob remains.
    expect(peers.size).toBe(1);
    expect(peers.get(5678)?.user.name).toBe('Bob');
    expect(peers.has(provider.awareness.clientID)).toBe(false);
  });

  it('cleans up on unmount: destroy provider + doc + clear presence', async () => {
    const { useCollabProvider, usePresenceStore } = await load();
    const { unmount } = renderHook(() =>
      useCollabProvider('circuit-abc', { id: 'alice', name: 'Alice' }),
    );
    const provider = lastProvider;
    expect(provider).not.toBeNull();
    if (!provider) return;
    const doc = provider.doc;
    usePresenceStore.getState().setRemotePeers([
      {
        clientId: 9,
        user: { id: 'x', name: 'X', color: 'var(--signal-2)' },
        cursor: null,
        selection: [],
        viewport: null,
        chipAnchor: null,
      },
    ]);
    unmount();
    expect(provider.destroy).toHaveBeenCalled();
    expect(doc.destroy).toHaveBeenCalled();
    expect(usePresenceStore.getState().remotePeers.size).toBe(0);
    expect(usePresenceStore.getState().selfClientId).toBeNull();
  });

  it('is a no-op when circuitId is null', async () => {
    const { useCollabProvider } = await load();
    renderHook(() => useCollabProvider(null, { id: 'alice', name: 'Alice' }));
    expect(lastProvider).toBeNull();
  });

  it('is a no-op when user is null', async () => {
    const { useCollabProvider } = await load();
    renderHook(() => useCollabProvider('circuit-abc', null));
    expect(lastProvider).toBeNull();
  });

  it('is a no-op when VITE_COLLAB_ENABLED=false', async () => {
    vi.stubEnv('VITE_COLLAB_ENABLED', 'false');
    const { useCollabProvider } = await load();
    renderHook(() => useCollabProvider('circuit-abc', { id: 'alice', name: 'Alice' }));
    expect(lastProvider).toBeNull();
  });
});
