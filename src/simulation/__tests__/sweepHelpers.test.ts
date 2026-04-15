import { describe, it, expect } from 'vitest';
import { linearSamples, netlistWithSubstitution } from '../sweepHelpers';

describe('linearSamples', () => {
  it('returns N evenly-spaced values inclusive of both endpoints', () => {
    expect(linearSamples(0, 10, 5)).toEqual([0, 2.5, 5, 7.5, 10]);
  });

  it('handles a negative range', () => {
    expect(linearSamples(-5, 5, 3)).toEqual([-5, 0, 5]);
  });

  it('returns [] for steps=0', () => {
    expect(linearSamples(0, 10, 0)).toEqual([]);
  });

  it('returns [midpoint] for steps=1 (degenerate case)', () => {
    expect(linearSamples(2, 8, 1)).toEqual([5]);
  });

  it('preserves ascending order', () => {
    const values = linearSamples(1, 100, 10);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]!);
    }
  });
});

describe('netlistWithSubstitution', () => {
  const sample = [
    '* OmniSpice test netlist',
    'V1 in 0 DC 5',
    'R1 in out 1k',
    'C1 out 0 10n',
    '.op',
    '.end',
  ].join('\n');

  it('replaces the value of a resistor by refDesignator', () => {
    const out = netlistWithSubstitution(sample, 'R1', 2500);
    expect(out).toContain('R1 in out 2500');
    expect(out).not.toContain('R1 in out 1k');
  });

  it('is case-insensitive on the refDesignator', () => {
    const out = netlistWithSubstitution(sample, 'r1', 3300);
    expect(out).toContain('R1 in out 3300');
  });

  it('leaves other lines untouched', () => {
    const out = netlistWithSubstitution(sample, 'R1', 47);
    expect(out).toContain('V1 in 0 DC 5');
    expect(out).toContain('C1 out 0 10n');
    expect(out).toContain('.end');
  });

  it('returns the original netlist unchanged when the ref is not found', () => {
    const out = netlistWithSubstitution(sample, 'R99', 42);
    expect(out).toBe(sample);
  });

  it('handles capacitor substitution (C1 with 4 tokens)', () => {
    const out = netlistWithSubstitution(sample, 'C1', 2.2e-8);
    expect(out).toContain(`C1 out 0 ${String(2.2e-8)}`);
  });
});
