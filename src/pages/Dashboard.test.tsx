import { describe, it, expect } from 'vitest';
import { Dashboard } from './Dashboard';

describe('Dashboard page', () => {
  it('exports a Dashboard component', () => {
    expect(typeof Dashboard).toBe('function');
  });
});
