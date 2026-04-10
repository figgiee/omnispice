import { describe, expect, it } from 'vitest';
// RED — src/labs/schema lands in 04-04.
// @ts-expect-error — module does not exist yet (Wave 0 scaffold).
import { LabSchema } from '../schema';

const validLab = {
  schema_version: 1,
  id: 'lab-1',
  title: 'RC Transient',
  steps: [
    {
      id: 'step-1',
      title: 'Build the circuit',
      instructions: 'Place R1 and C1, wire to vin/gnd.',
      checkpoints: [
        {
          id: 'cp-1',
          kind: 'node_voltage',
          node: 'v(out)',
          at: 0.005,
          expected: 5.0,
          tolerance: 0.1,
          weight: 1,
        },
      ],
    },
  ],
};

describe('labs/schema — LAB-01', () => {
  it('accepts a valid lab', () => {
    expect(() => LabSchema.parse(validLab)).not.toThrow();
  });

  it('rejects missing step id', () => {
    const bad = structuredClone(validLab);
    // @ts-expect-error — intentionally invalid
    delete bad.steps[0].id;
    expect(() => LabSchema.parse(bad)).toThrow();
  });

  it('rejects unknown predicate kind', () => {
    const bad = structuredClone(validLab);
    // @ts-expect-error — intentionally invalid discriminator
    bad.steps[0].checkpoints[0].kind = 'not_a_real_kind';
    expect(() => LabSchema.parse(bad)).toThrow();
  });

  it('rejects weight <= 0', () => {
    const bad = structuredClone(validLab);
    bad.steps[0].checkpoints[0].weight = 0;
    expect(() => LabSchema.parse(bad)).toThrow();
  });

  it('rejects schema_version !== 1', () => {
    const bad = structuredClone(validLab);
    bad.schema_version = 2;
    expect(() => LabSchema.parse(bad)).toThrow();
  });

  it('rejects waveform_match without reference_key', () => {
    const bad = structuredClone(validLab);
    bad.steps[0].checkpoints[0] = {
      id: 'cp-2',
      kind: 'waveform_match',
      probe: 'v(out)',
      // reference_key missing
      metric: 'rmse',
      tolerance: 0.1,
      weight: 1,
    } as unknown as (typeof validLab)['steps'][0]['checkpoints'][0];
    expect(() => LabSchema.parse(bad)).toThrow();
  });
});
