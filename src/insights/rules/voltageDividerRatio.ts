/**
 * Voltage divider ratio insight rule.
 *
 * Detects two series resistors between a DC voltage supply and GND with
 * a shared mid-point net (the tap). Reports the ratio Vout/Vin and the
 * absolute output voltage based on the supply value.
 *
 * Topology detection:
 *   Vsupply -- R2 -- mid-net -- R1 -- GND
 *
 * A "voltage supply" component is any dc_voltage, ac_voltage, pulse_voltage,
 * sin_voltage, or pwl_voltage type. GND is net "0".
 */

import { parseEngineeringNotation } from '@/circuit/units';
import type { Insight, InsightContext, InsightRule } from '../types';

const VOLTAGE_SOURCE_TYPES = new Set([
  'dc_voltage',
  'ac_voltage',
  'pulse_voltage',
  'sin_voltage',
  'pwl_voltage',
]);

const GND_NET = '0';

export const voltageDividerRatio: InsightRule = {
  id: 'voltage-divider-ratio',
  describe: 'Detects two-resistor voltage dividers and reports ratio',
  evaluate: ({ circuit }) => {
    const resistors = Array.from(circuit.components.values()).filter(
      (c) => c.type === 'resistor',
    );

    if (resistors.length < 2) return null;

    // Find all voltage sources so we know which nets are supply rails
    const supplySources = Array.from(circuit.components.values()).filter((c) =>
      VOLTAGE_SOURCE_TYPES.has(c.type),
    );

    // Build a map of (netId -> voltage value) from sources whose negative
    // terminal is GND
    const supplyNets = new Map<string, number>(); // netId -> Vcc
    for (const src of supplySources) {
      const posPort = src.ports.find((p) => p.name === 'P' || p.name === '+');
      const negPort = src.ports.find((p) => p.name === 'N' || p.name === '-');
      if (!posPort?.netId || !negPort?.netId) continue;
      if (negPort.netId !== GND_NET) continue;
      const vcc = parseEngineeringNotation(src.value);
      if (!Number.isFinite(vcc) || vcc <= 0) continue;
      supplyNets.set(posPort.netId, vcc);
    }

    if (supplyNets.size === 0) return null;

    // Try each pair of resistors for a series divider topology
    for (const rTop of resistors) {
      for (const rBot of resistors) {
        if (rTop.id === rBot.id) continue;

        const rTopVal = parseEngineeringNotation(rTop.value);
        const rBotVal = parseEngineeringNotation(rBot.value);
        if (!Number.isFinite(rTopVal) || !Number.isFinite(rBotVal)) continue;
        if (rTopVal <= 0 || rBotVal <= 0) continue;

        // rTop must connect to a supply net (one port) and a mid-net (other port)
        // rBot must connect to the SAME mid-net and to GND
        const rTopNets = new Set(
          rTop.ports.map((p) => p.netId).filter((n): n is string => n !== null),
        );
        const rBotNets = new Set(
          rBot.ports.map((p) => p.netId).filter((n): n is string => n !== null),
        );

        // rBot must touch GND
        if (!rBotNets.has(GND_NET)) continue;

        // Find the supply net rTop connects to
        let supplyNet: string | null = null;
        let vcc = 0;
        for (const netId of rTopNets) {
          const v = supplyNets.get(netId);
          if (v !== undefined) {
            supplyNet = netId;
            vcc = v;
            break;
          }
        }
        if (!supplyNet) continue;

        // Find the shared mid-net (not supply, not GND)
        let midNet: string | null = null;
        for (const netId of rTopNets) {
          if (netId !== supplyNet && rBotNets.has(netId)) {
            midNet = netId;
            break;
          }
        }
        if (!midNet) continue;

        // Valid divider found
        const ratio = rBotVal / (rTopVal + rBotVal);
        const vout = ratio * vcc;
        const pct = `${(ratio * 100).toFixed(1)}%`;
        const voutStr = `${vout.toFixed(2)} V`;

        return {
          id: `vdiv-${rTop.id}-${rBot.id}`,
          rule: 'voltage-divider-ratio',
          summary: `Voltage divider: ${pct} → ${voutStr} (R1=${rBot.value} Ω, R2=${rTop.value} Ω)`,
          expanded: `With R2 from supply to mid-net and R1 to GND, Vout = Vin × R1/(R1+R2) = ${vcc}V × ${pct} = ${voutStr}.`,
          formula: `V_{out} = V_{in} \\cdot \\frac{R_1}{R_1 + R_2}`,
          severity: 'info',
          anchor: { kind: 'schematic-net', netId: midNet },
        } satisfies Insight;
      }
    }

    return null;
  },
};
