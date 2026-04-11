/**
 * Plan 05-02 Task 4 — uiStore net label capture state machine.
 *
 * Unit-level coverage of begin/append/backspace/cancel/consume. The keyboard
 * dispatcher (useNetLabelInput) is verified end-to-end in the Playwright
 * spec tests/e2e/phase5/pin-types-and-nets.spec.ts.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '../uiStore';

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
