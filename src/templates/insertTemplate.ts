/**
 * Insert a bundled template into the circuit at the current insert cursor.
 *
 * Renumbers ref designators from the existing circuitStore.refCounters,
 * generates fresh UUIDs for components / ports / wires, and commits
 * everything in a single store update so undo captures one atomic step.
 *
 * Fires `omnispice:change-callout` so Plan 05-11's live-feedback callouts
 * can announce "Inserted Voltage Divider (4 parts)".
 */

import { COMPONENT_LIBRARY } from '@/circuit/componentLibrary';
import type { Component, ComponentType, Port, Wire } from '@/circuit/types';
import { useCircuitStore } from '@/store/circuitStore';
import { useUiStore } from '@/store/uiStore';
import { TEMPLATES, type CircuitTemplate } from './index';

export interface InsertTemplateResult {
  componentIds: string[];
  wireIds: string[];
}

/**
 * Insert by id. Returns the generated IDs so callers can select the new
 * components. Returns `null` if the id is unknown.
 */
export function insertTemplate(id: string): InsertTemplateResult | null {
  const template = TEMPLATES[id];
  if (!template) {
    console.warn(`[insertTemplate] unknown template id: ${id}`);
    return null;
  }
  return insertTemplateObject(template);
}

/**
 * Insert a template object directly (useful for tests).
 */
export function insertTemplateObject(template: CircuitTemplate): InsertTemplateResult {
  const uiStore = useUiStore.getState();
  const circuitStore = useCircuitStore.getState();

  const cursor = uiStore.insertCursor ?? uiStore.cursorPosition ?? { x: 300, y: 300 };

  // Running ref counters (per spicePrefix) start from the store's snapshot
  // so newly inserted components pick up after any existing R1, C1, V1…
  const nextCounters: Record<string, number> = { ...circuitStore.refCounters };

  // Map tmpId → new component id so we can resolve template wires.
  const componentIdMap = new Map<string, string>();
  // Map `${tmpId}:${portName}` → new port id (same per-component map).
  const portIdMap = new Map<string, string>();

  const newComponents: Component[] = template.components.map((tc) => {
    const def = COMPONENT_LIBRARY[tc.type as ComponentType];
    if (!def) {
      throw new Error(`[insertTemplate] unknown component type in template: ${tc.type}`);
    }
    const prefix = def.spicePrefix || (tc.type.charAt(0).toUpperCase());
    // Ground has an empty spicePrefix; skip renumbering and just keep a
    // blank refDesignator (the netlister treats ground as global "0").
    let refDesignator = '';
    if (prefix) {
      const nextNum = (nextCounters[prefix] ?? 0) + 1;
      nextCounters[prefix] = nextNum;
      refDesignator = `${prefix}${nextNum}`;
    }

    // Build ports in the SAME ORDER as COMPONENT_LIBRARY[type].ports so the
    // netlister (which indexes by port position) sees a valid component.
    const ports: Port[] = def.ports.map((portDef) => {
      const newPortId = crypto.randomUUID();
      portIdMap.set(`${tc.tmpId}:${portDef.name}`, newPortId);
      return {
        id: newPortId,
        name: portDef.name,
        netId: null,
      };
    });

    // Validate that every portName the template references is actually in
    // def.ports. Prevents typos in authored JSON from silently dropping wires.
    for (const declared of tc.portNames) {
      if (!def.ports.some((p) => p.name === declared)) {
        throw new Error(
          `[insertTemplate] template "${template.id}" references unknown port ` +
            `"${declared}" on ${tc.type}`,
        );
      }
    }

    const newId = crypto.randomUUID();
    componentIdMap.set(tc.tmpId, newId);

    const comp: Component = {
      id: newId,
      type: tc.type as ComponentType,
      refDesignator,
      value: tc.value || def.defaultValue,
      ports,
      position: {
        x: cursor.x + tc.position.x,
        y: cursor.y + tc.position.y,
      },
      rotation: tc.rotation,
      ...(def.defaultModel ? { spiceModel: def.defaultModel } : {}),
    };
    return comp;
  });

  const newWires: Wire[] = template.wires.map((tw) => {
    const sourcePortId = portIdMap.get(`${tw.from.comp}:${tw.from.port}`);
    const targetPortId = portIdMap.get(`${tw.to.comp}:${tw.to.port}`);
    if (!sourcePortId || !targetPortId) {
      throw new Error(
        `[insertTemplate] template "${template.id}" wire ${tw.tmpId} references ` +
          `unknown port (${tw.from.comp}:${tw.from.port} → ${tw.to.comp}:${tw.to.port})`,
      );
    }
    return {
      id: crypto.randomUUID(),
      sourcePortId,
      targetPortId,
      bendPoints: [],
    };
  });

  useCircuitStore.getState().addComponentsAndWires(newComponents, newWires, nextCounters);

  // Change callout (Plan 05-11 consumes this)
  window.dispatchEvent(
    new CustomEvent('omnispice:change-callout', {
      detail: {
        kind: 'insert-template',
        name: template.name,
        count: newComponents.length,
      },
    }),
  );

  return {
    componentIds: newComponents.map((c) => c.id),
    wireIds: newWires.map((w) => w.id),
  };
}
