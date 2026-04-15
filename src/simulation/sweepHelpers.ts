/**
 * Helpers for the Plan 05-07 parameter-sweep fan-out lane.
 *
 * These helpers are intentionally tiny and standalone so the orchestrator
 * can stitch together a sweep without pulling the full
 * `src/circuit/netlister.ts` back through the graph compute path for
 * every sample point.
 */

/**
 * Generate `steps` evenly-spaced values from `min` to `max` inclusive.
 *
 *   linearSamples(0, 10, 5) → [0, 2.5, 5, 7.5, 10]
 *   linearSamples(1, 5, 1)  → [1]   (degenerate — returns midpoint)
 *   linearSamples(1, 5, 0)  → []
 */
export function linearSamples(min: number, max: number, steps: number): number[] {
  if (steps <= 0) return [];
  if (steps === 1) return [(min + max) / 2];
  const out = new Array<number>(steps);
  const span = max - min;
  for (let i = 0; i < steps; i++) {
    out[i] = min + (span * i) / (steps - 1);
  }
  return out;
}

/**
 * Substitute a value for the named component in a SPICE netlist line.
 *
 * SPICE primitive lines are space-delimited:
 *   `R1 net_1 0 1k`          → `R1 net_1 0 2.5k`
 *   `C1 out gnd 10n`         → `C1 out gnd 22n`
 *
 * We look for a line whose first token (case-insensitive) matches the
 * reference designator. When found we REPLACE the 4th whitespace-
 * separated token — matching the ngspice 2-pin primitive shape used by
 * R, C, L, and DC voltage/current sources — with the new value. Lines
 * that don't look 2-pin (4+ tokens and the 4th is numeric-ish) are left
 * untouched; the sweep fan-out for those is out of scope for V1.
 *
 * Returns a new netlist string. If the refDesignator is not found,
 * returns the original netlist unchanged — the orchestrator swallows
 * that silently (nothing to sweep).
 */
export function netlistWithSubstitution(
  netlist: string,
  refDesignator: string,
  newValue: number,
): string {
  const refUpper = refDesignator.toUpperCase();
  const lines = netlist.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const tokens = line.trim().split(/\s+/);
    if (tokens.length < 4) continue;
    const firstToken = tokens[0] ?? '';
    if (firstToken.toUpperCase() !== refUpper) continue;
    // 2-pin primitive: [ref, net+, net-, value, ...]. Replace index 3.
    // Emit the new value as a plain float — downstream ngspice accepts
    // raw floats everywhere SI prefixes are valid.
    tokens[3] = String(newValue);
    lines[i] = tokens.join(' ');
    return lines.join('\n');
  }
  return netlist;
}
