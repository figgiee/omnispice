/**
 * Simulation state management.
 *
 * Tracks the simulation lifecycle: engine loading, execution,
 * results, and errors. Separated from circuit state to avoid
 * the monolithic state anti-pattern.
 */

import { create } from 'zustand';
import type { AnalysisConfig } from '@/circuit/types';
import type { VectorData } from '@/simulation/protocol';
import type { TranslatedError } from '@/simulation/errorTranslator';
import type { ValidationError } from '@/circuit/validator';

export type SimStatus =
  | 'idle'
  | 'loading_engine'
  | 'running'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface SimulationState {
  status: SimStatus;
  elapsedTime: number;
  results: VectorData[];
  errors: TranslatedError[];
  validationErrors: ValidationError[];
  analysisConfig: AnalysisConfig;

  setStatus: (status: SimStatus) => void;
  setElapsedTime: (time: number) => void;
  setResults: (results: VectorData[]) => void;
  setErrors: (errors: TranslatedError[]) => void;
  setValidationErrors: (errors: ValidationError[]) => void;
  setAnalysisConfig: (config: AnalysisConfig) => void;
  reset: () => void;
}

const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  type: 'transient',
  stopTime: '10m',
  timeStep: '1u',
};

const INITIAL_STATE = {
  status: 'idle' as SimStatus,
  elapsedTime: 0,
  results: [] as VectorData[],
  errors: [] as TranslatedError[],
  validationErrors: [] as ValidationError[],
  analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG },
};

export const useSimulationStore = create<SimulationState>()((set) => ({
  ...INITIAL_STATE,

  setStatus: (status) => set({ status }),

  setElapsedTime: (time) => set({ elapsedTime: time }),

  setResults: (results) => set({ results }),

  setErrors: (errors) => set({ errors }),

  setValidationErrors: (errors) => set({ validationErrors: errors }),

  setAnalysisConfig: (config) => set({ analysisConfig: config }),

  reset: () =>
    set({
      ...INITIAL_STATE,
      analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG },
    }),
}));
