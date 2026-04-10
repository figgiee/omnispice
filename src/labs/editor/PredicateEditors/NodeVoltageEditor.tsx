/**
 * NodeVoltageEditor — fields for a `node_voltage` checkpoint.
 *
 * Fields mirror `NodeVoltagePredicateSchema`: node, at, expected, tolerance.
 * Stateless controlled form — all edits flow through `onChange(nextPredicate)`.
 */
import type { NodeVoltagePredicate } from '@/labs/schema';

interface Props {
  predicate: NodeVoltagePredicate;
  onChange: (next: NodeVoltagePredicate) => void;
}

export function NodeVoltageEditor({ predicate, onChange }: Props) {
  return (
    <div className="predicate-editor predicate-editor--node-voltage">
      <label>
        Node
        <input
          type="text"
          value={predicate.node}
          onChange={(e) => onChange({ ...predicate, node: e.target.value })}
          placeholder="e.g. out"
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
        Expected (V)
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
