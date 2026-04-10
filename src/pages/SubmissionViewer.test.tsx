import { describe, it, expect } from 'vitest';
import { SubmissionViewer } from './SubmissionViewer';

describe('SubmissionViewer', () => {
  it('exports a SubmissionViewer component', () => {
    expect(typeof SubmissionViewer).toBe('function');
  });
});
