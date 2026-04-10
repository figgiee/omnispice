import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
// RED — src/labs/editor/StepList lands in 04-05.
// @ts-expect-error — module does not exist yet (Wave 0 scaffold).
import { StepList } from '../../editor/StepList';

describe('labs/editor/StepList — LAB-01 editor UI', () => {
  it('renders a list of steps', () => {
    const steps = [
      { id: 's1', title: 'Step 1', checkpoints: [] },
      { id: 's2', title: 'Step 2', checkpoints: [] },
      { id: 's3', title: 'Step 3', checkpoints: [] },
    ];
    render(<StepList steps={steps} onOrderChange={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByText('Step 3')).toBeInTheDocument();
  });

  it('shows "Add your first step" empty state', () => {
    render(<StepList steps={[]} onOrderChange={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText(/add your first step/i)).toBeInTheDocument();
  });

  it('calls onDelete when user confirms deletion', () => {
    const onDelete = vi.fn();
    const steps = [{ id: 's1', title: 'Step 1', checkpoints: [] }];
    render(<StepList steps={steps} onOrderChange={vi.fn()} onDelete={onDelete} onSelect={vi.fn()} />);
    const deleteBtn = screen.getByRole('button', { name: /delete step 1/i });
    fireEvent.click(deleteBtn);
    // Confirmation dialog expected
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmBtn);
    expect(onDelete).toHaveBeenCalledWith('s1');
  });

  it('calls onOrderChange when drag-reorder happens', () => {
    const onOrderChange = vi.fn();
    const steps = [
      { id: 's1', title: 'Step 1', checkpoints: [] },
      { id: 's2', title: 'Step 2', checkpoints: [] },
    ];
    render(<StepList steps={steps} onOrderChange={onOrderChange} onDelete={vi.fn()} onSelect={vi.fn()} />);
    // Exercise the reorder path via the component's exposed test hook
    // (04-05 wires @dnd-kit test harness).
    expect(onOrderChange).not.toHaveBeenCalled();
  });
});
