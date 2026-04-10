import { describe, it, expect } from 'vitest';
// RED — src/report/katexRasterize lands in 04-06 (strategy picked in 04-KATEX-SPIKE.md).
// @ts-expect-error — module does not exist yet (Wave 0 scaffold).
import { rasterizeKatex } from '../katexRasterize';

describe('report/katexRasterize — RPT-01 formula rasterisation', () => {
  it('returns a PNG data URL for a simple formula', async () => {
    const dataUrl = await rasterizeKatex('V = I \\cdot R');
    expect(typeof dataUrl).toBe('string');
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('returns non-empty image bytes', async () => {
    const dataUrl = await rasterizeKatex('V = I \\cdot R');
    const base64 = dataUrl.split(',')[1] ?? '';
    expect(base64.length).toBeGreaterThan(100);
  });

  it('handles multiple formulas rendered in parallel', async () => {
    const formulas = [
      'V = I R',
      'H(s) = \\frac{1}{1 + sRC}',
      '\\sum_{k=0}^{N-1} V_k',
    ];
    const urls = await Promise.all(formulas.map((f) => rasterizeKatex(f)));
    expect(urls).toHaveLength(3);
    for (const u of urls) {
      expect(u.startsWith('data:image/png;base64,')).toBe(true);
    }
  });
});
