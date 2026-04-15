/**
 * Class A bias rule — stub.
 * Task 2 will implement the full BJT midpoint detection.
 */

import type { InsightRule } from '../types';

export const classABias: InsightRule = {
  id: 'class-a-bias',
  describe: 'Detects BJT biased at midpoint of its rail (Class A bias point)',
  evaluate: () => null,
};
