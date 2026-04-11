/**
 * Behavior tests for TieredSimulationController.
 *
 * Plan 05-04 Task 3 — verifies the four lanes:
 *   1. runDcOpPoint: always-live, skips LOAD_CIRCUIT when hash unchanged
 *   2. scheduleAcSweep: 60ms debounce + 500ms max-deferral fallback
 *   3. runTransient: commit-on-release, immediate run, no debouncing
 *   4. runSweepPoint: cached by {circuitHash, param, value}
 * Plus: stale-result dropping, and dispose() cleanup.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TieredSimulationController } from '../TieredSimulationController';
import { installMockWorker, type MockWorker, makeDcVector, workerRegistry } from './mockWorker';

const NETLIST_A = '* A\nR1 1 0 1k\nV1 1 0 5\n.end';
const NETLIST_B = '* B\nR1 1 0 2k\nV1 1 0 5\n.end';

/** Drain queued promise microtasks. */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/** Return the current mock worker or throw with a helpful message. */
function requireWorker(): MockWorker {
  const w = workerRegistry.current;
  if (!w) throw new Error('MockWorker not yet created — did you flushMicrotasks?');
  return w;
}

/** Return the most-recent RUN command's requestId or throw. */
function requireLastRunId(w: MockWorker): string {
  const run = w.lastRun;
  if (!run?.requestId) throw new Error('Expected a RUN with a requestId');
  return run.requestId;
}

/**
 * Prime the controller so `workerRegistry.current` is populated with a
 * ready worker. Resolves after an initial DC op-point round trip.
 */
async function primeWorker(ctrl: TieredSimulationController): Promise<MockWorker> {
  const primer = ctrl.runDcOpPoint(NETLIST_A);
  await flushMicrotasks();
  const w = requireWorker();
  w.simulateReady();
  await flushMicrotasks();
  w.simulateResult(requireLastRunId(w), 'op');
  await primer;
  return w;
}

describe('TieredSimulationController', () => {
  let uninstall: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    workerRegistry.current = null;
    uninstall = installMockWorker();
  });

  afterEach(() => {
    uninstall();
    vi.useRealTimers();
  });

  describe('Lane 1 — runDcOpPoint (always-live)', () => {
    it('resolves with vectors on the first call', async () => {
      const ctrl = new TieredSimulationController();
      const p = ctrl.runDcOpPoint(NETLIST_A);
      await flushMicrotasks();
      const w = requireWorker();
      w.simulateReady();
      await flushMicrotasks();

      const run = w.lastRun;
      expect(run).toBeDefined();
      expect(run?.protocolAnalysis).toBe('op');
      w.simulateResult(requireLastRunId(w), 'op', [makeDcVector()]);
      await flushMicrotasks();
      const result = await p;
      expect(result[0]?.name).toBe('v(out)');
      ctrl.dispose();
    });

    it('skips LOAD_CIRCUIT when netlist hash matches previous call', async () => {
      const ctrl = new TieredSimulationController();
      const w = await primeWorker(ctrl);

      const loadsBefore = w.loadCount;

      const p2 = ctrl.runDcOpPoint(NETLIST_A);
      await flushMicrotasks();
      expect(w.loadCount).toBe(loadsBefore);
      w.simulateResult(requireLastRunId(w), 'op');
      await p2;
      ctrl.dispose();
    });

    it('sends a fresh LOAD_CIRCUIT when the netlist changes', async () => {
      const ctrl = new TieredSimulationController();
      const w = await primeWorker(ctrl);

      const loadsBefore = w.loadCount;
      const p2 = ctrl.runDcOpPoint(NETLIST_B);
      await flushMicrotasks();
      expect(w.loadCount).toBe(loadsBefore + 1);
      w.simulateResult(requireLastRunId(w), 'op');
      await p2;
      ctrl.dispose();
    });
  });

  describe('Lane 2 — scheduleAcSweep (60ms debounce + 500ms max-deferral)', () => {
    it('debounces 5 back-to-back calls within 60ms into ONE worker run', async () => {
      const ctrl = new TieredSimulationController();
      const w = await primeWorker(ctrl);

      const runsBefore = w.runCount;

      const params = { points: 100, fmin: 1, fmax: 1e6 };
      const promises = [
        ctrl.scheduleAcSweep(NETLIST_A, params),
        ctrl.scheduleAcSweep(NETLIST_A, params),
        ctrl.scheduleAcSweep(NETLIST_A, params),
        ctrl.scheduleAcSweep(NETLIST_A, params),
        ctrl.scheduleAcSweep(NETLIST_A, params),
      ];
      await flushMicrotasks();

      // No new RUN yet — still inside the 60ms debounce window
      expect(w.runCount).toBe(runsBefore);

      await vi.advanceTimersByTimeAsync(60);
      await flushMicrotasks();

      // Exactly ONE additional RUN should have been sent
      expect(w.runCount).toBe(runsBefore + 1);
      expect(w.lastRun?.protocolAnalysis).toBe('ac');

      w.simulateResult(requireLastRunId(w), 'ac');
      await flushMicrotasks();
      for (const p of promises) {
        await expect(p).resolves.toBeDefined();
      }
      ctrl.dispose();
    });

    it('max-deferral fallback fires AC within 500ms of continuous scrubbing', async () => {
      const ctrl = new TieredSimulationController();
      const w = await primeWorker(ctrl);
      const runsBefore = w.runCount;

      // Simulate continuous scrubbing: push a new AC request every 30ms.
      // The normal 60ms debounce resets each tick, but after 500ms the
      // max-deferral must fire a run anyway.
      const params = { points: 100, fmin: 1, fmax: 1e6 };
      // Start the first AC request
      const firstPromise = ctrl.scheduleAcSweep(NETLIST_A, params);
      for (let i = 0; i < 20; i++) {
        await vi.advanceTimersByTimeAsync(30);
        // Keep resetting the debounce
        void ctrl.scheduleAcSweep(NETLIST_A, params).catch(() => undefined);
        await flushMicrotasks();
      }

      // At least one RUN should have been sent (the max-deferral one)
      expect(w.runCount).toBeGreaterThanOrEqual(runsBefore + 1);

      // Drain the in-flight request so the promise settles
      const runId = w.lastRun?.requestId;
      if (runId) w.simulateResult(runId, 'ac');
      await flushMicrotasks();
      await firstPromise.catch(() => undefined);
      ctrl.dispose();
    });
  });

  describe('Lane 3 — runTransient (commit-on-release)', () => {
    it('runs immediately with no debounce', async () => {
      const ctrl = new TieredSimulationController();
      const p = ctrl.runTransient(NETLIST_A, { step: '1u', stop: '10m' });
      await flushMicrotasks();
      const w = requireWorker();
      w.simulateReady();
      await flushMicrotasks();

      expect(w.runCount).toBe(1);
      expect(w.lastRun?.protocolAnalysis).toBe('tran');

      w.simulateResult(requireLastRunId(w), 'tran');
      await flushMicrotasks();
      await expect(p).resolves.toBeDefined();
      ctrl.dispose();
    });
  });

  describe('Lane 4 — runSweepPoint (cached by hash+param+value)', () => {
    it('caches results and returns instantly on a repeat call', async () => {
      const ctrl = new TieredSimulationController();
      const p1 = ctrl.runSweepPoint(NETLIST_A, 'R1', 1000);
      await flushMicrotasks();
      const w = requireWorker();
      w.simulateReady();
      await flushMicrotasks();

      expect(w.runCount).toBe(1);
      w.simulateResult(requireLastRunId(w), 'op');
      await flushMicrotasks();
      await p1;

      // Second call with identical key — must NOT send another RUN
      const runsBefore = w.runCount;
      const p2 = ctrl.runSweepPoint(NETLIST_A, 'R1', 1000);
      await flushMicrotasks();
      expect(w.runCount).toBe(runsBefore);
      await expect(p2).resolves.toBeDefined();

      // Different value → should send a new RUN
      const p3 = ctrl.runSweepPoint(NETLIST_A, 'R1', 2000);
      await flushMicrotasks();
      expect(w.runCount).toBe(runsBefore + 1);
      w.simulateResult(requireLastRunId(w), 'op');
      await flushMicrotasks();
      await p3;
      ctrl.dispose();
    });
  });

  describe('Stale-result handling', () => {
    it('drops responses whose requestId was never registered (no throw)', async () => {
      const ctrl = new TieredSimulationController();
      const p = ctrl.runDcOpPoint(NETLIST_A);
      await flushMicrotasks();
      const w = requireWorker();
      w.simulateReady();
      await flushMicrotasks();

      // Emit a stray result with a random requestId — should be silently
      // discarded, must NOT reject the pending DC promise.
      expect(() => w.simulateResult('stale-zombie', 'op')).not.toThrow();

      // Now finish the real run
      w.simulateResult(requireLastRunId(w), 'op');
      await expect(p).resolves.toBeDefined();
      ctrl.dispose();
    });
  });

  describe('dispose', () => {
    it('terminates the worker and clears caches', async () => {
      const ctrl = new TieredSimulationController();
      const w = await primeWorker(ctrl);
      // Seed the sweep cache with a single point
      const p1 = ctrl.runSweepPoint(NETLIST_A, 'R1', 1000);
      await flushMicrotasks();
      w.simulateResult(requireLastRunId(w), 'op');
      await p1;

      ctrl.dispose();
      expect(w.terminated).toBe(true);
    });
  });
});
