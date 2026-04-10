/**
 * useLabRunner — ties the pure predicate evaluator to Phase 1 zustand
 * stores and the labStore slice.
 *
 * Design contract (from LabRunner.test.tsx + the plan's must_haves):
 *   - Re-evaluate every checkpoint in the active step whenever
 *     `simulationStore.results` changes.
 *   - Write results into `labStore.setCheckpointResults` so the chip list
 *     is reactive with zero per-render cost.
 *   - Compute a weighted score as
 *       Σ weight * (pass:1 | partial:0.5 | fail:0) / Σ weight
 *     over the CURRENT step's checkpoints (not the whole lab) so
 *     students see immediate feedback.
 *
 * The hook accepts the Lab + an optional `references` map directly —
 * no TanStack Query inside the hook, so it can be used in tests that
 * render `<LabRunner lab={...} />` without a QueryClientProvider.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useCircuitStore } from '@/store/circuitStore';
import { useSimulationStore } from '@/store/simulationStore';
import { checkpointResultKey, useLabStore } from '@/store/labStore';
import type { Checkpoint, Lab, Step } from '@/labs/schema';
import {
  evaluateCheckpoints,
  type CheckpointEvaluation,
  type CheckpointStatus,
  type EvalCircuit,
  type EvalContext,
  type EvalVector,
} from '@/labs/evaluator';

export interface UseLabRunnerArgs {
  lab: Lab;
  /** reference_key → parsed CSV. Callers pre-load from R2 + parseReferenceCsv. */
  references?: Record<string, { time: Float64Array; value: Float64Array }>;
  /**
   * Test hook — fires on every evaluation pass with the raw result map.
   * Used by LabRunner.test.tsx to assert re-evaluation happened.
   */
  onEvaluate?: (results: Record<string, CheckpointEvaluation>) => void;
}

export interface LabRunnerView {
  lab: Lab;
  activeStep: Step | null;
  activeStepIdx: number;
  /** Per-checkpoint status for the active step only (keyed by cp.id). */
  stepResults: Record<string, CheckpointStatus>;
  /** Number of checkpoints with status === 'pass' in the active step. */
  passedCount: number;
  /** Total checkpoints in the active step. */
  totalCount: number;
  /** Σ weight * passWeight(status) for the active step. */
  score: number;
  /** Σ weight for the active step. */
  totalWeight: number;
}

const PASS_WEIGHT: Record<CheckpointStatus, number> = {
  pass: 1,
  partial: 0.5,
  fail: 0,
};

/** Normalize the circuit store's Map to the EvalCircuit shape. */
function circuitToEval(components: Map<string, { type: string }>): EvalCircuit {
  return { components: Array.from(components.values()).map((c) => ({ type: c.type })) };
}

export function useLabRunner({
  lab,
  references,
  onEvaluate,
}: UseLabRunnerArgs): LabRunnerView {
  // labStore: active step index + results record.
  const activeStepIdx = useLabStore((s) => s.activeStepIdx);
  const setCheckpointResults = useLabStore((s) => s.setCheckpointResults);
  const allResults = useLabStore((s) => s.checkpointResults);

  // Simulation + circuit inputs that drive evaluation.
  const vectors = useSimulationStore((s) => s.results);
  const components = useCircuitStore((s) => s.circuit.components);

  const activeStep: Step | null = lab.steps[activeStepIdx] ?? null;

  // onEvaluate is a test hook — keep it in a ref so callers don't have to
  // memoize. The effect below reads `.current` when it fires.
  const onEvaluateRef = useRef(onEvaluate);
  useEffect(() => {
    onEvaluateRef.current = onEvaluate;
  }, [onEvaluate]);

  // Evaluate on: mount, new sim results, circuit change, step change.
  // We write results into labStore so the StepPanel chip list stays reactive
  // across the entire store-subscribed tree, not just this hook's consumer.
  useEffect(() => {
    if (!activeStep) {
      setCheckpointResults({});
      onEvaluateRef.current?.({});
      return;
    }
    const ctx: EvalContext = {
      vectors: vectors as EvalVector[],
      circuit: circuitToEval(components as Map<string, { type: string }>),
      ...(references ? { references } : {}),
    };
    const stepResults = evaluateCheckpoints(activeStep.checkpoints, ctx);

    // Merge into the labStore record keyed by `${stepId}:${cpId}`.
    const merged: Record<string, CheckpointStatus> = { ...allResults };
    for (const [cpId, evalResult] of Object.entries(stepResults)) {
      merged[checkpointResultKey(activeStep.id, cpId)] = evalResult.status;
    }
    setCheckpointResults(merged);

    onEvaluateRef.current?.(stepResults);
    // allResults is intentionally NOT in the dep list — it's the receiver of
    // our writes, depending on it would loop. setCheckpointResults is a
    // stable zustand action reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, vectors, components, references, setCheckpointResults]);

  // Derive the current-step view: per-cp statuses, passed count, weighted score.
  return useMemo<LabRunnerView>(() => {
    if (!activeStep) {
      return {
        lab,
        activeStep: null,
        activeStepIdx,
        stepResults: {},
        passedCount: 0,
        totalCount: 0,
        score: 0,
        totalWeight: 0,
      };
    }
    const stepResults: Record<string, CheckpointStatus> = {};
    let score = 0;
    let totalWeight = 0;
    let passedCount = 0;
    for (const cp of activeStep.checkpoints as Checkpoint[]) {
      const status = allResults[checkpointResultKey(activeStep.id, cp.id)];
      const weight = cp.weight;
      totalWeight += weight;
      if (status) {
        stepResults[cp.id] = status;
        score += weight * PASS_WEIGHT[status];
        if (status === 'pass') passedCount += 1;
      }
    }
    return {
      lab,
      activeStep,
      activeStepIdx,
      stepResults,
      passedCount,
      totalCount: activeStep.checkpoints.length,
      score,
      totalWeight,
    };
  }, [lab, activeStep, activeStepIdx, allResults]);
}
