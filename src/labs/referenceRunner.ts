/**
 * referenceRunner — browser-side pipeline for LAB-01 reference generation.
 *
 * When an instructor saves a lab, every `waveform_match` checkpoint needs a
 * reference CSV stored in R2 so students can be compared against the
 * instructor's own ngspice run. This module orchestrates the pipeline:
 *
 *   1. collectProbes(lab)              — walk the lab, collect every probe
 *   2. (caller runs ngspice)           — feed the reference circuit to the
 *                                         existing simulation worker and
 *                                         hand us back the resulting vectors
 *   3. vectorsToCsv(time, values)      — turn a single probe into CSV text
 *   4. generateAndUploadReferences()   — tie it all together: find each
 *                                         probe vector, serialize, upload
 *
 * Separating the ngspice invocation from the upload keeps this module
 * pure-testable (no worker, no network). The LabEditorPage wires it up to
 * `SimulationController` + the `labsApi.uploadReference` mutation.
 */
import type { Lab } from '@/labs/schema';
import type { VectorData } from '@/simulation/protocol';

/**
 * Walk every step + checkpoint in a lab and collect the set of probe names
 * referenced by `waveform_match` predicates. Each probe is kept exactly
 * once; order matches first-encountered order.
 */
export function collectProbes(lab: Lab): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const step of lab.steps) {
    for (const cp of step.checkpoints) {
      if (cp.kind === 'waveform_match' && cp.probe) {
        const probe = cp.probe;
        if (!seen.has(probe)) {
          seen.add(probe);
          out.push(probe);
        }
      }
    }
  }
  return out;
}

/**
 * Serialize a (time, value) Float64Array pair to 2-column CSV text with a
 * `time,value` header. The header is what `parseReferenceCsv` (LAB-03)
 * expects to skip on the first row.
 *
 * Values are stringified via `Number.prototype.toString()` — full double
 * precision, no truncation. Reference CSVs are write-once so size is not
 * a real concern.
 */
export function vectorsToCsv(time: Float64Array, values: Float64Array): string {
  if (time.length !== values.length) {
    throw new Error(
      `vectorsToCsv: length mismatch — time=${time.length}, values=${values.length}`,
    );
  }
  const lines: string[] = ['time,value'];
  for (let i = 0; i < time.length; i++) {
    lines.push(`${time[i]},${values[i]}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Locate a probe vector in a ngspice result set with the same
 * case-insensitive rule the evaluator uses. Looks for the `time` (or `frequency`)
 * sweep vector as well so CSV uploads get a proper x-axis.
 */
function findVector(vectors: VectorData[], name: string): VectorData | undefined {
  const lower = name.toLowerCase();
  return vectors.find((v) => v.name.toLowerCase() === lower);
}

/** Result of a single reference upload. */
export interface ReferenceUploadResult {
  probe: string;
  status: 'uploaded' | 'missing' | 'failed';
  error?: string;
}

export interface GenerateAndUploadOptions {
  /** The lab — provides the list of probes to extract. */
  lab: Lab;
  /** ngspice result vectors from the instructor's reference run. */
  vectors: VectorData[];
  /**
   * Upload callback. The LabEditorPage wires this to `labsApi.uploadReference`
   * so this module stays free of network + auth concerns. Returning a
   * rejected promise surfaces as `status: 'failed'` in the result list.
   */
  uploadReference: (probe: string, csv: string) => Promise<void>;
  /** Optional progress callback — fires per-probe. */
  onProgress?: (probe: string, status: 'running' | 'uploaded' | 'failed' | 'missing') => void;
}

/**
 * For every waveform_match probe in the lab:
 *   1. Find the corresponding vector by name (case-insensitive).
 *   2. Find the sweep axis (`time` for transient, `frequency` for AC).
 *   3. Serialize to CSV.
 *   4. Invoke `uploadReference(probe, csv)`.
 *
 * Returns one result per probe. Does NOT throw — partial failures are
 * reported in the result list so the caller can show "3 of 4 uploaded".
 */
export async function generateAndUploadReferences(
  options: GenerateAndUploadOptions,
): Promise<ReferenceUploadResult[]> {
  const { lab, vectors, uploadReference, onProgress } = options;
  const probes = collectProbes(lab);
  const results: ReferenceUploadResult[] = [];

  // Pick the sweep axis — time for transient, frequency for AC.
  const sweep =
    findVector(vectors, 'time') ?? findVector(vectors, 'frequency') ?? vectors[0] ?? null;
  if (!sweep) {
    // No vectors at all — every probe is "missing".
    for (const probe of probes) {
      onProgress?.(probe, 'missing');
      results.push({ probe, status: 'missing' });
    }
    return results;
  }

  for (const probe of probes) {
    onProgress?.(probe, 'running');
    const vec = findVector(vectors, probe);
    if (!vec) {
      onProgress?.(probe, 'missing');
      results.push({ probe, status: 'missing' });
      continue;
    }
    try {
      const csv = vectorsToCsv(sweep.data, vec.data);
      await uploadReference(probe, csv);
      onProgress?.(probe, 'uploaded');
      results.push({ probe, status: 'uploaded' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onProgress?.(probe, 'failed');
      results.push({ probe, status: 'failed', error: message });
    }
  }

  return results;
}
