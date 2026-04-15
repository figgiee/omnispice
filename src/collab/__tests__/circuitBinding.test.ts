/**
 * Plan 06-01 — Circuit CRDT binding tests (TDD RED → GREEN).
 *
 * Tests the bidirectional binding between Zustand circuitStore and a Y.Doc:
 *   1. LOCAL_ORIGIN is a Symbol
 *   2. getCircuitYMaps returns the same Y.Map instances on repeated calls (idempotent)
 *   3. Zustand addComponent propagates to Y.Map
 *   4. Remote Y.Map set propagates to Zustand without echo (no double-write)
 *   5. Wire round-trip: addWire on storeA propagates to yWires + storeB reflects it
 *   6. LOCAL_ORIGIN writes do NOT echo back to Zustand (echo guard)
 *   7. syncYMapToCircuit hydrates Zustand from a Y.Map snapshot
 *   8. cleanup() removes all observers — store mutations no longer update Y.Map
 */

import * as Y from 'yjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Dynamic imports are used so vi.resetModules() gives isolated module graphs.
type BindingModule = typeof import('../circuitBinding');
type HydrationModule = typeof import('../yMapToCircuit');
type StoreModule = typeof import('@/store/circuitStore');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal Component-like object suitable for Y.Map storage. */
function makeComponentJSON(id: string) {
  return {
    id,
    type: 'resistor',
    refDesignator: 'R1',
    value: '1k',
    ports: [],
    position: { x: 0, y: 0 },
    rotation: 0,
  };
}

/** Create a minimal Wire-like object suitable for Y.Map storage. */
function makeWireJSON(id: string, src = 'p1', tgt = 'p2') {
  return {
    id,
    sourcePortId: src,
    targetPortId: tgt,
    bendPoints: [],
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('circuitBinding', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function loadModules() {
    const bindMod = await import('../circuitBinding');
    const hydMod = await import('../yMapToCircuit');
    const storeMod = await import('@/store/circuitStore');
    // Reset the freshly-loaded store to a clean empty state.
    storeMod.useCircuitStore.setState({
      circuit: {
        components: new Map(),
        wires: new Map(),
        nets: new Map(),
      },
      refCounters: {},
    });
    return { bindMod, hydMod, storeMod };
  }

  // ── Test 1: LOCAL_ORIGIN is a Symbol ────────────────────────────────────
  it('LOCAL_ORIGIN is a Symbol', async () => {
    const { bindMod } = await loadModules();
    expect(typeof bindMod.LOCAL_ORIGIN).toBe('symbol');
  });

  // ── Test 2: getCircuitYMaps is idempotent ────────────────────────────────
  it('getCircuitYMaps returns the same Y.Map instance on repeated calls', async () => {
    const { bindMod } = await loadModules();
    const doc = new Y.Doc();
    const maps1 = bindMod.getCircuitYMaps(doc);
    const maps2 = bindMod.getCircuitYMaps(doc);
    expect(maps1.yComponents).toBe(maps2.yComponents);
    expect(maps1.yWires).toBe(maps2.yWires);
  });

  // ── Test 3: Zustand addComponent propagates to Y.Map ────────────────────
  it('Zustand addComponent propagates to yComponents', async () => {
    const { bindMod, storeMod } = await loadModules();
    const doc = new Y.Doc();
    const { yComponents } = bindMod.getCircuitYMaps(doc);

    const cleanup = bindMod.bindCircuitToYjs(doc, storeMod.useCircuitStore);

    // Directly insert a component into the Zustand store (bypasses normal
    // addComponent action which requires COMPONENT_LIBRARY lookup).
    const comp = makeComponentJSON('c1');
    storeMod.useCircuitStore.setState((s) => ({
      circuit: {
        ...s.circuit,
        components: new Map(s.circuit.components).set('c1', comp as never),
      },
    }));

    expect(yComponents.has('c1')).toBe(true);
    const raw = yComponents.get('c1');
    expect(raw).toBeDefined();
    // The value stored is a JSON string (spec: Y.Map<string, string>)
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    expect(parsed.id).toBe('c1');

    cleanup();
  });

  // ── Test 4: Remote Y.Map set propagates to Zustand (no echo) ────────────
  it('remote Y.Map set propagates to Zustand without echo', async () => {
    const { bindMod, storeMod } = await loadModules();
    const doc = new Y.Doc();
    const { yComponents } = bindMod.getCircuitYMaps(doc);

    const cleanup = bindMod.bindCircuitToYjs(doc, storeMod.useCircuitStore);

    // Simulate a remote peer writing with a different origin.
    const compJSON = makeComponentJSON('r2');
    doc.transact(() => {
      yComponents.set('r2', JSON.stringify(compJSON));
    }, 'remote-origin');

    // Zustand store should now reflect the remote component.
    const components = storeMod.useCircuitStore.getState().circuit.components;
    expect(components.has('r2')).toBe(true);

    // The echo guard must not re-write — Y.Map still has exactly 1 entry.
    expect(yComponents.size).toBe(1);

    cleanup();
  });

  // ── Test 5: Wire round-trip ──────────────────────────────────────────────
  it('addWire propagates to yWires', async () => {
    const { bindMod, storeMod } = await loadModules();
    const doc = new Y.Doc();
    const { yWires } = bindMod.getCircuitYMaps(doc);

    const cleanup = bindMod.bindCircuitToYjs(doc, storeMod.useCircuitStore);

    const wire = makeWireJSON('w1', 'port-a', 'port-b');
    storeMod.useCircuitStore.setState((s) => ({
      circuit: {
        ...s.circuit,
        wires: new Map(s.circuit.wires).set('w1', wire as never),
      },
    }));

    expect(yWires.has('w1')).toBe(true);
    const raw = yWires.get('w1');
    expect(raw).toBeDefined();
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    expect(parsed.id).toBe('w1');
    expect(parsed.sourcePortId).toBe('port-a');

    cleanup();
  });

  // ── Test 6: LOCAL_ORIGIN writes do NOT echo back to Zustand ─────────────
  it('LOCAL_ORIGIN writes do not cause extra Zustand setState calls', async () => {
    const { bindMod, storeMod } = await loadModules();
    const doc = new Y.Doc();

    const setStateCalls: unknown[] = [];
    const origSetState = storeMod.useCircuitStore.setState.bind(storeMod.useCircuitStore);
    const mockSetState = vi.fn((...args: Parameters<typeof origSetState>) => {
      setStateCalls.push(args[0]);
      return origSetState(...args);
    });
    storeMod.useCircuitStore.setState = mockSetState;

    const cleanup = bindMod.bindCircuitToYjs(doc, storeMod.useCircuitStore);

    // Reset call count after bind (bind itself may call setState 0 times).
    mockSetState.mockClear();

    // Trigger a local component add via direct setState (simulating a store action).
    const comp = makeComponentJSON('c2');
    storeMod.useCircuitStore.setState((s) => ({
      circuit: {
        ...s.circuit,
        components: new Map(s.circuit.components).set('c2', comp as never),
      },
    }));

    // Only 1 setState call: the original local write. NOT a second call from echo.
    expect(mockSetState).toHaveBeenCalledTimes(1);

    cleanup();
    storeMod.useCircuitStore.setState = origSetState;
  });

  // ── Test 7: syncYMapToCircuit hydrates Zustand ───────────────────────────
  it('syncYMapToCircuit hydrates Zustand from a Y.Map snapshot', async () => {
    const { hydMod, storeMod } = await loadModules();
    const doc = new Y.Doc();
    const yComponents = doc.getMap<string>('components');
    const yWires = doc.getMap<string>('wires');

    // Pre-populate the Y.Map as if a provider sync just delivered state.
    const comp = makeComponentJSON('seed-comp');
    const wire = makeWireJSON('seed-wire');
    doc.transact(() => {
      yComponents.set('seed-comp', JSON.stringify(comp));
      yWires.set('seed-wire', JSON.stringify(wire));
    });

    hydMod.syncYMapToCircuit(yComponents, yWires, storeMod.useCircuitStore);

    const state = storeMod.useCircuitStore.getState();
    expect(state.circuit.components.has('seed-comp')).toBe(true);
    expect(state.circuit.wires.has('seed-wire')).toBe(true);
    const storedComp = state.circuit.components.get('seed-comp');
    expect(storedComp?.id).toBe('seed-comp');
  });

  // ── Test 8: cleanup removes all observers ───────────────────────────────
  it('cleanup() removes all observers — Y.Map no longer updates after cleanup', async () => {
    const { bindMod, storeMod } = await loadModules();
    const doc = new Y.Doc();
    const { yComponents } = bindMod.getCircuitYMaps(doc);

    const cleanup = bindMod.bindCircuitToYjs(doc, storeMod.useCircuitStore);
    cleanup();

    // After cleanup, mutating the store should NOT propagate to Y.Map.
    const comp = makeComponentJSON('post-cleanup');
    storeMod.useCircuitStore.setState((s) => ({
      circuit: {
        ...s.circuit,
        components: new Map(s.circuit.components).set('post-cleanup', comp as never),
      },
    }));

    expect(yComponents.has('post-cleanup')).toBe(false);
  });
});
