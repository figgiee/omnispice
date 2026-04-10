/**
 * Lab authoring schema (Zod v4).
 *
 * Defines the complete data model for a guided lab: Lab → Steps → Checkpoints.
 * Each checkpoint is a discriminated union over five predicate kinds that the
 * pure-TypeScript evaluator (src/labs/evaluator.ts) can evaluate against a
 * simulation result + circuit state.
 *
 * Contract locked by the RED tests in:
 *   - src/labs/__tests__/schema.test.ts
 *   - src/labs/__tests__/evaluator.test.ts
 *
 * Shape deviates from the plan draft (04-04-PLAN.md) in favor of the test
 * fixtures: flat checkpoint (no separate `predicate` wrapper), numeric
 * `tolerance`, field names (`at`, `expected`, `branch`, `component`,
 * `tolerance_db`, `expected_db`, `instructions`) per the test contract.
 *
 * LAB-01 (authoring editor) consumes this; LAB-02 (runner) and LAB-03
 * (waveform match) evaluate against it.
 */

import { z } from 'zod';

/**
 * Kinds of components a `circuit_contains` predicate can count.
 * Kept broad enough to cover the ComponentType enum but expressed as strings
 * so hand-authored lab JSON stays forgiving (the evaluator normalizes to
 * lowercase).
 */
export const ComponentKindSchema = z.string().min(1);

/**
 * Common checkpoint fields.
 * `weight` must be strictly positive so the weighted progress bar has a
 * meaningful denominator.
 * `partial_threshold_pct` (optional) is the percent beyond `tolerance`
 * within which a result returns `partial` instead of `fail`. Bounded to
 * (0, 500] so lab authors can't silently neuter the pass/fail boundary.
 */
const CheckpointBase = {
  id: z.string().min(1),
  label: z.string().optional(),
  weight: z.number().positive().default(1),
  partial_threshold_pct: z.number().positive().max(500).optional(),
};

/** v(node) interpolation at a target time. */
export const NodeVoltagePredicateSchema = z.object({
  ...CheckpointBase,
  kind: z.literal('node_voltage'),
  node: z.string().min(1),
  at: z.number(),
  expected: z.number(),
  tolerance: z.number().positive(),
});

/** i(branch) interpolation at a target time. */
export const BranchCurrentPredicateSchema = z.object({
  ...CheckpointBase,
  kind: z.literal('branch_current'),
  branch: z.string().min(1),
  at: z.number(),
  expected: z.number(),
  tolerance: z.number().positive(),
});

/** rmse or max_abs of a probe vector vs a reference CSV in R2. */
export const WaveformMatchPredicateSchema = z.object({
  ...CheckpointBase,
  kind: z.literal('waveform_match'),
  probe: z.string().min(1),
  reference_key: z.string().min(1),
  metric: z.enum(['rmse', 'max_abs']),
  tolerance: z.number().positive(),
});

/** Count components of a given kind (e.g. "at least 2 resistors"). */
export const CircuitContainsPredicateSchema = z.object({
  ...CheckpointBase,
  kind: z.literal('circuit_contains'),
  component: ComponentKindSchema,
  count_min: z.number().int().nonnegative(),
  count_max: z.number().int().positive().optional(),
});

/** AC analysis gain in dB at a specific frequency. */
export const AcGainAtPredicateSchema = z.object({
  ...CheckpointBase,
  kind: z.literal('ac_gain_at'),
  probe: z.string().min(1),
  frequency: z.number().positive(),
  expected_db: z.number(),
  tolerance_db: z.number().positive(),
});

/**
 * Discriminated union of every supported checkpoint kind.
 * Zod uses the `kind` string literal to route parsing to the right schema,
 * giving precise error messages on unknown kinds.
 */
export const CheckpointSchema = z.discriminatedUnion('kind', [
  NodeVoltagePredicateSchema,
  BranchCurrentPredicateSchema,
  WaveformMatchPredicateSchema,
  CircuitContainsPredicateSchema,
  AcGainAtPredicateSchema,
]);

/** A single step inside a lab. */
export const StepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  instructions: z.string().default(''),
  checkpoints: z.array(CheckpointSchema).default([]),
});

/**
 * Top-level lab document. `schema_version` is locked to 1 for v1; bumping
 * it requires a migration step at load time.
 */
export const LabSchema = z.object({
  schema_version: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  reference_circuit_r2_key: z.string().optional(),
  /** Map of reference_key → R2 object path for waveform_match predicates. */
  reference_waveform_keys: z.record(z.string(), z.string()).default({}),
  steps: z.array(StepSchema).default([]),
});

// Inferred types — exported for the evaluator, store, and UI components.
export type Lab = z.infer<typeof LabSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Checkpoint = z.infer<typeof CheckpointSchema>;
export type NodeVoltagePredicate = z.infer<typeof NodeVoltagePredicateSchema>;
export type BranchCurrentPredicate = z.infer<typeof BranchCurrentPredicateSchema>;
export type WaveformMatchPredicate = z.infer<typeof WaveformMatchPredicateSchema>;
export type CircuitContainsPredicate = z.infer<typeof CircuitContainsPredicateSchema>;
export type AcGainAtPredicate = z.infer<typeof AcGainAtPredicateSchema>;
