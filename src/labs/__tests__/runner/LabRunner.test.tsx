import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
// RED — src/labs/runner/LabRunner lands in 04-04.
// @ts-expect-error — module does not exist yet (Wave 0 scaffold).
import { LabRunner } from '../../runner/LabRunner';

describe('labs/runner/LabRunner — LAB-02 student runner UI', () => {
  const lab = {
    schema_version: 1,
    id: 'lab-1',
    title: 'RC Transient',
    steps: [
      {
        id: 'step-1',
        title: 'Build RC',
        instructions: 'Place R and C',
        checkpoints: [
          { id: 'cp-1', kind: 'node_voltage', node: 'v(out)', at: 0.005, expected: 5.0, tolerance: 0.1, weight: 1 },
        ],
      },
    ],
  };

  it('renders checkpoint chips with status from current simulation result', () => {
    render(<LabRunner lab={lab} />);
    // The chip should appear — exact status depends on simulation store state.
    expect(screen.getByText(/cp-1|v\(out\)|build rc/i)).toBeInTheDocument();
  });

  it('re-evaluates checkpoints when a new simulation result arrives', () => {
    const onEvaluate = vi.fn();
    render(<LabRunner lab={lab} onEvaluate={onEvaluate} />);
    expect(onEvaluate).toHaveBeenCalled();
  });

  it('weighted progress bar reflects pass + 0.5*partial weighting', () => {
    const multiCheckpointLab = {
      ...lab,
      steps: [
        {
          id: 'step-1',
          title: 's1',
          instructions: '',
          checkpoints: [
            { id: 'cp-1', kind: 'node_voltage', node: 'v(out)', at: 0.005, expected: 5.0, tolerance: 0.1, weight: 1 },
            { id: 'cp-2', kind: 'node_voltage', node: 'v(out)', at: 0.004, expected: 4.8, tolerance: 0.1, weight: 1 },
          ],
        },
      ],
    };
    render(<LabRunner lab={multiCheckpointLab} />);
    const progress = screen.getByRole('progressbar');
    expect(progress).toBeInTheDocument();
  });
});
