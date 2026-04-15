/**
 * Op-amp saturation rule — stub.
 * Task 2 will implement the full rail-clipping detection.
 */

import type { InsightRule } from '../types';

export const opAmpSaturation: InsightRule = {
  id: 'op-amp-saturation',
  describe: 'Detects op-amp output saturated near a power rail',
  evaluate: () => null,
};
