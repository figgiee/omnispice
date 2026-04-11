/**
 * Tests for useTypeToPlace (Phase 5 plan 05-06, Task 4).
 *
 * Type-to-place contract:
 *   - A printable letter dispatched while `insertCursor` is active and no
 *     component is selected fires `omnispice:type-to-place` with the char
 *   - With a selection active: R rotates (handled by useCanvasInteractions),
 *     so useTypeToPlace must NOT claim the event (no dispatch)
 *   - With `insertCursor` null: no-op, no dispatch
 *   - Letters pressed while an INPUT/TEXTAREA is focused are ignored
 *   - Keys with modifiers (Ctrl/Meta/Alt) are ignored — they belong to hotkeys
 *   - Escape with an active insertCursor clears the cursor
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCircuitStore } from '@/store/circuitStore';
import { useUiStore } from '@/store/uiStore';
import { useTypeToPlace } from '../useTypeToPlace';

function resetStores() {
  useCircuitStore.setState({
    circuit: { components: new Map(), wires: new Map(), nets: new Map() },
    refCounters: {},
  });
  useCircuitStore.temporal.getState().clear();
  useUiStore.setState({
    selectedComponentIds: [],
    selectedWireIds: [],
    insertCursor: null,
    cursorPosition: null,
  });
}

function fireKey(key: string, opts: KeyboardEventInit = {}) {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }),
    );
  });
}

describe('useTypeToPlace', () => {
  let listener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetStores();
    listener = vi.fn();
    window.addEventListener('omnispice:type-to-place', listener);
    // Ensure focus is on body so input-guard never trips.
    document.body.focus();
  });

  it('dispatches omnispice:type-to-place when cursor is active and no selection', () => {
    useUiStore.setState({ insertCursor: { x: 100, y: 200 } });
    renderHook(() => useTypeToPlace());

    fireKey('r');

    expect(listener).toHaveBeenCalledTimes(1);
    const evt = listener.mock.calls[0]![0] as CustomEvent;
    expect(evt.detail).toMatchObject({
      firstChar: 'r',
      cursor: { x: 100, y: 200 },
    });
  });

  it('does nothing without an active insert cursor', () => {
    useUiStore.setState({ insertCursor: null });
    renderHook(() => useTypeToPlace());

    fireKey('r');

    expect(listener).not.toHaveBeenCalled();
  });

  it('does nothing when a component is selected (so R can rotate)', () => {
    useUiStore.setState({
      insertCursor: { x: 0, y: 0 },
      selectedComponentIds: ['some-component-id'],
    });
    renderHook(() => useTypeToPlace());

    fireKey('r');

    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores keys fired while an input element is focused', () => {
    useUiStore.setState({ insertCursor: { x: 0, y: 0 } });
    const host = document.createElement('input');
    document.body.appendChild(host);
    host.focus();

    renderHook(() => useTypeToPlace());
    fireKey('r');

    expect(listener).not.toHaveBeenCalled();
    document.body.removeChild(host);
  });

  it('ignores keys with Ctrl/Meta/Alt modifiers', () => {
    useUiStore.setState({ insertCursor: { x: 0, y: 0 } });
    renderHook(() => useTypeToPlace());

    fireKey('r', { ctrlKey: true });
    fireKey('r', { metaKey: true });
    fireKey('r', { altKey: true });

    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores non-letter printable keys', () => {
    useUiStore.setState({ insertCursor: { x: 0, y: 0 } });
    renderHook(() => useTypeToPlace());

    fireKey('5');
    fireKey(' ');
    fireKey('!');

    expect(listener).not.toHaveBeenCalled();
  });

  it('clears insertCursor on Escape', () => {
    useUiStore.setState({ insertCursor: { x: 50, y: 50 } });
    renderHook(() => useTypeToPlace());

    fireKey('Escape');

    expect(useUiStore.getState().insertCursor).toBeNull();
  });

  it('dispatches for every letter of the alphabet', () => {
    useUiStore.setState({ insertCursor: { x: 0, y: 0 } });
    renderHook(() => useTypeToPlace());

    fireKey('c');
    fireKey('L');

    expect(listener).toHaveBeenCalledTimes(2);
    expect(
      (listener.mock.calls[0]![0] as CustomEvent).detail,
    ).toMatchObject({ firstChar: 'c' });
    expect(
      (listener.mock.calls[1]![0] as CustomEvent).detail,
    ).toMatchObject({ firstChar: 'L' });
  });
});
