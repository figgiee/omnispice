/**
 * SweepFanOut — pure-function unit tests.
 *
 * Tests the data transformation helpers in isolation from uPlot to avoid
 * pulling in the full chart renderer under jsdom. The rendering path is
 * exercised indirectly by the existing WaveformViewer snapshot and the
 * Playwright E2E in `tests/e2e/phase5/wire-voltage-coloring.spec.ts`.
 */

import { describe, expect, it } from 'vitest';
import type { SweepResults } from '@/store/simulationStore';
import { buildSweepPlotData, buildSweepSeriesConfig } from '../sweepPlotData';

function makeVector(name: string, unit: string, values: number[]) {
  return {
    name,
    unit,
    isComplex: false,
    data: Float64Array.from(values),
  };
}

function makeSweep(): SweepResults {
  return {
    componentId: 'comp-1',
    paramName: 'R1.value',
    values: [1000, 2000, 3000],
    vectors: [
      [makeVector('time', 's', [0, 1, 2]), makeVector('v(out)', 'V', [0, 1, 2])],
      [makeVector('time', 's', [0, 1, 2]), makeVector('v(out)', 'V', [0, 0.5, 1])],
      [
        makeVector('time', 's', [0, 1, 2]),
        makeVector('v(out)', 'V', [0, 0.33, 0.66]),
      ],
    ],
  };
}

/** Narrow a `uPlot.AlignedData | null` result so tests can index safely. */
function expectData(
  data: ReturnType<typeof buildSweepPlotData>,
): readonly (number[] | Float64Array)[] {
  if (data === null) {
    throw new Error('expected non-null sweep plot data');
  }
  return data as readonly (number[] | Float64Array)[];
}

function expectSeries(series: ReturnType<typeof buildSweepSeriesConfig>, idx: number) {
  const entry = series[idx];
  if (!entry) throw new Error(`expected series entry at index ${idx}`);
  return entry;
}

describe('buildSweepPlotData', () => {
  it('uses the first sample X axis as the shared X', () => {
    const data = expectData(buildSweepPlotData(makeSweep()));
    expect(Array.from(data[0] ?? [])).toEqual([0, 1, 2]);
  });

  it('returns one Y series per sample in addition to the shared X', () => {
    const data = buildSweepPlotData(makeSweep());
    // 1 X axis + 3 samples = 4 rows
    expect(data).toHaveLength(4);
  });

  it('preserves the per-sample output vector values', () => {
    const data = expectData(buildSweepPlotData(makeSweep()));
    expect(Array.from(data[1] ?? [])).toEqual([0, 1, 2]);
    expect(Array.from(data[2] ?? [])).toEqual([0, 0.5, 1]);
    expect(Array.from(data[3] ?? [])).toEqual([0, 0.33, 0.66]);
  });

  it('returns null when the sweep has no samples', () => {
    const sweep: SweepResults = {
      componentId: 'c1',
      paramName: 'R1.value',
      values: [],
      vectors: [],
    };
    expect(buildSweepPlotData(sweep)).toBeNull();
  });

  it('returns null when a sample has only an X axis (no output)', () => {
    const sweep: SweepResults = {
      componentId: 'c1',
      paramName: 'R1.value',
      values: [1],
      vectors: [[makeVector('time', 's', [0, 1])]],
    };
    expect(buildSweepPlotData(sweep)).toBeNull();
  });
});

describe('buildSweepSeriesConfig', () => {
  it('returns 1 X series + N value series', () => {
    const series = buildSweepSeriesConfig(makeSweep());
    expect(series).toHaveLength(4);
  });

  it('labels each series with paramName=value', () => {
    const series = buildSweepSeriesConfig(makeSweep());
    expect(expectSeries(series, 1).label).toBe('R1.value=1000');
    expect(expectSeries(series, 2).label).toBe('R1.value=2000');
    expect(expectSeries(series, 3).label).toBe('R1.value=3000');
  });

  it('assigns distinct colours from the signal palette in order', () => {
    const series = buildSweepSeriesConfig(makeSweep());
    expect(expectSeries(series, 1).stroke).toBe('#4fc3f7');
    expect(expectSeries(series, 2).stroke).toBe('#ffa726');
    expect(expectSeries(series, 3).stroke).toBe('#66bb6a');
  });
});
