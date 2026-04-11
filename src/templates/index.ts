/**
 * Bundled circuit templates (Phase 5 plan 05-06).
 *
 * Each template is a small serialized circuit fragment that the command
 * palette can insert at the current insert-cursor position. On insertion,
 * component IDs are regenerated, ref designators are renumbered via the
 * circuit store's ref counters, and the callout event fires so Plan 05-11
 * (change callouts) can surface "N components inserted".
 *
 * Authoring recipe (see SUMMARY.md for the long form):
 *   1. Lay out the circuit in the editor
 *   2. Export to JSON using the dev-time helper (or hand-author)
 *   3. Use positions RELATIVE to the cursor (0,0 is a good anchor)
 *   4. Port names MUST match the componentLibrary exactly (e.g. "anode",
 *      "cathode", "positive", "negative", "1", "2")
 *   5. Register the file in this index
 */

import type { ComponentType } from '@/circuit/types';
import bjtCommonEmitter from './bjtCommonEmitter.json';
import opAmpInverting from './opAmpInverting.json';
import opAmpNonInverting from './opAmpNonInverting.json';
import rcLowPass from './rcLowPass.json';
import voltageDivider from './voltageDivider.json';

export interface TemplateComponent {
  tmpId: string;
  type: ComponentType;
  value: string;
  position: { x: number; y: number };
  rotation: number;
  /** Port names in the same order as COMPONENT_LIBRARY[type].ports. */
  portNames: string[];
}

export interface TemplatePortRef {
  comp: string;
  port: string;
}

export interface TemplateWire {
  tmpId: string;
  from: TemplatePortRef;
  to: TemplatePortRef;
}

export interface CircuitTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  components: TemplateComponent[];
  wires: TemplateWire[];
}

export const TEMPLATES: Record<string, CircuitTemplate> = {
  'voltage-divider': voltageDivider as CircuitTemplate,
  'rc-low-pass': rcLowPass as CircuitTemplate,
  'bjt-common-emitter': bjtCommonEmitter as CircuitTemplate,
  'opamp-inverting': opAmpInverting as CircuitTemplate,
  'opamp-non-inverting': opAmpNonInverting as CircuitTemplate,
};
