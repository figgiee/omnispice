/**
 * BranchCurrentEditor — fields for a `branch_current` checkpoint.
 *
 * Fields mirror `BranchCurrentPredicateSchema`: branch, at, expected, tolerance.
 */
import type { BranchCurrentPredicate } from '@/labs/schema';

interface Props {
  predicate: BranchCurrentPredicate;
  onChange: (next: BranchCurrentPredicate) => void;
}

export function BranchCurrentEditor({ predicate, onChange }: Props) {
  return (
    <div className="predicate-editor predicate-editor--branch-current">
      <label>
        Branch element
        <input
          type="text"
          value={predicate.branch}
          onChange={(e) => onChange({ ...predicate, branch: e.target.value })}
          placeholder="e.g. R1"
        />
      </label>
      <label>
        At time (s)
        <input
          type="number"
          step="any"
          value={predicate.at}
          onChange={(e) => onChange({ ...predicate, at: Number(e.target.value) })}
        />
      </label>
      <label>
        Expected (A)
        <input
          type="number"
          step="any"
          value={predicate.expected}
          onChange={(e) => onChange({ ...predicate, expected: Number(e.target.value) })}
        />
      </label>
      <label>
        Tolerance
        <input
          type="number"
          step="any"
          value={predicate.tolerance}
          min={0}
          onChange={(e) => onChange({ ...predicate, tolerance: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}
