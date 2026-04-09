import { describe, it, expect } from 'vitest';
import { translateError, type TranslatedError } from '../errorTranslator';

describe('translateError', () => {
  it('translates "singular matrix" to human-readable message about floating nodes/short circuits', () => {
    const result = translateError(
      'Error: singular matrix error at node net_3'
    );

    expect(result.message).toContain('net_3');
    expect(result.message).toContain('problem');
    expect(result.suggestion).toContain('floating');
    expect(result.severity).toBe('error');
    expect(result.raw).toContain('singular matrix');
  });

  it('translates "no dc path to ground" with node reference', () => {
    const result = translateError(
      'Error: no dc path to ground from node net_3'
    );

    expect(result.message).toContain('net_3');
    expect(result.message).toContain('not connected to ground');
    expect(result.suggestion).toContain('ground');
    expect(result.componentRef).toBe('net_3');
    expect(result.severity).toBe('error');
  });

  it('uses netMap to provide user-friendly node names', () => {
    const netMap = new Map([['net_3', 'Vout']]);
    const result = translateError(
      'Error: no dc path to ground from node net_3',
      netMap
    );

    expect(result.message).toContain('Vout');
  });

  it('translates "timestep too small" to convergence guidance', () => {
    const result = translateError(
      'Error: timestep too small; time = 3.4e-06'
    );

    expect(result.message).toContain('converging');
    expect(result.suggestion).toContain('timestep');
    expect(result.severity).toBe('error');
  });

  it('translates "can\'t find model" to missing model message', () => {
    const result = translateError("Error: can't find model MYMODEL");

    expect(result.message).toContain('MYMODEL');
    expect(result.message).toContain('not found');
    expect(result.suggestion).toContain('import');
    expect(result.severity).toBe('error');
  });

  it('returns generic message for unknown error pattern', () => {
    const rawError = 'Some weird ngspice error that nobody expected';
    const result = translateError(rawError);

    expect(result.message).toContain('encountered an error');
    expect(result.raw).toBe(rawError);
    expect(result.severity).toBe('error');
  });

  it('preserves raw ngspice output in all cases', () => {
    const rawError = 'Error: singular matrix error at node net_5';
    const result = translateError(rawError);
    expect(result.raw).toBe(rawError);
  });

  it('extracts component reference from error string', () => {
    const result = translateError(
      'Error: some problem with R1 in the circuit'
    );

    expect(result.componentRef).toBe('R1');
  });

  it('extracts component reference for various prefixes', () => {
    expect(translateError('Error on V1').componentRef).toBe('V1');
    expect(translateError('Error on C2').componentRef).toBe('C2');
    expect(translateError('Error on Q3').componentRef).toBe('Q3');
    expect(translateError('Error on M1').componentRef).toBe('M1');
    expect(translateError('Error on D4').componentRef).toBe('D4');
    expect(translateError('Error on L1').componentRef).toBe('L1');
    expect(translateError('Error on X2').componentRef).toBe('X2');
    expect(translateError('Error on I1').componentRef).toBe('I1');
  });
});
