/**
 * UI state management.
 *
 * Tracks editor UI state: active tool, panel visibility, selections,
 * and highlighted component for error navigation (D-21).
 * Separated from circuit/simulation state for clean slice architecture.
 */

import { create } from 'zustand';

export type ActiveTool = 'select' | 'wire';
export type BottomTab = 'errors' | 'waveform' | 'properties';

export interface UiState {
  activeTool: ActiveTool;
  bottomTab: BottomTab;
  sidebarCollapsed: boolean;
  bottomPanelCollapsed: boolean;
  bottomPanelHeight: number;
  selectedComponentIds: string[];
  selectedWireIds: string[];
  /** Per D-21: error navigation highlights component on canvas */
  highlightedComponentId: string | null;
  /**
   * Phase 5 Pillar 2 (Modelessness): true while the user holds Space to
   * temporarily pan the canvas with left-click drag. Consumed by Canvas
   * to flip React Flow's `panOnDrag` from middle-mouse-only to left-mouse.
   */
  tempPanActive: boolean;

  setActiveTool: (tool: ActiveTool) => void;
  setBottomTab: (tab: BottomTab) => void;
  toggleSidebar: () => void;
  toggleBottomPanel: () => void;
  setBottomPanelHeight: (height: number) => void;
  setSelectedComponentIds: (ids: string[]) => void;
  setSelectedWireIds: (ids: string[]) => void;
  /** Per D-21: set highlighted component for error navigation */
  setHighlightedComponentId: (id: string | null) => void;
  /** Phase 5: set temp-pan flag (true on Space keydown, false on keyup) */
  setTempPanActive: (v: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  activeTool: 'select',
  bottomTab: 'errors',
  sidebarCollapsed: false,
  bottomPanelCollapsed: true,
  bottomPanelHeight: 280,
  selectedComponentIds: [],
  selectedWireIds: [],
  highlightedComponentId: null,
  tempPanActive: false,

  setActiveTool: (tool) => set({ activeTool: tool }),

  setBottomTab: (tab) => set({ bottomTab: tab }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  toggleBottomPanel: () => set((s) => ({ bottomPanelCollapsed: !s.bottomPanelCollapsed })),

  setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),

  setSelectedComponentIds: (ids) => set({ selectedComponentIds: ids }),

  setSelectedWireIds: (ids) => set({ selectedWireIds: ids }),

  setHighlightedComponentId: (id) => set({ highlightedComponentId: id }),

  setTempPanActive: (v) => set({ tempPanActive: v }),
}));
