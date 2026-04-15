/**
 * Plan 06-03 — Separate test file for the collabActive bypass flag.
 *
 * Kept separate from circuitStore.test.ts to avoid touching the large
 * existing test file and to isolate the idb-keyval mock from other tests.
 *
 * Note: the Zustand `createJSONStorage` wrapper re-JSON-stringifies values
 * before they reach the underlying idb-keyval `set` call (so a string like
 * 'foo' arrives as '"foo"'). Tests here assert on call presence / absence
 * and key name rather than exact value shape.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock idb-keyval BEFORE importing circuitStore.
const idbSetMock = vi.fn().mockResolvedValue(undefined);
const idbGetMock = vi.fn().mockResolvedValue(null);
const idbDelMock = vi.fn().mockResolvedValue(undefined);

vi.mock('idb-keyval', () => ({
  set: idbSetMock,
  get: idbGetMock,
  del: idbDelMock,
}));

describe('circuitStore — collabActive persist bypass', () => {
  beforeEach(() => {
    idbSetMock.mockClear();
    idbGetMock.mockClear();
    idbDelMock.mockClear();
  });

  it('initializes with collabActive effectively false (setItem writes)', async () => {
    const { setCollabActive, useCircuitStore } = await import('../circuitStore');
    const storage = useCircuitStore.persist.getOptions().storage;
    if (!storage) throw new Error('storage is undefined');

    // Ensure default state allows writes
    setCollabActive(false);
    await storage.setItem('test-key', 'test-value');

    // createJSONStorage re-stringifies the value, so the key is what matters here.
    expect(idbSetMock).toHaveBeenCalledOnce();
    expect(idbSetMock.mock.calls[0][0]).toBe('test-key');
  });

  it('setCollabActive(true) suppresses idb writes', async () => {
    const { setCollabActive, useCircuitStore } = await import('../circuitStore');
    const storage = useCircuitStore.persist.getOptions().storage;
    if (!storage) throw new Error('storage is undefined');

    setCollabActive(true);
    await storage.setItem('test-key', 'should-be-blocked');

    expect(idbSetMock).not.toHaveBeenCalled();

    // Reset for other tests
    setCollabActive(false);
  });

  it('setCollabActive(false) re-enables idb writes after true', async () => {
    const { setCollabActive, useCircuitStore } = await import('../circuitStore');
    const storage = useCircuitStore.persist.getOptions().storage;
    if (!storage) throw new Error('storage is undefined');

    setCollabActive(true);
    await storage.setItem('test-key', 'blocked');
    expect(idbSetMock).not.toHaveBeenCalled();

    setCollabActive(false);
    await storage.setItem('test-key', 'allowed');
    expect(idbSetMock).toHaveBeenCalledOnce();
    expect(idbSetMock.mock.calls[0][0]).toBe('test-key');
  });

  it('getItem is NOT gated by collabActive (offline read path unchanged)', async () => {
    const { setCollabActive, useCircuitStore } = await import('../circuitStore');
    const storage = useCircuitStore.persist.getOptions().storage;
    if (!storage) throw new Error('storage is undefined');

    setCollabActive(true);
    await storage.getItem('test-key');

    // getItem should always delegate regardless of collabActive
    expect(idbGetMock).toHaveBeenCalledWith('test-key');

    setCollabActive(false);
  });
});
