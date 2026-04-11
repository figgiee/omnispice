/**
 * Tiny Worker stub for TieredSimulationController tests.
 *
 * Plan 05-04: replaces the real `Worker` constructor under `vi.stubGlobal`
 * so the controller never spawns a real thread. Tests drive it
 * synchronously via `simulateResult` / `simulateError`.
 */

import type { ProtocolAnalysis, SimCommand, SimResponse, VectorData } from '../protocol';

export class MockWorker {
  onmessage: ((event: MessageEvent<SimResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  readonly sentMessages: SimCommand[] = [];
  private _terminated = false;

  postMessage(data: SimCommand): void {
    this.sentMessages.push(data);
  }

  terminate(): void {
    this._terminated = true;
  }

  get terminated(): boolean {
    return this._terminated;
  }

  addEventListener(type: string, handler: (event: MessageEvent<SimResponse>) => void): void {
    if (type === 'message') {
      this.onmessage = handler;
    }
  }

  removeEventListener(): void {
    // no-op
  }

  /** Number of RUN commands the controller has sent so far. */
  get runCount(): number {
    return this.sentMessages.filter((m) => m.type === 'RUN').length;
  }

  /** Number of LOAD_CIRCUIT commands the controller has sent so far. */
  get loadCount(): number {
    return this.sentMessages.filter((m) => m.type === 'LOAD_CIRCUIT').length;
  }

  /** The most recently sent RUN command (or undefined). */
  get lastRun(): Extract<SimCommand, { type: 'RUN' }> | undefined {
    for (let i = this.sentMessages.length - 1; i >= 0; i--) {
      const m = this.sentMessages[i];
      if (m && m.type === 'RUN') return m;
    }
    return undefined;
  }

  /** Push a READY response on the message channel. */
  simulateReady(): void {
    this.onmessage?.(new MessageEvent('message', { data: { type: 'READY' } }));
  }

  /** Push a RESULT tagged with the requestId + protocolAnalysis. */
  simulateResult(
    requestId: string,
    protocolAnalysis: ProtocolAnalysis,
    vectors: VectorData[] = [makeDcVector()],
  ): void {
    this.onmessage?.(
      new MessageEvent('message', {
        data: { type: 'RESULT', vectors, requestId, protocolAnalysis },
      }),
    );
  }

  /** Push an ERROR tagged with the requestId. */
  simulateError(requestId: string, message = 'mock error'): void {
    this.onmessage?.(
      new MessageEvent('message', {
        data: { type: 'ERROR', message, raw: message, requestId },
      }),
    );
  }
}

export function makeDcVector(): VectorData {
  return {
    name: 'v(out)',
    data: new Float64Array([2.5]),
    unit: 'V',
    isComplex: false,
  };
}

/** Shared mutable slot so tests can grab the most-recently-created mock. */
export const workerRegistry: { current: MockWorker | null } = { current: null };

/**
 * Install the Worker global. Returns the uninstall function (for symmetry
 * in tests that need it, though `vi.unstubAllGlobals()` is usually enough).
 */
export function installMockWorker(): () => void {
  const OriginalWorker = (globalThis as { Worker?: unknown }).Worker;
  // biome-ignore lint/suspicious/noExplicitAny: stubbing a constructor
  (globalThis as any).Worker = class {
    constructor() {
      const w = new MockWorker();
      workerRegistry.current = w;
      return w as unknown as Worker;
    }
  };
  return () => {
    // biome-ignore lint/suspicious/noExplicitAny: restoring a constructor
    (globalThis as any).Worker = OriginalWorker;
  };
}
