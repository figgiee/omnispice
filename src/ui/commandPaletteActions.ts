/**
 * Command palette action registry.
 *
 * Each action is a discoverable command that the global CommandPalette can
 * surface under the "Actions" group. Actions dispatch either a direct store
 * call or a window CustomEvent so other panels (Toolbar, BottomPanel,
 * simulation controller) can react without circular imports.
 *
 * Adding a new action:
 *   1. Append an entry to ACTIONS with a stable id
 *   2. Either call store helpers directly or dispatch an existing
 *      `omnispice:*` CustomEvent so the palette stays decoupled
 *   3. No need to edit CommandPalette.tsx — it reads ACTIONS at render time
 */

import { exportWaveformAsCsv } from '@/export/exportCsv';
import { exportNetlist } from '@/export/exportNetlist';
import { exportSchematicAsPng } from '@/export/exportPng';
import { generateNetlist } from '@/circuit/netlister';
import type { AnalysisConfig } from '@/circuit/types';
import { useCircuitStore } from '@/store/circuitStore';
import { useSimulationStore } from '@/store/simulationStore';

export interface CommandPaletteAction {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void | Promise<void>;
}

export const ACTIONS: CommandPaletteAction[] = [
  {
    id: 'run-dc-op',
    label: 'Run DC Operating Point',
    shortcut: 'F5',
    run: () => {
      window.dispatchEvent(
        new CustomEvent('omnispice:run-simulation', {
          detail: { analysis: 'dc_op' },
        }),
      );
    },
  },
  {
    id: 'run-transient',
    label: 'Run Transient Analysis',
    run: () => {
      window.dispatchEvent(
        new CustomEvent('omnispice:run-simulation', {
          detail: { analysis: 'transient' },
        }),
      );
    },
  },
  {
    id: 'run-ac',
    label: 'Run AC Sweep',
    run: () => {
      window.dispatchEvent(
        new CustomEvent('omnispice:run-simulation', {
          detail: { analysis: 'ac' },
        }),
      );
    },
  },
  {
    id: 'cancel-simulation',
    label: 'Cancel Simulation',
    shortcut: 'Ctrl+.',
    run: () => {
      window.dispatchEvent(new CustomEvent('omnispice:cancel-simulation'));
    },
  },
  {
    id: 'export-netlist',
    label: 'Export SPICE Netlist',
    run: () => {
      const circuit = useCircuitStore.getState().circuit;
      // Minimal DC-op config so netlister can render — the user can re-run
      // with other analyses; netlist shape is identical for this export.
      const config: AnalysisConfig = { type: 'dc_op' };
      const netlist = generateNetlist(circuit, config);
      exportNetlist(netlist);
    },
  },
  {
    id: 'export-png',
    label: 'Export Schematic as PNG',
    run: async () => {
      // Canvas nodes are computed from the circuit store at export time; the
      // exportPng util reads them via the DOM. We still need to pass the node
      // bounds so React Flow centres them correctly, so we dispatch an event
      // that Layout.tsx can pick up (Layout owns `nodes` state).
      window.dispatchEvent(new CustomEvent('omnispice:export-png'));
    },
  },
  {
    id: 'export-csv',
    label: 'Export Waveform as CSV',
    run: () => {
      const results = useSimulationStore.getState().results;
      if (!results || results.length === 0) {
        window.dispatchEvent(
          new CustomEvent('omnispice:toast', {
            detail: {
              level: 'warning',
              message: 'No simulation results to export yet. Run a simulation first.',
            },
          }),
        );
        return;
      }
      exportWaveformAsCsv(results);
    },
  },
  {
    id: 'export-pdf',
    label: 'Export Circuit as PDF',
    run: () => {
      window.dispatchEvent(new CustomEvent('omnispice:export-pdf'));
    },
  },
  {
    id: 'toggle-shortcut-help',
    label: 'Show Keyboard Reference',
    shortcut: '?',
    run: () => {
      window.dispatchEvent(new CustomEvent('omnispice:toggle-shortcut-help'));
    },
  },
];

/** Dispatch registry — looks up an action by id and runs it. */
export function runAction(id: string): void {
  const action = ACTIONS.find((a) => a.id === id);
  if (!action) {
    console.warn(`[commandPalette] unknown action id: ${id}`);
    return;
  }
  void action.run();
}
