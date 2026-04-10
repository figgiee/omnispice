/**
 * Simulation state management.
 *
 * Tracks the simulation lifecycle: engine loading, execution,
 * results, and errors. Separated from circuit state to avoid
 * the monolithic state anti-pattern.
 */

import { create } from 'zustand';
import type { AnalysisConfig } from '@/circuit/types';
import type { ValidationError } from '@/circuit/validator';
import type { TranslatedError } from '@/simulation/errorTranslator';
import type { VectorData } from '@/simulation/protocol';

export type SimStatus = 'idle' | 'loading_engine' | 'running' | 'complete' | 'error' | 'cancelled';

export interface SimulationState {
  status: SimStatus;
  elapsedTime: number;
  results: VectorData[];
  netMap: Map<string, string>;
  errors: TranslatedError[];
  validationErrors: ValidationError[];
  analysisConfig: AnalysisConfig;

  setStatus: (status: SimStatus) => void;
  setElapsedTime: (time: number) => void;
  setResults: (results: VectorData[], netMap?: Map<string, string>) => void;
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
  netMap: new Map<string, string>(),
  errors: [] as TranslatedError[],
  validationErrors: [] as ValidationError[],
  analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG },
};

export const useSimulationStore = create<SimulationState>()((set) => ({
  ...INITIAL_STATE,

  setStatus: (status) => set({ status }),

  setElapsedTime: (time) => set({ elapsedTime: time }),

  setResults: (results, netMap) => set({ results, netMap: netMap ?? new Map<string, string>() }),

  setErrors: (errors) => set({ errors }),

  setValidationErrors: (errors) => set({ validationErrors: errors }),

  setAnalysisConfig: (config) => set({ analysisConfig: config }),

  reset: () =>
    set({
      ...INITIAL_STATE,
      netMap: new Map<string, string>(),
      analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG },
    }),
}));
