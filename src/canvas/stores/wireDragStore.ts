/**
 * wireDragStore — in-flight wire drag state for Phase 5 Pillar 1.
 *
 * Holds the source pin's ID and electrical type while a wire drag is active.
 * Every visible component node subscribes to this store and uses it to
 * recolor its pins via `compatState(sourcePinType, portPinType)`.
 *
 * Lifecycle:
 *   - Canvas.onConnectStart populates `{sourcePortId, sourcePinType}`
 *   - Canvas.onConnectEnd clears both fields back to null
 *
 * Zustand v5: state is serializable primitives only, subscribers stay cheap.
 * No derived selectors live here — that's the node components' job.
 */

import { create } from 'zustand';
import type { PinType } from '@/circuit/types';

export interface WireDragState {
  sourcePortId: string | null;
  sourcePinType: PinType | null;
  start: (portId: string, type: PinType) => void;
  end: () => void;
}

export const useWireDragStore = create<WireDragState>((set) => ({
  sourcePortId: null,
  sourcePinType: null,
  start: (portId, type) => set({ sourcePortId: portId, sourcePinType: type }),
  end: () => set({ sourcePortId: null, sourcePinType: null }),
}));
