/**
 * Waveform viewer component for time-domain and DC sweep results.
 *
 * Renders simulation results using uPlot with dark theme styling,
 * cursor readouts, signal toggling, zoom/pan, and auto-measurements.
 * Reads results from the simulation store and displays them as
 * oscilloscope-style waveform traces.
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useSimulationStore } from '@/store/simulationStore';
import { useCursor } from './hooks/useCursor';
import { useMeasurements } from './hooks/useMeasurements';
import type { MeasurementType } from './hooks/useMeasurements';
import { formatValue } from './measurements';
import styles from './WaveformViewer.module.css';

/**
 * Signal trace colors matching UI-SPEC Waveform Viewer Colors table.
 * Assigned in order, high-contrast on dark background, colorblind-safe.
 */
const SIGNAL_COLORS = [
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
 * Measurement button definitions for the toolbar.
 */
const MEASUREMENT_BUTTONS: { type: MeasurementType; label: string }[] = [
  { type: 'vpp', label: 'Vpp' },
  { type: 'frequency', label: 'Freq' },
  { type: 'rms', label: 'RMS' },
  { type: 'riseTime', label: 'Rise Time' },
];

export function WaveformViewer() {
  const results = useSimulationStore((s) => s.results);
  const chartRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  // Signal visibility state: all visible by default
  const [visibleSignals, setVisibleSignals] = useState<Set<number>>(new Set());
  const [selectedSignal, setSelectedSignal] = useState<number>(1);

  // Initialize visible signals when results change
  useEffect(() => {
    if (results.length > 1) {
      const allSignals = new Set<number>();
      for (let i = 1; i < results.length; i++) {
        allSignals.add(i);
      }
      setVisibleSignals(allSignals);
      setSelectedSignal(1);
    }
  }, [results]);

  const cursorState = useCursor(results, visibleSignals);
  const measureState = useMeasurements(results, selectedSignal);

  // Toggle signal visibility in legend (D-25)
  const toggleSignal = useCallback(
    (index: number) => {
      setVisibleSignals((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }

        // Update uPlot series visibility
        if (plotRef.current) {
          plotRef.current.setSeries(index, { show: !prev.has(index) });
        }

        return next;
      });
    },
    [],
  );

  // Select signal for measurements
  const selectSignal = useCallback((index: number) => {
    setSelectedSignal(index);
  }, []);

  // Build uPlot data from results
  const plotData = useMemo((): uPlot.AlignedData | null => {
    if (results.length < 2) return null;

    const data: number[][] = [];
    for (const vec of results) {
      data.push(Array.from(vec.data));
    }
    return data as uPlot.AlignedData;
  }, [results]);

  // Build uPlot series configuration
  const seriesConfig = useMemo((): uPlot.Series[] => {
    const series: uPlot.Series[] = [
      {
        // X-axis series (time or frequency)
        label: results.length > 0 ? results[0]!.name : 'Time',
      },
    ];

    for (let i = 1; i < results.length; i++) {
      const vec = results[i]!;
      const colorIdx = (i - 1) % SIGNAL_COLORS.length;
      series.push({
        label: vec.name,
        stroke: SIGNAL_COLORS[colorIdx],
        width: 2,
        show: visibleSignals.has(i),
      });
    }

    return series;
  }, [results, visibleSignals]);

  // Create/update uPlot instance
  useEffect(() => {
    if (!chartRef.current || !plotData || results.length < 2) {
      return;
    }

    // Destroy previous instance
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
          label: results[0]?.unit === 's' ? 'Time (s)' : results[0]?.name ?? '',
        },
        {
          stroke: '#9fa8c4',
          grid: { stroke: '#1e2d52', width: 1 },
          ticks: { stroke: '#1e2d52', width: 1 },
          font: '12px "JetBrains Mono Variable", Consolas, monospace',
          labelFont: '11px "Inter Variable", sans-serif',
          label: 'Amplitude',
        },
      ],
      cursor: {
        drag: { x: true, y: false }, // zoom by drag on x-axis
      },
      scales: {
        x: { time: false },
      },
      hooks: {
        setCursor: [
          (u: uPlot) => {
            const idx = u.cursor.idx;
            if (idx != null && idx >= 0) {
              cursorState.placeCursor(idx);
            }
          },
        ],
      },
    };

    const plot = new uPlot(opts, plotData, container);
    plotRef.current = plot;

    // ResizeObserver for auto-resize
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
    // We intentionally only re-create the chart when plotData or results change.
    // seriesConfig changes are handled via uPlot.setSeries() in toggleSignal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotData, results]);

  // Handle click on chart area for cursor placement
  const handleChartClick = useCallback(
    (e: React.MouseEvent) => {
      if (!plotRef.current) return;

      const idx = plotRef.current.cursor.idx;
      if (idx == null) return;

      if (e.shiftKey) {
        // Shift+click: place second cursor (D-27)
        cursorState.placeSecondCursor(idx);
      } else {
        cursorState.placeCursor(idx);
      }
    },
    [cursorState],
  );

  // Handle double-click to clear cursors
  const handleDoubleClick = useCallback(() => {
    cursorState.clearCursors();
  }, [cursorState]);

  // Empty state: no simulation results
  if (results.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          No simulation data yet. Run a simulation to see waveforms here.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Chart area */}
      <div
        ref={chartRef}
        className={styles.chartArea}
        onClick={handleChartClick}
        onDoubleClick={handleDoubleClick}
        data-testid="waveform-chart"
      />

      {/* Cursor readout overlay (D-26) */}
      {cursorState.cursor1 !== null && cursorState.cursor1Time !== null && (
        <div className={styles.cursorReadout} style={{ top: 8, right: 8 }}>
          <div>
            {results[0]?.name ?? 'x'}:{' '}
            {formatValue(cursorState.cursor1Time, results[0]?.unit ?? '')}
          </div>
          {cursorState.cursor1Values.map((cv) => (
            <div key={cv.signalName}>
              {cv.signalName}: {formatValue(cv.value, cv.unit)}
            </div>
          ))}
        </div>
      )}

      {/* Second cursor readout for delta mode (D-27) */}
      {cursorState.cursor2 !== null && cursorState.deltaTime !== null && (
        <div className={styles.deltaReadout} style={{ top: 8, left: 8 }}>
          <div>
            Delta {results[0]?.name ?? 'x'}:{' '}
            {formatValue(Math.abs(cursorState.deltaTime), results[0]?.unit ?? '')}
          </div>
          {cursorState.cursor2Values.map((cv) => {
            const v1 = cursorState.cursor1Values.find(
              (v) => v.signalName === cv.signalName,
            );
            if (!v1) return null;
            return (
              <div key={cv.signalName}>
                Delta {cv.signalName}:{' '}
                {formatValue(Math.abs(cv.value - v1.value), cv.unit)}
              </div>
            );
          })}
        </div>
      )}

      {/* Measurement overlays (D-28) */}
      {measureState.measurements.length > 0 && (
        <div
          className={styles.measurementOverlay}
          style={{ bottom: 80, right: 8 }}
        >
          {measureState.measurements.map((m) => (
            <div key={m.type}>{m.result.formatted}</div>
          ))}
        </div>
      )}

      {/* Measurement buttons row */}
      <div className={styles.measurementButtons}>
        {MEASUREMENT_BUTTONS.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            className={`${styles.measureBtn} ${measureState.activeTypes.has(type) ? styles.active : ''}`}
            onClick={() => measureState.toggleMeasurement(type)}
            data-testid={`measure-${type}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Signal legend with toggle (D-25) */}
      <div className={styles.legend} data-testid="waveform-legend">
        {results.slice(1).map((vec, idx) => {
          const signalIdx = idx + 1;
          const colorIdx = idx % SIGNAL_COLORS.length;
          const isVisible = visibleSignals.has(signalIdx);
          const isSelected = selectedSignal === signalIdx;

          return (
            <div
              key={vec.name}
              className={`${styles.legendItem} ${!isVisible ? styles.hidden : ''}`}
              onClick={() => toggleSignal(signalIdx)}
              onContextMenu={(e) => {
                e.preventDefault();
                selectSignal(signalIdx);
              }}
              style={
                isSelected
                  ? { borderBottom: `2px solid ${SIGNAL_COLORS[colorIdx]}` }
                  : undefined
              }
              data-testid={`legend-${vec.name}`}
            >
              <span
                className={styles.legendDot}
                style={{ backgroundColor: SIGNAL_COLORS[colorIdx] }}
              />
              <span>{vec.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
