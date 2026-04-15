/**
 * Voltage divider ratio rule — stub (will fail tests until implemented).
 */

import type { InsightRule } from '../types';

export const voltageDividerRatio: InsightRule = {
  id: 'voltage-divider-ratio',
  describe: 'Detects two-resistor voltage dividers and reports ratio',
  evaluate: () => null,
};
