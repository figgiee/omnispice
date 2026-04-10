/**
 * CircuitContainsEditor — fields for a `circuit_contains` checkpoint.
 *
 * Counts components of a given kind with an optional min/max range. `count_max`
 * is wiped from the predicate when the instructor empties the input, so the
 * schema's `optional()` branch is preserved.
 */
import type { CircuitContainsPredicate } from '@/labs/schema';

const COMPONENT_KINDS = [
  'resistor',
  'capacitor',
  'inductor',
  'diode',
  'voltage_source',
  'current_source',
  'bjt_npn',
  'bjt_pnp',
  'nmos',
  'pmos',
  'op_amp',
  'ground',
] as const;

interface Props {
  predicate: CircuitContainsPredicate;
  onChange: (next: CircuitContainsPredicate) => void;
}

export function CircuitContainsEditor({ predicate, onChange }: Props) {
  return (
    <div className="predicate-editor predicate-editor--circuit-contains">
      <label>
        Component kind
        <select
          value={predicate.component}
          onChange={(e) => onChange({ ...predicate, component: e.target.value })}
        >
          {COMPONENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label>
        Minimum count
        <input
          type="number"
          min={0}
          step={1}
          value={predicate.count_min}
          onChange={(e) =>
            onChange({ ...predicate, count_min: Number.parseInt(e.target.value, 10) || 0 })
          }
        />
      </label>
      <label>
        Maximum count (optional)
        <input
          type="number"
          min={1}
          step={1}
          value={predicate.count_max ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              const { count_max: _drop, ...rest } = predicate;
              onChange(rest as CircuitContainsPredicate);
            } else {
              onChange({ ...predicate, count_max: Number.parseInt(raw, 10) || 1 });
            }
          }}
        />
      </label>
    </div>
  );
}
