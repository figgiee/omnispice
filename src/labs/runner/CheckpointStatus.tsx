/**
 * Checkpoint status chip.
 *
 * Presentational component — one chip per checkpoint, rendered in
 * StepPanel's checkpoint list. Shows pass/partial/fail/pending with an
 * accessible aria-label so screen readers can announce lab progress.
 */

import type { CheckpointStatus as Status } from '@/labs/evaluator';
import type { Checkpoint } from '@/labs/schema';

interface Props {
  checkpoint: Checkpoint;
  /** Current status, or undefined if the checkpoint has not been evaluated yet. */
  status: Status | undefined;
  /** 1-based index within the step, shown in the visible label. */
  index: number;
}

interface ChipStyle {
  symbol: string;
  label: string;
  color: string;
  background: string;
}

const STYLES: Record<Status | 'pending', ChipStyle> = {
  pass: {
    symbol: '✓',
    label: 'passed',
    color: '#0a6b1c',
    background: '#d6f5dc',
  },
  partial: {
    symbol: '◐',
    label: 'partial credit',
    color: '#7a4a00',
    background: '#fff3d4',
  },
  fail: {
    symbol: '✗',
    label: 'failed',
    color: '#8a1a1a',
    background: '#fbd6d6',
  },
  pending: {
    symbol: '○',
    label: 'not yet evaluated',
    color: '#5a5a5a',
    background: '#eaeaea',
  },
};

export function CheckpointStatusChip({ checkpoint, status, index }: Props) {
  const key = status ?? 'pending';
  const style = STYLES[key];
  // Visible label is the human index ("Checkpoint 1") — we deliberately
  // avoid rendering `checkpoint.id` or any predicate-specific signal
  // (like node names) as visible text because the lab-runner RED test
  // uses `getByText` with a regex that would collide with other UI copy.
  // The aria-label still carries the full id + status for screen readers.
  const ariaLabel = `Checkpoint ${checkpoint.label ?? checkpoint.id}: ${style.label}`;
  return (
    <li
      aria-label={ariaLabel}
      data-testid={`checkpoint-${checkpoint.id}`}
      data-status={key}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 6,
        background: style.background,
        color: style.color,
        fontSize: 13,
        fontWeight: 500,
        listStyle: 'none',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
        {style.symbol}
      </span>
      <span>Checkpoint {index}</span>
    </li>
  );
}
