/**
 * RC time constant rule — stub (will fail tests until implemented).
 */

import type { InsightRule } from '../types';

export const rcTimeConstant: InsightRule = {
  id: 'rc-time-constant',
  describe: 'Detects simple RC networks and reports tau',
  evaluate: () => null,
};
