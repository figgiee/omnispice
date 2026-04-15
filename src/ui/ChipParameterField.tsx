/**
 * Plan 05-05 — a single inline-chip parameter field.
 *
 * Combines two gestures on the same DOM span:
 *   1. Click-to-edit via the existing `useValueEdit` hook (keyboard path)
 *   2. Press-and-drag horizontal scrub via `useParameterScrub` (mouse path)
 *
 * The parent `InlineParameterChip` owns the list of fields and provides
 * `onFocusField` for Tab cycling. Each field calls `onFocusField(offset)`
 * from its keydown handler; InlineParameterChip resolves the target ref
 * from its field-ref array.
 */
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import {
  formatEngineeringNotation,
  parseEngineeringNotation,
} from '@/circuit/units';
import { useParameterScrub } from '@/canvas/components/useParameterScrub';
import { useValueEdit } from '@/canvas/components/useValueEdit';
import { useCircuitStore } from '@/store/circuitStore';
import styles from './InlineParameterChip.module.css';

export interface ChipParameterFieldProps {
  componentId: string;
  paramName: string;
  value: string;
  /**
   * Fired when the user cycles focus out of this field via Tab /
   * Shift+Tab. `offset = +1` for Tab, `-1` for Shift+Tab. Wraps at ends
   * inside the parent InlineParameterChip.
   */
  onFocusField: (offset: 1 | -1) => void;
}

export interface ChipParameterFieldHandle {
  focus: () => void;
}

/**
 * Heuristic scrub step — 1% of the current parsed value per pixel,
 * clamped so near-zero starts don't freeze the gesture. Plan 05-06+
 * may switch this to a per-parameter metadata lookup.
 */
function computeScrubStep(parsed: number): number {
  const abs = Math.abs(parsed);
  if (!Number.isFinite(abs) || abs === 0) return 0.01;
  return Math.max(abs * 0.01, 1e-9);
}

export const ChipParameterField = forwardRef<
  ChipParameterFieldHandle,
  ChipParameterFieldProps
>(function ChipParameterField({ componentId, paramName, value, onFocusField }, ref) {
  const spanRef = useRef<HTMLSpanElement>(null);
  useImperativeHandle(ref, () => ({
    focus: () => spanRef.current?.focus(),
  }));

  const { isEditing, editValue, setEditValue, inputRef, startEditing, handleKeyDown } =
    useValueEdit(value);

  const commitTextValue = useCallback(
    (next: string) => {
      useCircuitStore.getState().updateComponentParam(componentId, paramName, next);
    },
    [componentId, paramName],
  );

  const parsed = parseEngineeringNotation(value);

  const { mode, onPointerDown } = useParameterScrub({
    componentId,
    initialValue: Number.isFinite(parsed) ? parsed : 0,
    step: computeScrubStep(parsed),
    shiftForSweep: true,
    onChange: (n) => commitTextValue(formatEngineeringNotation(n)),
    onSweepCommit: (range) =>
      useCircuitStore
        .getState()
        .setSweepParam(componentId, { min: range.min, max: range.max, steps: 10 }),
  });

  const onSpanKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLSpanElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        onFocusField(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startEditing();
      }
    },
    [onFocusField, startEditing],
  );

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        className={`${styles.input} nodrag`}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={(e) => {
          // Commit on Enter before delegating to the shared handler, so
          // the store update happens while isEditing is still true.
          if (e.key === 'Enter') {
            commitTextValue(editValue);
          }
          handleKeyDown(e);
        }}
        onBlur={() => commitTextValue(editValue)}
        aria-label={`${paramName} value`}
        data-testid={`chip-field-input-${paramName}`}
      />
    );
  }

  const label =
    mode === 'sweeping' ? `${formatEngineeringNotation(parsed)} ↔ …` : value;

  return (
    <span
      ref={spanRef}
      className={`${styles.field} nodrag`}
      tabIndex={0}
      role="button"
      aria-label={`${paramName}: ${value}. Press Enter to edit or drag to scrub.`}
      data-mode={mode}
      data-param={paramName}
      data-testid={`chip-field-${paramName}`}
      onClick={startEditing}
      onPointerDown={onPointerDown}
      onKeyDown={onSpanKeyDown}
    >
      {label}
    </span>
  );
});
