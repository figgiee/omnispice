/**
 * Store barrel exports.
 *
 * Re-exports all three Zustand stores for convenient imports.
 * Circuit store (with undo/redo), simulation store, and UI store
 * are kept as separate slices to avoid monolithic state.
 */

export { useCircuitStore } from './circuitStore';
export type { CircuitState } from './circuitStore';

export { useSimulationStore } from './simulationStore';
export type { SimulationState, SimStatus } from './simulationStore';

export { useUiStore } from './uiStore';
export type { UiState, ActiveTool, BottomTab } from './uiStore';
