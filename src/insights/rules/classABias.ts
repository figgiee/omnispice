/**
 * Class A bias point insight rule.
 *
 * Detects an NPN or PNP BJT transistor and checks whether its collector-to-emitter
 * voltage (Vce) is in the optimal Class A bias range (30%–70% of Vcc).
 *
 * If simulation vectors are available, Vce is read from node voltages.
 * If no simulation data is present, the rule returns null — it only fires
 * post-simulation.
 */

import type { Insight, InsightRule } from '../types';

const BJT_TYPES = new Set(['npn_bjt', 'pnp_bjt']);

/** Class A bias range: Vce should be between 30% and 70% of Vcc. */
const BIAS_LOW = 0.3;
const BIAS_HIGH = 0.7;

export const classABias: InsightRule = {
  id: 'class-a-bias',
  describe: 'Detects BJT biased at midpoint of its rail (Class A bias point)',
  evaluate: ({ circuit, vectors }) => {
    if (vectors.length === 0) return null;

    const bjts = Array.from(circuit.components.values()).filter((c) => BJT_TYPES.has(c.type));
    if (bjts.length === 0) return null;

    // Find supply voltage from node voltages (highest V(node) value, not GND)
    const nodeVoltages = new Map<string, number>();
    for (const vec of vectors) {
      const name = vec.name.toLowerCase();
      if (name.startsWith('v(') && name.endsWith(')') && vec.data.length > 0) {
        const netName = name.slice(2, -1);
        nodeVoltages.set(netName, vec.data[0] ?? 0);
      }
    }
    if (nodeVoltages.size === 0) return null;

    // Estimate Vcc as the max positive node voltage
    let vcc = 0;
    for (const v of nodeVoltages.values()) {
      if (v > vcc) vcc = v;
    }
    if (vcc <= 0) return null;

    for (const bjt of bjts) {
      // Identify collector and emitter ports by label
      const collectorPort = bjt.ports.find((p) => p.label === 'C' || p.name === 'C');
      const emitterPort = bjt.ports.find((p) => p.label === 'E' || p.name === 'E');
      if (!collectorPort?.netId || !emitterPort?.netId) continue;

      const vc = nodeVoltages.get(collectorPort.netId);
      const ve = nodeVoltages.get(emitterPort.netId);
      if (vc === undefined || ve === undefined) continue;

      const vce = Math.abs(vc - ve);
      const ratio = vce / vcc;

      if (ratio >= BIAS_LOW && ratio <= BIAS_HIGH) {
        return {
          id: `class-a-${bjt.id}`,
          rule: 'class-a-bias',
          summary: `${bjt.refDesignator} is biased at Vce = ${vce.toFixed(2)} V (${(ratio * 100).toFixed(0)}% of Vcc) — good Class A point`,
          expanded: `Class A amplifiers work best when Vce ≈ Vcc/2. This biases the transistor at its linear midpoint, maximising symmetric output swing before clipping.`,
          formula: `V_{CE} \\approx \\frac{V_{CC}}{2}`,
          severity: 'info',
          anchor: { kind: 'schematic-node', componentId: bjt.id },
        } satisfies Insight;
      }

      if (ratio < BIAS_LOW || ratio > BIAS_HIGH) {
        const side = ratio < BIAS_LOW ? 'too low (near saturation)' : 'too high (near cutoff)';
        return {
          id: `class-a-${bjt.id}-warn`,
          rule: 'class-a-bias',
          summary: `${bjt.refDesignator} Vce = ${vce.toFixed(2)} V (${(ratio * 100).toFixed(0)}% of Vcc) — bias ${side}`,
          expanded: `Class A amplifiers need Vce near Vcc/2 for maximum symmetric output swing. Adjust the bias resistors to move Vce into the 30%–70% range.`,
          formula: `V_{CE} \\approx \\frac{V_{CC}}{2}`,
          severity: 'warning',
          anchor: { kind: 'schematic-node', componentId: bjt.id },
        } satisfies Insight;
      }
    }

    return null;
  },
};
