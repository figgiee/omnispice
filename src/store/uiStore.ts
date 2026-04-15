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
  /**
   * Plan 05-06: persistent "insert cursor" set by an empty-canvas click.
   * While non-null, type-to-place and template insertion anchor to this
   * flow-space coordinate.
   */
  insertCursor: { x: number; y: number } | null;
  /**
   * Plan 05-06: live mouse position in flow coordinates. Used as a fallback
   * insertion anchor when `insertCursor` is null (e.g. template inserted via
   * command palette without an explicit click).
   */
  cursorPosition: { x: number; y: number } | null;
  /**
   * Plan 05-02 Task 4 — in-flight net label capture. When the user types a
   * printable character with exactly one wire selected, `beginNetLabelInput`
   * seeds this with the wire id and first char. Subsequent keypresses append
   * via `appendNetLabelChar`; Enter commits, Escape cancels.
   */
  pendingNetLabel: { wireId: string; chars: string } | null;
  /**
   * Plan 05-03 — current subcircuit the user has descended into. `null` means
   * the top level. View-only state: NOT persisted via zundo temporal middleware
   * (the store's temporal partialize only captures `circuit` + `refCounters`),
   * so descending/ascending cannot be undone. Set by double-clicking a
   * subcircuit block; cleared by Breadcrumb Home / Esc via `ascendSubcircuit`.
   */
  currentSubcircuitId: string | null;

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
  setInsertCursor: (pos: { x: number; y: number } | null) => void;
  setCursorPosition: (pos: { x: number; y: number } | null) => void;
  /** Plan 05-02 Task 4 — net label type-to-capture gesture. */
  beginNetLabelInput: (wireId: string, firstChar: string) => void;
  appendNetLabelChar: (c: string) => void;
  backspaceNetLabelChar: () => void;
  cancelNetLabel: () => void;
  /**
   * Consumed by the commit step — reads the buffered chars and clears the
   * pending state. The caller is responsible for actually creating the
   * label in the circuit store. Returns the buffered value.
   */
  consumeNetLabel: () => { wireId: string; chars: string } | null;
  /** Plan 05-03 — descend into a subcircuit (set to null to ascend). */
  setCurrentSubcircuitId: (id: string | null) => void;
  /** Plan 05-03 — ascend to top level. Equivalent to setCurrentSubcircuitId(null). */
  ascendSubcircuit: () => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  activeTool: 'select',
  bottomTab: 'errors',
  sidebarCollapsed: false,
  bottomPanelCollapsed: true,
  bottomPanelHeight: 280,
  selectedComponentIds: [],
  selectedWireIds: [],
  highlightedComponentId: null,
  tempPanActive: false,
  insertCursor: null,
  cursorPosition: null,
  pendingNetLabel: null,
  currentSubcircuitId: null,

  setActiveTool: (tool) => set({ activeTool: tool }),

  setBottomTab: (tab) => set({ bottomTab: tab }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  toggleBottomPanel: () => set((s) => ({ bottomPanelCollapsed: !s.bottomPanelCollapsed })),

  setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),

  setSelectedComponentIds: (ids) => set({ selectedComponentIds: ids }),

  setSelectedWireIds: (ids) => set({ selectedWireIds: ids }),

  setHighlightedComponentId: (id) => set({ highlightedComponentId: id }),

  setTempPanActive: (v) => set({ tempPanActive: v }),

  setInsertCursor: (pos) => set({ insertCursor: pos }),

  setCursorPosition: (pos) => set({ cursorPosition: pos }),

  beginNetLabelInput: (wireId, firstChar) => set({ pendingNetLabel: { wireId, chars: firstChar } }),

  appendNetLabelChar: (c) => {
    const current = get().pendingNetLabel;
    if (!current) return;
    set({ pendingNetLabel: { wireId: current.wireId, chars: current.chars + c } });
  },

  backspaceNetLabelChar: () => {
    const current = get().pendingNetLabel;
    if (!current) return;
    const next = current.chars.slice(0, -1);
    if (next.length === 0) {
      set({ pendingNetLabel: null });
    } else {
      set({ pendingNetLabel: { wireId: current.wireId, chars: next } });
    }
  },

  cancelNetLabel: () => set({ pendingNetLabel: null }),

  consumeNetLabel: () => {
    const current = get().pendingNetLabel;
    if (!current) return null;
    set({ pendingNetLabel: null });
    return current;
  },

  setCurrentSubcircuitId: (id) => set({ currentSubcircuitId: id }),

  ascendSubcircuit: () => set({ currentSubcircuitId: null }),
}));
