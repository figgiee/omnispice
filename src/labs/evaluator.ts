/**
 * Pure-TypeScript predicate evaluator for LAB-02 / LAB-03.
 *
 * Given a Checkpoint from src/labs/schema.ts and an EvalContext (simulation
 * vectors, circuit components, reference CSVs), returns a pass / partial /
 * fail status with a brief human-readable message.
 *
 * Invariants (guarded by src/labs/__tests__/evaluator.test.ts):
 *   - No DOM access. No `eval`. No `Function`. No async.
 *   - No dependency on the ngspice worker, zustand stores, or React.
 *   - Case-insensitive vector lookups (`v(OUT)` ≡ `v(out)`) — matches the
 *     convention overlayStore established in Phase 2.
 *   - Returns `fail` (not throws) when a referenced vector or CSV is
 *     missing. A missing probe is a student error, not a lab bug.
 *
 * The partial branch: when a checkpoint defines `partial_threshold_pct`,
 * results within `tolerance * (1 + partial_threshold_pct/100)` but beyond
 * `tolerance` return `'partial'`. Without the field, only pass/fail.
 */

import type { Checkpoint } from './schema';
import { interpAt, maxAbs, rmse } from './waveformMatch';

/**
 * Minimal vector shape the evaluator needs. Compatible with the
 * existing `VectorData` from src/simulation/protocol.ts — callers pass
 * `useSimulationStore.getState().results` directly.
 */
export interface EvalVector {
  name: string;
  unit: string;
  isComplex: boolean;
  data: Float64Array;
}

/**
 * Minimal circuit shape the evaluator needs. The test fixtures use
 * `{ nodes: [{type: 'resistor'}, ...] }`; Phase 2 production uses
 * `{ components: Map<string, Component> }`. We normalize at the call
 * site in useLabRunner, and accept both shapes here to keep the pure
 * module test-friendly.
 */
export interface EvalCircuit {
  /** Flat list of components present in the circuit. */
  nodes?: Array<{ type: string }>;
  /** Phase 2 shape — passed via Array.from(components.values()) in runner. */
  components?: Array<{ type: string }>;
}

export interface EvalContext {
  vectors: EvalVector[];
  circuit?: EvalCircuit;
  /**
   * reference_key → parsed CSV. Uses a plain Record (not Map) to match
   * the RED-test fixture shape and the no-Maps rule in labStore.
   */
  references?: Record<string, { time: Float64Array; value: Float64Array }>;
}

export type CheckpointStatus = 'pass' | 'partial' | 'fail';

export interface CheckpointEvaluation {
  id: string;
  status: CheckpointStatus;
  /** Short human-readable message for the UI chip tooltip. */
  message: string;
  /** Actual measured value (when applicable) for debugging / UI. */
  actual?: number;
}

/**
 * Case-insensitive vector lookup. Returns `undefined` when not found so
 * callers can return a descriptive fail message.
 */
function findVector(vectors: EvalVector[], name: string): EvalVector | undefined {
  const target = name.toLowerCase();
  return vectors.find((v) => v.name.toLowerCase() === target);
}

/** Locate the ngspice time vector — tolerant of casing. */
function findTimeVector(vectors: EvalVector[]): EvalVector | undefined {
  return vectors.find((v) => v.name.toLowerCase() === 'time');
}

/** Locate the AC frequency vector — ngspice emits it as "frequency". */
function findFrequencyVector(vectors: EvalVector[]): EvalVector | undefined {
  return vectors.find((v) => v.name.toLowerCase() === 'frequency');
}

/**
 * Turn an absolute deviation + tolerance + optional partial threshold into
 * a pass / partial / fail status. Centralized so every scalar-compare
 * predicate uses identical boundary logic.
 */
function statusFromDelta(
  delta: number,
  tolerance: number,
  partialThresholdPct: number | undefined,
): CheckpointStatus {
  if (delta <= tolerance) return 'pass';
  if (partialThresholdPct !== undefined) {
    const partialLimit = tolerance * (1 + partialThresholdPct / 100);
    if (delta <= partialLimit) return 'partial';
  }
  return 'fail';
}

/**
 * Normalize a circuit's component list from either the EvalCircuit shape.
 * Returns an empty array when nothing is available.
 */
function listComponents(circuit: EvalCircuit | undefined): Array<{ type: string }> {
  if (!circuit) return [];
  if (circuit.nodes) return circuit.nodes;
  if (circuit.components) return circuit.components;
  return [];
}

/**
 * Evaluate a single checkpoint against a context.
 * The entry point for both the runner hook and batch evaluation in tests.
 */
export function evaluateCheckpoint(
  cp: Checkpoint,
  ctx: EvalContext,
): CheckpointEvaluation {
  switch (cp.kind) {
    case 'node_voltage':
      return evalNodeVoltage(cp, ctx);
    case 'branch_current':
      return evalBranchCurrent(cp, ctx);
    case 'waveform_match':
      return evalWaveformMatch(cp, ctx);
    case 'circuit_contains':
      return evalCircuitContains(cp, ctx);
    case 'ac_gain_at':
      return evalAcGainAt(cp, ctx);
    default: {
      // Exhaustiveness guard — unreachable for validated schemas.
      const _never: never = cp;
      return {
        id: (_never as Checkpoint).id,
        status: 'fail',
        message: 'Unknown checkpoint kind',
      };
    }
  }
}

function evalNodeVoltage(
  cp: Extract<Checkpoint, { kind: 'node_voltage' }>,
  ctx: EvalContext,
): CheckpointEvaluation {
  const timeVec = findTimeVector(ctx.vectors);
  const nodeVec = findVector(ctx.vectors, cp.node);
  if (!timeVec || !nodeVec) {
    return {
      id: cp.id,
      status: 'fail',
      message: `Vector ${cp.node} not found in simulation result`,
    };
  }
  const actual = interpAt(timeVec.data, nodeVec.data, cp.at);
  if (!Number.isFinite(actual)) {
    return { id: cp.id, status: 'fail', message: `${cp.node} has no finite value at t=${cp.at}` };
  }
  const delta = Math.abs(actual - cp.expected);
  const status = statusFromDelta(delta, cp.tolerance, cp.partial_threshold_pct);
  return {
    id: cp.id,
    status,
    actual,
    message:
      status === 'pass'
        ? `${cp.node}(${cp.at}) = ${actual.toFixed(4)} within ${cp.tolerance} of ${cp.expected}`
        : `${cp.node}(${cp.at}) = ${actual.toFixed(4)}, expected ${cp.expected} ± ${cp.tolerance}`,
  };
}

function evalBranchCurrent(
  cp: Extract<Checkpoint, { kind: 'branch_current' }>,
  ctx: EvalContext,
): CheckpointEvaluation {
  const timeVec = findTimeVector(ctx.vectors);
  const branchVec = findVector(ctx.vectors, cp.branch);
  if (!timeVec || !branchVec) {
    return {
      id: cp.id,
      status: 'fail',
      message: `Vector ${cp.branch} not found in simulation result`,
    };
  }
  const actual = interpAt(timeVec.data, branchVec.data, cp.at);
  if (!Number.isFinite(actual)) {
    return {
      id: cp.id,
      status: 'fail',
      message: `${cp.branch} has no finite value at t=${cp.at}`,
    };
  }
  const delta = Math.abs(actual - cp.expected);
  const status = statusFromDelta(delta, cp.tolerance, cp.partial_threshold_pct);
  return {
    id: cp.id,
    status,
    actual,
    message:
      status === 'pass'
        ? `${cp.branch}(${cp.at}) = ${actual.toExponential(3)} within ${cp.tolerance}`
        : `${cp.branch}(${cp.at}) = ${actual.toExponential(3)}, expected ${cp.expected} ± ${cp.tolerance}`,
  };
}

function evalWaveformMatch(
  cp: Extract<Checkpoint, { kind: 'waveform_match' }>,
  ctx: EvalContext,
): CheckpointEvaluation {
  const timeVec = findTimeVector(ctx.vectors);
  const probeVec = findVector(ctx.vectors, cp.probe);
  const ref = ctx.references?.[cp.reference_key];
  if (!timeVec || !probeVec) {
    return {
      id: cp.id,
      status: 'fail',
      message: `Probe ${cp.probe} not found in simulation result`,
    };
  }
  if (!ref) {
    return {
      id: cp.id,
      status: 'fail',
      message: `Reference waveform ${cp.reference_key} not loaded`,
    };
  }

  const metricFn = cp.metric === 'rmse' ? rmse : maxAbs;
  const actual = metricFn(probeVec.data, ref.value, timeVec.data, ref.time);
  if (!Number.isFinite(actual)) {
    return {
      id: cp.id,
      status: 'fail',
      message: `${cp.metric} is infinite (empty student data)`,
    };
  }

  const status = statusFromDelta(actual, cp.tolerance, cp.partial_threshold_pct);
  return {
    id: cp.id,
    status,
    actual,
    message:
      status === 'pass'
        ? `${cp.metric}(${cp.probe}) = ${actual.toFixed(4)} within ${cp.tolerance}`
        : `${cp.metric}(${cp.probe}) = ${actual.toFixed(4)}, tolerance ${cp.tolerance}`,
  };
}

function evalCircuitContains(
  cp: Extract<Checkpoint, { kind: 'circuit_contains' }>,
  ctx: EvalContext,
): CheckpointEvaluation {
  const components = listComponents(ctx.circuit);
  const target = cp.component.toLowerCase();
  const count = components.filter((c) => c.type.toLowerCase() === target).length;
  const tooFew = count < cp.count_min;
  const tooMany = cp.count_max !== undefined && count > cp.count_max;
  if (tooFew || tooMany) {
    const bound =
      cp.count_max !== undefined
        ? `${cp.count_min}..${cp.count_max}`
        : `≥${cp.count_min}`;
    return {
      id: cp.id,
      status: 'fail',
      actual: count,
      message: `Found ${count} ${cp.component}(s), expected ${bound}`,
    };
  }
  return {
    id: cp.id,
    status: 'pass',
    actual: count,
    message: `Found ${count} ${cp.component}(s)`,
  };
}

function evalAcGainAt(
  cp: Extract<Checkpoint, { kind: 'ac_gain_at' }>,
  ctx: EvalContext,
): CheckpointEvaluation {
  const freqVec = findFrequencyVector(ctx.vectors);
  const probeVec = findVector(ctx.vectors, cp.probe);
  if (!freqVec || !probeVec) {
    return {
      id: cp.id,
      status: 'fail',
      message: `AC vectors (frequency + ${cp.probe}) not found`,
    };
  }

  // Complex probe vectors carry alternating (real, imag) pairs in a single
  // Float64Array, so the effective length is data.length / 2. Build a
  // magnitude array aligned to the frequency grid on the fly.
  const isComplex = probeVec.isComplex;
  const nFreq = freqVec.data.length;
  const mags = new Float64Array(nFreq);
  if (isComplex) {
    if (probeVec.data.length < nFreq * 2) {
      return {
        id: cp.id,
        status: 'fail',
        message: `Complex probe ${cp.probe} has fewer samples than frequency grid`,
      };
    }
    for (let i = 0; i < nFreq; i++) {
      const re = probeVec.data[2 * i] ?? 0;
      const im = probeVec.data[2 * i + 1] ?? 0;
      mags[i] = Math.hypot(re, im);
    }
  } else {
    // Magnitude-only vector — rare but valid for post-processed data.
    for (let i = 0; i < nFreq; i++) {
      mags[i] = Math.abs(probeVec.data[i] ?? 0);
    }
  }

  const magAtF = interpAt(freqVec.data, mags, cp.frequency);
  if (magAtF <= 0 || !Number.isFinite(magAtF)) {
    return {
      id: cp.id,
      status: 'fail',
      message: `|${cp.probe}|(${cp.frequency}) is zero or non-finite`,
    };
  }
  const db = 20 * Math.log10(magAtF);
  const delta = Math.abs(db - cp.expected_db);
  const status = statusFromDelta(delta, cp.tolerance_db, cp.partial_threshold_pct);
  return {
    id: cp.id,
    status,
    actual: db,
    message:
      status === 'pass'
        ? `|${cp.probe}|(${cp.frequency}Hz) = ${db.toFixed(2)} dB within ${cp.tolerance_db} dB`
        : `|${cp.probe}|(${cp.frequency}Hz) = ${db.toFixed(2)} dB, expected ${cp.expected_db} ± ${cp.tolerance_db} dB`,
  };
}

/**
 * Batch-evaluate every checkpoint in an array. Used by the runner hook
 * on each new simulation result.
 */
export function evaluateCheckpoints(
  checkpoints: Checkpoint[],
  ctx: EvalContext,
): Record<string, CheckpointEvaluation> {
  const out: Record<string, CheckpointEvaluation> = {};
  for (const cp of checkpoints) {
    out[cp.id] = evaluateCheckpoint(cp, ctx);
  }
  return out;
}
