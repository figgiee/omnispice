/**
 * Plan 05-05 Task 2 — InlineParameterChip render + commit behavior.
 *
 * The chip uses `@xyflow/react`'s store for viewport transform tracking,
 * so tests wrap the component in a `ReactFlowProvider`. The anchor
 * element is a manually-inserted DOM node with `data-id`, matching
 * what React Flow renders at runtime.
 *
 * Tab cycling is tested here as a unit-level behavior because the
 * ChipParameterField exposes an imperative focus() handle that makes
 * assertions deterministic without a full Playwright round-trip.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from '@/store/circuitStore';
import { useUiStore } from '@/store/uiStore';
import { InlineParameterChip } from '../InlineParameterChip';

function renderChip() {
  return render(
    <ReactFlowProvider>
      <InlineParameterChip />
    </ReactFlowProvider>,
  );
}

/** Seed a single resistor and insert a matching React Flow DOM anchor. */
function seedResistor(id = 'seed-r') {
  const realId = useCircuitStore.getState().addComponent('resistor', { x: 100, y: 100 });
  // Anchor DOM element — the chip queries `.react-flow__node[data-id="..."]`.
  const anchor = document.createElement('div');
  anchor.className = 'react-flow__node';
  anchor.setAttribute('data-id', realId);
  document.body.appendChild(anchor);
  return { id: realId, anchor, seedId: id };
}

beforeEach(() => {
  // Reset both stores so tests don't leak state.
  useCircuitStore.getState().clearCircuit();
  useUiStore.setState({
    selectedComponentIds: [],
    chipTargetId: null,
    chipFocusedParam: null,
  });
});

afterEach(() => {
  // Clean DOM anchors.
  for (const el of document.querySelectorAll('.react-flow__node')) {
    el.remove();
  }
});

describe('InlineParameterChip (Plan 05-05)', () => {
  it('renders nothing when chipTargetId is null', () => {
    renderChip();
    expect(screen.queryByTestId('inline-parameter-chip')).toBeNull();
  });

  it('renders with the component ref designator when targeted', () => {
    const { id } = seedResistor();
    useUiStore.getState().setChipTarget(id);
    renderChip();
    const chip = screen.getByTestId('inline-parameter-chip');
    expect(chip).toBeInTheDocument();
    // Resistor is the first `R*` allocated — ref designator is "R1".
    expect(chip.textContent).toContain('R1');
    expect(chip.textContent).toContain('1k');
  });

  it('commits an edited value to circuitStore on Enter', () => {
    const { id } = seedResistor();
    useUiStore.getState().setChipTarget(id);
    renderChip();

    const valueField = screen.getByTestId('chip-field-value');
    // Click to enter edit mode.
    act(() => {
      fireEvent.click(valueField);
    });
    const input = screen.getByTestId('chip-field-input-value') as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: '2.2k' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    const after = useCircuitStore.getState().circuit.components.get(id);
    expect(after?.value).toBe('2.2k');
  });

  it('Tab moves focus between fields when the chip has multiple params', () => {
    // Create a DC voltage source, then bolt a second param onto it so the
    // chip has a multi-field layout to cycle through.
    const id = useCircuitStore.getState().addComponent('dc_voltage', { x: 0, y: 0 });
    useCircuitStore.getState().updateComponentParam(id, 'tran_ramp', '1m');
    const anchor = document.createElement('div');
    anchor.className = 'react-flow__node';
    anchor.setAttribute('data-id', id);
    document.body.appendChild(anchor);

    useUiStore.getState().setChipTarget(id);
    renderChip();

    const valueField = screen.getByTestId('chip-field-value');
    const rampField = screen.getByTestId('chip-field-tran_ramp');

    // Focus the primary value field, then Tab — focus should land on ramp.
    valueField.focus();
    expect(document.activeElement).toBe(valueField);
    act(() => {
      fireEvent.keyDown(valueField, { key: 'Tab' });
    });
    expect(document.activeElement).toBe(rampField);

    // Shift+Tab back.
    act(() => {
      fireEvent.keyDown(rampField, { key: 'Tab', shiftKey: true });
    });
    expect(document.activeElement).toBe(valueField);
  });
});
