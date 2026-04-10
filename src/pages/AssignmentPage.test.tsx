import { describe, it, expect } from 'vitest';
import { AssignmentPage } from './AssignmentPage';

describe('AssignmentPage', () => {
  it('exports an AssignmentPage component', () => {
    expect(typeof AssignmentPage).toBe('function');
  });
});
