/**
 * AcGainAtEditor — fields for an `ac_gain_at` checkpoint.
 *
 * Gain is expressed in dB; the expected value and tolerance both sit in the
 * dB domain, matching the evaluator which does `20*log10|probe|(f)`.
 */
import type { AcGainAtPredicate } from '@/labs/schema';

interface Props {
  predicate: AcGainAtPredicate;
  onChange: (next: AcGainAtPredicate) => void;
}

export function AcGainAtEditor({ predicate, onChange }: Props) {
  return (
    <div className="predicate-editor predicate-editor--ac-gain-at">
      <label>
        Probe
        <input
          type="text"
          value={predicate.probe}
          onChange={(e) => onChange({ ...predicate, probe: e.target.value })}
          placeholder="e.g. v(out)"
        />
      </label>
      <label>
        Frequency (Hz)
        <input
          type="number"
          min={0}
          step="any"
          value={predicate.frequency}
          onChange={(e) => onChange({ ...predicate, frequency: Number(e.target.value) })}
        />
      </label>
      <label>
        Expected gain (dB)
        <input
          type="number"
          step="any"
          value={predicate.expected_db}
          onChange={(e) => onChange({ ...predicate, expected_db: Number(e.target.value) })}
        />
      </label>
      <label>
        Tolerance (dB)
        <input
          type="number"
          step="any"
          min={0}
          value={predicate.tolerance_db}
          onChange={(e) => onChange({ ...predicate, tolerance_db: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}
