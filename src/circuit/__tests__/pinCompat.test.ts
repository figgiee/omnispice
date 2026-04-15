import { describe, it, expect } from 'vitest';
import { compatState, COMPAT_MATRIX } from '../pinCompat';
import type { PinType } from '../types';
import type { CompatState } from '../pinCompat';

/**
 * Pin compatibility matrix unit tests.
 *
 * Enforces the locked decision from Risk #4 of 05-RESEARCH:
 *   signal ↔ supply = neutral (NOT error)
 * because BJT collector → V+ is standard practice in EE education.
 *
 * Rule: connections are NEVER blocked (see isValidConnection in Canvas.tsx);
 * this matrix drives VISUAL feedback only.
 */
describe('pinCompat matrix', () => {
  // Full 4×4 exhaustive parameterization — documents every cell explicitly.
  const cases: Array<[PinType, PinType, CompatState]> = [
    // signal row
    ['signal', 'signal', 'ok'],
    ['signal', 'power', 'error'],
    ['signal', 'ground', 'neutral'],
    ['signal', 'supply', 'neutral'], // RELAXED per D-01
    // power row
    ['power', 'signal', 'error'],
    ['power', 'power', 'ok'],
    ['power', 'ground', 'error'],
    ['power', 'supply', 'ok'],
    // ground row
    ['ground', 'signal', 'neutral'],
    ['ground', 'power', 'error'],
    ['ground', 'ground', 'ok'],
    ['ground', 'supply', 'error'],
    // supply row
    ['supply', 'signal', 'neutral'], // RELAXED per D-01
    ['supply', 'power', 'ok'],
    ['supply', 'ground', 'error'],
    ['supply', 'supply', 'ok'],
  ];

  it.each(cases)('%s → %s = %s', (src, tgt, expected) => {
    expect(compatState(src, tgt)).toBe(expected);
  });

  it('diagonal cells are all ok (self-compatibility)', () => {
    expect(compatState('signal', 'signal')).toBe('ok');
    expect(compatState('power', 'power')).toBe('ok');
    expect(compatState('ground', 'ground')).toBe('ok');
    expect(compatState('supply', 'supply')).toBe('ok');
  });

  it('signal ↔ supply is symmetric neutral (locked D-01)', () => {
    expect(compatState('signal', 'supply')).toBe('neutral');
    expect(compatState('supply', 'signal')).toBe('neutral');
  });

  it('signal ↔ ground is symmetric neutral', () => {
    expect(compatState('signal', 'ground')).toBe('neutral');
    expect(compatState('ground', 'signal')).toBe('neutral');
  });

  it('power ↔ supply is symmetric ok (same electrical role)', () => {
    expect(compatState('power', 'supply')).toBe('ok');
    expect(compatState('supply', 'power')).toBe('ok');
  });

  it('signal → power is an error', () => {
    expect(compatState('signal', 'power')).toBe('error');
    expect(compatState('power', 'signal')).toBe('error');
  });

  it('ground → power is an error', () => {
    expect(compatState('ground', 'power')).toBe('error');
    expect(compatState('power', 'ground')).toBe('error');
  });

  it('COMPAT_MATRIX has entries for every 4×4 cell', () => {
    const types: PinType[] = ['signal', 'power', 'ground', 'supply'];
    for (const a of types) {
      for (const b of types) {
        expect(COMPAT_MATRIX[a][b]).toBeDefined();
      }
    }
  });
});
