/**
 * Tests for useWireRouting hook.
 *
 * Verifies the wire routing state machine transitions:
 * start, addBend, complete, cancel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWireRouting } from '../useWireRouting';

// Mock circuitStore
const mockAddWire = vi.fn().mockReturnValue('wire-123');
vi.mock('@/store/circuitStore', () => ({
  useCircuitStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ addWire: mockAddWire }),
}));

// Mock uiStore - activeTool defaults to 'wire'
let mockActiveTool = 'wire';
vi.mock('@/store/uiStore', () => ({
  useUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ activeTool: mockActiveTool }),
}));

describe('useWireRouting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveTool = 'wire';
  });

  it('has isRouting=false and previewPath=null initially', () => {
    const { result } = renderHook(() => useWireRouting());

    expect(result.current.isRouting).toBe(false);
    expect(result.current.previewPath).toBeNull();
    expect(result.current.sourcePortId).toBeNull();
    expect(result.current.bendPoints).toEqual([]);
  });

  it('startRouting sets isRouting=true and stores source port', () => {
    const { result } = renderHook(() => useWireRouting());

    act(() => {
      result.current.startRouting('port-1');
    });

    expect(result.current.isRouting).toBe(true);
    expect(result.current.sourcePortId).toBe('port-1');
  });

  it('completeRouting calls circuitStore.addWire and resets state', () => {
    const { result } = renderHook(() => useWireRouting());

    act(() => {
      result.current.startRouting('port-1');
    });

    act(() => {
      result.current.completeRouting('port-2');
    });

    expect(mockAddWire).toHaveBeenCalledWith('port-1', 'port-2');
    expect(result.current.isRouting).toBe(false);
    expect(result.current.sourcePortId).toBeNull();
    expect(result.current.previewPath).toBeNull();
  });

  it('cancelRouting resets isRouting=false and clears preview', () => {
    const { result } = renderHook(() => useWireRouting());

    act(() => {
      result.current.startRouting('port-1');
    });

    expect(result.current.isRouting).toBe(true);

    act(() => {
      result.current.cancelRouting();
    });

    expect(result.current.isRouting).toBe(false);
    expect(result.current.previewPath).toBeNull();
    expect(result.current.sourcePortId).toBeNull();
  });

  it('addBend appends a bend point to the state', () => {
    const { result } = renderHook(() => useWireRouting());

    act(() => {
      result.current.startRouting('port-1');
    });

    act(() => {
      result.current.addBend({ x: 100, y: 200 });
    });

    expect(result.current.bendPoints).toEqual([{ x: 100, y: 200 }]);

    act(() => {
      result.current.addBend({ x: 300, y: 200 });
    });

    expect(result.current.bendPoints).toEqual([
      { x: 100, y: 200 },
      { x: 300, y: 200 },
    ]);
  });

  it('does not start routing when activeTool is not wire', () => {
    mockActiveTool = 'select';
    const { result } = renderHook(() => useWireRouting());

    act(() => {
      result.current.startRouting('port-1');
    });

    expect(result.current.isRouting).toBe(false);
    expect(result.current.sourcePortId).toBeNull();
  });

  it('does not complete routing when not actively routing', () => {
    const { result } = renderHook(() => useWireRouting());

    act(() => {
      result.current.completeRouting('port-2');
    });

    expect(mockAddWire).not.toHaveBeenCalled();
  });

  it('does not add bend when not actively routing', () => {
    const { result } = renderHook(() => useWireRouting());

    act(() => {
      result.current.addBend({ x: 100, y: 200 });
    });

    expect(result.current.bendPoints).toEqual([]);
  });
});
