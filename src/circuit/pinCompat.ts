/**
 * Pin compatibility matrix for OmniSpice schematic editor (Phase 5 Pillar 1).
 *
 * Rule: connections are NEVER blocked (isValidConnection returns true in
 * Canvas.tsx). This matrix drives VISUAL feedback only — pedagogical, not
 * enforcement. Students must be able to complete any wire and see a
 * follow-up red error in the Errors panel.
 *
 * Locked decision D-01 (see 05-RESEARCH Risk #4):
 *   signal ↔ supply = neutral (NOT error), because BJT collector → V+
 *   is standard practice in EE education.
 *
 * Locked decision D-01 (corollary):
 *   signal ↔ ground = neutral, because pull-down resistors land on GND
 *   and students must be free to wire them without a scary red slash.
 */

import type { PinType } from './types';

export type CompatState = 'ok' | 'neutral' | 'error';

export const COMPAT_MATRIX: Record<PinType, Record<PinType, CompatState>> = {
  signal: { signal: 'ok',      power: 'error',  ground: 'neutral', supply: 'neutral' },
  power:  { signal: 'error',   power: 'ok',     ground: 'error',   supply: 'ok'      },
  ground: { signal: 'neutral', power: 'error',  ground: 'ok',      supply: 'error'   },
  supply: { signal: 'neutral', power: 'ok',     ground: 'error',   supply: 'ok'      },
};

/**
 * Pure function: returns the visual compatibility state for a source pin
 * type dragging toward a target pin type. Safe to call inside React render.
 */
export function compatState(source: PinType, target: PinType): CompatState {
  return COMPAT_MATRIX[source][target];
}
