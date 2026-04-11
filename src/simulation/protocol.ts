/**
 * Web Worker communication protocol for ngspice simulation.
 *
 * Defines the typed message protocol between the main thread and
 * the ngspice WASM worker. All simulation commands and responses
 * flow through these types.
 *
 * Plan 05-04: Extended with `requestId`, `circuitHash`, `RESET_CIRCUIT`
 * and per-analysis discriminants so the TieredSimulationController can
 * correlate multiple in-flight requests and drop stale results.
 */

/**
 * Per-analysis protocol type used on the wire.
 *
 * Distinct from `circuit/types.ts` `AnalysisType` which is the domain-
 * facing type (`dc_op | transient | ac | dc_sweep`). These short codes
 * map directly to ngspice pipe-mode keywords:
 *   - 'op'   → `op`
 *   - 'tran' → `tran {step} {stop}`
 *   - 'ac'   → `ac dec {n} {fmin} {fmax}`
 *   - 'dc'   → `dc {src} {start} {stop} {step}`
 */
export type ProtocolAnalysis = 'op' | 'tran' | 'ac' | 'dc';

/**
 * Commands sent from main thread to simulation worker.
 *
 * Backwards compatible with the legacy single-shot flow:
 *   - `LOAD_CIRCUIT` without `circuitHash` still works (no cache check)
 *   - `RUN` with `analysis: string` still works for the legacy controller
 *     which passes `'run'` and lets the worker auto-detect analysis type
 *     from the netlist.
 */
export type SimCommand =
  | { type: 'INIT' }
  | {
      type: 'LOAD_CIRCUIT';
      netlist: string;
      /** Plan 05-04: stable structural hash; worker skips reload if unchanged. */
      circuitHash?: string;
    }
  | {
      type: 'RESET_CIRCUIT';
    }
  | {
      type: 'RUN';
      /** Legacy field: free-form analysis keyword; new code sets `protocolAnalysis` instead. */
      analysis: string;
      /** Plan 05-04: protocol-level analysis discriminant. */
      protocolAnalysis?: ProtocolAnalysis;
      /** Plan 05-04: correlates a response back to its originating request. */
      requestId?: string;
      /** Plan 05-04: preformatted SPICE fragment appended after the analysis keyword. */
      params?: string;
    }
  | { type: 'CANCEL'; requestId?: string }
  | { type: 'LOAD_MODEL'; filename: string; content: string };

/**
 * Responses sent from simulation worker to main thread.
 */
export type SimResponse =
  | { type: 'READY' }
  | { type: 'PROGRESS'; elapsed: number; requestId?: string }
  | {
      type: 'RESULT';
      vectors: VectorData[];
      requestId?: string;
      protocolAnalysis?: ProtocolAnalysis;
    }
  | {
      type: 'ERROR';
      message: string;
      raw: string;
      requestId?: string;
    }
  | { type: 'STDOUT'; text: string }
  | { type: 'CANCELLED'; requestId?: string };

/**
 * Simulation vector data returned from ngspice.
 *
 * Each vector represents a single signal (e.g., time, voltage at a node,
 * current through a component). Uses Float64Array for efficient numeric
 * data transfer via structured clone (no serialization overhead).
 */
export interface VectorData {
  /** Signal name, e.g., 'time', 'v(out)', 'i(R1)' */
  name: string;
  /** Raw numeric data points */
  data: Float64Array;
  /** Unit of measurement, e.g., 'V', 'A', 's', 'Hz' */
  unit: string;
  /** True for AC analysis results (magnitude/phase pairs) */
  isComplex: boolean;
}
