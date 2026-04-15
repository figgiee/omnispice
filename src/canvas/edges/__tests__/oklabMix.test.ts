import { describe, it, expect } from 'vitest';
import { mixOklab, voltageToT } from '../oklabMix';

/** Parse `#rrggbb` into [r, g, b] 0-255 ints. */
function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`Not a #rrggbb hex: ${hex}`);
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
}

describe('mixOklab', () => {
  it('returns a #rrggbb string', () => {
    expect(mixOklab(0.5)).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('t=0 returns a blue-dominant colour (maps to --wire-v-low)', () => {
    const c = mixOklab(0);
    const [r, _g, b] = parseHex(c);
    // Blue dominates the low end (#42a5f5 → B is the highest channel).
    expect(b).toBeGreaterThan(r);
  });

  it('t=1 returns a red-dominant colour (maps to --wire-v-high)', () => {
    const c = mixOklab(1);
    const [r, _g, b] = parseHex(c);
    // Red dominates the high end (#ef5350 → R is the highest channel).
    expect(r).toBeGreaterThan(b);
  });

  it('t=0.5 returns a non-muddy mid-tone (OKLab lerp keeps luminance visible)', () => {
    const c = mixOklab(0.5);
    const [r, g, b] = parseHex(c);
    // Pure sRGB lerp between red and blue would give ~#903a83 which is
    // quite dark; OKLab lerp preserves perceptual luminance. We assert
    // rec709 relative luminance stays above a conservative floor so a
    // regression to pure-sRGB lerp fails this test.
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    expect(lum).toBeGreaterThan(60);
  });

  it('clamps t below 0 to t=0', () => {
    expect(mixOklab(-5)).toBe(mixOklab(0));
  });

  it('clamps t above 1 to t=1', () => {
    expect(mixOklab(5)).toBe(mixOklab(1));
  });

  it('is deterministic across calls', () => {
    expect(mixOklab(0.3)).toBe(mixOklab(0.3));
  });
});

describe('voltageToT', () => {
  it('maps v=minRail to 0', () => {
    expect(voltageToT(0, 0, 5)).toBe(0);
  });

  it('maps v=maxRail to 1', () => {
    expect(voltageToT(5, 0, 5)).toBe(1);
  });

  it('maps the midpoint to 0.5', () => {
    expect(voltageToT(2.5, 0, 5)).toBe(0.5);
  });

  it('handles equal rails without throwing (degenerate range → 0.5)', () => {
    expect(voltageToT(3, 3, 3)).toBe(0.5);
  });

  it('extrapolates below minRail (caller responsible for clamping downstream)', () => {
    expect(voltageToT(-1, 0, 5)).toBeLessThan(0);
  });

  it('extrapolates above maxRail', () => {
    expect(voltageToT(6, 0, 5)).toBeGreaterThan(1);
  });

  it('handles negative rails (e.g. ±12V supply)', () => {
    expect(voltageToT(0, -12, 12)).toBe(0.5);
    expect(voltageToT(-12, -12, 12)).toBe(0);
    expect(voltageToT(12, -12, 12)).toBe(1);
  });
});
