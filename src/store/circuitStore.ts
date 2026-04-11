/**
 * Circuit state management with undo/redo.
 *
 * Manages the circuit data model (components, wires, nets) with full
 * undo/redo support via zundo. Uses Map serialization for immutable
 * state updates compatible with Zustand's shallow equality checks.
 */

import { temporal } from 'zundo';
import { create } from 'zustand';
import { COMPONENT_LIBRARY, type ComponentPortDefinition } from '@/circuit/componentLibrary';
import type { Circuit, Component, ComponentType, Port, Wire } from '@/circuit/types';

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
}

function createEmptyCircuit(): Circuit {
  return {
    components: new Map(),
    wires: new Map(),
    nets: new Map(),
  };
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

        return id;
      },

      removeComponent: (id) => {
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
      },

      updateComponentValue: (id, value) => {
        set((s) => {
          const comp = s.circuit.components.get(id);
          if (!comp) return s;

          const components = new Map(s.circuit.components);
          components.set(id, { ...comp, value });
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
    }),
    {
      limit: 100,
      partialize: (state) => ({
        circuit: state.circuit,
        refCounters: state.refCounters,
      }),
    },
  ),
);
