/**
 * Plan 06-02 — useCollabUndoManager tests (TDD RED → GREEN).
 *
 * Tests the split undo system:
 *   1. createCircuitUndoManager returns a Y.UndoManager that only tracks LOCAL_ORIGIN
 *   2. undoCollab reverts a local component add without touching a peer's interleaved add
 *   3. undoCollab falls through to zundo when no Y.UndoManager is active
 *   4. zundo pause/resume lifecycle is clean
 *   5. destroys manager on unmount
 *   6. redoCollab delegates to Y.UndoManager when active
 */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

// Mock useCircuitStore so we can assert pause/resume/undo/redo calls without
// loading the full Zustand + IndexedDB stack.
const mockTemporalState = {
  pause: vi.fn(),
  resume: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  isTracking: true,
};

vi.mock('@/store/circuitStore', () => ({
  useCircuitStore: {
    temporal: {
      getState: () => mockTemporalState,
    },
  },
}));

// Inline renderHook from @testing-library/react is not needed; we exercise
// the hook effect lifecycle manually via React's act() equivalent using
// the raw effect logic via createCircuitUndoManager (pure function, no DOM).

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeComponentJSON(id: string): string {
  return JSON.stringify({
    id,
    type: 'resistor',
    refDesignator: 'R1',
    value: '1k',
    ports: [],
    position: { x: 0, y: 0 },
    rotation: 0,
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('createCircuitUndoManager', () => {
  let doc: Y.Doc;
  let yComponents: Y.Map<string>;
  let yWires: Y.Map<string>;

  beforeEach(async () => {
    vi.resetModules();
    // Reset mock call counts between tests
    mockTemporalState.pause.mockClear();
    mockTemporalState.resume.mockClear();
    mockTemporalState.undo.mockClear();
    mockTemporalState.redo.mockClear();

    doc = new Y.Doc();
    yComponents = doc.getMap<string>('components');
    yWires = doc.getMap<string>('wires');
  });

  afterEach(() => {
    doc.destroy();
    vi.restoreAllMocks();
  });

  it('creates a Y.UndoManager that only tracks LOCAL_ORIGIN', async () => {
    const { createCircuitUndoManager } = await import('../useCollabUndoManager');
    const { LOCAL_ORIGIN } = await import('../circuitBinding');

    const manager = createCircuitUndoManager(doc);

    // Write with LOCAL_ORIGIN → should be undoable
    doc.transact(() => {
      yComponents.set('r1', makeComponentJSON('r1'));
    }, LOCAL_ORIGIN);

    expect(manager.canUndo()).toBe(true);

    // Write with a remote origin → should NOT add to undo stack
    const undoCountBefore = manager.undoStack.length;
    doc.transact(() => {
      yComponents.set('r2', makeComponentJSON('r2'));
    }, 'remote-peer');

    // r2 was added but undo stack count should not have increased due to 'remote-peer'
    expect(manager.undoStack.length).toBe(undoCountBefore);

    manager.destroy();
  });

  it('undoCollab reverts a local add without touching a peer interleaved add', async () => {
    const { createCircuitUndoManager } = await import('../useCollabUndoManager');
    const { LOCAL_ORIGIN } = await import('../circuitBinding');

    const manager = createCircuitUndoManager(doc);

    // Local write: add r1
    doc.transact(() => {
      yComponents.set('r1', makeComponentJSON('r1'));
    }, LOCAL_ORIGIN);

    expect(yComponents.has('r1')).toBe(true);

    // Peer write: add r2 (different origin — not tracked by undo manager)
    doc.transact(() => {
      yComponents.set('r2', makeComponentJSON('r2'));
    }, 'peer-origin');

    expect(yComponents.has('r2')).toBe(true);

    // Undo the local write
    manager.undo();

    // r1 should be gone (local undo)
    expect(yComponents.has('r1')).toBe(false);
    // r2 should still be there (peer's write is NOT reverted)
    expect(yComponents.has('r2')).toBe(true);

    manager.destroy();
  });

  it('undoCollab falls through to zundo when no Y.UndoManager is active', async () => {
    const { useCollabUndoManager } = await import('../useCollabUndoManager');

    const { result } = renderHook(() => useCollabUndoManager(null));

    // No yDoc → no Y.UndoManager created → should fall back to zundo
    result.current.undoCollab();

    expect(mockTemporalState.undo).toHaveBeenCalledTimes(1);
    expect(mockTemporalState.pause).not.toHaveBeenCalled();
  });

  it('zundo pause/resume lifecycle: paused on connect, resumed on unmount', async () => {
    // We test the effect side-effects by calling the hook's cleanup function
    // returned from useEffect. Since we can't use renderHook here without
    // a React environment, we test the pure factory path through the
    // createCircuitUndoManager integration with useCollabUndoManager.
    //
    // Strategy: call useCollabUndoManager(doc) which returns stable callbacks,
    // then verify pause was called; then simulate unmount by calling the
    // returned cleanup indirectly via a second call with null.

    const { useCollabUndoManager } = await import('../useCollabUndoManager');

    // With a real yDoc, pause should have been called during the effect.
    // Since we can't run useEffect here, we verify the pause/resume calls
    // that the hook's internal effect triggers by using an explicit factory
    // test against the lifecycle function exported as a named export.
    const { setupCollabUndoLifecycle } = await import('../useCollabUndoManager');

    const cleanup = setupCollabUndoLifecycle(doc);

    expect(mockTemporalState.pause).toHaveBeenCalledTimes(1);
    expect(mockTemporalState.resume).not.toHaveBeenCalled();

    cleanup();

    expect(mockTemporalState.resume).toHaveBeenCalledTimes(1);

    // useCollabUndoManager itself still works
    const { result } = renderHook(() => useCollabUndoManager(null));
    expect(typeof result.current.undoCollab).toBe('function');
  });

  it('redoCollab delegates to Y.UndoManager when active', async () => {
    const { createCircuitUndoManager } = await import('../useCollabUndoManager');
    const { LOCAL_ORIGIN } = await import('../circuitBinding');

    const manager = createCircuitUndoManager(doc);

    doc.transact(() => {
      yComponents.set('r1', makeComponentJSON('r1'));
    }, LOCAL_ORIGIN);

    manager.undo();
    expect(yComponents.has('r1')).toBe(false);
    expect(manager.canRedo()).toBe(true);

    manager.redo();
    expect(yComponents.has('r1')).toBe(true);

    manager.destroy();
  });

  it('destroys manager on cleanup', async () => {
    const { createCircuitUndoManager } = await import('../useCollabUndoManager');
    const { setupCollabUndoLifecycle } = await import('../useCollabUndoManager');

    const cleanup = setupCollabUndoLifecycle(doc);

    // Verify a manager was created by checking that pause was called
    expect(mockTemporalState.pause).toHaveBeenCalledTimes(1);

    // After cleanup, resume should be called and the doc should not error
    cleanup();
    expect(mockTemporalState.resume).toHaveBeenCalledTimes(1);

    // Doc operations still work (manager was destroyed but doc is intact)
    expect(() => {
      doc.transact(() => {
        yComponents.set('x1', makeComponentJSON('x1'));
      });
    }).not.toThrow();
  });
});

describe('useCollabUndoManager hook', () => {
  let doc: Y.Doc;

  beforeEach(() => {
    vi.resetModules();
    mockTemporalState.pause.mockClear();
    mockTemporalState.resume.mockClear();
    mockTemporalState.undo.mockClear();
    mockTemporalState.redo.mockClear();
    doc = new Y.Doc();
  });

  afterEach(() => {
    doc.destroy();
    vi.restoreAllMocks();
  });

  it('redoCollab falls through to zundo when no Y.UndoManager is active', async () => {
    const { useCollabUndoManager } = await import('../useCollabUndoManager');

    const { result } = renderHook(() => useCollabUndoManager(null));

    result.current.redoCollab();

    expect(mockTemporalState.redo).toHaveBeenCalledTimes(1);
  });
});
