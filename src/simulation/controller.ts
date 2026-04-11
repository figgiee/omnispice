/**
 * Main-thread simulation controller.
 *
 * Manages the lifecycle of the ngspice WASM Web Worker: initialization,
 * running simulations, cancellation, and cleanup. Provides callbacks for
 * progress updates, results, and errors.
 *
 * @deprecated Plan 05-04 — the long-term replacement for this class is
 *   `TieredSimulationController`, which supports four concurrent analysis
 *   lanes with per-request correlation via `requestId`. `controller.ts`
 *   remains in place for the legacy single-shot F5 "Run" path (used by
 *   `useSimulationRunner` / the manual run button and covered by
 *   `controller.test.ts`). Plan 05-07 will migrate F5 through the
 *   orchestrator and this file can be deleted at that point.
 *
 *   New code MUST NOT instantiate `SimulationController` directly —
 *   import `TieredSimulationController` (or better, use the singleton
 *   `simulationOrchestrator`) instead.
 */

import type { AnalysisType } from '../circuit/types';
import type { SimCommand, SimResponse, VectorData } from './protocol';

/**
 * Translated error with human-readable message.
 */
export interface TranslatedError {
  message: string;
  raw: string;
}

/**
 * SimulationController manages the full worker lifecycle:
 * init, run, cancel, destroy.
 *
 * - D-18: Progress updates every 500ms with elapsed seconds
 * - D-19: Cancel terminates worker immediately (no graceful shutdown)
 * - SIM-05: Worker runs in dedicated thread, never blocks main
 * - SIM-07: After cancel, worker is null until next runSimulation re-initializes
 */
export class SimulationController {
  private worker: Worker | null = null;
  private startTime = 0;
  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  /** Resolver for the current pending operation (init or run) */
  private pendingResolve: (() => void) | null = null;
  private pendingReject: ((err: Error) => void) | null = null;

  /** Current simulation state for message sequencing */
  private waitingForLoad = false;

  constructor(
    private onProgress: (elapsed: number) => void,
    private onResult: (vectors: VectorData[]) => void,
    private onError: (error: TranslatedError) => void,
    private onReady: () => void,
  ) {}

  /**
   * Create a new worker and initialize the ngspice WASM module.
   * Sends INIT command and waits for READY response.
   */
  async initialize(): Promise<void> {
    this.worker = new Worker(new URL('./worker/simulation.worker.ts', import.meta.url), {
      type: 'module',
    });

    return new Promise<void>((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      this.worker!.onmessage = (event: MessageEvent<SimResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker!.onerror = (event: ErrorEvent) => {
        const err = new Error(`Worker error: ${event.message || 'Unknown error'}`);
        if (this.pendingReject) {
          this.pendingReject(err);
          this.pendingResolve = null;
          this.pendingReject = null;
        }
        this.onError({ message: err.message, raw: String(event) });
      };

      // Send INIT command
      this.sendCommand({ type: 'INIT' });
    });
  }

  /**
   * Run a simulation with the given netlist and analysis type.
   * Sends LOAD_CIRCUIT then RUN commands in sequence.
   *
   * @param netlist - SPICE netlist string
   * @param analysisType - Type of analysis to run
   */
  async runSimulation(netlist: string, analysisType: AnalysisType): Promise<void> {
    // Lazy re-initialization after cancel
    if (!this.worker || !this.initialized) {
      await this.initialize();
    }

    return new Promise<void>((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      // Start progress timer (D-18: update every 500ms)
      this.startTime = Date.now();
      this.startProgressTimer();

      // Send LOAD_CIRCUIT first
      this.waitingForLoad = true;
      this.sendCommand({ type: 'LOAD_CIRCUIT', netlist });

      // RUN will be sent after LOAD_CIRCUIT is acknowledged (STDOUT response).
      // Store analysis type for the RUN command.
      this._pendingAnalysisType = analysisType;
    });
  }

  /** Stored analysis type for pending RUN command */
  private _pendingAnalysisType: AnalysisType = 'dc_op';

  /**
   * Cancel the current simulation.
   *
   * Per Pitfall 6 and D-19: terminates worker immediately.
   * A fresh worker is spawned lazily on the next runSimulation call.
   */
  cancelSimulation(): void {
    this.stopProgressTimer();

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.initialized = false;
    }

    // Clear pending promises
    this.pendingResolve = null;
    this.pendingReject = null;
  }

  /**
   * Load a SPICE model file into the worker's MEMFS.
   */
  loadModel(filename: string, content: string): void {
    if (!this.worker) {
      this.onError({
        message: 'Cannot load model: worker not initialized',
        raw: 'ERR_NOT_INITIALIZED',
      });
      return;
    }

    this.sendCommand({ type: 'LOAD_MODEL', filename, content });
  }

  /**
   * Clean up the worker and all timers.
   */
  destroy(): void {
    this.stopProgressTimer();

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.initialized = false;
    }

    this.pendingResolve = null;
    this.pendingReject = null;
  }

  /**
   * Handle incoming messages from the worker.
   */
  private handleWorkerMessage(response: SimResponse): void {
    switch (response.type) {
      case 'READY': {
        this.initialized = true;
        this.onReady();
        if (this.pendingResolve) {
          const resolve = this.pendingResolve;
          this.pendingResolve = null;
          this.pendingReject = null;
          resolve();
        }
        break;
      }

      case 'STDOUT': {
        // After LOAD_CIRCUIT acknowledgment, send RUN
        if (this.waitingForLoad) {
          this.waitingForLoad = false;
          this.sendCommand({ type: 'RUN', analysis: 'run' });
        }
        break;
      }

      case 'PROGRESS': {
        this.onProgress(response.elapsed);
        break;
      }

      case 'RESULT': {
        this.stopProgressTimer();
        this.onResult(response.vectors);
        if (this.pendingResolve) {
          const resolve = this.pendingResolve;
          this.pendingResolve = null;
          this.pendingReject = null;
          resolve();
        }
        break;
      }

      case 'ERROR': {
        this.stopProgressTimer();
        this.onError({ message: response.message, raw: response.raw });
        if (this.pendingReject) {
          const reject = this.pendingReject;
          this.pendingResolve = null;
          this.pendingReject = null;
          reject(new Error(response.message));
        }
        break;
      }

      case 'CANCELLED': {
        this.stopProgressTimer();
        break;
      }
    }
  }

  /**
   * Send a typed command to the worker.
   */
  private sendCommand(command: SimCommand): void {
    if (this.worker) {
      this.worker.postMessage(command);
    }
  }

  /**
   * Start the progress timer (fires every 500ms).
   */
  private startProgressTimer(): void {
    this.stopProgressTimer();
    this.progressInterval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      this.onProgress(elapsed);
    }, 500);
  }

  /**
   * Stop the progress timer.
   */
  private stopProgressTimer(): void {
    if (this.progressInterval !== null) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
}
