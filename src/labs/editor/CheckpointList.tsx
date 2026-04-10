/**
 * CheckpointList — per-step checkpoint authoring UI.
 *
 * Renders a row per checkpoint with label + weight + kind selector + the
 * kind-specific PredicateEditor. Adding a checkpoint appends a blank
 * `node_voltage` entry (the simplest valid predicate). Deleting removes the
 * row. Every edit flows through `onChange(nextCheckpoints)` so the parent
 * owns state and can feed it into the outer form validator.
 */
import type { Checkpoint } from '@/labs/schema';
import { PredicateEditor } from './PredicateEditors';

interface Props {
  checkpoints: Checkpoint[];
  onChange: (next: Checkpoint[]) => void;
}

type Kind = Checkpoint['kind'];

/** Build a blank checkpoint of a given kind with sensible defaults. */
function blankCheckpoint(kind: Kind, index: number): Checkpoint {
  const id = `cp-${Date.now().toString(36)}-${index}`;
  switch (kind) {
    case 'node_voltage':
      return { kind, id, weight: 1, node: 'out', at: 0, expected: 0, tolerance: 0.05 };
    case 'branch_current':
      return { kind, id, weight: 1, branch: 'R1', at: 0, expected: 0, tolerance: 0.001 };
    case 'waveform_match':
      return {
        kind,
        id,
        weight: 1,
        probe: 'v(out)',
        reference_key: '',
        metric: 'rmse',
        tolerance: 0.1,
      };
    case 'circuit_contains':
      return { kind, id, weight: 1, component: 'resistor', count_min: 1 };
    case 'ac_gain_at':
      return {
        kind,
        id,
        weight: 1,
        probe: 'v(out)',
        frequency: 1000,
        expected_db: 0,
        tolerance_db: 1,
      };
  }
}

export function CheckpointList({ checkpoints, onChange }: Props) {
  function updateAt(index: number, next: Checkpoint) {
    const copy = checkpoints.slice();
    copy[index] = next;
    onChange(copy);
  }

  function deleteAt(index: number) {
    const copy = checkpoints.slice();
    copy.splice(index, 1);
    onChange(copy);
  }

  function addBlank() {
    onChange([...checkpoints, blankCheckpoint('node_voltage', checkpoints.length)]);
  }

  function changeKind(index: number, kind: Kind) {
    const current = checkpoints[index];
    if (!current || current.kind === kind) return;
    // Create a fresh predicate of the new kind, preserving id + label + weight.
    const fresh = blankCheckpoint(kind, index);
    updateAt(index, {
      ...fresh,
      id: current.id,
      weight: current.weight,
      ...(current.label !== undefined ? { label: current.label } : {}),
    } as Checkpoint);
  }

  return (
    <div data-testid="checkpoint-list">
      <h3>Checkpoints</h3>
      {checkpoints.length === 0 ? (
        <p style={{ color: '#888' }}>No checkpoints yet. Add one below.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {checkpoints.map((cp, index) => (
            <li
              key={cp.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 4,
                padding: '0.75rem',
                marginBottom: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ flex: 1 }}>
                  Label
                  <input
                    type="text"
                    value={cp.label ?? ''}
                    onChange={(e) => updateAt(index, { ...cp, label: e.target.value })}
                    placeholder={`Checkpoint ${index + 1}`}
                  />
                </label>
                <label>
                  Weight
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={cp.weight}
                    onChange={(e) =>
                      updateAt(index, { ...cp, weight: Number(e.target.value) || 1 })
                    }
                    style={{ width: '4rem' }}
                  />
                </label>
                <label>
                  Kind
                  <select
                    value={cp.kind}
                    onChange={(e) => changeKind(index, e.target.value as Kind)}
                  >
                    <option value="node_voltage">Node voltage</option>
                    <option value="branch_current">Branch current</option>
                    <option value="waveform_match">Waveform match</option>
                    <option value="circuit_contains">Circuit contains</option>
                    <option value="ac_gain_at">AC gain at</option>
                  </select>
                </label>
                <button
                  type="button"
                  aria-label={`Delete checkpoint ${index + 1}`}
                  onClick={() => deleteAt(index)}
                  style={{ color: '#c00' }}
                >
                  Remove
                </button>
              </div>
              <PredicateEditor
                predicate={cp}
                onChange={(next) => updateAt(index, next)}
              />
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={addBlank}>
        + Add checkpoint
      </button>
    </div>
  );
}
