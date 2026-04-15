/**
 * Plan 05-05 Task 1 — useParameterScrub behavior tests (TDD RED → GREEN).
 *
 * jsdom doesn't implement the Pointer Lock API. We stub
 * `Element.prototype.requestPointerLock`, `document.exitPointerLock`, and
 * manually pin `document.pointerLockElement` so the hook's move-listener
 * guard passes inside tests.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useParameterScrub } from '../useParameterScrub';

function pointerEvent(
  type: string,
  init: { movementX?: number; shiftKey?: boolean } = {},
): PointerEvent {
  // jsdom's PointerEvent constructor forwards unknown fields, but
  // `movementX` is read via the DOM interface — dispatch a plain Event
  // with assigned fields instead.
  const ev = new Event(type, { bubbles: true }) as unknown as PointerEvent;
  Object.defineProperty(ev, 'movementX', { value: init.movementX ?? 0 });
  Object.defineProperty(ev, 'shiftKey', { value: init.shiftKey ?? false });
  return ev;
}

let pointerLockTarget: Element | null = null;

beforeEach(() => {
  pointerLockTarget = null;
  // Stub the Pointer Lock API on Element and Document.
  Object.defineProperty(Element.prototype, 'requestPointerLock', {
    value: function requestPointerLock() {
      pointerLockTarget = this;
      Object.defineProperty(document, 'pointerLockElement', {
        value: pointerLockTarget,
        configurable: true,
      });
    },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(document, 'exitPointerLock', {
    value: () => {
      pointerLockTarget = null;
      Object.defineProperty(document, 'pointerLockElement', {
        value: null,
        configurable: true,
      });
    },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(document, 'pointerLockElement', {
    value: null,
    configurable: true,
  });
});

afterEach(() => {
  // Clean up any orphan listeners / pointer lock state between tests.
  pointerLockTarget = null;
});

/** Fire a React-style pointerdown through the hook's returned handler. */
function firePointerDown(
  handler: (e: React.PointerEvent) => void,
  init: { shiftKey?: boolean } = {},
) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const reactEvent = {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    currentTarget: target,
    shiftKey: init.shiftKey ?? false,
  } as unknown as React.PointerEvent;
  act(() => {
    handler(reactEvent);
  });
  return target;
}

describe('useParameterScrub (Plan 05-05)', () => {
  it('starts in idle mode', () => {
    const { result } = renderHook(() =>
      useParameterScrub({
        componentId: 'r1',
        initialValue: 1000,
        step: 1,
        onChange: vi.fn(),
      }),
    );
    expect(result.current.mode).toBe('idle');
  });

  it('enters scrubbing mode on pointer-down', () => {
    const { result } = renderHook(() =>
      useParameterScrub({
        componentId: 'r1',
        initialValue: 1000,
        step: 1,
        onChange: vi.fn(),
      }),
    );
    firePointerDown(result.current.onPointerDown);
    expect(result.current.mode).toBe('scrubbing');
  });

  it('enters sweeping mode on shift + pointer-down when shiftForSweep is true', () => {
    const { result } = renderHook(() =>
      useParameterScrub({
        componentId: 'r1',
        initialValue: 1000,
        step: 1,
        shiftForSweep: true,
        onChange: vi.fn(),
      }),
    );
    firePointerDown(result.current.onPointerDown, { shiftKey: true });
    expect(result.current.mode).toBe('sweeping');
  });

  it('accumulates movementX and calls onChange with startValue + delta*step', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useParameterScrub({
        componentId: 'r1',
        initialValue: 100,
        step: 2,
        onChange,
      }),
    );
    firePointerDown(result.current.onPointerDown);

    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', { movementX: 3 }));
      window.dispatchEvent(pointerEvent('pointermove', { movementX: 2 }));
    });

    // Two moves: +3 → 100 + 3*2 = 106, then +2 → 100 + 5*2 = 110
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 106);
    expect(onChange).toHaveBeenNthCalledWith(2, 110);
  });

  it('dispatches omnispice:scrub-committed on pointer-up with componentId detail', () => {
    const spy = vi.fn();
    const listener = (e: Event) => spy(e);
    window.addEventListener('omnispice:scrub-committed', listener);

    const { result } = renderHook(() =>
      useParameterScrub({
        componentId: 'resistor-1',
        initialValue: 50,
        step: 1,
        onChange: vi.fn(),
      }),
    );
    firePointerDown(result.current.onPointerDown);

    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', { movementX: 5 }));
      window.dispatchEvent(pointerEvent('pointerup'));
    });

    expect(spy).toHaveBeenCalledOnce();
    const ev = spy.mock.calls[0]?.[0] as CustomEvent<{ componentId: string }>;
    expect(ev.detail.componentId).toBe('resistor-1');
    expect(result.current.mode).toBe('idle');

    window.removeEventListener('omnispice:scrub-committed', listener);
  });

  it('Escape cancels the scrub and reverts onChange to startValue', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useParameterScrub({
        componentId: 'r1',
        initialValue: 200,
        step: 1,
        onChange,
      }),
    );
    firePointerDown(result.current.onPointerDown);

    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', { movementX: 10 }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    // Last onChange call must revert to the starting value.
    expect(onChange.mock.calls.at(-1)?.[0]).toBe(200);
    expect(result.current.mode).toBe('idle');
  });

  it('onSweepCommit receives final {min,max} range on sweep release', () => {
    const onSweepCommit = vi.fn();
    const { result } = renderHook(() =>
      useParameterScrub({
        componentId: 'r1',
        initialValue: 100,
        step: 2,
        shiftForSweep: true,
        onChange: vi.fn(),
        onSweepCommit,
      }),
    );
    firePointerDown(result.current.onPointerDown, { shiftKey: true });

    act(() => {
      // Move right: delta=+3 → 106 (max)
      window.dispatchEvent(pointerEvent('pointermove', { movementX: 3 }));
      // Move left: delta=-8 → 100 + (-5)*2 = 90 (min)
      window.dispatchEvent(pointerEvent('pointermove', { movementX: -8 }));
      window.dispatchEvent(pointerEvent('pointerup'));
    });

    expect(onSweepCommit).toHaveBeenCalledOnce();
    const range = onSweepCommit.mock.calls[0]?.[0];
    expect(range.min).toBe(90);
    expect(range.max).toBe(106);
  });
});
