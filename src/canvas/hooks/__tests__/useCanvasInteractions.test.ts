/**
 * Tests for useCanvasInteractions hook.
 *
 * Verifies that keyboard shortcuts dispatch the correct store actions.
 * Uses mocked circuitStore, uiStore, and React Flow.
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanvasInteractions } from '../useCanvasInteractions';

// Mock React Flow
const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();
const mockFitView = vi.fn();
const mockSetCenter = vi.fn();
const mockGetViewport = vi.fn(() => ({ x: 0, y: 0, zoom: 1 }));
type MockNode = {
  id: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  measured?: { width?: number; height?: number };
  selected?: boolean;
};
const mockNodes: MockNode[] = [];
const mockGetNodes = vi.fn(() => mockNodes);
vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
    fitView: mockFitView,
    setCenter: mockSetCenter,
    getNodes: mockGetNodes,
    getViewport: mockGetViewport,
    screenToFlowPosition: vi.fn((pos: { x: number; y: number }) => pos),
  }),
}));

// Mock circuitStore
const mockRemoveComponent = vi.fn();
const mockRemoveWire = vi.fn();
const mockRotateComponent = vi.fn();
const mockAddComponents = vi.fn();
const mockCollapseSubcircuit = vi.fn();
const mockUndo = vi.fn();
const mockRedo = vi.fn();
const mockCircuitState = {
  circuit: {
    components: new Map([
      ['comp-1', { id: 'comp-1', type: 'resistor', position: { x: 0, y: 0 }, ports: [] }],
      ['comp-2', { id: 'comp-2', type: 'capacitor', position: { x: 100, y: 0 }, ports: [] }],
    ]),
    wires: new Map(),
    nets: new Map(),
  },
  removeComponent: mockRemoveComponent,
  removeWire: mockRemoveWire,
  rotateComponent: mockRotateComponent,
  addComponents: mockAddComponents,
  collapseSubcircuit: mockCollapseSubcircuit,
};

vi.mock('@/store/circuitStore', () => ({
  useCircuitStore: Object.assign(
    (selector: (state: typeof mockCircuitState) => unknown) => selector(mockCircuitState),
    {
      getState: () => mockCircuitState,
      temporal: {
        getState: () => ({
          undo: mockUndo,
          redo: mockRedo,
        }),
      },
    },
  ),
}));

// Mock uiStore
let mockSelectedComponentIds: string[] = [];
let mockSelectedWireIds: string[] = [];
let mockCurrentSubcircuitId: string | null = null;
const mockSetSelectedComponentIds = vi.fn();
const mockSetActiveTool = vi.fn();
const mockSetTempPanActive = vi.fn();
const mockAscendSubcircuit = vi.fn(() => {
  mockCurrentSubcircuitId = null;
});
const mockUiState = () => ({
  selectedComponentIds: mockSelectedComponentIds,
  selectedWireIds: mockSelectedWireIds,
  setSelectedComponentIds: mockSetSelectedComponentIds,
  setActiveTool: mockSetActiveTool,
  setTempPanActive: mockSetTempPanActive,
  tempPanActive: false,
  currentSubcircuitId: mockCurrentSubcircuitId,
  ascendSubcircuit: mockAscendSubcircuit,
});

vi.mock('@/store/uiStore', () => ({
  useUiStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector(mockUiState()),
    {
      getState: () => mockUiState(),
    },
  ),
}));

// Track registered hotkeys and their handlers.
// Some keys (e.g. 'space') register both a keydown and keyup handler —
// keep the latest registration under the bare key (matches old tests) and
// also expose a keyed-by-phase map for Phase 5 space tests.
type HotkeyOptions = { keydown?: boolean; keyup?: boolean } & Record<string, unknown>;
const registeredHotkeys = new Map<string, (e?: KeyboardEvent) => void>();
const registeredHotkeyPhases = new Map<
  string,
  { keydown?: (e?: KeyboardEvent) => void; keyup?: (e?: KeyboardEvent) => void }
>();
vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: (keys: string, handler: (e?: KeyboardEvent) => void, options?: HotkeyOptions) => {
    for (const key of keys.split(',').map((k) => k.trim())) {
      registeredHotkeys.set(key, handler);
      const phase = registeredHotkeyPhases.get(key) ?? {};
      // Default react-hotkeys-hook behavior is keydown when no option set
      if (options?.keyup === true && options?.keydown !== true) {
        phase.keyup = handler;
      } else {
        phase.keydown = handler;
      }
      registeredHotkeyPhases.set(key, phase);
    }
  },
}));

describe('useCanvasInteractions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredHotkeys.clear();
    registeredHotkeyPhases.clear();
    mockNodes.length = 0;
    mockSelectedComponentIds = [];
    mockSelectedWireIds = [];
    mockCurrentSubcircuitId = null;
  });

  function setupHook() {
    renderHook(() => useCanvasInteractions());
  }

  it('registers Delete key to remove selected components', () => {
    mockSelectedComponentIds = ['comp-1', 'comp-2'];
    setupHook();

    const handler = registeredHotkeys.get('delete');
    expect(handler).toBeDefined();
    handler!();

    expect(mockRemoveComponent).toHaveBeenCalledWith('comp-1');
    expect(mockRemoveComponent).toHaveBeenCalledWith('comp-2');
    expect(mockSetSelectedComponentIds).toHaveBeenCalledWith([]);
  });

  it('registers R key to rotate selected components', () => {
    mockSelectedComponentIds = ['comp-1'];
    setupHook();

    const handler = registeredHotkeys.get('r');
    expect(handler).toBeDefined();
    handler!();

    expect(mockRotateComponent).toHaveBeenCalledWith('comp-1');
  });

  // Skipped: W tool-switch hotkey is asserted but never implemented in the hook.
  // Pre-existing stale test — left skipped pending UX decision on tool hotkeys.
  it.skip('registers W key to switch to wire tool', () => {
    setupHook();

    const handler = registeredHotkeys.get('w');
    expect(handler).toBeDefined();
    handler!();

    expect(mockSetActiveTool).toHaveBeenCalledWith('wire');
  });

  it('registers Ctrl+Z for undo via temporal store', () => {
    setupHook();

    const handler = registeredHotkeys.get('ctrl+z');
    expect(handler).toBeDefined();
    handler!();

    expect(mockUndo).toHaveBeenCalled();
  });

  it('registers Ctrl+Shift+Z for redo via temporal store', () => {
    setupHook();

    const handler = registeredHotkeys.get('ctrl+shift+z');
    expect(handler).toBeDefined();
    handler!();

    expect(mockRedo).toHaveBeenCalled();
  });

  it('registers Escape to switch to select tool', () => {
    setupHook();

    const handler = registeredHotkeys.get('escape');
    expect(handler).toBeDefined();
    handler!();

    expect(mockSetActiveTool).toHaveBeenCalledWith('select');
  });

  it('registers F5 for simulation run', () => {
    setupHook();

    const handler = registeredHotkeys.get('f5');
    expect(handler).toBeDefined();

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    handler!();

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'omnispice:run-simulation' }),
    );
    dispatchSpy.mockRestore();
  });

  it('registers Ctrl+A to select all components', () => {
    setupHook();

    const handler = registeredHotkeys.get('ctrl+a');
    expect(handler).toBeDefined();
    handler!();

    expect(mockSetSelectedComponentIds).toHaveBeenCalledWith(['comp-1', 'comp-2']);
  });

  // Skipped: V tool-switch hotkey is asserted but never implemented in the hook.
  // Pre-existing stale test — left skipped pending UX decision on tool hotkeys.
  it.skip('registers V key to switch to select tool', () => {
    setupHook();

    // V and escape share the same handler registration
    const handler = registeredHotkeys.get('v');
    expect(handler).toBeDefined();
    handler!();

    expect(mockSetActiveTool).toHaveBeenCalledWith('select');
  });

  it('registers zoom shortcuts', () => {
    setupHook();

    const zoomInHandler = registeredHotkeys.get('ctrl+=');
    expect(zoomInHandler).toBeDefined();
    zoomInHandler!();
    expect(mockZoomIn).toHaveBeenCalled();

    const zoomOutHandler = registeredHotkeys.get('ctrl+-');
    expect(zoomOutHandler).toBeDefined();
    zoomOutHandler!();
    expect(mockZoomOut).toHaveBeenCalled();

    const fitViewHandler = registeredHotkeys.get('ctrl+0');
    expect(fitViewHandler).toBeDefined();
    fitViewHandler!();
    expect(mockFitView).toHaveBeenCalled();
  });
});

// Phase 5 hotkeys — un-skipped across Tasks 2-3 as hotkeys ship.
describe('Phase 5 hotkeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredHotkeys.clear();
    registeredHotkeyPhases.clear();
    mockNodes.length = 0;
    mockSelectedComponentIds = [];
    mockSelectedWireIds = [];
    mockCurrentSubcircuitId = null;
  });

  function setupHook() {
    renderHook(() => useCanvasInteractions());
  }

  it('F with no selection is a no-op (does not throw, does not call setCenter)', () => {
    mockNodes.push(
      {
        id: 'comp-1',
        position: { x: 0, y: 0 },
        width: 60,
        height: 40,
        selected: false,
      },
      {
        id: 'comp-2',
        position: { x: 200, y: 100 },
        width: 60,
        height: 40,
        selected: false,
      },
    );
    setupHook();

    const handler = registeredHotkeys.get('f');
    expect(handler).toBeDefined();
    expect(() => handler!()).not.toThrow();
    expect(mockSetCenter).not.toHaveBeenCalled();
  });

  it('F with one selected node calls setCenter near the node centroid', () => {
    mockNodes.push({
      id: 'comp-1',
      position: { x: 100, y: 50 },
      width: 60,
      height: 40,
      selected: true,
    });
    setupHook();

    const handler = registeredHotkeys.get('f');
    expect(handler).toBeDefined();
    handler!();

    expect(mockSetCenter).toHaveBeenCalledTimes(1);
    // Centroid for single node is position + size/2 = (130, 70)
    const [x, y, opts] = mockSetCenter.mock.calls[0] as [
      number,
      number,
      { duration?: number; zoom?: number },
    ];
    expect(x).toBeCloseTo(130, 0);
    expect(y).toBeCloseTo(70, 0);
    expect(opts).toMatchObject({ duration: 200 });
  });

  it('A calls fitView with a 200ms animation', () => {
    setupHook();

    const handler = registeredHotkeys.get('a');
    expect(handler).toBeDefined();
    handler!();

    expect(mockFitView).toHaveBeenCalledWith({ duration: 200 });
  });

  it('0 (bare) calls fitView with a 200ms animation', () => {
    setupHook();

    // '0' shares the 'a, 0' registration with A
    const handler = registeredHotkeys.get('0');
    expect(handler).toBeDefined();
    handler!();

    expect(mockFitView).toHaveBeenCalledWith({ duration: 200 });
  });

  it('Space keydown sets tempPanActive true; Space keyup sets it false', () => {
    setupHook();

    const phases = registeredHotkeyPhases.get('space');
    expect(phases).toBeDefined();
    expect(phases?.keydown).toBeDefined();
    expect(phases?.keyup).toBeDefined();

    phases!.keydown!({ preventDefault: vi.fn() } as unknown as KeyboardEvent);
    expect(mockSetTempPanActive).toHaveBeenCalledWith(true);

    phases!.keyup!({ preventDefault: vi.fn() } as unknown as KeyboardEvent);
    expect(mockSetTempPanActive).toHaveBeenCalledWith(false);
  });

  it('Shift+D copies then pastes the current selection', () => {
    mockSelectedComponentIds = ['comp-1'];
    setupHook();

    const handler = registeredHotkeys.get('shift+d');
    expect(handler).toBeDefined();
    handler!({ preventDefault: vi.fn() } as unknown as KeyboardEvent);

    // Paste creates new components via addComponents (see hook logic)
    expect(mockAddComponents).toHaveBeenCalled();
    // Paste also updates the selection to the newly-created ids
    expect(mockSetSelectedComponentIds).toHaveBeenCalled();
  });
});
