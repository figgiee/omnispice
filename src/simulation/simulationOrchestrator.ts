/**
 * simulationOrchestrator — the singleton bridge between the circuit store
 * and the TieredSimulationController.
 *
 * Plan 05-04 Task 4. This module is mounted once at app startup
 * (`startOrchestrator()` in App.tsx) and subscribes to `useCircuitStore`.
 * Every store change kicks off the four simulation lanes:
 *
 *   - **DC op-point (always-live)** — runs on every circuit change, pipes
 *     node voltages / branch currents into `overlayStore`. This is what
 *     makes component values update visibly as the user drags sliders or
 *     retypes resistor values.
 *
 *   - **AC sweep (debounced)** — 60ms debounce + 500ms max-deferral.
 *     Only fires when the circuit contains an AC-capable source
 *     (`ac_voltage` / `ac_current`).
 *
 *   - **Transient (commit-on-release)** — listens for the
 *     `omnispice:scrub-committed` window event (emitted by the scrubber
 *     pointer-up handler in Plan 05-05). Does NOT fire on store changes.
 *
 * The orchestrator NEVER toasts on simulation failure — per RESEARCH
 * §3.7 that's a classic "live simulator vomit" anti-pattern. Failures
 * are logged at debug level and the overlay simply doesn't update.
 *
 * ## Deviations from the PLAN.md draft
 *
 * The plan called for `useCircuitStore.subscribe` with a Zustand
 * two-argument selector form. `subscribeWithSelector` middleware is not
 * currently wrapped around circuitStore, so instead we use the single-
 * argument subscribe and track the previous `circuit` reference
 * ourselves — identical semantics, no middleware churn.
 *
 * Similarly, `generateNetlistWithMap` requires an `AnalysisConfig`
 * (it's a two-arg function in netlister.ts, not the single-arg shape
 * the plan assumed). We pass a minimal DC op-point config for the
 * always-live lane, and borrow the user's configured transient config
 * for the scrub-committed path.
 */

import { buildPortToNetMap, computeNets } from '@/circuit/graph';
import { generateNetlistWithMap } from '@/circuit/netlister';
import type { AnalysisConfig, Circuit, Component } from '@/circuit/types';
import { useOverlayStore } from '@/overlay/overlayStore';
import { useCircuitStore } from '@/store/circuitStore';
import { useSimulationStore } from '@/store/simulationStore';
import type { VectorData } from './protocol';
import { linearSamples, netlistWithSubstitution } from './sweepHelpers';
import {
  type AcParams,
  TieredSimulationController,
  type TranParams,
} from './TieredSimulationController';

/** DC op-point analysis config — the always-live lane uses this. */
const DC_OP_CONFIG: AnalysisConfig = { type: 'dc_op' };

/** Default AC sweep parameters. Plan 05-07 will pull these from the probe. */
const DEFAULT_AC_PARAMS: AcParams = {
  points: 100,
  fmin: 1,
  fmax: 1e6,
};

/** Default transient parameters. Plan 05-05 will drive these from the scrubber. */
const DEFAULT_TRAN_PARAMS: TranParams = {
  step: '1u',
  stop: '10m',
};

/** The event name emitted by the scrubber (Plan 05-05) on pointer-up. */
export const SCRUB_COMMITTED_EVENT = 'omnispice:scrub-committed';

// --- Singleton state -------------------------------------------------------

let controller: TieredSimulationController | null = null;
let unsubStore: (() => void) | null = null;
let scrubCommittedListener: EventListener | null = null;
let lastCircuit: Circuit | null = null;

/**
 * Check whether a circuit contains an AC-capable source. If not, we skip
 * the AC sweep lane entirely — no sense paying the worker round-trip for
 * results nobody will read.
 */
function hasAcSource(circuit: Circuit): boolean {
  for (const comp of circuit.components.values()) {
    if (comp.type === 'ac_voltage' || comp.type === 'ac_current') return true;
  }
  return false;
}

/**
 * Plan 05-07 — find a component with a `__sweep` parameter tag.
 *
 * The sweep contract is a lightweight string: the scrubber (Plan 05-05)
 * or a future parameter-knob UI sets `component.parameters.__sweep =
 * "min,max,steps"` when the user wants to fan-out the result. The
 * orchestrator picks the FIRST matching component (one-parameter sweep
 * only in V1; 2-D sweeps are deferred).
 *
 * Returns `null` when no sweep is requested — the fan-out lane stays
 * idle in that case.
 */
interface SweepRequest {
  component: Component;
  min: number;
  max: number;
  steps: number;
}
function findSweepRequest(circuit: Circuit): SweepRequest | null {
  for (const comp of circuit.components.values()) {
    const spec = comp.parameters?.__sweep;
    if (!spec) continue;
    const parts = spec.split(',').map((s) => Number(s.trim()));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) continue;
    const [min, max, stepsRaw] = parts as [number, number, number];
    const steps = Math.max(1, Math.floor(stepsRaw));
    return { component: comp, min, max, steps };
  }
  return null;
}

/**
 * Pipe DC op-point vectors into overlayStore. Mirrors the logic in
 * useOverlaySync but runs on the controller result directly, not via
 * simulationStore — that avoids a round-trip and makes the "always-live"
 * lane actually fast.
 */
function writeDcOverlay(circuit: Circuit, vectors: VectorData[]): void {
  const voltages: Record<string, number> = {};
  const currents: Record<string, number> = {};
  let hasAny = false;

  for (const vec of vectors) {
    if (vec.data.length !== 1) continue;
    const name = vec.name.toLowerCase();
    if (name.startsWith('v(') && name.endsWith(')')) {
      voltages[name.slice(2, -1)] = vec.data[0] ?? 0;
      hasAny = true;
    } else if (name.startsWith('i(') && name.endsWith(')')) {
      currents[name.slice(2, -1).toUpperCase()] = vec.data[0] ?? 0;
      hasAny = true;
    }
  }

  if (!hasAny) {
    useOverlayStore.getState().clear();
    return;
  }

  const nets = computeNets(circuit.components, circuit.wires);
  const portToNet = buildPortToNetMap(nets);
  const edgeVoltages: Record<string, number> = {};
  for (const [wireId, wire] of circuit.wires) {
    const netName = portToNet.get(wire.sourcePortId);
    if (netName !== undefined && voltages[netName] !== undefined) {
      edgeVoltages[wireId] = voltages[netName] ?? 0;
    }
  }
  // Plan 05-07 — `wireVoltages` is keyed by net NAME, not wire ID. This
  // mirrors the shape WireEdge wants (look up net → voltage → colour)
  // without recomputing the net graph on every render.
  // Ground net (SPICE name "0") is intentionally included so WireEdge can
  // detect it and render the neutral cyan instead of a blue rail colour.
  const wireVoltages: Record<string, number> = { ...voltages };
  useOverlayStore.getState().setOverlay(voltages, currents, edgeVoltages, wireVoltages);
}

/**
 * Kick off a DC op-point, AC sweep (if appropriate) for the current
 * circuit. Catches and debug-logs errors — never toasts.
 */
function driveStoreChange(circuit: Circuit): void {
  if (!controller) return;

  let netlist: string;
  try {
    const result = generateNetlistWithMap(circuit, DC_OP_CONFIG);
    netlist = result.netlist;
  } catch (err) {
    // Empty / invalid circuits can't be netlisted — not an error state,
    // just means there's nothing to simulate yet.
    console.debug('[orchestrator] netlist generation skipped:', err);
    useOverlayStore.getState().clear();
    useOverlayStore.getState().setSimStatus('not-run');
    return;
  }

  // Plan 05-07 — mark computing BEFORE the worker round-trip so the
  // HoverTooltip status line flips to "computing…" during the DC lane.
  useOverlayStore.getState().setSimStatus('computing');

  // Lane 1: DC op-point — always-live
  controller
    .runDcOpPoint(netlist)
    .then((vectors) => {
      writeDcOverlay(circuit, vectors);
      useOverlayStore.getState().setSimStatus('live');
    })
    .catch((err: Error) => {
      // Log but don't toast — debounced failure noise is a classic
      // live-simulator anti-pattern per RESEARCH §3.7.
      console.debug('[orchestrator] DC op-point failed:', err.message);
      useOverlayStore.getState().setSimStatus('error');
    });

  // Lane 2: AC sweep — debounced, only if the circuit has an AC source
  if (hasAcSource(circuit)) {
    controller
      .scheduleAcSweep(netlist, DEFAULT_AC_PARAMS)
      .then((vectors) => {
        // Write into simulationStore so the waveform viewer can pick it up.
        useSimulationStore.getState().setResults(vectors);
      })
      .catch(() => {
        // silent
      });
  }

  // Lane 4: Parameter sweep fan-out — only if a component carries a
  // `__sweep` tag. Fires in parallel with the DC lane; each sample point
  // hits the TieredSimulationController's sweep cache so repeated scrubs
  // are free after the first pass.
  const sweepReq = findSweepRequest(circuit);
  if (sweepReq) {
    const { component: sweepComp, min, max, steps } = sweepReq;
    const values = linearSamples(min, max, steps);
    const refDesignator = sweepComp.refDesignator;
    const paramName = `${refDesignator}.value`;
    const samplePromises = values.map((v) => {
      const swapped = netlistWithSubstitution(netlist, refDesignator, v);
      // `controller` is non-null here because the early return at the top
      // of driveStoreChange guards it — but TypeScript can't narrow
      // through the .map closure so we alias to a local.
      const ctrl = controller;
      if (!ctrl) return Promise.resolve<VectorData[]>([]);
      return ctrl.runSweepPoint(swapped, refDesignator, v);
    });
    Promise.all(samplePromises)
      .then((allVectors) => {
        useSimulationStore.getState().setSweepResults({
          componentId: sweepComp.id,
          paramName,
          values,
          vectors: allVectors,
        });
      })
      .catch((err: Error) => {
        console.debug('[orchestrator] sweep fan-out failed:', err.message);
      });
  } else {
    // No sweep on this circuit — make sure any stale results disappear
    // so SweepFanOut can unmount cleanly.
    if (useSimulationStore.getState().sweepResults !== null) {
      useSimulationStore.getState().setSweepResults(null);
    }
  }
}

/**
 * Mount the orchestrator. Idempotent — subsequent calls are no-ops.
 * Call once from App.tsx on mount.
 */
export function startOrchestrator(): void {
  if (controller) return;

  controller = new TieredSimulationController();
  lastCircuit = useCircuitStore.getState().circuit;

  // Subscribe with single-arg form (no subscribeWithSelector middleware
  // on this store); detect circuit changes via a local reference check.
  unsubStore = useCircuitStore.subscribe((state) => {
    if (state.circuit === lastCircuit) return;
    lastCircuit = state.circuit;
    driveStoreChange(state.circuit);
  });

  // Lane 3: Transient — fires only on scrubber pointer-up (Plan 05-05)
  scrubCommittedListener = (() => {
    if (!controller) return;
    const circuit = useCircuitStore.getState().circuit;
    let netlist: string;
    try {
      const result = generateNetlistWithMap(circuit, {
        type: 'transient',
        timeStep: DEFAULT_TRAN_PARAMS.step,
        stopTime: DEFAULT_TRAN_PARAMS.stop,
      });
      netlist = result.netlist;
    } catch (err) {
      console.debug('[orchestrator] transient netlist skipped:', err);
      return;
    }
    controller
      .runTransient(netlist, DEFAULT_TRAN_PARAMS)
      .then((vectors) => {
        useSimulationStore.getState().setResults(vectors);
      })
      .catch((err: Error) => {
        console.debug('[orchestrator] transient failed:', err.message);
      });
  }) as EventListener;
  window.addEventListener(SCRUB_COMMITTED_EVENT, scrubCommittedListener);

  // Prime: kick off an initial DC op-point for whatever circuit exists.
  driveStoreChange(lastCircuit);
}

/**
 * Tear down the orchestrator. Called on App unmount and by tests in
 * afterEach so fresh suites never see leaked state.
 */
export function stopOrchestrator(): void {
  unsubStore?.();
  unsubStore = null;
  if (scrubCommittedListener) {
    window.removeEventListener(SCRUB_COMMITTED_EVENT, scrubCommittedListener);
    scrubCommittedListener = null;
  }
  controller?.dispose();
  controller = null;
  lastCircuit = null;
}

/**
 * Test-only: return the live controller. Used by the orchestrator test
 * to peek at the lanes without re-plumbing the whole store.
 */
export function __getControllerForTests(): TieredSimulationController | null {
  return controller;
}
