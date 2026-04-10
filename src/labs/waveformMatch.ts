/**
 * Waveform comparison metrics for LAB-03.
 *
 * Pure Float64Array math — no DOM, no allocations beyond the output arrays,
 * no dependencies. Comparing a student simulation result to a reference CSV
 * almost always involves mismatched time grids (student chose their own
 * timestep), so every metric interpolates the reference onto the student's
 * grid first via linear interpolation.
 *
 * Contract locked by src/labs/__tests__/waveformMatch.test.ts.
 *
 * Function signatures follow the test's student-first convention:
 *   rmse(studentValues, refValues, studentTime, refTime)
 * which keeps call sites readable: "how far is the student from the ref".
 */

/**
 * Linearly interpolate `ys(t)` at sample point `t` given source grid `ts`.
 * Clamps to the endpoints if `t` falls outside `[ts[0], ts[last]]`.
 *
 * Runs in O(log n) via binary search — important because the evaluator
 * calls this once per student sample during resample().
 */
export function interpAt(ts: Float64Array, ys: Float64Array, t: number): number {
  const n = ts.length;
  if (n === 0 || ys.length === 0) return Number.NaN;
  if (n === 1) return ys[0] ?? Number.NaN;

  const first = ts[0] ?? 0;
  const last = ts[n - 1] ?? 0;

  if (t <= first) return ys[0] ?? Number.NaN;
  if (t >= last) return ys[n - 1] ?? Number.NaN;

  // Binary search for the first index whose ts[i] > t.
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const mt = ts[mid] ?? 0;
    if (mt <= t) lo = mid + 1;
    else hi = mid;
  }

  const i1 = lo;
  const i0 = i1 - 1;
  const t0 = ts[i0] ?? 0;
  const t1 = ts[i1] ?? 0;
  const y0 = ys[i0] ?? 0;
  const y1 = ys[i1] ?? 0;
  const dt = t1 - t0;
  if (dt === 0) return y0;
  const frac = (t - t0) / dt;
  return y0 + frac * (y1 - y0);
}

/**
 * Resample `(srcTs, srcYs)` onto the target grid `targetTs` via linear
 * interpolation. Returns a fresh Float64Array of length `targetTs.length`.
 */
export function resample(
  srcTs: Float64Array,
  srcYs: Float64Array,
  targetTs: Float64Array,
): Float64Array {
  const out = new Float64Array(targetTs.length);
  for (let i = 0; i < targetTs.length; i++) {
    const t = targetTs[i] ?? 0;
    out[i] = interpAt(srcTs, srcYs, t);
  }
  return out;
}

/**
 * Root-mean-square error between a student waveform and a reference
 * waveform. The reference is resampled onto the student's time grid so
 * mismatched grids are handled transparently.
 *
 * Returns `Infinity` when the student has no samples (can't reason about
 * a missing curve; let the evaluator surface this as a hard fail).
 */
export function rmse(
  studentValues: Float64Array,
  refValues: Float64Array,
  studentTime: Float64Array,
  refTime: Float64Array,
): number {
  if (studentValues.length === 0 || studentTime.length === 0) return Infinity;
  const n = studentValues.length;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const t = studentTime[i] ?? 0;
    const refAtT = interpAt(refTime, refValues, t);
    const d = (studentValues[i] ?? 0) - refAtT;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / n);
}

/**
 * Maximum absolute difference between student and reference waveforms.
 *
 * This samples the student grid AND samples the student at the reference
 * grid, because the largest deviation can happen between student samples
 * when the grids are offset. Taking the max across both directions catches
 * the common case where a student's divergence spike sits midway between
 * two reference samples (or vice versa).
 *
 * Returns `Infinity` when the student has no samples.
 */
export function maxAbs(
  studentValues: Float64Array,
  refValues: Float64Array,
  studentTime: Float64Array,
  refTime: Float64Array,
): number {
  if (studentValues.length === 0 || studentTime.length === 0) return Infinity;

  let best = 0;

  // Pass 1: walk the student grid, comparing against the interpolated
  // reference at each student sample.
  for (let i = 0; i < studentValues.length; i++) {
    const t = studentTime[i] ?? 0;
    const refAtT = interpAt(refTime, refValues, t);
    const d = Math.abs((studentValues[i] ?? 0) - refAtT);
    if (d > best) best = d;
  }

  // Pass 2: walk the reference grid, comparing against the interpolated
  // student at each reference sample. This is what catches the "divergence
  // spike at t=1.5" case in the RED test.
  for (let i = 0; i < refTime.length; i++) {
    const t = refTime[i] ?? 0;
    const stuAtT = interpAt(studentTime, studentValues, t);
    const d = Math.abs(stuAtT - (refValues[i] ?? 0));
    if (d > best) best = d;
  }

  return best;
}

/**
 * Check whether a scalar value is within a simple (absolute) tolerance of
 * an expected target. The lab schema uses a flat numeric `tolerance`
 * (absolute), following the RED test contract — no percent-vs-abs union
 * at the schema level. Authors can express percent tolerances by computing
 * them at authoring time.
 */
export function withinTolerance(actual: number, expected: number, tolerance: number): boolean {
  return Math.abs(actual - expected) <= tolerance;
}
