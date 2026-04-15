/**
 * Plan 05-05 — Pointer Lock based parameter scrubber gesture.
 *
 * The hook turns a DOM element into a horizontal scrubber:
 *
 *   - `onPointerDown`: requests pointer lock on the target and enters
 *     `scrubbing` mode. If `shiftKey` was held AND `shiftForSweep` is set,
 *     enters `sweeping` mode instead.
 *   - While locked, `pointermove` deltas accumulate into a virtual cursor
 *     position and call `onChange(startValue + delta * step)`. Sweep mode
 *     additionally tracks running min/max.
 *   - `pointerup` exits pointer lock, emits `omnispice:scrub-committed`
 *     (consumed by the Plan 05-04 simulation orchestrator to fire a
 *     transient re-run), and — in sweep mode — calls `onSweepCommit` with
 *     the final {min, max} range.
 *   - `Escape` during a scrub cancels the gesture and reverts the value
 *     via `onChange(startValue)`. It intentionally does NOT dispatch the
 *     committed event (no transient replay on cancel).
 *
 * The hook never mutates any store directly. Parameter state lives in
 * `circuitStore`; the chip consumer is responsible for wiring
 * `onChange` → `updateComponentValue`.
 *
 * **jsdom caveat:** `requestPointerLock()` is a no-op in jsdom. Tests stub
 * it and manually pin `document.pointerLockElement` so the pointermove
 * guard passes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type ScrubMode = 'idle' | 'scrubbing' | 'sweeping';

export interface ScrubOptions {
  /** Component ID — emitted on the commit CustomEvent for orchestrator routing. */
  componentId: string;
  /** Starting numeric value at pointer-down. */
  initialValue: number;
  /** Units per pixel of horizontal movement. */
  step: number;
  /** Called on every move with the new value. */
  onChange: (next: number) => void;
  /** Called when a sweep gesture releases, with the final {min, max} range. */
  onSweepCommit?: (range: { min: number; max: number }) => void;
  /** Whether holding Shift at pointer-down activates sweep mode. */
  shiftForSweep?: boolean;
}

export interface ScrubHandle {
  mode: ScrubMode;
  onPointerDown: (e: React.PointerEvent) => void;
}

export const SCRUB_COMMITTED_EVENT = 'omnispice:scrub-committed';

export function useParameterScrub(opts: ScrubOptions): ScrubHandle {
  const [mode, setMode] = useState<ScrubMode>('idle');

  // Mutable running state for the duration of a single scrub gesture.
  const stateRef = useRef({
    startValue: 0,
    deltaX: 0,
    minValue: 0,
    maxValue: 0,
  });

  // Keep the latest `opts` in a ref so the effect below can always call
  // the freshest `onChange` / `onSweepCommit` without re-attaching listeners
  // every render (which would drop in-flight pointermove events).
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const current = optsRef.current;
    stateRef.current = {
      startValue: current.initialValue,
      deltaX: 0,
      minValue: current.initialValue,
      maxValue: current.initialValue,
    };

    const target = e.currentTarget as HTMLElement;
    // Pointer Lock API is feature-detected; Safari < 17 ships a prefixed
    // variant but we only target evergreen browsers (RESEARCH §8.1).
    target.requestPointerLock?.();

    const next: ScrubMode = e.shiftKey && current.shiftForSweep ? 'sweeping' : 'scrubbing';
    setMode(next);
  }, []);

  useEffect(() => {
    if (mode === 'idle') return;

    const onMove = (e: PointerEvent) => {
      // Only act while pointer lock is held — otherwise we'd keep scrubbing
      // if the browser silently exited lock (tab blur, user Escape outside
      // our keydown handler, etc).
      if (!document.pointerLockElement) return;

      stateRef.current.deltaX += e.movementX;
      const newValue =
        stateRef.current.startValue + stateRef.current.deltaX * optsRef.current.step;

      if (mode === 'sweeping') {
        stateRef.current.minValue = Math.min(stateRef.current.minValue, newValue);
        stateRef.current.maxValue = Math.max(stateRef.current.maxValue, newValue);
      }

      optsRef.current.onChange(newValue);
    };

    const onUp = () => {
      document.exitPointerLock?.();

      if (mode === 'sweeping' && optsRef.current.onSweepCommit) {
        optsRef.current.onSweepCommit({
          min: stateRef.current.minValue,
          max: stateRef.current.maxValue,
        });
      }

      setMode('idle');

      // Notify the Plan 05-04 orchestrator — it runs transient on this event.
      window.dispatchEvent(
        new CustomEvent(SCRUB_COMMITTED_EVENT, {
          detail: { componentId: optsRef.current.componentId },
        }),
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      document.exitPointerLock?.();
      // Revert to the start value — NO committed event fires on cancel.
      optsRef.current.onChange(stateRef.current.startValue);
      setMode('idle');
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [mode]);

  return { mode, onPointerDown };
}
