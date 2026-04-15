/**
 * Zustand store for waveform measurement annotations.
 *
 * Annotations are user-placed callout markers on the waveform viewer.
 * Each annotation records a point in time on a specific vector, a label,
 * and the measured value at that point. Session-only — not persisted.
 */

import { create } from 'zustand';

export interface MeasurementAnnotation {
  id: string;
  vectorName: string;
  t: number;
  label: string;
  value: number;
  unit: string;
}

interface ReportAnnotationsState {
  annotations: MeasurementAnnotation[];
  addAnnotation: (a: Omit<MeasurementAnnotation, 'id'>) => void;
  removeAnnotation: (id: string) => void;
  clearAll: () => void;
}

export const useReportAnnotationsStore = create<ReportAnnotationsState>(
  (set) => ({
    annotations: [],
    addAnnotation: (a) =>
      set((s) => ({
        annotations: [
          ...s.annotations,
          { ...a, id: crypto.randomUUID() },
        ],
      })),
    removeAnnotation: (id) =>
      set((s) => ({
        annotations: s.annotations.filter((x) => x.id !== id),
      })),
    clearAll: () => set({ annotations: [] }),
  }),
);
