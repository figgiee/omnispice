/**
 * Step panel — renders the active step's instructions and checkpoint
 * chip list. Mirrors the Phase 3 RenderedInstructions sanitization
 * pattern: marked({ async: false }) + DOMPurify.
 *
 * Markdown is sanitized inside a useMemo so the expensive parse+sanitize
 * runs only when the instructions text changes, not on every re-render
 * triggered by a new simulation result.
 */

import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo } from 'react';
import type { CheckpointStatus } from '@/labs/evaluator';
import type { Step } from '@/labs/schema';
import { checkpointResultKey } from '@/store/labStore';
import { CheckpointStatusChip } from './CheckpointStatus';

interface Props {
  step: Step;
  /** Full Record from labStore.checkpointResults (keyed `${stepId}:${cpId}`). */
  results: Record<string, CheckpointStatus>;
  /** Current step index — used to enable/disable navigation buttons. */
  stepIdx: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
}

export function StepPanel({ step, results, stepIdx, totalSteps, onPrev, onNext }: Props) {
  // Parse markdown once per instructions change. marked v15 requires
  // `{ async: false }` to return a string synchronously (Phase 3 Pitfall 4).
  const html = useMemo(() => {
    if (!step.instructions) return '';
    const raw = marked.parse(step.instructions, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [step.instructions]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 16,
      }}
    >
      <header>
        <div
          style={{ fontSize: 11, textTransform: 'uppercase', color: '#888', letterSpacing: 0.5 }}
        >
          Step {stepIdx + 1} of {totalSteps}
        </div>
        <h2 style={{ margin: '4px 0 0 0', fontSize: 18, fontWeight: 600 }}>{step.title}</h2>
      </header>

      {html ? (
        <div
          className="lab-instructions-body"
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--text-primary, #222)',
          }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by DOMPurify
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}

      <section aria-label="Checkpoints">
        <h3
          style={{ fontSize: 13, textTransform: 'uppercase', color: '#888', margin: '0 0 8px 0' }}
        >
          Checkpoints
        </h3>
        <ul
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}
        >
          {step.checkpoints.map((cp, i) => (
            <CheckpointStatusChip
              key={cp.id}
              checkpoint={cp}
              status={results[checkpointResultKey(step.id, cp.id)]}
              index={i + 1}
            />
          ))}
        </ul>
      </section>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={onPrev}
          disabled={stepIdx === 0}
          style={{ padding: '6px 12px' }}
        >
          Previous step
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={stepIdx >= totalSteps - 1}
          style={{ padding: '6px 12px' }}
        >
          Next step
        </button>
      </div>
    </div>
  );
}
