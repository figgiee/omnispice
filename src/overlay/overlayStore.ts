import { create } from 'zustand';

interface OverlayState {
  nodeVoltages: Record<string, number>;
  branchCurrents: Record<string, number>;
  /** Voltage for each wire edge, keyed by wire ID */
  edgeVoltages: Record<string, number>;
  isVisible: boolean;
  setOverlay: (
    voltages: Record<string, number>,
    currents: Record<string, number>,
    edgeVoltages: Record<string, number>,
  ) => void;
  toggleVisibility: () => void;
  clear: () => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
  nodeVoltages: {},
  branchCurrents: {},
  edgeVoltages: {},
  isVisible: true,
  setOverlay: (voltages, currents, edgeVoltages) =>
    set({ nodeVoltages: voltages, branchCurrents: currents, edgeVoltages }),
  toggleVisibility: () => set((s) => ({ isVisible: !s.isVisible })),
  clear: () => set({ nodeVoltages: {}, branchCurrents: {}, edgeVoltages: {} }),
}));
