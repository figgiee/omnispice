/**
 * Weighted lab progress bar (LAB-02).
 *
 * Renders a horizontal progress bar with ARIA progressbar semantics. The
 * caller is responsible for computing the score from checkpoint results
 * (see computeWeightedScore in useLabRunner) — this component is purely
 * presentational.
 */

interface Props {
  /** Weighted score so far (pass = 1 * weight, partial = 0.5 * weight, fail = 0). */
  score: number;
  /** Sum of weights for every checkpoint in scope (step or lab). */
  totalWeight: number;
  /** Number of checkpoints that have been fully passed (for the caption). */
  passedCount: number;
  /** Total number of checkpoints in scope (for the caption). */
  totalCount: number;
}

export function LabProgressBar({ score, totalWeight, passedCount, totalCount }: Props) {
  const pct =
    totalWeight > 0 ? Math.max(0, Math.min(100, Math.round((score / totalWeight) * 100))) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Lab progress: ${pct}% (${passedCount} of ${totalCount} checkpoints passed)`}
        style={{
          width: '100%',
          height: 10,
          borderRadius: 5,
          background: '#e0e0e0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: pct === 100 ? '#0a6b1c' : '#2563eb',
            transition: 'width 160ms ease-out',
          }}
        />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary, #555)' }}>
        Lab progress: {pct}% ({passedCount} of {totalCount} checkpoints passed)
      </div>
    </div>
  );
}
