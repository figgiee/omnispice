/**
 * Enforces the circuitStore middleware order:
 *
 *   temporal(persist(...))  -- CORRECT
 *   persist(temporal(...))  -- WRONG (would persist temporal meta)
 *
 * Also verifies:
 *   - A component added to the store serializes through the persist
 *     middleware into the mocked IndexedDB (idb-keyval) backing store.
 *   - A fresh store instance re-imported from scratch rehydrates state
 *     from that blob and recovers the component.
 *   - temporal.undo() still works after persist wraps the store
 *     (so temporal remains the outer middleware).
 *   - The persisted blob contains the current circuit/refCounters but
 *     NOT the undo stack (partialize excludes temporal meta).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory backing store shared with the idb-keyval mock below.
const memory = new Map<string, string>();

vi.mock('idb-keyval', () => ({
  get: async (k: string) => memory.get(k),
  set: async (k: string, v: string) => {
    memory.set(k, v);
  },
  del: async (k: string) => {
    memory.delete(k);
  },
  clear: async () => {
    memory.clear();
  },
}));

async function waitForPersist(): Promise<void> {
  // Zustand persist writes on a microtask queue flush. A couple of
  // ticks is enough to let the async storage.setItem finish.
  await new Promise((r) => setTimeout(r, 20));
}

// Reset idb + module graph between tests so each `import('../circuitStore')`
// returns a brand new store bound to the cleared in-memory IDB.
beforeEach(() => {
  memory.clear();
  vi.resetModules();
});

describe('circuitStore persist + temporal middleware order', () => {
  it('writes persisted state to (mocked) IndexedDB after addComponent', async () => {
    const { useCircuitStore } = await import('../circuitStore');
    useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    await waitForPersist();

    const raw = memory.get('omnispice-circuit');
    expect(raw, 'persist middleware did not write to idb-keyval').toBeDefined();

    const parsed = JSON.parse(raw ?? '{}');
    expect(parsed.state).toBeDefined();
    expect(parsed.state.circuit).toBeDefined();
    // The Map must serialize as a tagged sentinel, not an empty object.
    expect(parsed.state.circuit.components.__type).toBe('__$map$__');
    expect(parsed.state.circuit.components.entries.length).toBe(1);
  });

  it('rehydrates a fresh store instance from the persisted blob', async () => {
    // Seed memory via a first store instance.
    {
      const { useCircuitStore } = await import('../circuitStore');
      useCircuitStore.getState().addComponent('resistor', { x: 10, y: 20 });
      await waitForPersist();
    }

    // Reload modules — this simulates a page refresh.
    vi.resetModules();

    const { useCircuitStore: freshStore } = await import('../circuitStore');
    // Persist middleware rehydrates asynchronously on first access.
    await freshStore.persist.rehydrate?.();
    await waitForPersist();

    const state = freshStore.getState();
    expect(state.circuit.components).toBeInstanceOf(Map);
    expect(state.circuit.components.size).toBe(1);
    const comp = [...state.circuit.components.values()][0];
    expect(comp.type).toBe('resistor');
    expect(comp.position).toEqual({ x: 10, y: 20 });
    expect(comp.refDesignator).toBe('R1');
    expect(state.refCounters.R).toBe(1);
  });

  it('undo still works after persist wraps the store (temporal outside persist)', async () => {
    const { useCircuitStore } = await import('../circuitStore');
    useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    useCircuitStore.getState().addComponent('resistor', { x: 50, y: 0 });
    expect(useCircuitStore.getState().circuit.components.size).toBe(2);

    await useCircuitStore.temporal.getState().undo();
    expect(useCircuitStore.getState().circuit.components.size).toBe(1);

    await useCircuitStore.temporal.getState().undo();
    expect(useCircuitStore.getState().circuit.components.size).toBe(0);
  });

  it('redo works after undo with persist wrapping', async () => {
    const { useCircuitStore } = await import('../circuitStore');
    const id = useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    await useCircuitStore.temporal.getState().undo();
    expect(useCircuitStore.getState().circuit.components.size).toBe(0);

    await useCircuitStore.temporal.getState().redo();
    expect(useCircuitStore.getState().circuit.components.has(id)).toBe(true);
  });

  it('persisted blob contains circuit state but NOT the temporal undo stack', async () => {
    const { useCircuitStore } = await import('../circuitStore');
    useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    useCircuitStore.getState().addComponent('resistor', { x: 50, y: 0 });
    await waitForPersist();

    const parsed = JSON.parse(memory.get('omnispice-circuit') ?? '{}');
    expect(parsed.state).toBeDefined();
    // Circuit + refCounters ARE persisted.
    expect(parsed.state.circuit).toBeDefined();
    expect(parsed.state.refCounters).toBeDefined();
    // Temporal metadata must NOT leak into the persisted blob.
    expect(parsed.state.pastStates).toBeUndefined();
    expect(parsed.state.futureStates).toBeUndefined();
    expect(parsed.state._temporalStore).toBeUndefined();
  });
});
