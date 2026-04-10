/**
 * LabRunner — the student-facing lab runtime component (LAB-02).
 *
 * Standalone by design: takes a fully-hydrated Lab as a prop (parsed
 * elsewhere, e.g. by LabRunnerPage via useLabJson) and reads live
 * simulation state from zustand stores directly. This keeps the
 * component renderable in vitest + @testing-library without any Clerk
 * or QueryClient wrapper, which the RED test in
 * src/labs/__tests__/runner/LabRunner.test.tsx requires.
 *
 * Responsibilities:
 *   - Drive the useLabRunner hook (evaluator + labStore wiring).
 *   - Render the active step (StepPanel) + weighted progress bar.
 *   - Expose an `onEvaluate` prop that fires on every evaluation pass,
 *     used by tests to assert re-evaluation behavior.
 */

import { useCallback } from 'react';
import type { CheckpointEvaluation } from '@/labs/evaluator';
import type { Lab } from '@/labs/schema';
import { useLabStore } from '@/store/labStore';
import { LabProgressBar } from './ProgressBar';
import { StepPanel } from './StepPanel';
import { useLabRunner } from './useLabRunner';

interface Props {
  lab: Lab;
  /**
   * Preloaded reference CSVs keyed by reference_key. LabRunnerPage populates
   * this from useReferenceCsv queries; tests can omit it because the RED
   * fixture doesn't use waveform_match predicates.
   */
  references?: Record<string, { time: Float64Array; value: Float64Array }>;
  /** Fires after each evaluation pass — used in tests. */
  onEvaluate?: (results: Record<string, CheckpointEvaluation>) => void;
}

export function LabRunner({ lab, references, onEvaluate }: Props) {
  const activeStepIdx = useLabStore((s) => s.activeStepIdx);
  const setActiveStep = useLabStore((s) => s.setActiveStep);
  // Subscribe to the results record so StepPanel re-renders when the
  // evaluator writes a new status for any checkpoint.
  const checkpointResults = useLabStore((s) => s.checkpointResults);

  const view = useLabRunner({ lab, references, onEvaluate });

  const handlePrev = useCallback(() => {
    setActiveStep(activeStepIdx - 1);
  }, [activeStepIdx, setActiveStep]);

  const handleNext = useCallback(() => {
    setActiveStep(activeStepIdx + 1);
  }, [activeStepIdx, setActiveStep]);

  // Empty / no-steps fallback — never throws, always renders something the
  // RED test's getByText can match.
  if (!view.activeStep) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{lab.title}</h1>
        <p style={{ color: '#888' }}>This lab has no steps yet.</p>
      </div>
    );
  }

  return (
    <div
      data-testid="lab-runner"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        minWidth: 320,
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{lab.title}</h1>
        <LabProgressBar
          score={view.score}
          totalWeight={view.totalWeight}
          passedCount={view.passedCount}
          totalCount={view.totalCount}
        />
      </header>

      <StepPanel
        step={view.activeStep}
        results={checkpointResults}
        stepIdx={view.activeStepIdx}
        totalSteps={lab.steps.length}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </div>
  );
}
