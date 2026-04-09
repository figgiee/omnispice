import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimulationController } from '../controller';
import type { SimResponse, VectorData } from '../protocol';

/**
 * Mock Worker class for testing SimulationController.
 * Vitest/jsdom doesn't have a real Worker constructor,
 * so we provide a minimal mock.
 */
class MockWorker {
  onmessage: ((event: MessageEvent<SimResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  private _terminated = false;

  /** Messages sent to the worker via postMessage */
  readonly sentMessages: unknown[] = [];

  postMessage(data: unknown): void {
    this.sentMessages.push(data);
  }

  terminate(): void {
    this._terminated = true;
  }

  get terminated(): boolean {
    return this._terminated;
  }

  /** Simulate worker sending a response back to main thread */
  simulateResponse(response: SimResponse): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: response }));
    }
  }

  addEventListener(type: string, handler: (event: MessageEvent<SimResponse>) => void): void {
    if (type === 'message') {
      this.onmessage = handler;
    }
  }

  removeEventListener(): void {
    // No-op for testing
  }
}

// Store reference to current mock worker so tests can control it
let currentMockWorker: MockWorker | null = null;

// Mock the Worker constructor globally
vi.stubGlobal(
  'Worker',
  class {
    constructor() {
      const mock = new MockWorker();
      currentMockWorker = mock;
      return mock as unknown as Worker;
    }
  },
);

describe('SimulationController', () => {
  let controller: SimulationController;
  let onProgress: ReturnType<typeof vi.fn>;
  let onResult: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;
  let onReady: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    currentMockWorker = null;
    onProgress = vi.fn();
    onResult = vi.fn();
    onError = vi.fn();
    onReady = vi.fn();
    controller = new SimulationController(onProgress, onResult, onError, onReady);
  });

  afterEach(() => {
    controller.destroy();
    vi.useRealTimers();
  });

  describe('initialize', () => {
    it('sends INIT then waits for READY', async () => {
      const initPromise = controller.initialize();

      // Worker should have been created and INIT sent
      expect(currentMockWorker).not.toBeNull();
      expect(currentMockWorker!.sentMessages).toContainEqual({ type: 'INIT' });

      // Simulate worker responding with READY
      currentMockWorker!.simulateResponse({ type: 'READY' });

      await initPromise;
      expect(onReady).toHaveBeenCalled();
    });
  });

  describe('runSimulation', () => {
    it('sends INIT then LOAD_CIRCUIT then RUN messages in sequence', async () => {
      // Initialize first
      const initPromise = controller.initialize();
      currentMockWorker!.simulateResponse({ type: 'READY' });
      await initPromise;

      const worker = currentMockWorker!;
      worker.sentMessages.length = 0; // Clear init messages

      // Run simulation
      const runPromise = controller.runSimulation(
        '* test\nV1 in 0 5\n.tran 1u 1m\n.end',
        'transient',
      );

      // Should send LOAD_CIRCUIT first
      expect(worker.sentMessages[0]).toEqual({
        type: 'LOAD_CIRCUIT',
        netlist: '* test\nV1 in 0 5\n.tran 1u 1m\n.end',
      });

      // Simulate STDOUT response for circuit loaded
      worker.simulateResponse({ type: 'STDOUT', text: 'Circuit loaded' });

      // Should then send RUN
      expect(worker.sentMessages[1]).toEqual({
        type: 'RUN',
        analysis: 'run',
      });

      // Simulate result
      const mockVectors: VectorData[] = [
        { name: 'time', data: new Float64Array([0, 1e-4]), unit: 's', isComplex: false },
      ];
      worker.simulateResponse({ type: 'RESULT', vectors: mockVectors });

      await runPromise;
      expect(onResult).toHaveBeenCalledWith(mockVectors);
    });
  });

  describe('cancelSimulation', () => {
    it('terminates worker and marks it for lazy re-initialization', async () => {
      // Initialize
      const initPromise = controller.initialize();
      currentMockWorker!.simulateResponse({ type: 'READY' });
      await initPromise;

      const oldWorker = currentMockWorker!;

      // Cancel
      controller.cancelSimulation();

      // Old worker should be terminated
      expect(oldWorker.terminated).toBe(true);
    });
  });

  describe('onProgress callback', () => {
    it('fires with elapsed time during simulation', async () => {
      // Initialize
      const initPromise = controller.initialize();
      currentMockWorker!.simulateResponse({ type: 'READY' });
      await initPromise;

      // Start simulation
      controller.runSimulation(
        '* test\n.tran 1u 1m\n.end',
        'transient',
      );

      const worker = currentMockWorker!;
      worker.simulateResponse({ type: 'STDOUT', text: 'loaded' });

      // Advance time by 500ms -- progress should fire
      vi.advanceTimersByTime(500);
      expect(onProgress).toHaveBeenCalled();
      const elapsed = onProgress.mock.calls[0]![0] as number;
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('onError callback', () => {
    it('fires with translated error on ERROR response', async () => {
      // Initialize
      const initPromise = controller.initialize();
      currentMockWorker!.simulateResponse({ type: 'READY' });
      await initPromise;

      // Start simulation
      controller.runSimulation('* test\n.end', 'dc_op');

      const worker = currentMockWorker!;
      worker.simulateResponse({ type: 'STDOUT', text: 'loaded' });

      // Simulate error
      worker.simulateResponse({
        type: 'ERROR',
        message: 'singular matrix',
        raw: 'Error: singular matrix at node 7',
      });

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('loadModel', () => {
    it('sends LOAD_MODEL command to worker', async () => {
      const initPromise = controller.initialize();
      currentMockWorker!.simulateResponse({ type: 'READY' });
      await initPromise;

      controller.loadModel('2N2222.mod', '.model 2N2222 NPN(...)');

      expect(currentMockWorker!.sentMessages).toContainEqual({
        type: 'LOAD_MODEL',
        filename: '2N2222.mod',
        content: '.model 2N2222 NPN(...)',
      });
    });
  });

  describe('destroy', () => {
    it('cleans up worker and timers', async () => {
      const initPromise = controller.initialize();
      currentMockWorker!.simulateResponse({ type: 'READY' });
      await initPromise;

      const worker = currentMockWorker!;
      controller.destroy();

      expect(worker.terminated).toBe(true);
    });
  });
});
