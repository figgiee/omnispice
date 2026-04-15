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

/**
 * Plan 05-07 — parameter sweep results used by `SweepFanOut`.
 *
 * When the user commits a Shift-scrub on a component (Plan 05-05) the
 * orchestrator runs one DC op-point per sample value via
 * `TieredSimulationController.runSweepPoint`. Each sample's full vector
 * set is stashed in `vectors[i]`, parallel to `values[i]`, so the
 * fan-out renderer can draw one curve per sample using a shared X axis.
 *
 * `null` when no sweep is active — SweepFanOut hides itself in that case.
 */
export interface SweepResults {
  /** refDesignator or component ID of the swept component. */
  componentId: string;
  /** Human-readable name shown in the legend, e.g. `R1.resistance`. */
  paramName: string;
  /** The parameter values sampled during the sweep, ascending. */
  values: number[];
  /** Results for each sample — `vectors[i]` corresponds to `values[i]`. */
  vectors: VectorData[][];
}

export interface SimulationState {
  status: SimStatus;
  elapsedTime: number;
  results: VectorData[];
  netMap: Map<string, string>;
  errors: TranslatedError[];
  validationErrors: ValidationError[];
  analysisConfig: AnalysisConfig;
  /** Plan 05-07 — active parameter-sweep fan-out results. */
  sweepResults: SweepResults | null;

  setStatus: (status: SimStatus) => void;
  setElapsedTime: (time: number) => void;
  setResults: (results: VectorData[], netMap?: Map<string, string>) => void;
  setErrors: (errors: TranslatedError[]) => void;
  setValidationErrors: (errors: ValidationError[]) => void;
  setAnalysisConfig: (config: AnalysisConfig) => void;
  /** Plan 05-07 — replace or clear the fan-out sweep set. */
  setSweepResults: (results: SweepResults | null) => void;
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
  sweepResults: null as SweepResults | null,
};

export const useSimulationStore = create<SimulationState>()((set) => ({
  ...INITIAL_STATE,

  setStatus: (status) => set({ status }),

  setElapsedTime: (time) => set({ elapsedTime: time }),

  setResults: (results, netMap) => set({ results, netMap: netMap ?? new Map<string, string>() }),

  setErrors: (errors) => set({ errors }),

  setValidationErrors: (errors) => set({ validationErrors: errors }),

  setAnalysisConfig: (config) => set({ analysisConfig: config }),

  setSweepResults: (sweepResults) => set({ sweepResults }),

  reset: () =>
    set({
      ...INITIAL_STATE,
      netMap: new Map<string, string>(),
      analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG },
      sweepResults: null,
    }),
}));
