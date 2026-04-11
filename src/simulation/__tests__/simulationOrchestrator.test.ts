/**
 * Tests for simulationOrchestrator.
 *
 * Plan 05-04 Task 4. Mocks TieredSimulationController so we can assert
 * which lanes fire on which triggers, without spawning a real Worker.
 *
 * Covers:
 *   - DC op-point runs on every store change
 *   - AC sweep is scheduled when the circuit contains an AC source,
 *     skipped otherwise
 *   - Transient runs ONLY on omnispice:scrub-committed, not on store
 *     changes
 *   - DC failures do NOT call any toast/error-surface (just debug logs)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mock the controller BEFORE importing the orchestrator ---------------
//
// We hoist the spy functions via `vi.hoisted` so the factory in `vi.mock`
// can reference them (vitest hoists `vi.mock` calls above imports, which
// means top-level `const` declarations are not visible inside the factory).

const mocks = vi.hoisted(() => ({
  runDcOpPointMock: vi.fn(),
  scheduleAcSweepMock: vi.fn(),
  runTransientMock: vi.fn(),
  runSweepPointMock: vi.fn(),
  disposeMock: vi.fn(),
}));

vi.mock('../TieredSimulationController', () => {
  class MockTieredSimulationController {
    runDcOpPoint = mocks.runDcOpPointMock;
    scheduleAcSweep = mocks.scheduleAcSweepMock;
    runTransient = mocks.runTransientMock;
    runSweepPoint = mocks.runSweepPointMock;
    dispose = mocks.disposeMock;
  }
  return {
    TieredSimulationController: MockTieredSimulationController,
  };
});

const { runDcOpPointMock, scheduleAcSweepMock, runTransientMock, runSweepPointMock, disposeMock } =
  mocks;

import { useCircuitStore } from '@/store/circuitStore';
import {
  SCRUB_COMMITTED_EVENT,
  startOrchestrator,
  stopOrchestrator,
} from '../simulationOrchestrator';

function resetControllerMocks(): void {
  runDcOpPointMock.mockReset().mockResolvedValue([]);
  scheduleAcSweepMock.mockReset().mockResolvedValue([]);
  runTransientMock.mockReset().mockResolvedValue([]);
  runSweepPointMock.mockReset().mockResolvedValue([]);
  disposeMock.mockReset();
}

function resetCircuitStore(): void {
  useCircuitStore.getState().clearCircuit();
}

describe('simulationOrchestrator', () => {
  beforeEach(() => {
    resetControllerMocks();
    resetCircuitStore();
  });

  afterEach(() => {
    stopOrchestrator();
  });

  it('runs DC op-point once at start and again on every circuit change', async () => {
    startOrchestrator();
    // Startup priming call
    const initialCalls = runDcOpPointMock.mock.calls.length;

    // Add a component — one store change
    useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    await Promise.resolve();
    expect(runDcOpPointMock.mock.calls.length).toBe(initialCalls + 1);

    // Add another — another store change
    useCircuitStore.getState().addComponent('resistor', { x: 50, y: 0 });
    await Promise.resolve();
    expect(runDcOpPointMock.mock.calls.length).toBe(initialCalls + 2);
  });

  it('schedules an AC sweep when an ac_voltage source is present', async () => {
    startOrchestrator();

    // Start with a pure-DC circuit — no AC calls expected
    useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    useCircuitStore.getState().addComponent('dc_voltage', { x: 100, y: 0 });
    await Promise.resolve();
    const acBefore = scheduleAcSweepMock.mock.calls.length;
    expect(acBefore).toBe(0);

    // Adding an ac_voltage should cause the next store tick to schedule AC
    useCircuitStore.getState().addComponent('ac_voltage', { x: 200, y: 0 });
    await Promise.resolve();
    expect(scheduleAcSweepMock.mock.calls.length).toBeGreaterThan(acBefore);
  });

  it('does NOT run transient on store changes — only on scrub-committed', async () => {
    startOrchestrator();

    useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    useCircuitStore.getState().addComponent('dc_voltage', { x: 100, y: 0 });
    await Promise.resolve();
    expect(runTransientMock).not.toHaveBeenCalled();

    // Dispatch scrub-committed — transient MUST fire exactly once
    window.dispatchEvent(new CustomEvent(SCRUB_COMMITTED_EVENT));
    await Promise.resolve();
    expect(runTransientMock).toHaveBeenCalledTimes(1);

    // A subsequent store change must NOT fire transient again
    useCircuitStore.getState().addComponent('resistor', { x: 200, y: 0 });
    await Promise.resolve();
    expect(runTransientMock).toHaveBeenCalledTimes(1);
  });

  it('swallows DC op-point failures silently (no thrown error, no rethrow)', async () => {
    // Make the DC lane reject
    runDcOpPointMock.mockReset().mockRejectedValue(new Error('singular matrix'));
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    startOrchestrator();
    useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    // Let the rejected promise settle
    await Promise.resolve();
    await Promise.resolve();

    // debug logged, but nothing thrown to the caller
    expect(debugSpy).toHaveBeenCalled();
    debugSpy.mockRestore();
  });

  it('stopOrchestrator unsubscribes and further store changes do not drive lanes', async () => {
    startOrchestrator();
    useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    await Promise.resolve();
    const callsBeforeStop = runDcOpPointMock.mock.calls.length;

    stopOrchestrator();
    expect(disposeMock).toHaveBeenCalled();

    // A post-stop store mutation MUST NOT trigger the controller
    useCircuitStore.getState().addComponent('resistor', { x: 50, y: 0 });
    await Promise.resolve();
    expect(runDcOpPointMock.mock.calls.length).toBe(callsBeforeStop);
  });
});
