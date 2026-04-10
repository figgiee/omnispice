/**
 * Worker-side Zod mirror of `src/labs/schema.ts`.
 *
 * Duplicated across the client and worker bundlers because Vite and the
 * Cloudflare Workers bundler resolve module paths differently; a single
 * shared package would require a workspace refactor that lands in Phase 5.
 *
 * When modifying this file, ALSO update `src/labs/schema.ts` to keep the
 * two in lock-step. The contract is owned by `src/labs/__tests__/schema.test.ts`.
 *
 * Fields follow the flat checkpoint shape exactly:
 *   kind, at, expected, tolerance, branch, component, tolerance_db, expected_db
 *
 * Partial-credit support via optional `partial_threshold_pct`.
 */
import { z } from 'zod';

export const ComponentKindSchema = z.string().min(1);

const CheckpointBase = {
  id: z.string().min(1),
  label: z.string().optional(),
  weight: z.number().positive().default(1),
  partial_threshold_pct: z.number().positive().max(500).optional(),
};

export const NodeVoltagePredicateSchema = z.object({
  ...CheckpointBase,
  kind: z.literal('node_voltage'),
  node: z.string().min(1),
  at: z.number(),
  expected: z.number(),
  tolerance: z.number().positive(),
});

export const BranchCurrentPredicateSchema = z.object({
  ...CheckpointBase,
  kind: z.literal('branch_current'),
  branch: z.string().min(1),
  at: z.number(),
  expected: z.number(),
  tolerance: z.number().positive(),
});

export const WaveformMatchPredicateSchema = z.object({
  ...CheckpointBase,
  kind: z.literal('waveform_match'),
  probe: z.string().min(1),
  reference_key: z.string().min(1),
  metric: z.enum(['rmse', 'max_abs']),
  tolerance: z.number().positive(),
});

export const CircuitContainsPredicateSchema = z.object({
  ...CheckpointBase,
  kind: z.literal('circuit_contains'),
  component: ComponentKindSchema,
  count_min: z.number().int().nonnegative(),
  count_max: z.number().int().positive().optional(),
});

export const AcGainAtPredicateSchema = z.object({
  ...CheckpointBase,
  kind: z.literal('ac_gain_at'),
  probe: z.string().min(1),
  frequency: z.number().positive(),
  expected_db: z.number(),
  tolerance_db: z.number().positive(),
});

export const CheckpointSchema = z.discriminatedUnion('kind', [
  NodeVoltagePredicateSchema,
  BranchCurrentPredicateSchema,
  WaveformMatchPredicateSchema,
  CircuitContainsPredicateSchema,
  AcGainAtPredicateSchema,
]);

export const StepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  instructions: z.string().default(''),
  checkpoints: z.array(CheckpointSchema).default([]),
});

export const LabSchema = z.object({
  schema_version: z.literal(1),
  // `id` is optional on write (server assigns when missing) but present
  // once a lab has been persisted. Treated as optional to accept drafts
  // from the editor POST payload.
  id: z.string().min(1).optional().default(''),
  title: z.string().min(1),
  description: z.string().optional(),
  reference_circuit_r2_key: z.string().optional(),
  reference_waveform_keys: z.record(z.string(), z.string()).default({}),
  steps: z.array(StepSchema).default([]),
});

export type Lab = z.infer<typeof LabSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Checkpoint = z.infer<typeof CheckpointSchema>;
