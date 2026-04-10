/**
 * WaveformMatchEditor — fields for a `waveform_match` checkpoint.
 *
 * `reference_key` is populated by the referenceRunner at save time, so it is
 * displayed read-only here; the instructor cannot edit it by hand.
 */
import type { WaveformMatchPredicate } from '@/labs/schema';

interface Props {
  predicate: WaveformMatchPredicate;
  onChange: (next: WaveformMatchPredicate) => void;
}

export function WaveformMatchEditor({ predicate, onChange }: Props) {
  return (
    <div className="predicate-editor predicate-editor--waveform-match">
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
        Reference key (auto-populated on save)
        <input
          type="text"
          value={predicate.reference_key}
          readOnly
          placeholder="Generated when you save the lab"
        />
      </label>
      <label>
        Metric
        <select
          value={predicate.metric}
          onChange={(e) =>
            onChange({ ...predicate, metric: e.target.value as 'rmse' | 'max_abs' })
          }
        >
          <option value="rmse">RMSE</option>
          <option value="max_abs">Max absolute</option>
        </select>
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
