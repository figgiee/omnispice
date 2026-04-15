/**
 * Gain-bandwidth product insight rule.
 *
 * For an op-amp in an inverting or non-inverting configuration, estimates the
 * expected closed-loop -3 dB bandwidth as: BW = GBW / |gain|.
 *
 * GBW defaults are taken from well-known datasheets:
 *   - ideal_opamp: assumed infinite GBW → rule returns null (no constraint)
 *   - ua741 / lm741: 1 MHz (classic datasheet spec)
 *
 * Gain is inferred from the feedback network:
 *   - Inverting:     gain = -Rf / Rin  (two resistors: one from input, one feedback)
 *   - Non-inverting: gain = 1 + Rf/Rg  (one to output, one to GND)
 *
 * Returns null when:
 *   - No op-amp is present
 *   - Op-amp type has no known GBW (ideal_opamp)
 *   - Fewer than two resistors are connected to the op-amp output net
 */

import { parseEngineeringNotation } from '@/circuit/units';
import type { Insight, InsightRule } from '../types';

/** GBW for real op-amp models (Hz). */
const GBW_HZ: Record<string, number> = {
  ua741: 1e6,
  lm741: 1e6,
};

export const gainBandwidthProduct: InsightRule = {
  id: 'gain-bandwidth-product',
  describe: 'Estimates closed-loop bandwidth from op-amp GBW and feedback gain',
  evaluate: ({ circuit }) => {
    const opAmps = Array.from(circuit.components.values()).filter(
      (c) => c.type === 'ua741' || c.type === 'lm741',
    );
    if (opAmps.length === 0) return null;

    for (const opamp of opAmps) {
      const gbw = GBW_HZ[opamp.type];
      if (!gbw) continue;

      // Find the output port net
      const outPort = opamp.ports.find(
        (p) => p.label === 'OUT' || p.name === 'OUT' || p.name === 'out',
      );
      if (!outPort?.netId) continue;
      const outNet = outPort.netId;

      // Collect resistors that connect to the output net (feedback resistors)
      const feedbackResistors = Array.from(circuit.components.values()).filter(
        (c) =>
          c.type === 'resistor' &&
          c.ports.some((p) => p.netId === outNet),
      );

      if (feedbackResistors.length === 0) continue;

      // Use the first feedback resistor's value as Rf
      const rf = feedbackResistors[0];
      if (!rf) continue;
      const rfVal = parseEngineeringNotation(rf.value);
      if (!Number.isFinite(rfVal) || rfVal <= 0) continue;

      // Find a second resistor connected to the inverting input (−) or GND
      // to estimate the gain. Look for resistors that share a net with Rf
      // but are NOT the op-amp output.
      const rfNets = new Set(
        rf.ports.map((p) => p.netId).filter((n): n is string => n !== null && n !== outNet),
      );

      let gain = 1; // default: unity
      for (const comp of circuit.components.values()) {
        if (comp.type !== 'resistor' || comp.id === rf.id) continue;
        const sharedNet = comp.ports.find(
          (p) => p.netId !== null && rfNets.has(p.netId),
        );
        if (!sharedNet) continue;
        const rVal = parseEngineeringNotation(comp.value);
        if (!Number.isFinite(rVal) || rVal <= 0) continue;
        // Inverting configuration: |gain| = Rf / Rin
        gain = Math.max(1, rfVal / rVal);
        break;
      }

      const bw = gbw / gain;

      // Format bandwidth
      const bwStr =
        bw >= 1e6
          ? `${(bw / 1e6).toFixed(2)} MHz`
          : bw >= 1e3
            ? `${(bw / 1e3).toFixed(1)} kHz`
            : `${bw.toFixed(0)} Hz`;

      const gbwStr =
        gbw >= 1e6 ? `${(gbw / 1e6).toFixed(0)} MHz` : `${(gbw / 1e3).toFixed(0)} kHz`;

      return {
        id: `gbw-${opamp.id}`,
        rule: 'gain-bandwidth-product',
        summary: `${opamp.refDesignator} (GBW=${gbwStr}) at gain ×${gain.toFixed(1)} → BW ≈ ${bwStr}`,
        expanded: `The gain-bandwidth product is constant for a given op-amp. Higher closed-loop gain means lower bandwidth. Check that your required signal frequency is well below ${bwStr}.`,
        formula: `BW = \\frac{GBW}{|A_v|}`,
        severity: 'info',
        anchor: { kind: 'schematic-node', componentId: opamp.id },
      } satisfies Insight;
    }

    return null;
  },
};
