/**
 * Lab runtime state slice (LAB-02).
 *
 * Mirrors classroomStore — only the currently-active lab entity IDs and
 * per-checkpoint evaluation results. Lab definitions (and the associated
 * reference CSVs) live in TanStack Query cache.
 *
 * Convention (from 04-CONTEXT.md): NO Maps. Use a plain Record keyed by
 * `${stepId}:${checkpointId}`. Matches the overlayStore Record pattern.
 */

import { create } from 'zustand';
import type { CheckpointStatus } from '@/labs/evaluator';

/** Build a composite key for the checkpointResults record. */
export function checkpointResultKey(stepId: string, checkpointId: string): string {
  return `${stepId}:${checkpointId}`;
}

export interface LabState {
  /** Currently-open lab document ID (R2 key stem), or null when no lab is active. */
  activeLabId: string | null;
  /** Currently-open attempt ID (from POST /api/labs/:id/attempts), or null. */
  activeAttemptId: string | null;
  /** Which step (0-indexed) the student is viewing inside the active lab. */
  activeStepIdx: number;
  /**
   * Last-known result for every checkpoint the runner has evaluated.
   * Keyed by `${stepId}:${checkpointId}` (see checkpointResultKey).
   * Plain Record — never a Map, per the zustand slice convention.
   */
  checkpointResults: Record<string, CheckpointStatus>;
  /** True while the pure evaluator is running (should be sub-millisecond). */
  isEvaluating: boolean;

  setActiveLab: (labId: string, attemptId: string | null) => void;
  setActiveAttempt: (attemptId: string | null) => void;
  setActiveStep: (idx: number) => void;
  setCheckpointResult: (
    stepId: string,
    checkpointId: string,
    result: CheckpointStatus,
  ) => void;
  setCheckpointResults: (results: Record<string, CheckpointStatus>) => void;
  setEvaluating: (value: boolean) => void;
  clearResults: () => void;
  exit: () => void;
}

const INITIAL_STATE = {
  activeLabId: null as string | null,
  activeAttemptId: null as string | null,
  activeStepIdx: 0,
  checkpointResults: {} as Record<string, CheckpointStatus>,
  isEvaluating: false,
};

/**
 * useLabStore — active lab runtime slice.
 *
 * Action semantics:
 * - `setActiveLab` resets step index and results. Opening a different lab
 *   should never inherit progress from a previous one.
 * - `setCheckpointResult` merges a single result without clobbering others.
 * - `clearResults` keeps the lab open but flushes evaluations (e.g., after
 *   a student reset).
 * - `exit` returns the slice to its initial state.
 */
export const useLabStore = create<LabState>()((set) => ({
  ...INITIAL_STATE,

  setActiveLab: (labId, attemptId) =>
    set({
      activeLabId: labId,
      activeAttemptId: attemptId,
      activeStepIdx: 0,
      checkpointResults: {},
      isEvaluating: false,
    }),

  setActiveAttempt: (attemptId) => set({ activeAttemptId: attemptId }),

  setActiveStep: (idx) => set({ activeStepIdx: Math.max(0, idx) }),

  setCheckpointResult: (stepId, checkpointId, result) =>
    set((state) => ({
      checkpointResults: {
        ...state.checkpointResults,
        [checkpointResultKey(stepId, checkpointId)]: result,
      },
    })),

  setCheckpointResults: (results) => set({ checkpointResults: results }),

  setEvaluating: (value) => set({ isEvaluating: value }),

  clearResults: () => set({ checkpointResults: {}, isEvaluating: false }),

  exit: () => set({ ...INITIAL_STATE }),
}));
