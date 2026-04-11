/**
 * Tests for the extended simulation worker protocol.
 *
 * Plan 05-04 Task 2 — verifies:
 *   - RESET_CIRCUIT clears currentCircuitHash
 *   - LOAD_CIRCUIT with the same hash is a no-op (fast path)
 *   - Two RUN commands with different requestIds produce two RESULT
 *     responses each tagged with the originating requestId
 *   - CANCEL marks a running requestId, and the eventual result is emitted
 *     as CANCELLED rather than RESULT
 *
 * Worker messaging cannot be exercised through a real `Worker` in jsdom, so
 * we import the worker module directly — the top-level `self.onmessage =`
 * assignment registers a handler on the test environment's global `self`.
 * We then invoke it as a plain function with `postMessage` stubbed to a
 * capturing array.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimCommand, SimResponse } from '../protocol';
import type { NgspiceModule } from '../worker/ngspice-wrapper';

// ---- Mock ngspice-wrapper so the worker never tries to load WASM --------

function createFakeModule(): NgspiceModule {
  const files = new Map<string, string>();
  let stdout = '';
  let stderr = '';
  return {
    FS: {
      writeFile: (path: string, data: string | Uint8Array) => {
        files.set(path, typeof data === 'string' ? data : new TextDecoder().decode(data));
      },
      readFile: (path: string) => files.get(path) ?? '',
      mkdir: () => {
        // no-op
      },
      unlink: (path: string) => {
        files.delete(path);
      },
    },
    callMain: () => {
      // Emit a minimal DC op output so parseMockOutput can parse it
      stdout = 'v(out) = 2.50000e+00';
    },
    feedStdin: () => {
      // no-op for test; analysis type is read from cmd.protocolAnalysis
    },
    get stdoutBuffer() {
      return stdout;
    },
    get stderrBuffer() {
      return stderr;
    },
    clearBuffers: () => {
      stdout = '';
      stderr = '';
    },
    isMock: true,
  };
}

vi.mock('../worker/ngspice-wrapper', async () => {
  const actual = await vi.importActual<typeof import('../worker/ngspice-wrapper')>(
    '../worker/ngspice-wrapper',
  );
  return {
    ...actual,
    loadNgspice: vi.fn(async () => createFakeModule()),
  };
});

// ---- Drive self.onmessage directly -----------------------------------------

type OnMessage = (event: MessageEvent<SimCommand>) => Promise<void> | void;

let captured: SimResponse[] = [];

function installPostMessageSpy(): void {
  captured = [];
  // biome-ignore lint/suspicious/noExplicitAny: we're replacing the global
  (globalThis as any).self = globalThis;
  // biome-ignore lint/suspicious/noExplicitAny: structured-clone-free stub
  (globalThis as any).postMessage = (msg: SimResponse) => {
    captured.push(msg);
  };
}

async function send(handler: OnMessage, cmd: SimCommand): Promise<void> {
  await handler({ data: cmd } as MessageEvent<SimCommand>);
}

async function loadWorker(): Promise<OnMessage> {
  // Dynamic import so the mock is applied before the module executes.
  // The worker assigns `self.onmessage` at top level — we read it off the
  // global `self` after import. `vi.resetModules()` in beforeEach ensures
  // we get a fresh module (and fresh internal `currentCircuitHash` state)
  // per test.
  await import('../worker/simulation.worker');
  // biome-ignore lint/suspicious/noExplicitAny: reading stub handler
  return (globalThis as any).self.onmessage as OnMessage;
}

describe('simulation.worker extended protocol', () => {
  beforeEach(() => {
    installPostMessageSpy();
    vi.resetModules();
  });

  afterEach(() => {
    captured = [];
  });

  it('LOAD_CIRCUIT with same circuitHash is a no-op after INIT', async () => {
    const handler = await loadWorker();
    await send(handler, { type: 'INIT' });
    expect(captured.some((r) => r.type === 'READY')).toBe(true);

    captured.length = 0;
    await send(handler, { type: 'LOAD_CIRCUIT', netlist: 'V1 1 0 5', circuitHash: 'hash-a' });
    const firstLoad = captured.find((r) => r.type === 'STDOUT');
    expect(firstLoad).toBeDefined();
    expect((firstLoad as { type: 'STDOUT'; text: string }).text).toMatch(/loaded/);

    captured.length = 0;
    await send(handler, { type: 'LOAD_CIRCUIT', netlist: 'V1 1 0 5', circuitHash: 'hash-a' });
    const secondLoad = captured.find((r) => r.type === 'STDOUT');
    expect((secondLoad as { type: 'STDOUT'; text: string }).text).toMatch(/cached/i);
  });

  it('RESET_CIRCUIT clears the cached hash so the next LOAD_CIRCUIT re-parses', async () => {
    const handler = await loadWorker();
    await send(handler, { type: 'INIT' });

    await send(handler, { type: 'LOAD_CIRCUIT', netlist: 'V1 1 0 5', circuitHash: 'hash-a' });
    captured.length = 0;

    await send(handler, { type: 'RESET_CIRCUIT' });
    const resetMsg = captured.find((r) => r.type === 'STDOUT');
    expect((resetMsg as { type: 'STDOUT'; text: string }).text).toMatch(/reset/i);

    captured.length = 0;
    await send(handler, { type: 'LOAD_CIRCUIT', netlist: 'V1 1 0 5', circuitHash: 'hash-a' });
    const afterReset = captured.find((r) => r.type === 'STDOUT');
    // After reset the same hash should NOT hit the cache
    expect((afterReset as { type: 'STDOUT'; text: string }).text).toMatch(/loaded/);
  });

  it('RUN tags each RESULT with its originating requestId', async () => {
    const handler = await loadWorker();
    await send(handler, { type: 'INIT' });
    await send(handler, { type: 'LOAD_CIRCUIT', netlist: 'V1 1 0 5', circuitHash: 'h' });
    captured.length = 0;

    await send(handler, {
      type: 'RUN',
      analysis: 'op',
      protocolAnalysis: 'op',
      requestId: 'req-1',
    });
    await send(handler, {
      type: 'RUN',
      analysis: 'op',
      protocolAnalysis: 'op',
      requestId: 'req-2',
    });

    const results = captured.filter((r) => r.type === 'RESULT') as Extract<
      SimResponse,
      { type: 'RESULT' }
    >[];
    expect(results).toHaveLength(2);
    const [first, second] = results;
    expect(first?.requestId).toBe('req-1');
    expect(second?.requestId).toBe('req-2');
    expect(first?.protocolAnalysis).toBe('op');
  });

  it('CANCEL before the RUN completes flips the eventual result to CANCELLED', async () => {
    const handler = await loadWorker();
    await send(handler, { type: 'INIT' });
    await send(handler, { type: 'LOAD_CIRCUIT', netlist: 'V1 1 0 5', circuitHash: 'h' });

    // Pre-mark a requestId as cancelled, THEN run it. The mock path resolves
    // synchronously inside the handler, but the cancellation check runs
    // AFTER callMain so we will observe the CANCELLED response.
    captured.length = 0;
    await send(handler, { type: 'CANCEL', requestId: 'req-X' });
    await send(handler, {
      type: 'RUN',
      analysis: 'op',
      protocolAnalysis: 'op',
      requestId: 'req-X',
    });

    // The RUN should NOT emit a RESULT for this requestId. It should emit
    // a CANCELLED tagged with req-X.
    const cancelled = captured.filter(
      (r) => r.type === 'CANCELLED' && (r as { requestId?: string }).requestId === 'req-X',
    );
    const results = captured.filter(
      (r) => r.type === 'RESULT' && (r as { requestId?: string }).requestId === 'req-X',
    );
    expect(cancelled.length).toBeGreaterThanOrEqual(1);
    expect(results).toHaveLength(0);
  });

  it('RUN without a requestId still works (legacy path)', async () => {
    const handler = await loadWorker();
    await send(handler, { type: 'INIT' });
    await send(handler, { type: 'LOAD_CIRCUIT', netlist: 'V1 1 0 5' });
    captured.length = 0;

    await send(handler, { type: 'RUN', analysis: 'run' });

    const result = captured.find((r) => r.type === 'RESULT') as
      | Extract<SimResponse, { type: 'RESULT' }>
      | undefined;
    expect(result).toBeDefined();
    expect(result?.requestId).toBeUndefined();
  });
});
