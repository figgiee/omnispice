/**
 * Insight engine types for OmniSpice.
 *
 * An Insight is a deterministic, rule-derived annotation that surfaces
 * pedagogically relevant information about a circuit or its simulation
 * results. Insights are generated after committed simulation results
 * (transient or AC settle), never on live DC ticks.
 *
 * Plan 05-08 — Pedagogy Pillar 5.
 */

import type { Circuit } from '@/circuit/types';
import type { VectorData } from '@/simulation/protocol';
import type { MeasurementResult } from '@/waveform/measurements';

/** Where in the UI the insight is anchored. */
export type InsightAnchor =
  | { kind: 'waveform-region'; vectorName: string; t0: number; t1: number }
  | { kind: 'waveform-point'; vectorName: string; t: number }
  | { kind: 'schematic-node'; componentId: string }
  | { kind: 'schematic-net'; netId: string };

export interface Insight {
  /** Stable hash used for dedup and dismissal tracking. */
  id: string;
  /** Rule id for debugging (e.g., 'rc-time-constant'). */
  rule: string;
  /** One sentence, direct voice. Shown in the collapsed pill. */
  summary: string;
  /** Optional explanatory paragraph shown in the expanded card. */
  expanded?: string;
  /** Optional KaTeX formula shown in the expanded card. */
  formula?: string;
  severity: 'info' | 'warning';
  anchor: InsightAnchor;
}

export interface InsightContext {
  circuit: Circuit;
  vectors: VectorData[];
  measurements: MeasurementResult[];
}

export interface InsightRule {
  id: string;
  describe: string;
  evaluate: (ctx: InsightContext) => Insight | null;
}
