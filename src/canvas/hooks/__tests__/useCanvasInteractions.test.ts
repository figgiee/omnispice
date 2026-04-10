/**
 * Tests for useCanvasInteractions hook.
 *
 * Verifies that keyboard shortcuts dispatch the correct store actions.
 * Uses mocked circuitStore, uiStore, and React Flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCanvasInteractions } from '../useCanvasInteractions';

// Mock React Flow
const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();
const mockFitView = vi.fn();
vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
    fitView: mockFitView,
    screenToFlowPosition: vi.fn((pos: { x: number; y: number }) => pos),
  }),
}));

// Mock circuitStore
const mockRemoveComponent = vi.fn();
const mockRemoveWire = vi.fn();
const mockRotateComponent = vi.fn();
const mockAddComponents = vi.fn();
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
    }
  ),
}));

// Mock uiStore
let mockSelectedComponentIds: string[] = [];
let mockSelectedWireIds: string[] = [];
const mockSetSelectedComponentIds = vi.fn();
const mockSetActiveTool = vi.fn();

vi.mock('@/store/uiStore', () => ({
  useUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      selectedComponentIds: mockSelectedComponentIds,
      selectedWireIds: mockSelectedWireIds,
      setSelectedComponentIds: mockSetSelectedComponentIds,
      setActiveTool: mockSetActiveTool,
    }),
}));

// Track registered hotkeys and their handlers
const registeredHotkeys = new Map<string, () => void>();
vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: (keys: string, handler: () => void) => {
    // Store each key combo and its handler for test invocation
    for (const key of keys.split(',').map((k) => k.trim())) {
      registeredHotkeys.set(key, handler);
    }
  },
}));

describe('useCanvasInteractions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredHotkeys.clear();
    mockSelectedComponentIds = [];
    mockSelectedWireIds = [];
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

  it('registers W key to switch to wire tool', () => {
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
      expect.objectContaining({ type: 'omnispice:run-simulation' })
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

  it('registers V key to switch to select tool', () => {
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
