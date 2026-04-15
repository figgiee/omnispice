/**
 * RC time constant insight rule.
 *
 * Detects a simple RC network (one resistor and one capacitor sharing a net)
 * and reports τ = R×C and the cutoff frequency fc = 1/(2π×τ).
 *
 * Topology: source -- R -- shared-net -- C -- GND
 * The order (R first vs C first) is not enforced; only the shared net matters.
 */

import { parseEngineeringNotation } from '@/circuit/units';
import type { Insight, InsightContext, InsightRule } from '../types';

function sig2(n: number): string {
  // 2 significant figures, preserving trailing zeros (e.g. 1.0)
  return n.toPrecision(2);
}

function formatTau(tau: number): string {
  if (tau >= 1) return `${sig2(tau)} s`;
  if (tau >= 1e-3) return `${sig2(tau * 1e3)} ms`;
  if (tau >= 1e-6) return `${sig2(tau * 1e6)} µs`;
  if (tau >= 1e-9) return `${sig2(tau * 1e9)} ns`;
  return `${sig2(tau * 1e12)} ps`;
}

function formatFreq(fc: number): string {
  if (fc >= 1e9) return `${sig2(fc / 1e9)} GHz`;
  if (fc >= 1e6) return `${sig2(fc / 1e6)} MHz`;
  if (fc >= 1e3) return `${sig2(fc / 1e3)} kHz`;
  return `${sig2(fc)} Hz`;
}

export const rcTimeConstant: InsightRule = {
  id: 'rc-time-constant',
  describe: 'Detects simple RC networks and reports tau',
  evaluate: ({ circuit }: InsightContext): Insight | null => {
    const resistors = Array.from(circuit.components.values()).filter((c) => c.type === 'resistor');
    const capacitors = Array.from(circuit.components.values()).filter(
      (c) => c.type === 'capacitor',
    );

    if (resistors.length === 0 || capacitors.length === 0) return null;

    // Find a resistor and capacitor that share a net
    for (const r of resistors) {
      const rVal = parseEngineeringNotation(r.value);
      if (!Number.isFinite(rVal) || rVal <= 0) continue;

      const rNetIds = new Set(r.ports.map((p) => p.netId).filter((n): n is string => !!n));

      for (const c of capacitors) {
        const cVal = parseEngineeringNotation(c.value);
        if (!Number.isFinite(cVal) || cVal <= 0) continue;

        const cNetIds = c.ports.map((p) => p.netId).filter((n): n is string => !!n);

        // Find the shared net
        const sharedNet = cNetIds.find((netId) => rNetIds.has(netId));
        if (!sharedNet) continue;

        const tau = rVal * cVal;
        const fc = 1 / (2 * Math.PI * tau);

        return {
          id: `rc-${r.id}-${c.id}`,
          rule: 'rc-time-constant',
          summary: `RC network: τ = ${formatTau(tau)}, fc = ${Math.round(fc)} Hz`,
          expanded: `With R = ${r.value} Ω and C = ${c.value} F, the time constant τ = R×C = ${formatTau(tau)}. The −3 dB cutoff frequency is fc = 1/(2π×τ) = ${formatFreq(fc)}.`,
          formula: '\\tau = RC',
          severity: 'info',
          anchor: { kind: 'schematic-net', netId: sharedNet },
        };
      }
    }

    return null;
  },
};
