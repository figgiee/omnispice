/**
 * OKLab colour interpolation helper for wire-voltage stroke colouring.
 *
 * Plan 05-07 — the schematic editor visualises DC operating-point node
 * voltages by colouring each wire's stroke between `--wire-v-low` (blue,
 * `#42a5f5`) and `--wire-v-high` (red, `#ef5350`). Linear sRGB interpolation
 * produces muddy dark-grey midtones because sRGB is not perceptually uniform.
 * OKLab is a perceptual colour space by Björn Ottosson — interpolating in
 * OKLab keeps the midtone luminance close to both endpoints and avoids the
 * "dead zone" through desaturated grey.
 *
 * The `culori` library (4.x) ships a robust OKLab implementation and an
 * `interpolate()` factory that returns a function `t ∈ [0,1] → colour`.
 * We call `formatHex` on the resulting colour to emit a plain `#rrggbb`
 * string that can be assigned directly to an SVG `stroke` attribute.
 *
 * The two endpoint colours MUST stay in sync with the CSS custom properties
 * `--wire-v-low` and `--wire-v-high` declared in the theme; if those change
 * the runtime interpolation will silently drift. A targeted visual
 * regression test (`tests/e2e/phase5/wire-voltage-coloring.spec.ts`) guards
 * the end-to-end behaviour.
 */

// culori ships TypeScript declarations via @types/culori. The three
// named exports we use (`interpolate`, `formatHex`) are stable since 3.x.
import { type Color, formatHex, interpolate } from 'culori';

/** Keep these in sync with `--wire-v-low` and `--wire-v-high`. */
const LOW_COLOR = '#42a5f5';
const HIGH_COLOR = '#ef5350';

// `interpolate` returns a function `(t: number) => Color`. Building the
// mixer once at module load is a ~20µs fixed cost that pays itself back
// on every wire: WireEdge recomputes its stroke whenever its net voltage
// changes, which on a Shift-scrub can be 60Hz × N wires.
const mixer = interpolate([LOW_COLOR, HIGH_COLOR], 'oklab') as (t: number) => Color;

/**
 * Interpolate between `--wire-v-low` and `--wire-v-high` in OKLab space.
 *
 * `t` is clamped to `[0, 1]`. Values outside that range are silently
 * snapped to the nearest endpoint — callers that want extrapolation
 * should scale `t` themselves. Returns a `#rrggbb` hex string; if the
 * underlying `formatHex` ever fails to serialise (e.g. colour is out
 * of gamut — shouldn't happen for OKLab lerps between two in-gamut
 * colours) we fall back to `--wire-stroke` cyan.
 *
 * @example
 * mixOklab(0)    // '#42a5f5' (blue, low rail)
 * mixOklab(0.5)  // perceptual midpoint, NOT sRGB lerp
 * mixOklab(1)    // '#ef5350' (red, high rail)
 */
export function mixOklab(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const color = mixer(clamped);
  // formatHex accepts any culori Color shape and returns `#rrggbb` or
  // `undefined` if the colour cannot be represented in sRGB.
  const hex = formatHex(color);
  return hex ?? '#4fc3f7'; // fallback to --wire-stroke cyan
}

/**
 * Map a voltage to `t ∈ [0, 1]` given the rail range.
 *
 * No clamping — callers can pass the result straight to `mixOklab`
 * which handles out-of-range values. Degenerate ranges (minRail ===
 * maxRail) return `0.5` so we don't divide by zero and the caller
 * gets a stable midtone.
 */
export function voltageToT(v: number, minRail: number, maxRail: number): number {
  if (maxRail === minRail) return 0.5;
  return (v - minRail) / (maxRail - minRail);
}
