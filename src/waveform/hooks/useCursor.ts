/**
 * Cursor state management for waveform viewer.
 *
 * Manages single and dual cursor positions for time-domain and
 * frequency-domain measurement readouts. Supports two-cursor delta
 * mode for measuring differences between two points (D-27).
 */

import { useState, useCallback, useMemo } from 'react';
import type { VectorData } from '@/simulation/protocol';

export interface CursorValue {
  signalName: string;
  value: number;
  unit: string;
}

export interface CursorState {
  /** Data index of cursor 1, or null if no cursor placed */
  cursor1: number | null;
  /** Data index of cursor 2 (for two-cursor delta mode), or null */
  cursor2: number | null;
  /** Time/frequency value at cursor 1 */
  cursor1Time: number | null;
  /** Time/frequency value at cursor 2 */
  cursor2Time: number | null;
  /** Signal values at cursor 1 */
  cursor1Values: CursorValue[];
  /** Signal values at cursor 2 */
  cursor2Values: CursorValue[];
  /** Delta time between cursors (null if only one cursor) */
  deltaTime: number | null;
  /** Place or move cursor 1 to a data index */
  placeCursor: (index: number) => void;
  /** Place cursor 2 for two-cursor delta mode (Shift+click) */
  placeSecondCursor: (index: number) => void;
  /** Remove all cursors */
  clearCursors: () => void;
}

/**
 * Hook for managing waveform cursor state.
 *
 * @param results Simulation result vectors (first vector is x-axis)
 * @param visibleSignals Indices of currently visible signals
 */
export function useCursor(
  results: VectorData[],
  visibleSignals: Set<number>,
): CursorState {
  const [cursor1, setCursor1] = useState<number | null>(null);
  const [cursor2, setCursor2] = useState<number | null>(null);

  const xAxis = results.length > 0 ? results[0] : null;

  const getValuesAtIndex = useCallback(
    (index: number): CursorValue[] => {
      if (index < 0 || results.length <= 1) return [];

      const values: CursorValue[] = [];
      for (let i = 1; i < results.length; i++) {
        if (!visibleSignals.has(i)) continue;
        const vec = results[i];
        if (!vec || index >= vec.data.length) continue;
        values.push({
          signalName: vec.name,
          value: vec.data[index]!,
          unit: vec.unit,
        });
      }
      return values;
    },
    [results, visibleSignals],
  );

  const cursor1Time = useMemo(() => {
    if (cursor1 === null || !xAxis || cursor1 >= xAxis.data.length) return null;
    return xAxis.data[cursor1]!;
  }, [cursor1, xAxis]);

  const cursor2Time = useMemo(() => {
    if (cursor2 === null || !xAxis || cursor2 >= xAxis.data.length) return null;
    return xAxis.data[cursor2]!;
  }, [cursor2, xAxis]);

  const cursor1Values = useMemo(() => {
    if (cursor1 === null) return [];
    return getValuesAtIndex(cursor1);
  }, [cursor1, getValuesAtIndex]);

  const cursor2Values = useMemo(() => {
    if (cursor2 === null) return [];
    return getValuesAtIndex(cursor2);
  }, [cursor2, getValuesAtIndex]);

  const deltaTime = useMemo(() => {
    if (cursor1Time === null || cursor2Time === null) return null;
    return cursor2Time - cursor1Time;
  }, [cursor1Time, cursor2Time]);

  const placeCursor = useCallback((index: number) => {
    setCursor1(index);
    setCursor2(null); // Reset second cursor when placing primary
  }, []);

  const placeSecondCursor = useCallback((index: number) => {
    setCursor2(index);
  }, []);

  const clearCursors = useCallback(() => {
    setCursor1(null);
    setCursor2(null);
  }, []);

  return {
    cursor1,
    cursor2,
    cursor1Time,
    cursor2Time,
    cursor1Values,
    cursor2Values,
    deltaTime,
    placeCursor,
    placeSecondCursor,
    clearCursors,
  };
}
