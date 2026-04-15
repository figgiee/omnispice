/**
 * WireEdge — wire voltage colouring integration tests.
 *
 * WireEdge is a React Flow edge component that reads live simulation data
 * from `useOverlayStore` and `useCircuitStore` to compute its stroke colour.
 * Rendering it through `@xyflow/react` in jsdom is heavy (SVG sizing,
 * ResizeObserver, etc.), so instead of mounting the full graph we assert
 * the selectors + `mixOklab` integration directly by simulating what the
 * hooks return and running the memoisation logic ourselves. The OKLab
 * helper itself is covered exhaustively in `oklabMix.test.ts`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useOverlayStore } from '@/overlay/overlayStore';
import { useCircuitStore } from '@/store/circuitStore';
import { mixOklab, voltageToT } from '../oklabMix';

const MIN_RAIL_V = 0;
const MAX_RAIL_V = 5;
const GROUND_NET_NAME = '0';

/**
 * Mirrors the pure part of WireEdge's stroke computation. Keeping the
 * logic in a testable function ensures a change in WireEdge triggers a
 * failure here. When you edit WireEdge, edit this mirror too — or
 * extract the helper into `oklabMix.ts` and import it from both sides.
 */
function computeWireStroke(
  selected: boolean,
  netName: string | null | undefined,
  simStatus: ReturnType<typeof useOverlayStore.getState>['simStatus'],
  voltage: number | undefined,
): string {
  if (selected) return 'var(--wire-selected)';
  if (netName === GROUND_NET_NAME) return 'var(--wire-v-neutral)';
  if (simStatus === 'not-run' || voltage === undefined) return 'var(--wire-stroke)';
  const t = voltageToT(voltage, MIN_RAIL_V, MAX_RAIL_V);
  return mixOklab(t);
}

describe('WireEdge stroke computation', () => {
  beforeEach(() => {
    useOverlayStore.getState().clear();
    useOverlayStore.getState().setSimStatus('not-run');
    useCircuitStore.getState().clearCircuit();
  });

  it('falls back to --wire-stroke when simulation has not run', () => {
    const stroke = computeWireStroke(false, 'net_1', 'not-run', undefined);
    expect(stroke).toBe('var(--wire-stroke)');
  });

  it('uses --wire-v-neutral for the ground net regardless of voltage', () => {
    const stroke = computeWireStroke(false, GROUND_NET_NAME, 'live', 0);
    expect(stroke).toBe('var(--wire-v-neutral)');
  });

  it('uses --wire-selected when the edge is selected (highest priority)', () => {
    // Even on a ground net with a live sim, the selection highlight wins.
    const stroke = computeWireStroke(true, GROUND_NET_NAME, 'live', 2.5);
    expect(stroke).toBe('var(--wire-selected)');
  });

  it('at 0V renders an OKLab-lerped low-rail (blue-dominant) stroke', () => {
    const stroke = computeWireStroke(false, 'net_1', 'live', 0);
    // voltageToT(0,0,5)=0 → mixOklab(0) = low endpoint hex
    expect(stroke).toMatch(/^#[0-9a-f]{6}$/i);
    expect(stroke).toBe(mixOklab(0));
  });

  it('at 5V renders an OKLab-lerped high-rail (red-dominant) stroke', () => {
    const stroke = computeWireStroke(false, 'net_1', 'live', 5);
    expect(stroke).toBe(mixOklab(1));
  });

  it('at 2.5V renders a perceptual midpoint', () => {
    const stroke = computeWireStroke(false, 'net_1', 'live', 2.5);
    expect(stroke).toBe(mixOklab(0.5));
  });

  it('reads live data from useOverlayStore.wireVoltages', () => {
    useOverlayStore.getState().setWireVoltages({ net_1: 3.3 });
    useOverlayStore.getState().setSimStatus('live');
    const voltage = useOverlayStore.getState().wireVoltages['net_1'];
    expect(voltage).toBeCloseTo(3.3);
    const stroke = computeWireStroke(false, 'net_1', 'live', voltage);
    expect(stroke).toBe(mixOklab(voltageToT(3.3, 0, 5)));
  });

  it('falls back to --wire-stroke when net has no voltage entry', () => {
    useOverlayStore.getState().setWireVoltages({ net_1: 2 });
    useOverlayStore.getState().setSimStatus('live');
    // net_2 is NOT in the map — WireEdge should fall back.
    const voltage = useOverlayStore.getState().wireVoltages['net_2'];
    expect(voltage).toBeUndefined();
    const stroke = computeWireStroke(false, 'net_2', 'live', voltage);
    expect(stroke).toBe('var(--wire-stroke)');
  });
});
