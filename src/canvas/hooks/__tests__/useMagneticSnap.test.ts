/**
 * Tests for useMagneticSnap hook.
 *
 * Verifies magnetic snap threshold detection at 20px boundary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMagneticSnap, SNAP_THRESHOLD_PX } from '../useMagneticSnap';

// Mock React Flow's useReactFlow
const mockGetNodes = vi.fn();
vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    getNodes: mockGetNodes,
  }),
}));

describe('useMagneticSnap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports SNAP_THRESHOLD_PX as 20', () => {
    expect(SNAP_THRESHOLD_PX).toBe(20);
  });

  it('returns snapTarget=null when no nodes exist', () => {
    mockGetNodes.mockReturnValue([]);

    const { result } = renderHook(() => useMagneticSnap());

    act(() => {
      result.current.checkSnap({ x: 50, y: 50 });
    });

    expect(result.current.snapTarget).toBeNull();
    expect(result.current.isSnapping).toBe(false);
  });

  it('returns snapTarget when position is within 20px of a pin', () => {
    mockGetNodes.mockReturnValue([
      {
        id: 'node-1',
        position: { x: 100, y: 100 },
        measured: { width: 60, height: 40 },
        handles: [
          { id: 'handle-left', x: 0, y: 20 },
          { id: 'handle-right', x: 60, y: 20 },
        ],
      },
    ]);

    const { result } = renderHook(() => useMagneticSnap());

    // Position within 20px of left handle (100, 120)
    act(() => {
      result.current.checkSnap({ x: 110, y: 120 });
    });

    expect(result.current.snapTarget).not.toBeNull();
    expect(result.current.snapTarget?.portId).toBe('handle-left');
    expect(result.current.snapTarget?.nodeId).toBe('node-1');
    expect(result.current.isSnapping).toBe(true);
  });

  it('returns snapTarget=null when position is more than 20px from any pin', () => {
    mockGetNodes.mockReturnValue([
      {
        id: 'node-1',
        position: { x: 100, y: 100 },
        measured: { width: 60, height: 40 },
        handles: [
          { id: 'handle-left', x: 0, y: 20 },
        ],
      },
    ]);

    const { result } = renderHook(() => useMagneticSnap());

    // Pin is at (100, 120). Position at (100, 141) is 21px away.
    act(() => {
      result.current.checkSnap({ x: 100, y: 141 });
    });

    expect(result.current.snapTarget).toBeNull();
    expect(result.current.isSnapping).toBe(false);
  });

  it('isSnapping is true when snapTarget is not null', () => {
    mockGetNodes.mockReturnValue([
      {
        id: 'node-1',
        position: { x: 0, y: 0 },
        measured: { width: 60, height: 40 },
        handles: [
          { id: 'handle-1', x: 30, y: 20 },
        ],
      },
    ]);

    const { result } = renderHook(() => useMagneticSnap());

    // Position exactly at pin (30, 20) - distance 0
    act(() => {
      result.current.checkSnap({ x: 30, y: 20 });
    });

    expect(result.current.isSnapping).toBe(true);
    expect(result.current.snapTarget).not.toBeNull();
  });

  it('selects the closest pin when multiple are within threshold', () => {
    mockGetNodes.mockReturnValue([
      {
        id: 'node-1',
        position: { x: 0, y: 0 },
        measured: { width: 60, height: 40 },
        handles: [
          { id: 'handle-left', x: 0, y: 20 },
          { id: 'handle-right', x: 60, y: 20 },
        ],
      },
    ]);

    const { result } = renderHook(() => useMagneticSnap());

    // Position at (5, 20), 5px from left handle, 55px from right handle
    act(() => {
      result.current.checkSnap({ x: 5, y: 20 });
    });

    expect(result.current.snapTarget?.portId).toBe('handle-left');
  });

  it('clearSnap resets snap state', () => {
    mockGetNodes.mockReturnValue([
      {
        id: 'node-1',
        position: { x: 0, y: 0 },
        measured: { width: 60, height: 40 },
        handles: [
          { id: 'handle-1', x: 0, y: 0 },
        ],
      },
    ]);

    const { result } = renderHook(() => useMagneticSnap());

    act(() => {
      result.current.checkSnap({ x: 0, y: 0 });
    });

    expect(result.current.isSnapping).toBe(true);

    act(() => {
      result.current.clearSnap();
    });

    expect(result.current.isSnapping).toBe(false);
    expect(result.current.snapTarget).toBeNull();
  });

  it('returns snapped position from snapTarget', () => {
    mockGetNodes.mockReturnValue([
      {
        id: 'node-1',
        position: { x: 50, y: 50 },
        measured: { width: 60, height: 40 },
        handles: [
          { id: 'handle-1', x: 10, y: 10 },
        ],
      },
    ]);

    const { result } = renderHook(() => useMagneticSnap());

    // Pin at (60, 60), check near it
    act(() => {
      result.current.checkSnap({ x: 65, y: 60 });
    });

    expect(result.current.snapPosition).toEqual({ x: 60, y: 60 });
  });
});
