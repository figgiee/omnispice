/**
 * SweepFanOut pure data helpers.
 *
 * Split from `SweepFanOut.tsx` so unit tests can import them without
 * pulling in uPlot — uPlot calls `window.matchMedia` at module load
 * time, which jsdom doesn't implement (`TypeError: matchMedia is not a
 * function`). Separating the transformations from the renderer avoids a
 * test-time polyfill.
 *
 * See SweepFanOut.tsx for context on why the fan-out shape is what it
 * is and for the hover-point precise-run backlog TODO.
 */

import type uPlot from 'uplot';
import type { SweepResults } from '@/store/simulationStore';

/** Signal palette — matches WaveformViewer.tsx `SIGNAL_COLORS` (UI-SPEC §7). */
export const SWEEP_SIGNAL_COLORS = [
  '#4fc3f7', // Cyan
  '#ffa726', // Orange
  '#66bb6a', // Green
  '#f06292', // Pink
  '#ba68c8', // Purple
  '#ffee58', // Yellow
  '#26c6da', // Teal
  '#ef5350', // Red
] as const;

/**
 * Build a uPlot AlignedData array from a sweep set.
 *
 * Returns `null` if the sweep is empty or the first sample doesn't carry
 * at least an X axis + one output vector. Callers should hide the fan-out
 * panel when this returns null.
 */
export function buildSweepPlotData(sweep: SweepResults): uPlot.AlignedData | null {
  if (!sweep.vectors.length) return null;
  const firstSample = sweep.vectors[0];
  if (!firstSample || firstSample.length < 2) return null;

  const xAxis = firstSample[0];
  if (!xAxis) return null;
  const xValues = Array.from(xAxis.data);
  const seriesData: number[][] = [xValues];

  for (const sampleVectors of sweep.vectors) {
    const output = sampleVectors[1];
    if (!output) {
      seriesData.push(new Array(xValues.length).fill(0));
      continue;
    }
    seriesData.push(Array.from(output.data));
  }

  return seriesData as uPlot.AlignedData;
}

/** Build per-series config (label + stroke) for a sweep set. */
export function buildSweepSeriesConfig(sweep: SweepResults): uPlot.Series[] {
  const xLabel = sweep.vectors[0]?.[0]?.name ?? 'x';
  const series: uPlot.Series[] = [{ label: xLabel }];
  for (let i = 0; i < sweep.values.length; i++) {
    const val = sweep.values[i]!;
    const colorIdx = i % SWEEP_SIGNAL_COLORS.length;
    series.push({
      label: `${sweep.paramName}=${val}`,
      stroke: SWEEP_SIGNAL_COLORS[colorIdx],
      width: 1,
    });
  }
  return series;
}
