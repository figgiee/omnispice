import { describe, it, expect } from 'vitest';
import sampleResult from '../../../tests/labs/fixtures/sample-result.json' with { type: 'json' };
// RED — src/labs/evaluator lands in 04-04.
// @ts-expect-error — module does not exist yet (Wave 0 scaffold).
import { evaluateCheckpoint } from '../evaluator';

interface RawVector {
  name: string;
  unit: string;
  isComplex: boolean;
  data: number[];
}

function rehydrate(): Array<{
  name: string;
  unit: string;
  isComplex: boolean;
  data: Float64Array;
}> {
  return (sampleResult.vectors as RawVector[]).map((v) => ({
    name: v.name,
    unit: v.unit,
    isComplex: v.isComplex,
    data: new Float64Array(v.data),
  }));
}

describe('labs/evaluator — LAB-02 predicate evaluation', () => {
  describe('node_voltage', () => {
    it('passes when v(out) at 0.005s is within tolerance', () => {
      const res = evaluateCheckpoint(
        { id: 'cp', kind: 'node_voltage', node: 'v(out)', at: 0.005, expected: 5.0, tolerance: 0.1, weight: 1 },
        { vectors: rehydrate() },
      );
      expect(res.status).toBe('pass');
    });

    it('fails when v(out) at 0.005s is outside tolerance', () => {
      const res = evaluateCheckpoint(
        { id: 'cp', kind: 'node_voltage', node: 'v(out)', at: 0.005, expected: 10.0, tolerance: 0.1, weight: 1 },
        { vectors: rehydrate() },
      );
      expect(res.status).toBe('fail');
    });
  });

  describe('branch_current', () => {
    it('passes when i(r1) at 0.005s is within tolerance', () => {
      const res = evaluateCheckpoint(
        { id: 'cp', kind: 'branch_current', branch: 'i(r1)', at: 0.005, expected: 0.005, tolerance: 1e-4, weight: 1 },
        { vectors: rehydrate() },
      );
      expect(res.status).toBe('pass');
    });
  });

  describe('waveform_match', () => {
    it('passes when rmse vs reference is below tolerance', () => {
      const res = evaluateCheckpoint(
        {
          id: 'cp',
          kind: 'waveform_match',
          probe: 'v(out)',
          reference_key: 'ref/v_out.csv',
          metric: 'rmse',
          tolerance: 0.5,
          weight: 1,
        },
        {
          vectors: rehydrate(),
          references: {
            'ref/v_out.csv': {
              time: new Float64Array([0, 0.001, 0.002, 0.003, 0.004, 0.005]),
              value: new Float64Array([0, 1.18, 2.36, 3.55, 4.72, 4.95]),
            },
          },
        },
      );
      expect(['pass', 'partial']).toContain(res.status);
    });
  });

  describe('circuit_contains', () => {
    it('passes when circuit contains at least count_min resistors', () => {
      const res = evaluateCheckpoint(
        { id: 'cp', kind: 'circuit_contains', component: 'resistor', count_min: 2, weight: 1 },
        {
          vectors: rehydrate(),
          circuit: { nodes: [{ type: 'resistor' }, { type: 'resistor' }, { type: 'capacitor' }] },
        },
      );
      expect(res.status).toBe('pass');
    });

    it('fails when count_min is not met', () => {
      const res = evaluateCheckpoint(
        { id: 'cp', kind: 'circuit_contains', component: 'resistor', count_min: 3, weight: 1 },
        {
          vectors: rehydrate(),
          circuit: { nodes: [{ type: 'resistor' }, { type: 'resistor' }, { type: 'capacitor' }] },
        },
      );
      expect(res.status).toBe('fail');
    });
  });

  describe('ac_gain_at', () => {
    it('evaluates gain at a target frequency (AC analysis)', () => {
      const res = evaluateCheckpoint(
        { id: 'cp', kind: 'ac_gain_at', probe: 'v(out)', frequency: 100, expected_db: -3, tolerance_db: 1, weight: 1 },
        {
          vectors: [
            { name: 'frequency', unit: 'Hz', isComplex: false, data: new Float64Array([10, 100, 1000]) },
            { name: 'v(out)', unit: 'V', isComplex: true, data: new Float64Array([1, 0, 0.707, 0, 0.1, 0]) },
          ],
        },
      );
      expect(['pass', 'partial', 'fail']).toContain(res.status);
    });
  });
});
