import { create } from 'zustand';

/**
 * Phase 5 Plan 05-07 — simulation status used by HoverTooltip and WireEdge
 * to colour their status line / wire stroke opacity. `not-run` is the initial
 * state before the orchestrator has produced any DC result; `computing` is
 * set by the orchestrator right before a worker round-trip; `live` when a
 * fresh DC op-point arrives; `stale` when a transient scrub is using last-
 * committed values; `error` on convergence failure.
 */
export type SimStatus = 'not-run' | 'computing' | 'live' | 'stale' | 'error';

interface OverlayState {
  nodeVoltages: Record<string, number>;
  branchCurrents: Record<string, number>;
  /** Voltage for each wire edge, keyed by wire ID (legacy, used by WireEdge label). */
  edgeVoltages: Record<string, number>;
  /**
   * Plan 05-07 — voltage per net, keyed by net NAME (e.g. `net_1`, `vout`,
   * or the SPICE ground name `0`). Populated by the simulation orchestrator
   * whenever a DC op-point arrives. Consumed by WireEdge to compute the
   * OKLab-interpolated wire stroke. Absence of a key = neutral cyan.
   */
  wireVoltages: Record<string, number>;
  /**
   * Plan 05-07 — live simulation status. Drives the HoverTooltip status
   * line (`DC op: live` etc) and WireEdge stroke opacity (dim when stale).
   */
  simStatus: SimStatus;
  isVisible: boolean;
  setOverlay: (
    voltages: Record<string, number>,
    currents: Record<string, number>,
    edgeVoltages: Record<string, number>,
    wireVoltages?: Record<string, number>,
  ) => void;
  setWireVoltages: (wireVoltages: Record<string, number>) => void;
  setSimStatus: (status: SimStatus) => void;
  toggleVisibility: () => void;
  clear: () => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
  nodeVoltages: {},
  branchCurrents: {},
  edgeVoltages: {},
  wireVoltages: {},
  simStatus: 'not-run',
  isVisible: true,
  setOverlay: (voltages, currents, edgeVoltages, wireVoltages) =>
    set({
      nodeVoltages: voltages,
      branchCurrents: currents,
      edgeVoltages,
      ...(wireVoltages !== undefined ? { wireVoltages } : {}),
    }),
  setWireVoltages: (wireVoltages) => set({ wireVoltages }),
  setSimStatus: (simStatus) => set({ simStatus }),
  toggleVisibility: () => set((s) => ({ isVisible: !s.isVisible })),
  clear: () =>
    set({
      nodeVoltages: {},
      branchCurrents: {},
      edgeVoltages: {},
      wireVoltages: {},
    }),
}));
