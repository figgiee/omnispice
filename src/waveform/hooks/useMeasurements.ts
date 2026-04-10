/**
 * Measurement state management for waveform viewer.
 *
 * Wraps the pure measurement functions from measurements.ts and
 * manages the active measurement display state (which measurements
 * are currently visible as overlays on the waveform plot).
 */

import { useState, useCallback, useMemo } from 'react';
import type { VectorData } from '@/simulation/protocol';
import {
  type MeasurementResult,
  measureVpp,
  measureFrequency,
  measureRMS,
  measureRiseTime,
} from '../measurements';

export type MeasurementType = 'vpp' | 'frequency' | 'rms' | 'riseTime';

export interface MeasurementEntry {
  type: MeasurementType;
  signalIndex: number;
  result: MeasurementResult;
}

export interface MeasurementsState {
  /** Currently active measurements displayed as overlays */
  measurements: MeasurementEntry[];
  /** Active measurement types for the selected signal */
  activeTypes: Set<MeasurementType>;
  /** Toggle a measurement type on/off for the selected signal */
  toggleMeasurement: (type: MeasurementType) => void;
  /** Clear all active measurements */
  clearMeasurements: () => void;
}

/**
 * Hook for managing waveform measurements.
 *
 * @param results Simulation result vectors (first vector is x-axis)
 * @param selectedSignal Index of the currently selected signal (1-based, skipping x-axis)
 */
export function useMeasurements(
  results: VectorData[],
  selectedSignal: number,
): MeasurementsState {
  const [activeTypes, setActiveTypes] = useState<Set<MeasurementType>>(
    new Set(),
  );

  const xAxis = results.length > 0 ? results[0] : null;
  const signalData =
    selectedSignal > 0 && selectedSignal < results.length
      ? results[selectedSignal]
      : null;

  const measurements = useMemo(() => {
    if (!signalData || !xAxis) return [];

    const entries: MeasurementEntry[] = [];

    for (const type of activeTypes) {
      let result: MeasurementResult | null = null;

      switch (type) {
        case 'vpp':
          result = measureVpp(signalData.data);
          break;
        case 'frequency':
          result = measureFrequency(xAxis.data, signalData.data);
          break;
        case 'rms':
          result = measureRMS(signalData.data);
          break;
        case 'riseTime':
          result = measureRiseTime(xAxis.data, signalData.data);
          break;
      }

      if (result) {
        entries.push({
          type,
          signalIndex: selectedSignal,
          result,
        });
      }
    }

    return entries;
  }, [activeTypes, signalData, xAxis, selectedSignal]);

  const toggleMeasurement = useCallback((type: MeasurementType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const clearMeasurements = useCallback(() => {
    setActiveTypes(new Set());
  }, []);

  return {
    measurements,
    activeTypes,
    toggleMeasurement,
    clearMeasurements,
  };
}
