/**
 * SweepFanOut — parameter-sweep family-of-curves renderer.
 *
 * Plan 05-07 — when the user commits a Shift-scrub on a component's
 * value, the orchestrator writes a `SweepResults` entry into
 * `simulationStore.sweepResults`. This component transforms that set
 * into a uPlot chart with one curve per sample value, so the student
 * can see at a glance how the output responds as the parameter moves
 * across its range.
 *
 * ## Implementation notes
 *
 * - Reads `sweepResults` from `simulationStore`. Renders `null` when no
 *   sweep is active — saves an unnecessary uPlot instance creation.
 * - Pure data transformation lives in `./sweepPlotData.ts` so unit
 *   tests can assert the shape without pulling in uPlot (uPlot calls
 *   `window.matchMedia` at module init, which jsdom lacks).
 * - Each sample's first non-time vector is extracted as the curve for
 *   that sample. V1 does not let the user pick which output to fan out;
 *   Plan 05-11 (or a follow-up) adds a per-curve selector.
 * - Colours come from the `--signal-0..7` palette (UI-SPEC §7). Beyond
 *   8 samples we wrap around — the typical student use case is 4-10
 *   samples so this is fine for V1.
 *
 * ## Deferred — hover-point precise run
 *
 * UI-SPEC §8.2 says hovering a curve should trigger a full precise sim
 * for that sample (not just the cached DC op-point). V1 leaves that as
 * a backlog item — see PLAN.md "hover-point precise-run" deferral and
 * the TODO marker below.
 */

import { useEffect, useMemo, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useSimulationStore } from '@/store/simulationStore';
import { buildSweepPlotData, buildSweepSeriesConfig, SWEEP_SIGNAL_COLORS } from './sweepPlotData';
import styles from './WaveformViewer.module.css';

export function SweepFanOut() {
  const sweep = useSimulationStore((s) => s.sweepResults);
  const chartRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  // TODO(plan-05-11): hover-point precise run — on curve hover, re-run
  // `runSweepPoint(netlist, paramName, value)` without the cache to get
  // a precise waveform instead of the cached DC op-point approximation.

  const plotData = useMemo(() => (sweep ? buildSweepPlotData(sweep) : null), [sweep]);
  const seriesConfig = useMemo(() => (sweep ? buildSweepSeriesConfig(sweep) : null), [sweep]);

  useEffect(() => {
    if (!chartRef.current || !plotData || !seriesConfig) {
      return;
    }

    if (plotRef.current) {
      plotRef.current.destroy();
      plotRef.current = null;
    }

    const container = chartRef.current;
    const rect = container.getBoundingClientRect();
    const opts: uPlot.Options = {
      width: Math.max(rect.width, 200),
      height: Math.max(rect.height, 100),
      series: seriesConfig,
      axes: [
        {
          stroke: '#9fa8c4',
          grid: { stroke: '#1e2d52', width: 1 },
          ticks: { stroke: '#1e2d52', width: 1 },
          font: '12px "JetBrains Mono Variable", Consolas, monospace',
          labelFont: '11px "Inter Variable", sans-serif',
        },
        {
          stroke: '#9fa8c4',
          grid: { stroke: '#1e2d52', width: 1 },
          ticks: { stroke: '#1e2d52', width: 1 },
          font: '12px "JetBrains Mono Variable", Consolas, monospace',
          labelFont: '11px "Inter Variable", sans-serif',
        },
      ],
      scales: { x: { time: false } },
    };

    const plot = new uPlot(opts, plotData, container);
    plotRef.current = plot;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && plotRef.current) {
          plotRef.current.setSize({
            width: Math.max(width, 200),
            height: Math.max(height, 100),
          });
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [plotData, seriesConfig]);

  if (!sweep) return null;

  return (
    <div className={styles.container} data-testid="sweep-fan-out">
      <div ref={chartRef} className={styles.chartArea} />
      <div className={styles.legend} data-testid="sweep-legend">
        {sweep.values.map((val, idx) => {
          const colorIdx = idx % SWEEP_SIGNAL_COLORS.length;
          return (
            <div
              key={`sweep-${sweep.paramName}-${val}`}
              className={styles.legendItem}
              data-testid={`sweep-legend-${idx}`}
            >
              <span
                className={styles.legendDot}
                style={{ backgroundColor: SWEEP_SIGNAL_COLORS[colorIdx] }}
              />
              <span>
                {sweep.paramName}={val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
