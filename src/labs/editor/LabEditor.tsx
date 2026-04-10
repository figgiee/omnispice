/**
 * LabEditor — top-level instructor authoring shell.
 *
 * Layout:
 *   ┌─────────── Toolbar (title, Save, Try as student) ────────────┐
 *   ├──────────────┬────────────────────────────────────────────────┤
 *   │  StepList    │  Active step instructions + CheckpointList    │
 *   └──────────────┴────────────────────────────────────────────────┘
 *
 * Validation: on Save we run the full draft through `LabSchema.safeParse`
 * and surface any Zod issues inline. This is cheaper than wiring
 * react-hook-form around the whole nested tree and matches how the RED
 * tests (04-04) exercise the parse path.
 *
 * Controlled component — owns no lab state itself. The parent page passes
 * `lab` and receives a new draft via `onChange` for autosave, or a final
 * Lab via `onSave` for the reference-runner handoff.
 */
import { useMemo, useState } from 'react';
import { type Lab, LabSchema, type Step } from '@/labs/schema';
import { CheckpointList } from './CheckpointList';
import { StepList } from './StepList';

interface Props {
  lab: Lab;
  onChange: (next: Lab) => void;
  onSave: (lab: Lab) => Promise<void> | void;
  onPreviewAsStudent?: () => void;
  saving?: boolean;
}

export function LabEditor({ lab, onChange, onSave, onPreviewAsStudent, saving = false }: Props) {
  const [activeStepId, setActiveStepId] = useState<string | null>(lab.steps[0]?.id ?? null);
  const [issues, setIssues] = useState<string[]>([]);

  const activeStep = useMemo(
    () => lab.steps.find((s) => s.id === activeStepId) ?? null,
    [lab.steps, activeStepId],
  );

  function updateStep(next: Step) {
    onChange({
      ...lab,
      steps: lab.steps.map((s) => (s.id === next.id ? next : s)),
    });
  }

  function addStep() {
    const id = `step-${Date.now().toString(36)}`;
    const next: Step = {
      id,
      title: `Step ${lab.steps.length + 1}`,
      instructions: '',
      checkpoints: [],
    };
    onChange({ ...lab, steps: [...lab.steps, next] });
    setActiveStepId(id);
  }

  function deleteStep(id: string) {
    const remaining = lab.steps.filter((s) => s.id !== id);
    onChange({ ...lab, steps: remaining });
    if (activeStepId === id) {
      setActiveStepId(remaining[0]?.id ?? null);
    }
  }

  function reorderSteps(next: Array<Pick<Step, 'id' | 'title' | 'checkpoints'>>) {
    // Rebuild by picking full step objects from the existing list, preserving
    // instructions which the sortable only tracks by id/title/checkpoints.
    const byId = new Map(lab.steps.map((s) => [s.id, s] as const));
    const rebuilt = next.map((partial) => byId.get(partial.id)).filter((s): s is Step => !!s);
    onChange({ ...lab, steps: rebuilt });
  }

  async function handleSave() {
    const parsed = LabSchema.safeParse(lab);
    if (!parsed.success) {
      setIssues(parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`));
      return;
    }
    setIssues([]);
    await onSave(parsed.data);
  }

  return (
    <div className="lab-editor" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="lab-editor__toolbar" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="text"
          value={lab.title}
          onChange={(e) => onChange({ ...lab, title: e.target.value })}
          placeholder="Lab title"
          style={{ flex: 1, fontSize: '1.1rem', fontWeight: 600, padding: '0.5rem' }}
        />
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {onPreviewAsStudent && (
          <button type="button" onClick={onPreviewAsStudent}>
            Try as student
          </button>
        )}
      </div>

      <textarea
        value={lab.description ?? ''}
        onChange={(e) => onChange({ ...lab, description: e.target.value })}
        placeholder="Lab description (markdown supported)"
        rows={3}
        style={{ width: '100%', padding: '0.5rem' }}
      />

      {issues.length > 0 && (
        <div className="lab-editor__issues" style={{ border: '1px solid #c00', padding: '0.5rem', color: '#c00' }}>
          <strong>Validation errors:</strong>
          <ul>
            {issues.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="lab-editor__body" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1rem' }}>
        <aside>
          <h3>Steps</h3>
          <StepList
            steps={lab.steps}
            activeStepId={activeStepId}
            onOrderChange={reorderSteps}
            onDelete={deleteStep}
            onSelect={setActiveStepId}
          />
          <button type="button" onClick={addStep} style={{ marginTop: '0.5rem', width: '100%' }}>
            + Add step
          </button>
        </aside>

        <main>
          {activeStep ? (
            <>
              <label>
                Step title
                <input
                  type="text"
                  value={activeStep.title}
                  onChange={(e) => updateStep({ ...activeStep, title: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </label>
              <label>
                Instructions (markdown)
                <textarea
                  value={activeStep.instructions}
                  onChange={(e) => updateStep({ ...activeStep, instructions: e.target.value })}
                  rows={6}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </label>
              <CheckpointList
                checkpoints={activeStep.checkpoints}
                onChange={(next) => updateStep({ ...activeStep, checkpoints: next })}
              />
            </>
          ) : (
            <p>Select a step from the left, or add one to get started.</p>
          )}
        </main>
      </div>
    </div>
  );
}
