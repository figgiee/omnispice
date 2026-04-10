import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOverlayStore } from '../overlayStore';
import { useOverlaySync } from '../useOverlaySync';
import { useSimulationStore } from '@/store/simulationStore';

describe('useOverlaySync', () => {
  beforeEach(() => {
    useOverlayStore.getState().clear();
    useSimulationStore.getState().reset();
  });

  it('extracts v(net_1) from DC op results and sets nodeVoltages', () => {
    renderHook(() => useOverlaySync());

    act(() => {
      useSimulationStore.getState().setResults([
        { name: 'v(net_1)', data: new Float64Array([3.3]), unit: 'V', isComplex: false },
      ]);
    });

    expect(useOverlayStore.getState().nodeVoltages['net_1']).toBeCloseTo(3.3);
  });

  it('extracts i(r1) case-insensitively and keys by uppercase ref', () => {
    renderHook(() => useOverlaySync());

    act(() => {
      useSimulationStore.getState().setResults([
        { name: 'i(r1)', data: new Float64Array([0.001]), unit: 'A', isComplex: false },
      ]);
    });

    expect(useOverlayStore.getState().branchCurrents['R1']).toBeCloseTo(0.001);
  });

  it('ignores transient results (data.length > 1)', () => {
    renderHook(() => useOverlaySync());

    act(() => {
      useSimulationStore.getState().setResults([
        { name: 'v(net_1)', data: new Float64Array([1, 2, 3]), unit: 'V', isComplex: false },
      ]);
    });

    expect(useOverlayStore.getState().nodeVoltages).toEqual({});
  });

  it('clears overlay on clear()', () => {
    act(() => {
      useOverlayStore.getState().setOverlay({ net_1: 3.3 }, { R1: 0.001 });
      useOverlayStore.getState().clear();
    });
    expect(useOverlayStore.getState().nodeVoltages).toEqual({});
    expect(useOverlayStore.getState().branchCurrents).toEqual({});
  });

  it('toggleVisibility flips isVisible', () => {
    const initial = useOverlayStore.getState().isVisible;
    act(() => { useOverlayStore.getState().toggleVisibility(); });
    expect(useOverlayStore.getState().isVisible).toBe(!initial);
  });
});
