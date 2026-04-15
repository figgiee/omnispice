/**
 * Op-amp saturation insight rule.
 *
 * Checks whether an op-amp output node voltage is within 0.2 V of either
 * power rail (Vcc or -Vcc/GND). Only fires when simulation vectors are
 * available (post-simulation, not on live DC ticks during scrubbing).
 *
 * Returns null if:
 *   - No op-amp component is present in the circuit
 *   - No simulation vectors are available
 *   - The output voltage cannot be resolved from vectors
 */

import type { Insight, InsightRule } from '../types';

const OPAMP_TYPES = new Set(['ideal_opamp', 'ua741', 'lm741']);

/** Distance from rail at which we flag saturation (volts). */
const SATURATION_MARGIN = 0.2;

export const opAmpSaturation: InsightRule = {
  id: 'op-amp-saturation',
  describe: 'Detects op-amp output saturated near a power rail',
  evaluate: ({ circuit, vectors }) => {
    if (vectors.length === 0) return null;

    const opAmps = Array.from(circuit.components.values()).filter((c) =>
      OPAMP_TYPES.has(c.type),
    );
    if (opAmps.length === 0) return null;

    // Collect node voltages from vectors
    const nodeVoltages = new Map<string, number>();
    for (const vec of vectors) {
      const name = vec.name.toLowerCase();
      if (name.startsWith('v(') && name.endsWith(')') && vec.data.length > 0) {
        nodeVoltages.set(name.slice(2, -1), vec.data[0] ?? 0);
      }
    }
    if (nodeVoltages.size === 0) return null;

    // Estimate rails from the full range of observed node voltages
    let vMax = -Infinity;
    let vMin = Infinity;
    for (const v of nodeVoltages.values()) {
      if (v > vMax) vMax = v;
      if (v < vMin) vMin = v;
    }

    for (const opamp of opAmps) {
      // Identify output port by label 'OUT' or name 'OUT'
      const outPort = opamp.ports.find(
        (p) => p.label === 'OUT' || p.name === 'OUT' || p.name === 'out',
      );
      if (!outPort?.netId) continue;

      const vout = nodeVoltages.get(outPort.netId);
      if (vout === undefined) continue;

      const nearPos = Math.abs(vout - vMax) <= SATURATION_MARGIN;
      const nearNeg = Math.abs(vout - vMin) <= SATURATION_MARGIN;

      if (nearPos || nearNeg) {
        const rail = nearPos ? `+${vMax.toFixed(1)} V` : `${vMin.toFixed(1)} V`;
        return {
          id: `opamp-sat-${opamp.id}`,
          rule: 'op-amp-saturation',
          summary: `${opamp.refDesignator} output (${vout.toFixed(2)} V) is saturated near the ${rail} rail`,
          expanded: `The op-amp output is within ${SATURATION_MARGIN} V of a power rail, indicating it has clipped. Check gain setting and input common-mode range. Real op-amps cannot swing all the way to the rail unless they are rail-to-rail devices.`,
          formula: `V_{out} \\approx V_{rail}`,
          severity: 'warning',
          anchor: { kind: 'schematic-node', componentId: opamp.id },
        } satisfies Insight;
      }
    }

    return null;
  },
};
