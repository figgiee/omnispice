/**
 * Plan 05-02 Task 4 — uiStore net label capture state machine.
 *
 * Unit-level coverage of begin/append/backspace/cancel/consume. The keyboard
 * dispatcher (useNetLabelInput) is verified end-to-end in the Playwright
 * spec tests/e2e/phase5/pin-types-and-nets.spec.ts.
 *
 * Plan 05-11 — changeCalloutQueue TTL state machine.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '../uiStore';

describe('uiStore — changeCalloutQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUiStore.getState().clearAllCallouts();
  });
  afterEach(() => {
    vi.useRealTimers();
    useUiStore.getState().clearAllCallouts();
  });

  it('enqueues a callout with a generated id and expiry 780ms from now', () => {
    const now = 1_000_000;
    vi.setSystemTime(now);
    useUiStore.getState().enqueueChangeCallout({
      icon: '+',
      text: 'Added R1',
      anchor: { componentId: 'comp-1' },
    });
    const queue = useUiStore.getState().changeCalloutQueue;
    expect(queue).toHaveLength(1);
    const [first] = queue;
    expect(first).toBeDefined();
    if (!first) return;
    expect(first.icon).toBe('+');
    expect(first.text).toBe('Added R1');
    expect(first.id).toBeTruthy();
    expect(first.addedAt).toBe(now);
    expect(first.expiresAt).toBe(now + 780);
    expect(first.anchor.componentId).toBe('comp-1');
  });

  it('expires callouts whose expiresAt is past', () => {
    vi.setSystemTime(1_000_000);
    useUiStore.getState().enqueueChangeCallout({
      icon: '+',
      text: 'Added R1',
      anchor: {},
    });
    expect(useUiStore.getState().changeCalloutQueue).toHaveLength(1);

    vi.setSystemTime(1_000_000 + 800);
    useUiStore.getState().expireCallouts();
    expect(useUiStore.getState().changeCalloutQueue).toHaveLength(0);
  });

  it('does not expire callouts that are still within their TTL', () => {
    vi.setSystemTime(1_000_000);
    useUiStore.getState().enqueueChangeCallout({
      icon: '−',
      text: 'Deleted R1',
      anchor: { lastPosition: { x: 10, y: 20 } },
    });

    vi.setSystemTime(1_000_000 + 400);
    useUiStore.getState().expireCallouts();
    expect(useUiStore.getState().changeCalloutQueue).toHaveLength(1);
  });

  it('handles multiple callouts in the queue with independent TTLs', () => {
    vi.setSystemTime(1_000_000);
    useUiStore.getState().enqueueChangeCallout({ icon: '+', text: 'Added R1', anchor: {} });

    vi.setSystemTime(1_000_000 + 500);
    useUiStore.getState().enqueueChangeCallout({ icon: '↻', text: 'Rotated R2', anchor: {} });

    // Advance past first callout's expiry but not second's
    vi.setSystemTime(1_000_000 + 850);
    useUiStore.getState().expireCallouts();
    const queue = useUiStore.getState().changeCalloutQueue;
    expect(queue).toHaveLength(1);
    const [remaining] = queue;
    expect(remaining).toBeDefined();
    if (!remaining) return;
    expect(remaining.text).toBe('Rotated R2');
  });

  it('clearAllCallouts empties the queue', () => {
    vi.setSystemTime(1_000_000);
    useUiStore.getState().enqueueChangeCallout({ icon: '+', text: 'Added R1', anchor: {} });
    useUiStore.getState().enqueueChangeCallout({ icon: '−', text: 'Deleted R2', anchor: {} });
    expect(useUiStore.getState().changeCalloutQueue).toHaveLength(2);

    useUiStore.getState().clearAllCallouts();
    expect(useUiStore.getState().changeCalloutQueue).toHaveLength(0);
  });

  it('stores optional presenceColor on the callout', () => {
    vi.setSystemTime(1_000_000);
    useUiStore.getState().enqueueChangeCallout({
      icon: '+',
      text: 'Added R1',
      anchor: {},
      presenceColor: '#ff6b6b',
    });
    const [callout] = useUiStore.getState().changeCalloutQueue;
    expect(callout).toBeDefined();
    if (!callout) return;
    expect(callout.presenceColor).toBe('#ff6b6b');
  });
});

describe('uiStore — pendingNetLabel state machine', () => {
  beforeEach(() => {
    useUiStore.getState().cancelNetLabel();
  });
  afterEach(() => {
    useUiStore.getState().cancelNetLabel();
  });

  it('begins with a wire id and first char', () => {
    useUiStore.getState().beginNetLabelInput('wire-1', 'V');
    expect(useUiStore.getState().pendingNetLabel).toEqual({
      wireId: 'wire-1',
      chars: 'V',
    });
  });

  it('appends subsequent chars', () => {
    useUiStore.getState().beginNetLabelInput('wire-1', 'V');
    useUiStore.getState().appendNetLabelChar('O');
    useUiStore.getState().appendNetLabelChar('U');
    useUiStore.getState().appendNetLabelChar('T');
    expect(useUiStore.getState().pendingNetLabel?.chars).toBe('VOUT');
  });

  it('backspace trims the last char', () => {
    useUiStore.getState().beginNetLabelInput('wire-1', 'V');
    useUiStore.getState().appendNetLabelChar('O');
    useUiStore.getState().backspaceNetLabelChar();
    expect(useUiStore.getState().pendingNetLabel?.chars).toBe('V');
  });

  it('backspace from a single char clears the pending state', () => {
    useUiStore.getState().beginNetLabelInput('wire-1', 'V');
    useUiStore.getState().backspaceNetLabelChar();
    expect(useUiStore.getState().pendingNetLabel).toBeNull();
  });

  it('cancel clears pending state', () => {
    useUiStore.getState().beginNetLabelInput('wire-1', 'V');
    useUiStore.getState().cancelNetLabel();
    expect(useUiStore.getState().pendingNetLabel).toBeNull();
  });

  it('consume returns the buffer and clears pending state', () => {
    useUiStore.getState().beginNetLabelInput('wire-1', 'V');
    useUiStore.getState().appendNetLabelChar('O');
    useUiStore.getState().appendNetLabelChar('U');
    useUiStore.getState().appendNetLabelChar('T');
    const consumed = useUiStore.getState().consumeNetLabel();
    expect(consumed).toEqual({ wireId: 'wire-1', chars: 'VOUT' });
    expect(useUiStore.getState().pendingNetLabel).toBeNull();
  });

  it('consume with no pending state returns null', () => {
    const consumed = useUiStore.getState().consumeNetLabel();
    expect(consumed).toBeNull();
  });

  it('append with no pending state is a no-op', () => {
    useUiStore.getState().appendNetLabelChar('A');
    expect(useUiStore.getState().pendingNetLabel).toBeNull();
  });

  it('beginNetLabelInput replaces a previous buffer (new wire)', () => {
    useUiStore.getState().beginNetLabelInput('wire-1', 'V');
    useUiStore.getState().beginNetLabelInput('wire-2', 'A');
    expect(useUiStore.getState().pendingNetLabel).toEqual({
      wireId: 'wire-2',
      chars: 'A',
    });
  });
});
