import { describe, it, expect } from 'vitest';
// RED — src/labs/waveformMatch lands in 04-04.
// @ts-expect-error — module does not exist yet (Wave 0 scaffold).
import { rmse, maxAbs } from '../waveformMatch';

describe('labs/waveformMatch — LAB-03 metrics', () => {
  describe('rmse', () => {
    it('is 0 for identical grids and values', () => {
      const t = new Float64Array([0, 1, 2, 3]);
      const v = new Float64Array([0, 1, 2, 3]);
      expect(rmse(v, v, t, t)).toBeCloseTo(0, 10);
    });

    it('interpolates student values onto reference grid when grids differ', () => {
      const tRef = new Float64Array([0, 1, 2]);
      const vRef = new Float64Array([0, 10, 20]);
      const tStu = new Float64Array([0, 0.5, 1, 1.5, 2]);
      const vStu = new Float64Array([0, 5, 10, 15, 20]);
      expect(rmse(vStu, vRef, tStu, tRef)).toBeCloseTo(0, 6);
    });

    it('returns Infinity when student data is empty', () => {
      const t = new Float64Array([0, 1]);
      const tRef = new Float64Array([0, 1]);
      const vRef = new Float64Array([0, 1]);
      const vStu = new Float64Array([]);
      expect(rmse(vStu, vRef, t, tRef)).toBe(Infinity);
    });
  });

  describe('maxAbs', () => {
    it('is 0 for identical grids and values', () => {
      const t = new Float64Array([0, 1, 2]);
      const v = new Float64Array([0, 1, 2]);
      expect(maxAbs(v, v, t, t)).toBeCloseTo(0, 10);
    });

    it('captures the single largest deviation across mismatched grids', () => {
      const tRef = new Float64Array([0, 1, 2]);
      const vRef = new Float64Array([0, 1, 2]);
      const tStu = new Float64Array([0, 0.5, 1, 1.5, 2]);
      // Student matches at all sample points but diverges at t=1.5
      const vStu = new Float64Array([0, 0.5, 1, 3.0, 2]);
      const m = maxAbs(vStu, vRef, tStu, tRef);
      expect(m).toBeGreaterThan(1);
    });

    it('returns Infinity when student data is empty', () => {
      const t = new Float64Array([0]);
      const tRef = new Float64Array([0]);
      const vRef = new Float64Array([0]);
      const vStu = new Float64Array([]);
      expect(maxAbs(vStu, vRef, t, tRef)).toBe(Infinity);
    });
  });
});
