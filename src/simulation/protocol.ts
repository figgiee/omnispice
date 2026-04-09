/**
 * Web Worker communication protocol for ngspice simulation.
 *
 * Defines the typed message protocol between the main thread and
 * the ngspice WASM worker. All simulation commands and responses
 * flow through these types.
 */

/**
 * Commands sent from main thread to simulation worker.
 */
export type SimCommand =
  | { type: 'INIT' }
  | { type: 'LOAD_CIRCUIT'; netlist: string }
  | { type: 'RUN'; analysis: string }
  | { type: 'CANCEL' }
  | { type: 'LOAD_MODEL'; filename: string; content: string };

/**
 * Responses sent from simulation worker to main thread.
 */
export type SimResponse =
  | { type: 'READY' }
  | { type: 'PROGRESS'; elapsed: number }
  | { type: 'RESULT'; vectors: VectorData[] }
  | { type: 'ERROR'; message: string; raw: string }
  | { type: 'STDOUT'; text: string }
  | { type: 'CANCELLED' };

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
