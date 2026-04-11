/**
 * usePinClassName — shared helper that every ComponentNode uses to compute
 * Phase 5 compat-aware className strings for React Flow Handles.
 *
 * Lookup path:
 *   (ComponentType, handleId) -> COMPONENT_LIBRARY[type].ports.find(p.name === handleId)
 *   -> port.pinType
 *   -> wireDragStore.sourcePinType
 *   -> compatState() -> 'ok' | 'neutral' | 'error'
 *
 * Returns one of:
 *   - Base state (no active drag): "{styles.pin} pin-type-{pinType}"
 *   - Drag in progress, source pin: "{styles.pin} pin-type-{pinType}"
 *     (the source pin does not re-color; it's the one you're dragging from)
 *   - Drag in progress, other pin: "{styles.pin} pin-compat-{ok|neutral|error}"
 *
 * Globals vs modules: `pin-type-*` and `pin-compat-*` are intentionally
 * UNSCOPED (not CSS-modules-hashed) because they're looked up dynamically
 * at render time. They live in `pinStates.css`, imported from `main.tsx`.
 */

import { useMemo } from 'react';
import { COMPONENT_LIBRARY } from '@/circuit/componentLibrary';
import type { ComponentType, PinType } from '@/circuit/types';
import { compatState } from '@/circuit/pinCompat';
import { useWireDragStore } from '../stores/wireDragStore';
import styles from './ComponentNode.module.css';

/**
 * Resolve a handle id (e.g. "base", "pin1", "positive") to its declared
 * pinType by looking it up in the component library.
 */
export function pinTypeFor(componentType: ComponentType, handleId: string): PinType {
  const lib = COMPONENT_LIBRARY[componentType];
  const portDef = lib?.ports.find((p) => p.name === handleId);
  return portDef?.pinType ?? 'signal';
}

/**
 * Hook: compute the className for a single Handle inside a custom node.
 *
 * `nodeId` is the React Flow node id; it's compared against the drag source
 * so the source pin does not re-color itself during drag.
 *
 * Usage:
 *   const className = usePinClassName('resistor', 'pin1', nodeId);
 */
export function usePinClassName(
  componentType: ComponentType,
  handleId: string,
  nodeId: string,
): string {
  const sourcePortId = useWireDragStore((s) => s.sourcePortId);
  const sourcePinType = useWireDragStore((s) => s.sourcePinType);

  return useMemo(() => {
    const pinType = pinTypeFor(componentType, handleId);
    const baseClass = `${styles.pin} pin-type-${pinType}`;

    // No drag in progress → default state
    if (sourcePortId === null || sourcePinType === null) {
      return baseClass;
    }

    // This IS the source pin → keep it in its natural color
    // (React Flow passes the node id + handle id combined in onConnectStart,
    // so we match on the composite `${nodeId}:${handleId}` below)
    if (sourcePortId === `${nodeId}:${handleId}`) {
      return baseClass;
    }

    // Other pin → apply compat state
    const state = compatState(sourcePinType, pinType);
    return `${styles.pin} pin-compat-${state}`;
  }, [componentType, handleId, nodeId, sourcePortId, sourcePinType]);
}
