/**
 * Plan 06-02 — Split undo system: Y.UndoManager for collab sessions,
 * zundo temporal middleware for offline/solo sessions.
 *
 * Exports:
 *   createCircuitUndoManager  — Pure factory: creates a Y.UndoManager that
 *                               only tracks LOCAL_ORIGIN writes on the two
 *                               circuit Y.Maps. Caller owns the lifecycle.
 *
 *   setupCollabUndoLifecycle  — Imperative lifecycle function: creates the
 *                               Y.UndoManager, pauses zundo, and returns a
 *                               cleanup function that destroys the manager
 *                               and resumes zundo. Extracted for testability.
 *
 *   useCollabUndoManager      — React hook wrapping setupCollabUndoLifecycle
 *                               in a useEffect. Exposes undoCollab/redoCollab
 *                               that delegate to Y.UndoManager when collab is
 *                               active and fall back to zundo when offline.
 *
 * Architecture:
 *   - During a collab session (yDoc non-null):
 *       Y.UndoManager tracks { trackedOrigins: new Set([LOCAL_ORIGIN]) }
 *       so Ctrl+Z only reverts the local user's edits. Peer edits (tagged
 *       with any other origin or undefined) are never placed on the local
 *       undo stack.
 *   - zundo temporal middleware is paused while collab is active to avoid
 *       double-capture of state snapshots.
 *   - On collab disconnect / unmount: Y.UndoManager is destroyed and zundo
 *       resumes normal snapshot recording.
 *   - When yDoc is null (offline/solo mode): undoCollab / redoCollab
 *       delegate directly to zundo.
 */

import { useCallback, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { useCircuitStore } from '@/store/circuitStore';
import { getCircuitYMaps, LOCAL_ORIGIN } from './circuitBinding';

// ---------------------------------------------------------------------------
// Pure factory — no React, no lifecycle management
// ---------------------------------------------------------------------------

/**
 * Creates a `Y.UndoManager` that tracks only `LOCAL_ORIGIN` transactions on
 * the `components` and `wires` Y.Maps inside `yDoc`.
 *
 * The manager is configured with a 300 ms capture timeout so rapid edits
 * (e.g. drag + value-change) are grouped into a single undo step.
 *
 * Caller is responsible for calling `manager.destroy()` when done.
 */
export function createCircuitUndoManager(yDoc: Y.Doc): Y.UndoManager {
  const { yComponents, yWires } = getCircuitYMaps(yDoc);

  return new Y.UndoManager([yComponents, yWires], {
    trackedOrigins: new Set([LOCAL_ORIGIN]),
    captureTimeout: 300,
  });
}

// ---------------------------------------------------------------------------
// Imperative lifecycle (extracted so tests can call it without React)
// ---------------------------------------------------------------------------

/**
 * Sets up the collab undo lifecycle for a Y.Doc:
 *   1. Pauses zundo temporal so it doesn't snapshot-record during collab.
 *   2. Creates a Y.UndoManager tracking only LOCAL_ORIGIN writes.
 *   3. Returns a cleanup function that destroys the manager and resumes zundo.
 *
 * This is the testable core of `useCollabUndoManager`'s useEffect body.
 */
export function setupCollabUndoLifecycle(yDoc: Y.Doc): () => void {
  // Pause zundo — Y.UndoManager owns undo semantics while collab is active.
  useCircuitStore.temporal.getState().pause();

  const manager = createCircuitUndoManager(yDoc);

  return () => {
    manager.destroy();
    useCircuitStore.temporal.getState().resume();
  };
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * React hook that manages the Y.UndoManager lifecycle tied to a Y.Doc.
 *
 * When `yDoc` is non-null (collab session active):
 *   - Pauses zundo temporal history recording.
 *   - Creates a Y.UndoManager scoped to LOCAL_ORIGIN writes only.
 *   - Exposes `undoCollab` / `redoCollab` that delegate to Y.UndoManager.
 *
 * When `yDoc` is null (offline / solo mode):
 *   - `undoCollab` / `redoCollab` fall through to zundo.
 *
 * On cleanup (yDoc becomes null or component unmounts):
 *   - Y.UndoManager is destroyed.
 *   - zundo temporal recording resumes.
 *
 * @param yDoc - Active Y.Doc from the collab provider, or null when offline.
 */
export function useCollabUndoManager(yDoc: Y.Doc | null) {
  const managerRef = useRef<Y.UndoManager | null>(null);

  useEffect(() => {
    if (!yDoc) {
      managerRef.current = null;
      return;
    }

    useCircuitStore.temporal.getState().pause();

    const manager = createCircuitUndoManager(yDoc);
    managerRef.current = manager;

    return () => {
      manager.destroy();
      managerRef.current = null;
      useCircuitStore.temporal.getState().resume();
    };
  }, [yDoc]);

  const undoCollab = useCallback(() => {
    const m = managerRef.current;
    if (m?.canUndo()) {
      m.undo();
    } else {
      useCircuitStore.temporal.getState().undo();
    }
  }, []);

  const redoCollab = useCallback(() => {
    const m = managerRef.current;
    if (m?.canRedo()) {
      m.redo();
    } else {
      useCircuitStore.temporal.getState().redo();
    }
  }, []);

  const canUndo = useCallback(() => managerRef.current?.canUndo() ?? false, []);

  const canRedo = useCallback(() => managerRef.current?.canRedo() ?? false, []);

  return { undoCollab, redoCollab, canUndo, canRedo };
}
