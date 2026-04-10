/**
 * Bode plot component for AC analysis results.
 *
 * Renders magnitude (dB) and phase (degrees) on dual y-axes with a
 * logarithmic x-axis for frequency. Magnitude traces use solid lines,
 * phase traces use dashed lines. Shares cursor, measurement, and legend
 * behavior with WaveformViewer.
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
 * Signal trace colors matching UI-SPEC.
 */
const SIGNAL_COLORS = [
  '#4fc3f7',
  '#ffa726',
  '#66bb6a',
  '#f06292',
  '#ba68c8',
  '#ffee58',
  '#26c6da',
  '#ef5350',
] as const;

const MEASUREMENT_BUTTONS: { type: MeasurementType; label: string }[] = [
  { type: 'vpp', label: 'Vpp' },
  { type: 'frequency', label: 'Freq' },
  { type: 'rms', label: 'RMS' },
  { type: 'riseTime', label: 'Rise Time' },
];

/**
 * Separates AC results into magnitude and phase vectors.
 * Convention: magnitude vectors have unit "dB", phase vectors have unit "deg".
 * If no explicit split, treats odd-indexed signals as magnitude and even as phase.
 */
function categorizeACVectors(
  results: { name: string; data: Float64Array; unit: string; isComplex: boolean }[],
): { magnitudeIndices: number[]; phaseIndices: number[] } {
  const magnitudeIndices: number[] = [];
  const phaseIndices: number[] = [];

  for (let i = 1; i < results.length; i++) {
    const vec = results[i]!;
    if (vec.unit === 'deg' || vec.unit === 'degrees' || vec.name.toLowerCase().includes('phase')) {
      phaseIndices.push(i);
    } else {
      magnitudeIndices.push(i);
    }
  }

  return { magnitudeIndices, phaseIndices };
}

export function BodePlot() {
  const results = useSimulationStore((s) => s.results);
  const chartRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  const [visibleSignals, setVisibleSignals] = useState<Set<number>>(new Set());
  const [selectedSignal, setSelectedSignal] = useState<number>(1);

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

  const { magnitudeIndices, phaseIndices } = useMemo(
    () => categorizeACVectors(results),
    [results],
  );

  const toggleSignal = useCallback(
    (index: number) => {
      setVisibleSignals((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        if (plotRef.current) {
          plotRef.current.setSeries(index, { show: !prev.has(index) });
        }
        return next;
      });
    },
    [],
  );

  const selectSignal = useCallback((index: number) => {
    setSelectedSignal(index);
  }, []);

  const plotData = useMemo((): uPlot.AlignedData | null => {
    if (results.length < 2) return null;
    const data: number[][] = [];
    for (const vec of results) {
      data.push(Array.from(vec.data));
    }
    return data as uPlot.AlignedData;
  }, [results]);

  const seriesConfig = useMemo((): uPlot.Series[] => {
    const series: uPlot.Series[] = [
      {
        label: results.length > 0 ? results[0]!.name : 'Frequency',
      },
    ];

    for (let i = 1; i < results.length; i++) {
      const vec = results[i]!;
      const colorIdx = (i - 1) % SIGNAL_COLORS.length;
      const isPhase = phaseIndices.includes(i);

      series.push({
        label: vec.name,
        stroke: SIGNAL_COLORS[colorIdx],
        width: 2,
        show: visibleSignals.has(i),
        dash: isPhase ? [8, 4] : undefined,
        scale: isPhase ? 'phase' : 'magnitude',
      });
    }

    return series;
  }, [results, visibleSignals, phaseIndices]);

  // Create/update uPlot for Bode plot
  useEffect(() => {
    if (!chartRef.current || !plotData || results.length < 2) {
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
      scales: {
        x: {
          time: false,
          distr: 3, // Logarithmic x-axis for frequency
        },
        magnitude: {
          auto: true,
        },
        phase: {
          auto: true,
        },
      },
      axes: [
        {
          // X-axis: Frequency
          stroke: '#9fa8c4',
          grid: { stroke: '#1e2d52', width: 1 },
          ticks: { stroke: '#1e2d52', width: 1 },
          font: '12px "JetBrains Mono Variable", Consolas, monospace',
          labelFont: '11px "Inter Variable", sans-serif',
          label: 'Frequency (Hz)',
        },
        {
          // Left Y-axis: Magnitude (dB)
          scale: 'magnitude',
          stroke: '#9fa8c4',
          grid: { stroke: '#1e2d52', width: 1 },
          ticks: { stroke: '#1e2d52', width: 1 },
          font: '12px "JetBrains Mono Variable", Consolas, monospace',
          labelFont: '11px "Inter Variable", sans-serif',
          label: 'Magnitude (dB)',
          side: 3, // Left side
        },
        {
          // Right Y-axis: Phase (degrees)
          scale: 'phase',
          stroke: '#9fa8c4',
          grid: { show: false },
          ticks: { stroke: '#1e2d52', width: 1 },
          font: '12px "JetBrains Mono Variable", Consolas, monospace',
          labelFont: '11px "Inter Variable", sans-serif',
          label: 'Phase (deg)',
          side: 1, // Right side
        },
      ],
      cursor: {
        drag: { x: true, y: false },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotData, results]);

  const handleChartClick = useCallback(
    (e: React.MouseEvent) => {
      if (!plotRef.current) return;
      const idx = plotRef.current.cursor.idx;
      if (idx == null) return;

      if (e.shiftKey) {
        cursorState.placeSecondCursor(idx);
      } else {
        cursorState.placeCursor(idx);
      }
    },
    [cursorState],
  );

  const handleDoubleClick = useCallback(() => {
    cursorState.clearCursors();
  }, [cursorState]);

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
      <div
        ref={chartRef}
        className={styles.chartArea}
        onClick={handleChartClick}
        onDoubleClick={handleDoubleClick}
        data-testid="bode-chart"
      />

      {/* Cursor readout */}
      {cursorState.cursor1 !== null && cursorState.cursor1Time !== null && (
        <div className={styles.cursorReadout} style={{ top: 8, right: 8 }}>
          <div>
            Freq: {formatValue(cursorState.cursor1Time, 'Hz')}
          </div>
          {cursorState.cursor1Values.map((cv) => (
            <div key={cv.signalName}>
              {cv.signalName}: {formatValue(cv.value, cv.unit)}
            </div>
          ))}
        </div>
      )}

      {/* Delta readout */}
      {cursorState.cursor2 !== null && cursorState.deltaTime !== null && (
        <div className={styles.deltaReadout} style={{ top: 8, left: 8 }}>
          <div>
            Delta Freq: {formatValue(Math.abs(cursorState.deltaTime), 'Hz')}
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

      {/* Measurement overlays */}
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

      {/* Measurement buttons */}
      <div className={styles.measurementButtons}>
        {MEASUREMENT_BUTTONS.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            className={`${styles.measureBtn} ${measureState.activeTypes.has(type) ? styles.active : ''}`}
            onClick={() => measureState.toggleMeasurement(type)}
            data-testid={`bode-measure-${type}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Signal legend */}
      <div className={styles.legend} data-testid="bode-legend">
        {results.slice(1).map((vec, idx) => {
          const signalIdx = idx + 1;
          const colorIdx = idx % SIGNAL_COLORS.length;
          const isVisible = visibleSignals.has(signalIdx);
          const isPhase = phaseIndices.includes(signalIdx);
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
                style={{
                  backgroundColor: SIGNAL_COLORS[colorIdx],
                  borderStyle: isPhase ? 'dashed' : 'solid',
                }}
              />
              <span>
                {vec.name}
                {isPhase ? ' (phase)' : magnitudeIndices.includes(signalIdx) ? ' (mag)' : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
