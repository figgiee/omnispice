/**
 * Plan 06-03 — Tests for useYIndexedDB hook and collabActive persist bypass.
 *
 * Tests verify:
 * 1. setCollabActive(true) prevents idb-keyval writes via the persist adapter.
 * 2. setCollabActive(false) allows idb-keyval writes via the persist adapter.
 * 3. useYIndexedDB mounts IndexeddbPersistence and fires onSynced when IDB loads.
 * 4. useYIndexedDB destroys IndexeddbPersistence on unmount.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as Y from 'yjs';

// ---------------------------------------------------------------------------
// Part 1: collabActive bypass flag in the persist storage adapter
// ---------------------------------------------------------------------------

// Mock idb-keyval BEFORE importing circuitStore so the adapter sees the mock.
const idbSetMock = vi.fn().mockResolvedValue(undefined);
const idbGetMock = vi.fn().mockResolvedValue(null);
const idbDelMock = vi.fn().mockResolvedValue(undefined);

vi.mock('idb-keyval', () => ({
  set: idbSetMock,
  get: idbGetMock,
  del: idbDelMock,
}));

// Mock y-indexeddb
const destroyMock = vi.fn().mockResolvedValue(undefined);
const onMock = vi.fn();
const IndexeddbPersistenceMock = vi.fn().mockImplementation(() => ({
  on: onMock,
  destroy: destroyMock,
}));

vi.mock('y-indexeddb', () => ({
  IndexeddbPersistence: IndexeddbPersistenceMock,
}));

// Mock syncYMapToCircuit — not under test here
vi.mock('../yMapToCircuit', () => ({
  syncYMapToCircuit: vi.fn(),
}));

describe('circuitStore collabActive flag', () => {
  beforeEach(async () => {
    vi.resetModules();
    idbSetMock.mockClear();
    idbGetMock.mockClear();
    idbDelMock.mockClear();
  });

  it('setCollabActive(false) allows persist storage.setItem to write', async () => {
    const { setCollabActive, useCircuitStore } = await import('../../store/circuitStore');
    const storage = useCircuitStore.persist.getOptions().storage;
    if (!storage) throw new Error('storage is undefined');

    setCollabActive(false);
    await storage.setItem('omnispice-circuit', '{"test":true}');

    expect(idbSetMock).toHaveBeenCalledOnce();
    expect(idbSetMock).toHaveBeenCalledWith('omnispice-circuit', '{"test":true}');
  });

  it('setCollabActive(true) prevents persist storage.setItem from writing', async () => {
    const { setCollabActive, useCircuitStore } = await import('../../store/circuitStore');
    const storage = useCircuitStore.persist.getOptions().storage;
    if (!storage) throw new Error('storage is undefined');

    setCollabActive(true);
    await storage.setItem('omnispice-circuit', '{"should":"not write"}');

    expect(idbSetMock).not.toHaveBeenCalled();

    // Clean up — reset to false so subsequent tests are not affected
    setCollabActive(false);
  });
});

// ---------------------------------------------------------------------------
// Part 2: useYIndexedDB hook
// ---------------------------------------------------------------------------

describe('useYIndexedDB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: on('synced', cb) calls cb immediately
    onMock.mockImplementation((event: string, cb: () => void) => {
      if (event === 'synced') cb();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('mounts IndexeddbPersistence when yDoc and circuitId are provided', async () => {
    const { useYIndexedDB } = await import('../useYIndexedDB');
    const yDoc = new Y.Doc();

    renderHook(() => useYIndexedDB(yDoc, 'circuit-abc'));

    expect(IndexeddbPersistenceMock).toHaveBeenCalledOnce();
    expect(IndexeddbPersistenceMock).toHaveBeenCalledWith('circuit-circuit-abc', yDoc);
  });

  it('calls onSynced when IDB fires the synced event', async () => {
    const { useYIndexedDB } = await import('../useYIndexedDB');
    const yDoc = new Y.Doc();
    const onSynced = vi.fn();

    renderHook(() => useYIndexedDB(yDoc, 'circuit-abc', onSynced));

    expect(onSynced).toHaveBeenCalledOnce();
  });

  it('destroys IndexeddbPersistence on unmount', async () => {
    const { useYIndexedDB } = await import('../useYIndexedDB');
    const yDoc = new Y.Doc();

    const { unmount } = renderHook(() => useYIndexedDB(yDoc, 'circuit-abc'));

    unmount();

    expect(destroyMock).toHaveBeenCalledOnce();
  });

  it('is a no-op when circuitId is null', async () => {
    const { useYIndexedDB } = await import('../useYIndexedDB');
    const yDoc = new Y.Doc();

    renderHook(() => useYIndexedDB(yDoc, null));

    expect(IndexeddbPersistenceMock).not.toHaveBeenCalled();
  });

  it('is a no-op when yDoc is null', async () => {
    const { useYIndexedDB } = await import('../useYIndexedDB');

    renderHook(() => useYIndexedDB(null, 'circuit-abc'));

    expect(IndexeddbPersistenceMock).not.toHaveBeenCalled();
  });
});
