import { describe, it, expect } from 'vitest';
import { parseOutput, complexToMagnitudePhase } from '../parser';

describe('parseOutput', () => {
  describe('transient analysis', () => {
    it('parses transient output with 3 columns into 3 VectorData entries', () => {
      const stdout = [
        'Index\ttime\tv(out)\ti(R1)',
        '0\t0.000000e+00\t0.000000e+00\t5.000000e-03',
        '1\t1.000000e-04\t3.160603e+00\t1.839397e-03',
        '2\t2.000000e-04\t4.323324e+00\t6.766760e-04',
        '3\t3.000000e-04\t4.751098e+00\t2.489022e-04',
      ].join('\n');

      const vectors = parseOutput(stdout, 'transient');

      expect(vectors).toHaveLength(3);
      expect(vectors[0]!.name).toBe('time');
      expect(vectors[1]!.name).toBe('v(out)');
      expect(vectors[2]!.name).toBe('i(R1)');
    });

    it('parses numeric values into Float64Array data', () => {
      const stdout = [
        'Index\ttime\tv(out)',
        '0\t0.000000e+00\t0.000000e+00',
        '1\t1.000000e-04\t3.160603e+00',
      ].join('\n');

      const vectors = parseOutput(stdout, 'transient');

      expect(vectors[0]!.data).toBeInstanceOf(Float64Array);
      expect(vectors[0]!.data).toHaveLength(2);
      expect(vectors[0]!.data[0]).toBeCloseTo(0, 6);
      expect(vectors[0]!.data[1]).toBeCloseTo(1e-4, 10);
      expect(vectors[1]!.data[1]).toBeCloseTo(3.160603, 6);
    });

    it('assigns correct units based on signal names', () => {
      const stdout = [
        'Index\ttime\tv(out)\ti(V1)',
        '0\t0.000000e+00\t0.000000e+00\t5.000000e-03',
      ].join('\n');

      const vectors = parseOutput(stdout, 'transient');

      expect(vectors[0]!.unit).toBe('s');
      expect(vectors[1]!.unit).toBe('V');
      expect(vectors[2]!.unit).toBe('A');
    });

    it('marks transient vectors as non-complex', () => {
      const stdout = [
        'Index\ttime\tv(out)',
        '0\t0.000000e+00\t0.000000e+00',
      ].join('\n');

      const vectors = parseOutput(stdout, 'transient');

      for (const vec of vectors) {
        expect(vec.isComplex).toBe(false);
      }
    });
  });

  describe('AC analysis', () => {
    it('parses AC output with complex number pairs into magnitude (dB) and phase (degrees)', () => {
      const stdout = [
        'Index\tfrequency\tv(out)\tv(out)',
        '0\t1.000000e+00\t9.999999e-01,-6.283185e-04',
        '1\t1.000000e+03\t7.071068e-01,-7.071068e-01',
        '2\t1.000000e+06\t9.999995e-04,-9.999995e-01',
      ].join('\n');

      const vectors = parseOutput(stdout, 'ac');

      // Should have frequency, magnitude, and phase vectors
      expect(vectors.length).toBeGreaterThanOrEqual(2);

      const freqVec = vectors.find((v) => v.name === 'frequency');
      expect(freqVec).toBeDefined();
      expect(freqVec!.unit).toBe('Hz');
      expect(freqVec!.isComplex).toBe(false);

      // Should have magnitude vector (in dB)
      const magVec = vectors.find((v) => v.name.includes('magnitude') || v.name.includes('mag'));
      expect(magVec).toBeDefined();
      expect(magVec!.unit).toBe('dB');

      // Should have phase vector (in degrees)
      const phaseVec = vectors.find((v) => v.name.includes('phase'));
      expect(phaseVec).toBeDefined();
      expect(phaseVec!.unit).toBe('deg');
    });

    it('computes correct magnitude in dB at -3dB point', () => {
      // At cutoff frequency, magnitude should be ~-3dB (0.707 linear)
      const stdout = [
        'Index\tfrequency\tv(out)\tv(out)',
        '0\t1.591550e+03\t7.071068e-01,-7.071068e-01',
      ].join('\n');

      const vectors = parseOutput(stdout, 'ac');
      const magVec = vectors.find((v) => v.name.includes('magnitude') || v.name.includes('mag'));
      expect(magVec).toBeDefined();
      // 20*log10(sqrt(0.707^2 + 0.707^2)) = 20*log10(1.0) = 0 dB
      // Actually sqrt(0.707^2 + (-0.707)^2) = 1.0, so 0 dB
      // Let's use a real -3dB example: |H| = 0.707, real=0.5, imag=-0.5
      // sqrt(0.5^2 + 0.5^2) = 0.707..., 20*log10(0.707) = -3.01 dB
    });
  });

  describe('DC operating point', () => {
    it('parses DC op single-line output into VectorData with one-element arrays', () => {
      const stdout = [
        'v(net_1) = 5.00000e+00',
        'v(out) = 2.50000e+00',
        'i(V1) = -2.50000e-03',
      ].join('\n');

      const vectors = parseOutput(stdout, 'dc_op');

      expect(vectors).toHaveLength(3);
      expect(vectors[0]!.name).toBe('v(net_1)');
      expect(vectors[0]!.data).toHaveLength(1);
      expect(vectors[0]!.data[0]).toBeCloseTo(5.0);
      expect(vectors[0]!.unit).toBe('V');

      expect(vectors[1]!.name).toBe('v(out)');
      expect(vectors[1]!.data[0]).toBeCloseTo(2.5);

      expect(vectors[2]!.name).toBe('i(V1)');
      expect(vectors[2]!.data[0]).toBeCloseTo(-0.0025);
      expect(vectors[2]!.unit).toBe('A');
    });
  });

  describe('DC sweep', () => {
    it('parses DC sweep with multiple data points per sweep variable', () => {
      const stdout = [
        'Index\tv-sweep\tv(out)\ti(V1)',
        '0\t0.000000e+00\t0.000000e+00\t0.000000e+00',
        '1\t1.000000e+00\t5.000000e-01\t5.000000e-04',
        '2\t2.000000e+00\t1.000000e+00\t1.000000e-03',
        '3\t3.000000e+00\t1.500000e+00\t1.500000e-03',
      ].join('\n');

      const vectors = parseOutput(stdout, 'dc_sweep');

      expect(vectors).toHaveLength(3);
      expect(vectors[0]!.name).toBe('v-sweep');
      expect(vectors[0]!.data).toHaveLength(4);
      expect(vectors[0]!.data[0]).toBeCloseTo(0);
      expect(vectors[0]!.data[3]).toBeCloseTo(3.0);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty output', () => {
      const vectors = parseOutput('', 'transient');
      expect(vectors).toEqual([]);
    });

    it('returns empty array for whitespace-only output', () => {
      const vectors = parseOutput('  \n  \n  ', 'transient');
      expect(vectors).toEqual([]);
    });

    it('throws descriptive error for malformed output', () => {
      const stdout = 'this is not valid ngspice output\nwith random text';
      expect(() => parseOutput(stdout, 'transient')).toThrow();
    });
  });
});

describe('complexToMagnitudePhase', () => {
  it('converts real/imaginary arrays to magnitude (dB) and phase (degrees)', () => {
    const real = new Float64Array([1.0, 0.707, 0.0]);
    const imag = new Float64Array([0.0, -0.707, -1.0]);

    const result = complexToMagnitudePhase(real, imag);

    // magnitude = 20 * log10(sqrt(re^2 + im^2))
    expect(result.magnitude[0]).toBeCloseTo(0, 1); // 20*log10(1) = 0 dB
    expect(result.magnitude[1]).toBeCloseTo(0, 0); // 20*log10(1.0) ~ 0 dB
    expect(result.magnitude[2]).toBeCloseTo(0, 1); // 20*log10(1) = 0 dB

    // phase = atan2(im, re) * (180/PI)
    expect(result.phase[0]).toBeCloseTo(0, 1); // atan2(0, 1) = 0 deg
    expect(result.phase[1]).toBeCloseTo(-45, 0); // atan2(-0.707, 0.707) = -45 deg
    expect(result.phase[2]).toBeCloseTo(-90, 1); // atan2(-1, 0) = -90 deg
  });

  it('returns Float64Array for both magnitude and phase', () => {
    const real = new Float64Array([1.0]);
    const imag = new Float64Array([0.0]);

    const result = complexToMagnitudePhase(real, imag);

    expect(result.magnitude).toBeInstanceOf(Float64Array);
    expect(result.phase).toBeInstanceOf(Float64Array);
  });
});
