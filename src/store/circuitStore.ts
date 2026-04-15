/**
 * Circuit state management with undo/redo.
 *
 * Manages the circuit data model (components, wires, nets) with full
 * undo/redo support via zundo. Uses Map serialization for immutable
 * state updates compatible with Zustand's shallow equality checks.
 */

import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import { temporal } from 'zundo';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { COMPONENT_LIBRARY, type ComponentPortDefinition } from '@/circuit/componentLibrary';
import type { Circuit, Component, ComponentType, Port, Wire } from '@/circuit/types';
import { mapReplacer, mapReviver } from './mapSerialization';

/**
 * Plan 06-03 — collab bypass flag.
 *
 * When a y-indexeddb provider owns the IndexedDB slot during a collab session,
 * we must prevent Zustand persist from writing to the same key at the same
 * time. Callers set this to `true` before mounting useYIndexedDB and reset it
 * to `false` when the collab session ends.
 *
 * Only `setItem` is gated — `getItem` and `removeItem` are read-only or
 * deletion paths used by the offline-first bootstrap and are safe regardless.
 */
let collabActive = false;

/**
 * Exported setter so the collab lifecycle (useCollabProvider, useYIndexedDB)
 * can flip the flag without importing Zustand state into the collab layer.
 */
export const setCollabActive = (active: boolean): void => {
  collabActive = active;
};

/**
 * Storage adapter that bridges zustand `persist` to `idb-keyval`. Strings go
 * in, strings come out — the JSON serialization is handled by
 * `createJSONStorage` with our Map/Set-aware replacer/reviver.
 *
 * Tests can `vi.mock('idb-keyval', ...)` to swap the backing store for
 * an in-memory Map without touching this adapter.
 */
const indexedDbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = await idbGet<string>(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    // During collab sessions y-indexeddb owns the IndexedDB slot.
    // Skip Zustand persist writes to prevent a double-write race.
    if (collabActive) return;
    await idbSet(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await idbDel(name);
  },
};

/**
 * State shape for the circuit store.
 *
 * circuit: The full circuit data model (components, wires, nets).
 * refCounters: Tracks the next ref designator number per spice prefix (e.g., { R: 3, C: 1 }).
 */
export interface CircuitState {
  circuit: Circuit;
  refCounters: Record<string, number>;

  // CRUD actions
  addComponent: (type: ComponentType, position: { x: number; y: number }) => string;
  removeComponent: (id: string) => void;
  updateComponentValue: (id: string, value: string) => void;
  /**
   * Plan 05-05 — set an arbitrary named parameter on a component. If
   * `paramName === 'value'` this is equivalent to `updateComponentValue`.
   * Otherwise it writes into `component.parameters[paramName]`. Used by
   * the inline parameter chip to edit multi-parameter components (sources,
   * op-amps, etc.) without a dedicated per-field action per component type.
   */
  updateComponentParam: (id: string, paramName: string, value: string) => void;
  /**
   * Plan 05-05 — record a sweep range on a component. Stored inline on
   * `component.parameters.__sweep` as a CSV "min,max,steps" string. The
   * tiered simulation orchestrator + fan-out waveform renderer will
   * consume this in Plan 05-07; this plan just writes it so the shift-drag
   * sweep gesture has somewhere to land.
   */
  setSweepParam: (id: string, range: { min: number; max: number; steps: number }) => void;
  updateComponentPosition: (id: string, position: { x: number; y: number }) => void;
  rotateComponent: (id: string) => void;
  addWire: (sourcePortId: string, targetPortId: string) => string;
  removeWire: (id: string) => void;
  clearCircuit: () => void;
  addComponents: (components: Component[]) => void;
  /**
   * Bulk-insert pre-built components + wires in a single store update so
   * undo captures one atomic step. Used by template insertion (plan 05-06).
   * The optional `refCounters` arg overwrites the running SPICE ref designator
   * counters so subsequent single-component adds continue from the right seed.
   */
  addComponentsAndWires: (
    components: Component[],
    wires: Wire[],
    refCounters?: Record<string, number>,
  ) => void;
  /** Replace the entire circuit (e.g., after LTspice import). Resets refCounters. */
  setCircuit: (circuit: Circuit) => void;
  /**
   * Phase 5 Pillar 1 — split the given wire with a net-label pseudo-component
   * at the provided flow-space position. Replaces the original wire with two
   * new wires that both touch the label's `pin1`. The label's `netLabel` is
   * what `computeNets` will promote to the net's SPICE name.
   *
   * Returns the new label component ID so callers can select it.
   */
  splitWireWithNetLabel: (
    wireId: string,
    position: { x: number; y: number },
    netLabel: string,
  ) => string | null;

  /**
   * Plan 05-03 — collapse a multi-selection into a single subcircuit block.
   *
   * - Fewer than 2 selected components → silent no-op (UI-SPEC §9.3).
   * - Creates a new `type='subcircuit'` component with auto-generated ref
   *   `X{N}` and exposed ports derived from wires that cross the selection
   *   boundary. Internal wires are preserved; boundary wires are re-pointed
   *   so the outside endpoint connects to the subcircuit's exposed port.
   * - Each selected component gets `parentId` set to the new subcircuit id
   *   so `circuitToFlow` can hide them at the top level.
   * - V1 single-level guard: if a caller passes `isNested=true` (the store
   *   does not itself know the current view; the caller — typically
   *   `useCanvasInteractions` — must pass `true` when `uiStore.currentSubcircuitId`
   *   is non-null), the call is a silent no-op.
   */
  collapseSubcircuit: (componentIds: string[], name: string, isNested?: boolean) => string | null;

  /**
   * Plan 05-03 — inverse of `collapseSubcircuit`. Removes the subcircuit
   * component, clears `parentId` on former children, and re-points boundary
   * wires back to the original inner ports via `exposedPinMapping`.
   */
  expandSubcircuit: (subId: string) => void;
}

function createEmptyCircuit(): Circuit {
  return {
    components: new Map(),
    wires: new Map(),
    nets: new Map(),
  };
}

/**
 * Plan 05-11 — emit a raw change-callout event. The ChangeCalloutLayer
 * listens for this event and maps it to a formatted pill. Kept outside
 * uiStore so circuitStore has no dependency on React or uiStore.
 */
function dispatchChangeCallout(detail: {
  kind: 'add' | 'delete' | 'rotate' | 'param-edit' | 'duplicate';
  ref?: string;
  componentId?: string;
  value?: string;
  param?: string;
  count?: number;
  lastPosition?: { x: number; y: number };
}) {
  window.dispatchEvent(new CustomEvent('omnispice:change-callout', { detail }));
}

/**
 * Generate a unique ID using crypto.randomUUID().
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Create Port objects from a component definition's port config.
 *
 * Phase 5: pin metadata (`pinType`, `direction`, `label`) is forwarded from
 * the library definition. Missing fields fall back to `signal`/`inout` so
 * legacy saved circuits (pre-Phase 5) keep loading without a crash.
 */
function createPorts(portDefs: ComponentPortDefinition[]): Port[] {
  return portDefs.map((def) => ({
    id: generateId(),
    name: def.name,
    netId: null,
    pinType: def.pinType ?? 'signal',
    direction: def.direction ?? 'inout',
    ...(def.label ? { label: def.label } : {}),
  }));
}

export const useCircuitStore = create<CircuitState>()(
  temporal(
    persist(
      (set, get) => ({
        circuit: createEmptyCircuit(),
        refCounters: {},

        addComponent: (type, position) => {
          const def = COMPONENT_LIBRARY[type];
          const id = generateId();
          const state = get();

          // Increment ref counter for this SPICE prefix
          const prefix = def.spicePrefix || type.charAt(0).toUpperCase();
          const currentCount = state.refCounters[prefix] ?? 0;
          const nextCount = currentCount + 1;
          const refDesignator = `${prefix}${nextCount}`;

          const component: Component = {
            id,
            type,
            refDesignator,
            value: def.defaultValue,
            ports: createPorts(def.ports),
            position,
            rotation: 0,
            ...(def.defaultModel ? { spiceModel: def.defaultModel } : {}),
          };

          set((s) => {
            const components = new Map(s.circuit.components);
            components.set(id, component);
            return {
              circuit: { ...s.circuit, components },
              refCounters: { ...s.refCounters, [prefix]: nextCount },
            };
          });

          dispatchChangeCallout({ kind: 'add', ref: refDesignator, componentId: id });

          return id;
        },

        removeComponent: (id) => {
          // Capture position + ref before mutating state (needed for delete callout)
          const preComp = get().circuit.components.get(id);
          const deletedRef = preComp?.refDesignator;
          const deletedPos = preComp?.position;

          set((s) => {
            const comp = s.circuit.components.get(id);
            if (!comp) return s;

            // Collect port IDs for this component
            const portIds = new Set(comp.ports.map((p) => p.id));

            // Remove wires connected to any of the component's ports
            const wires = new Map(s.circuit.wires);
            for (const [wireId, wire] of wires) {
              if (portIds.has(wire.sourcePortId) || portIds.has(wire.targetPortId)) {
                wires.delete(wireId);
              }
            }

            // Remove the component
            const components = new Map(s.circuit.components);
            components.delete(id);

            return {
              circuit: { ...s.circuit, components, wires },
            };
          });

          dispatchChangeCallout({
            kind: 'delete',
            ref: deletedRef,
            lastPosition: deletedPos,
          });
        },

        updateComponentValue: (id, value) => {
          const preComp = get().circuit.components.get(id);
          set((s) => {
            const comp = s.circuit.components.get(id);
            if (!comp) return s;

            const components = new Map(s.circuit.components);
            components.set(id, { ...comp, value });
            return {
              circuit: { ...s.circuit, components },
            };
          });
          if (preComp) {
            dispatchChangeCallout({
              kind: 'param-edit',
              ref: preComp.refDesignator,
              componentId: id,
              param: 'value',
              value,
            });
          }
        },

        updateComponentParam: (id, paramName, value) => {
          const preComp = get().circuit.components.get(id);
          set((s) => {
            const comp = s.circuit.components.get(id);
            if (!comp) return s;

            const components = new Map(s.circuit.components);
            if (paramName === 'value') {
              components.set(id, { ...comp, value });
            } else {
              const parameters = { ...(comp.parameters ?? {}), [paramName]: value };
              components.set(id, { ...comp, parameters });
            }
            return {
              circuit: { ...s.circuit, components },
            };
          });
          if (preComp) {
            dispatchChangeCallout({
              kind: 'param-edit',
              ref: preComp.refDesignator,
              componentId: id,
              param: paramName,
              value,
            });
          }
        },

        setSweepParam: (id, range) => {
          set((s) => {
            const comp = s.circuit.components.get(id);
            if (!comp) return s;

            const components = new Map(s.circuit.components);
            const parameters = {
              ...(comp.parameters ?? {}),
              __sweep: `${range.min},${range.max},${range.steps}`,
            };
            components.set(id, { ...comp, parameters });
            return {
              circuit: { ...s.circuit, components },
            };
          });
        },

        updateComponentPosition: (id, position) => {
          set((s) => {
            const comp = s.circuit.components.get(id);
            if (!comp) return s;

            const components = new Map(s.circuit.components);
            components.set(id, { ...comp, position });
            return {
              circuit: { ...s.circuit, components },
            };
          });
        },

        rotateComponent: (id) => {
          const preComp = get().circuit.components.get(id);
          set((s) => {
            const comp = s.circuit.components.get(id);
            if (!comp) return s;

            const components = new Map(s.circuit.components);
            const nextRotation = (comp.rotation + 90) % 360;
            components.set(id, { ...comp, rotation: nextRotation });
            return {
              circuit: { ...s.circuit, components },
            };
          });
          if (preComp) {
            dispatchChangeCallout({ kind: 'rotate', ref: preComp.refDesignator, componentId: id });
          }
        },

        addWire: (sourcePortId, targetPortId) => {
          const id = generateId();
          const wire: Wire = {
            id,
            sourcePortId,
            targetPortId,
            bendPoints: [],
          };

          set((s) => {
            const wires = new Map(s.circuit.wires);
            wires.set(id, wire);
            return {
              circuit: { ...s.circuit, wires },
            };
          });

          return id;
        },

        removeWire: (id) => {
          set((s) => {
            const wires = new Map(s.circuit.wires);
            wires.delete(id);
            return {
              circuit: { ...s.circuit, wires },
            };
          });
        },

        clearCircuit: () => {
          set({
            circuit: createEmptyCircuit(),
            refCounters: {},
          });
        },

        addComponents: (components) => {
          set((s) => {
            const newComponents = new Map(s.circuit.components);
            for (const comp of components) {
              newComponents.set(comp.id, comp);
            }
            return {
              circuit: { ...s.circuit, components: newComponents },
            };
          });
        },

        addComponentsAndWires: (components, wires, refCounters) => {
          set((s) => {
            const newComponents = new Map(s.circuit.components);
            for (const comp of components) {
              newComponents.set(comp.id, comp);
            }
            const newWires = new Map(s.circuit.wires);
            for (const wire of wires) {
              newWires.set(wire.id, wire);
            }
            return {
              circuit: { ...s.circuit, components: newComponents, wires: newWires },
              refCounters: refCounters ?? s.refCounters,
            };
          });
        },

        setCircuit: (circuit) => {
          set({
            circuit,
            refCounters: {},
          });
        },

        splitWireWithNetLabel: (wireId, position, netLabel) => {
          const state = get();
          const wire = state.circuit.wires.get(wireId);
          if (!wire) return null;

          const def = COMPONENT_LIBRARY.net_label;
          const labelId = generateId();
          const labelPorts = createPorts(def.ports);
          const pinId = labelPorts[0]?.id;
          if (!pinId) return null;

          const labelComponent: Component = {
            id: labelId,
            type: 'net_label',
            refDesignator: `NL_${labelId.slice(0, 4)}`,
            value: netLabel,
            ports: labelPorts,
            position,
            rotation: 0,
            netLabel,
          };

          const wireA: Wire = {
            id: generateId(),
            sourcePortId: wire.sourcePortId,
            targetPortId: pinId,
            bendPoints: [],
          };
          const wireB: Wire = {
            id: generateId(),
            sourcePortId: pinId,
            targetPortId: wire.targetPortId,
            bendPoints: [],
          };

          set((s) => {
            const components = new Map(s.circuit.components);
            components.set(labelId, labelComponent);
            const wires = new Map(s.circuit.wires);
            wires.delete(wireId);
            wires.set(wireA.id, wireA);
            wires.set(wireB.id, wireB);
            return {
              circuit: { ...s.circuit, components, wires },
            };
          });

          return labelId;
        },

        collapseSubcircuit: (componentIds, name, isNested) => {
          // Plan 06-04 — collab guard: subcircuit topology changes are not
          // CRDT-safe in Phase 6. The action is a no-op during live sessions.
          if (collabActive) {
            console.warn(
              '[OmniSpice] collapseSubcircuit is disabled during a collaboration session. ' +
                'Subcircuit collapse is not CRDT-safe. Disconnect to collapse.',
            );
            return null;
          }
          // Silent no-op per UI-SPEC §9.3: empty selection or single-item.
          if (componentIds.length < 2) return null;
          // V1 single-level guard (Plan 05-03 locked decision #2): callers
          // must pass `isNested=true` when already inside a subcircuit.
          if (isNested === true) return null;

          const state = get();
          const children: Component[] = [];
          for (const id of componentIds) {
            const c = state.circuit.components.get(id);
            if (c) children.push(c);
          }
          if (children.length < 2) return null;

          const selectionPortIds = new Set<string>(
            children.flatMap((c) => c.ports.map((p) => p.id)),
          );

          // Inner port id -> child component, for pinType inheritance lookups.
          const innerPortIndex = new Map<string, Port>();
          for (const c of children) {
            for (const p of c.ports) {
              innerPortIndex.set(p.id, p);
            }
          }

          // Walk every wire; classify as inside / outside / boundary.
          // Boundary wires yield one exposed port per distinct inner port.
          const exposedPorts: Port[] = [];
          const exposedPinMapping: Record<string, string> = {};
          // Reuse one exposed port when multiple boundary wires touch the
          // same inner pin (e.g. a shared fan-out).
          const innerPortToExposed = new Map<string, Port>();

          const boundaryRepoints: {
            wireId: string;
            exposedPortId: string;
            endpoint: 'source' | 'target';
          }[] = [];

          for (const wire of state.circuit.wires.values()) {
            const sourceInside = selectionPortIds.has(wire.sourcePortId);
            const targetInside = selectionPortIds.has(wire.targetPortId);
            if (sourceInside === targetInside) {
              // Fully inside or fully outside — leave wire as-is.
              continue;
            }
            const insidePortId = sourceInside ? wire.sourcePortId : wire.targetPortId;
            const innerPort = innerPortIndex.get(insidePortId);
            if (!innerPort) continue;

            let exposed = innerPortToExposed.get(insidePortId);
            if (!exposed) {
              exposed = {
                id: generateId(),
                name: innerPort.name,
                netId: null,
                pinType: innerPort.pinType ?? 'signal',
                direction: innerPort.direction ?? 'inout',
                ...(innerPort.label ? { label: innerPort.label } : { label: innerPort.name }),
              };
              innerPortToExposed.set(insidePortId, exposed);
              exposedPorts.push(exposed);
              exposedPinMapping[exposed.id] = insidePortId;
            }

            boundaryRepoints.push({
              wireId: wire.id,
              exposedPortId: exposed.id,
              endpoint: sourceInside ? 'source' : 'target',
            });
          }

          // Centroid placement so the block visually replaces the cluster.
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (const c of children) {
            if (c.position.x < minX) minX = c.position.x;
            if (c.position.y < minY) minY = c.position.y;
            if (c.position.x > maxX) maxX = c.position.x;
            if (c.position.y > maxY) maxY = c.position.y;
          }
          if (!Number.isFinite(minX)) {
            minX = 0;
            minY = 0;
            maxX = 0;
            maxY = 0;
          }
          const centroid = {
            x: Math.round((minX + maxX) / 2 / 10) * 10,
            y: Math.round((minY + maxY) / 2 / 10) * 10,
          };

          // Next X ref designator.
          const currentX = state.refCounters.X ?? 0;
          const nextX = currentX + 1;
          const subId = generateId();
          const subcircuit: Component = {
            id: subId,
            type: 'subcircuit',
            refDesignator: `X${nextX}`,
            value: name,
            subcircuitName: name,
            ports: exposedPorts,
            position: centroid,
            rotation: 0,
            childComponentIds: [...componentIds],
            exposedPinMapping,
          };

          set((s) => {
            const newWires = new Map(s.circuit.wires);
            for (const repoint of boundaryRepoints) {
              const w = newWires.get(repoint.wireId);
              if (!w) continue;
              if (repoint.endpoint === 'source') {
                newWires.set(w.id, { ...w, sourcePortId: repoint.exposedPortId });
              } else {
                newWires.set(w.id, { ...w, targetPortId: repoint.exposedPortId });
              }
            }

            const newComponents = new Map(s.circuit.components);
            newComponents.set(subId, subcircuit);
            for (const id of componentIds) {
              const child = newComponents.get(id);
              if (!child) continue;
              newComponents.set(id, { ...child, parentId: subId });
            }

            return {
              circuit: {
                ...s.circuit,
                components: newComponents,
                wires: newWires,
              },
              refCounters: { ...s.refCounters, X: nextX },
            };
          });

          return subId;
        },

        expandSubcircuit: (subId) => {
          const state = get();
          const sub = state.circuit.components.get(subId);
          if (!sub || sub.type !== 'subcircuit') return;
          if (!sub.childComponentIds || !sub.exposedPinMapping) return;

          const exposedPortIds = new Set(sub.ports.map((p) => p.id));
          // Narrow once so the callback below closes over a non-optional map.
          const pinMapping = sub.exposedPinMapping;

          set((s) => {
            const newWires = new Map(s.circuit.wires);
            for (const w of s.circuit.wires.values()) {
              let next = w;
              if (exposedPortIds.has(w.sourcePortId)) {
                const innerId = pinMapping[w.sourcePortId];
                if (innerId) next = { ...next, sourcePortId: innerId };
              }
              if (exposedPortIds.has(w.targetPortId)) {
                const innerId = pinMapping[w.targetPortId];
                if (innerId) next = { ...next, targetPortId: innerId };
              }
              if (next !== w) newWires.set(w.id, next);
            }

            const newComponents = new Map(s.circuit.components);
            newComponents.delete(subId);
            for (const childId of sub.childComponentIds ?? []) {
              const c = newComponents.get(childId);
              if (!c) continue;
              const { parentId: _parentId, ...rest } = c;
              void _parentId;
              newComponents.set(childId, rest as Component);
            }

            return {
              circuit: {
                ...s.circuit,
                components: newComponents,
                wires: newWires,
              },
            };
          });
        },
      }),
      {
        name: 'omnispice-circuit',
        storage: createJSONStorage(() => indexedDbStorage, {
          replacer: mapReplacer,
          reviver: mapReviver,
        }),
        // Only persist circuit data + refCounters, never derived / action state.
        partialize: (state) => ({
          circuit: state.circuit,
          refCounters: state.refCounters,
        }),
        // Bump on breaking shape changes — consumers re-run the round-trip
        // test (see __tests__/circuitStoreOfflinePersist.test.ts) when
        // modifying this version.
        version: 1,
      },
    ),
    {
      limit: 100,
      partialize: (state) => ({
        circuit: state.circuit,
        refCounters: state.refCounters,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Plan 06-04 — Exported helpers for CRDT conflict resolution
// ---------------------------------------------------------------------------

/**
 * Resolves concurrent refDesignator collisions that can arise when two peers
 * call addComponent simultaneously with the same component type.
 *
 * The conflict scenario: both clients generate 'R1'. After CRDT merge both
 * entries exist in Y.Map under different UUIDs, but the displayed
 * refDesignator of both components is 'R1'.
 *
 * Resolution: sort the conflicting components deterministically by their UUID
 * (UUIDs are globally unique and comparable as strings), keep the
 * lexicographically-first UUID's designator, and auto-increment the rest.
 *
 * This function is pure — it takes the current components Map and returns a
 * corrected Map without mutating either. Callers (e.g. the yComponents
 * observer in circuitBinding.ts) apply it after each remote sync and write
 * the corrected Map back to Zustand via setState.
 *
 * Known limitation (documented): there is a sub-100 ms window between a
 * remote add arriving via Y.Map observe and this function running where
 * duplicate designators can briefly coexist in the UI. This is acceptable
 * for Phase 6 v1 — the correction fires on the next microtask tick.
 */
export function resolveRefDesignatorConflicts(
  components: Map<string, import('@/circuit/types').Component>,
): Map<string, import('@/circuit/types').Component> {
  // Group component IDs by their current refDesignator.
  const byRef = new Map<string, string[]>();
  for (const [id, comp] of components) {
    const existing = byRef.get(comp.refDesignator);
    if (existing) {
      existing.push(id);
    } else {
      byRef.set(comp.refDesignator, [id]);
    }
  }

  // Find groups with more than one component — those are collisions.
  let hasConflicts = false;
  for (const ids of byRef.values()) {
    if (ids.length > 1) {
      hasConflicts = true;
      break;
    }
  }
  if (!hasConflicts) return components;

  const result = new Map(components);

  for (const [ref, ids] of byRef) {
    if (ids.length <= 1) continue;

    // Sort by UUID for a deterministic cross-client winner. The
    // lexicographically-smallest UUID keeps the original designator;
    // the rest get auto-incremented suffixes.
    ids.sort();

    // Extract the numeric suffix and SPICE prefix from the winning ref.
    const match = /^([A-Za-z_]+)(\d+)$/.exec(ref);
    if (!match) continue;
    // match[1] and match[2] are guaranteed non-undefined by the regex groups above.
    const prefix = match[1] as string;
    const winningNumber = parseInt(match[2] as string, 10);

    // Collect all currently-used numbers for this prefix to avoid further
    // collisions when assigning incremented designators.
    const usedNumbers = new Set<number>();
    for (const comp of result.values()) {
      const m = /^([A-Za-z_]+)(\d+)$/.exec(comp.refDesignator);
      if (m && m[1] === prefix && m[2] !== undefined) {
        usedNumbers.add(parseInt(m[2], 10));
      }
    }

    // The first (winner) keeps its designator; losers get the next free number.
    for (let i = 1; i < ids.length; i++) {
      const loserId = ids[i];
      if (!loserId) continue;
      const loser = result.get(loserId);
      if (!loser) continue;

      // Find next free number above the winning one.
      let next = winningNumber + 1;
      while (usedNumbers.has(next)) next++;
      usedNumbers.add(next);

      result.set(loserId, { ...loser, refDesignator: `${prefix}${next}` });
    }
  }

  return result;
}
