/**
 * TieredSimulationController — the four-lane simulation engine that
 * backs OmniSpice's "always-live" editing experience (Phase 5, Pillar 3).
 *
 * Plan 05-04 backbone. Plans 05-05 (scrubber), 05-07 (hover probe),
 * and 05-08 (parameter sweep) all consume this controller without
 * rebuilding simulation infrastructure.
 *
 * ## The four lanes
 *
 *   1. **runDcOpPoint(netlist)** — always-live DC operating point.
 *      Subscription-driven: fires on every circuit store change. Skips
 *      LOAD_CIRCUIT when the netlist string hasn't changed (worker also
 *      has a matching circuit-hash cache).
 *
 *   2. **scheduleAcSweep(netlist, params)** — debounced AC sweep. 60ms
 *      sliding debounce so rapid edits coalesce into one run. A 500ms
 *      max-deferral fallback fires a run anyway if the user keeps
 *      scrubbing continuously (RESEARCH §3.7 starvation pitfall).
 *
 *   3. **runTransient(netlist, params)** — commit-on-release. Triggered
 *      by the scrubber pointer-up event (Plan 05-05). No debounce —
 *      runs immediately.
 *
 *   4. **runSweepPoint(netlist, paramName, value)** — parameter-sweep
 *      cache. Keyed on `{netlistHash}:{paramName}:{value}`. Repeated
 *      calls for the same key return the cached vectors without a
 *      worker round-trip.
 *
 * ## Request correlation
 *
 * Every worker request carries a `requestId`. The controller keeps a
 * `Map<requestId, Deferred>` and dispatches responses by id. Stray
 * responses (stale runs, responses that arrive after dispose) are
 * dropped silently. This is how the scrubber Plan 05-05 can fire
 * hundreds of AC sweeps without confusing responses.
 *
 * ## Not in this plan
 *
 * - Scrubber UI wiring (Plan 05-05)
 * - Parameter-knob UI (Plan 05-08)
 * - Probe tooltips (Plan 05-07)
 * - Linear interpolation between cached sweep points (stub below, will
 *   be expanded in Plan 05-08)
 */

import type {
  ProtocolAnalysis,
  SimCommand,
  SimResponse,
  VectorData,
} from './protocol';

/** AC sweep parameters. Translated to `ac dec {n} {fmin} {fmax}`. */
export interface AcParams {
  /** Points per decade. */
  points: number;
  /** Start frequency in Hz. */
  fmin: number;
  /** Stop frequency in Hz. */
  fmax: number;
}

/** Transient analysis parameters. Translated to `tran {step} {stop}`. */
export interface TranParams {
  /** Time step, e.g. '1u'. */
  step: string;
  /** Stop time, e.g. '10m'. */
  stop: string;
}

interface Deferred<T> {
  resolve: (value: T) => void;
  reject: (err: Error) => void;
}

/** Internal: format the SPICE fragment that goes after the analysis keyword. */
function formatAcParams(p: AcParams): string {
  return `dec ${p.points} ${p.fmin} ${p.fmax}`;
}

function formatTranParams(p: TranParams): string {
  return `${p.step} ${p.stop}`;
}

/**
 * Short stable hash of a netlist string. This is a FAST check for
 * "did the netlist actually change?" — not cryptographically strong,
 * but fine for cache keys. Structural `hashNetlist(circuit)` is the
 * right tool when the caller is upstream of netlist generation; this
 * is for the in-controller layer where only the string is available.
 */
function fastHash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export class TieredSimulationController {
  // --- Worker lifecycle ----------------------------------------------------

  private worker: Worker | null = null;
  private workerReady = false;
  private workerInitPromise: Promise<void> | null = null;

  // --- Request correlation -------------------------------------------------

  private pending = new Map<string, Deferred<VectorData[]>>();
  private nextRequestId = 1;

  // --- Circuit cache (Lane 1) ----------------------------------------------

  private lastLoadedHash: string | null = null;

  // --- AC debounce (Lane 2) ------------------------------------------------

  private acDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private acFirstScheduleTime: number | null = null;
  private acPendingWaiters: Array<Deferred<VectorData[]>> = [];
  private acPendingArgs: { netlist: string; params: AcParams } | null = null;
  private static readonly AC_DEBOUNCE_MS = 60;
  private static readonly AC_MAX_DEFERRAL_MS = 500;

  // --- Sweep cache (Lane 4) ------------------------------------------------

  private sweepCache = new Map<string, VectorData[]>();

  // ========================================================================
  //  Lane 1: DC operating point — always-live
  // ========================================================================

  /**
   * Run a DC operating point analysis. Always fires immediately — this is
   * the lane that backs the live-overlay loop. Skips LOAD_CIRCUIT when
   * the netlist is structurally identical to the previous call.
   */
  async runDcOpPoint(netlist: string): Promise<VectorData[]> {
    return this.runAnalysis(netlist, 'op');
  }

  // ========================================================================
  //  Lane 2: AC sweep — debounced (60ms) + max-deferral (500ms)
  // ========================================================================

  /**
   * Schedule an AC sweep. Multiple calls within the debounce window
   * coalesce into a single worker run. A 500ms max-deferral guarantees
   * the run eventually fires even under continuous scrubbing.
   */
  scheduleAcSweep(netlist: string, params: AcParams): Promise<VectorData[]> {
    return new Promise<VectorData[]>((resolve, reject) => {
      this.acPendingWaiters.push({ resolve, reject });
      this.acPendingArgs = { netlist, params };

      const now = Date.now();
      if (this.acFirstScheduleTime === null) {
        this.acFirstScheduleTime = now;
      }

      if (this.acDebounceTimer !== null) {
        clearTimeout(this.acDebounceTimer);
      }

      const elapsed = now - this.acFirstScheduleTime;
      const remaining = TieredSimulationController.AC_MAX_DEFERRAL_MS - elapsed;
      const delay = Math.max(
        0,
        Math.min(TieredSimulationController.AC_DEBOUNCE_MS, remaining),
      );

      this.acDebounceTimer = setTimeout(() => {
        void this.flushAcDebounce();
      }, delay);
    });
  }

  private async flushAcDebounce(): Promise<void> {
    const args = this.acPendingArgs;
    const waiters = this.acPendingWaiters;
    this.acDebounceTimer = null;
    this.acFirstScheduleTime = null;
    this.acPendingWaiters = [];
    this.acPendingArgs = null;

    if (!args || waiters.length === 0) return;

    try {
      const vectors = await this.runAnalysis(
        args.netlist,
        'ac',
        formatAcParams(args.params),
      );
      for (const w of waiters) w.resolve(vectors);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      for (const w of waiters) w.reject(e);
    }
  }

  // ========================================================================
  //  Lane 3: Transient — commit-on-release
  // ========================================================================

  /**
   * Run a transient analysis. Fires immediately with no debounce. Meant
   * to be driven by the scrubber pointer-up event in Plan 05-05.
   */
  async runTransient(netlist: string, params: TranParams): Promise<VectorData[]> {
    return this.runAnalysis(netlist, 'tran', formatTranParams(params));
  }

  // ========================================================================
  //  Lane 4: Parameter sweep — cached by {hash, param, value}
  // ========================================================================

  /**
   * Run a single sweep point. Results are cached by
   * `{netlistHash}:{paramName}:{value}`. Repeated calls for the same key
   * return the cached vectors without touching the worker.
   *
   * Plan 05-08 will add linear interpolation between cached points —
   * this implementation caches exact hits only.
   */
  async runSweepPoint(
    netlist: string,
    paramName: string,
    value: number,
  ): Promise<VectorData[]> {
    const hash = fastHash(netlist);
    const key = `${hash}:${paramName}:${value}`;
    const cached = this.sweepCache.get(key);
    if (cached) return cached;

    const vectors = await this.runAnalysis(netlist, 'op');
    this.sweepCache.set(key, vectors);
    return vectors;
  }

  // ========================================================================
  //  Lifecycle
  // ========================================================================

  /**
   * Terminate the worker, cancel any pending debounce, and clear all
   * caches. After dispose the controller is dead — construct a new one
   * to keep simulating.
   */
  dispose(): void {
    if (this.acDebounceTimer !== null) {
      clearTimeout(this.acDebounceTimer);
      this.acDebounceTimer = null;
    }
    // Reject any in-flight promises so callers don't hang
    for (const d of this.pending.values()) {
      d.reject(new Error('TieredSimulationController disposed'));
    }
    this.pending.clear();
    // Reject AC waiters that were still queued
    for (const w of this.acPendingWaiters) {
      w.reject(new Error('TieredSimulationController disposed'));
    }
    this.acPendingWaiters = [];
    this.acPendingArgs = null;
    this.acFirstScheduleTime = null;
    this.sweepCache.clear();
    this.lastLoadedHash = null;

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.workerReady = false;
    this.workerInitPromise = null;
  }

  // ========================================================================
  //  Internals: worker bootstrap + single-RUN dispatch
  // ========================================================================

  private ensureWorker(): Promise<void> {
    if (this.workerReady) return Promise.resolve();
    if (this.workerInitPromise) return this.workerInitPromise;

    this.worker = new Worker(
      new URL('./worker/simulation.worker.ts', import.meta.url),
      { type: 'module' },
    );
    this.worker.onmessage = (event: MessageEvent<SimResponse>) => {
      this.handleWorkerMessage(event.data);
    };
    this.worker.onerror = (event: ErrorEvent) => {
      // Reject every in-flight request — a worker error is unrecoverable.
      const err = new Error(`Worker error: ${event.message || 'unknown'}`);
      for (const d of this.pending.values()) d.reject(err);
      this.pending.clear();
    };

    this.workerInitPromise = new Promise<void>((resolve, reject) => {
      this.workerInitResolve = resolve;
      this.workerInitReject = reject;
    });
    this.postCommand({ type: 'INIT' });
    return this.workerInitPromise;
  }

  private workerInitResolve: (() => void) | null = null;
  private workerInitReject: ((err: Error) => void) | null = null;

  private handleWorkerMessage(response: SimResponse): void {
    switch (response.type) {
      case 'READY': {
        this.workerReady = true;
        const resolve = this.workerInitResolve;
        this.workerInitResolve = null;
        this.workerInitReject = null;
        resolve?.();
        break;
      }
      case 'RESULT': {
        const id = response.requestId;
        if (!id) break; // Legacy un-tagged result — ignore in tiered lane
        const deferred = this.pending.get(id);
        if (!deferred) break; // Stale — already cancelled or superseded
        this.pending.delete(id);
        deferred.resolve(response.vectors);
        break;
      }
      case 'ERROR': {
        const id = response.requestId;
        if (!id) break;
        const deferred = this.pending.get(id);
        if (!deferred) break;
        this.pending.delete(id);
        deferred.reject(new Error(response.message));
        break;
      }
      case 'CANCELLED': {
        const id = response.requestId;
        if (!id) break;
        const deferred = this.pending.get(id);
        if (!deferred) break;
        this.pending.delete(id);
        deferred.reject(new Error('Cancelled'));
        break;
      }
      // READY already handled above; STDOUT/PROGRESS are informational
      case 'PROGRESS':
      case 'STDOUT':
        break;
    }
  }

  /**
   * Shared path for all four lanes: ensure worker is ready, LOAD_CIRCUIT
   * if the netlist changed, then RUN with a fresh requestId, returning
   * a promise that resolves when the tagged response arrives.
   */
  private async runAnalysis(
    netlist: string,
    analysis: ProtocolAnalysis,
    params?: string,
  ): Promise<VectorData[]> {
    await this.ensureWorker();

    const hash = fastHash(netlist);
    if (this.lastLoadedHash !== hash) {
      this.postCommand({
        type: 'LOAD_CIRCUIT',
        netlist,
        circuitHash: hash,
      });
      this.lastLoadedHash = hash;
    }

    const requestId = `req-${this.nextRequestId++}`;
    const promise = new Promise<VectorData[]>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
    });
    const runCommand: SimCommand = {
      type: 'RUN',
      analysis: analysis,
      protocolAnalysis: analysis,
      requestId,
      ...(params !== undefined ? { params } : {}),
    };
    this.postCommand(runCommand);
    return promise;
  }

  private postCommand(cmd: SimCommand): void {
    this.worker?.postMessage(cmd);
  }
}
