import { create } from 'zustand';

interface OverlayState {
  nodeVoltages: Record<string, number>;
  branchCurrents: Record<string, number>;
  isVisible: boolean;
  setOverlay: (voltages: Record<string, number>, currents: Record<string, number>) => void;
  toggleVisibility: () => void;
  clear: () => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
  nodeVoltages: {},
  branchCurrents: {},
  isVisible: true,
  setOverlay: (voltages, currents) =>
    set({ nodeVoltages: voltages, branchCurrents: currents }),
  toggleVisibility: () => set((s) => ({ isVisible: !s.isVisible })),
  clear: () => set({ nodeVoltages: {}, branchCurrents: {} }),
}));
