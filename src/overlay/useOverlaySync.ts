import { useEffect } from 'react';
import { buildPortToNetMap, computeNets } from '@/circuit/graph';
import { useCircuitStore } from '@/store/circuitStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useOverlayStore } from './overlayStore';

/**
 * Watches simulationStore.results and populates overlayStore with DC op voltages/currents.
 * Only processes DC operating point results (single-element Float64Array vectors).
 * Transient and AC results are ignored — too many points to meaningfully overlay.
 *
 * Also computes edgeVoltages: maps each wire ID to the voltage of its net, so
 * WireEdge components can display node voltages on the schematic wires.
 *
 * Mount once at the app root level (e.g., in App.tsx or a layout component).
 */
export function useOverlaySync(): void {
  const results = useSimulationStore((s) => s.results);
  const setOverlay = useOverlayStore((s) => s.setOverlay);
  const clear = useOverlayStore((s) => s.clear);

  useEffect(() => {
    if (!results.length) {
      clear();
      return;
    }

    const voltages: Record<string, number> = {};
    const currents: Record<string, number> = {};
    let hasDcOp = false;

    for (const vec of results) {
      // DC op: single-element arrays only
      if (vec.data.length !== 1) continue;

      const name = vec.name.toLowerCase();
      if (name.startsWith('v(') && name.endsWith(')')) {
        const netName = name.slice(2, -1);
        voltages[netName] = vec.data[0]!;
        hasDcOp = true;
      } else if (name.startsWith('i(') && name.endsWith(')')) {
        const ref = name.slice(2, -1).toUpperCase();
        currents[ref] = vec.data[0]!;
        hasDcOp = true;
      }
    }

    if (hasDcOp) {
      // Map each wire to its net's voltage so WireEdge can display it
      const circuit = useCircuitStore.getState().circuit;
      const nets = computeNets(circuit.components, circuit.wires);
      const portToNet = buildPortToNetMap(nets);

      const edgeVoltages: Record<string, number> = {};
      for (const [wireId, wire] of circuit.wires) {
        const netName = portToNet.get(wire.sourcePortId);
        if (netName !== undefined && voltages[netName] !== undefined) {
          edgeVoltages[wireId] = voltages[netName] ?? 0;
        }
      }

      setOverlay(voltages, currents, edgeVoltages);
    } else {
      clear();
    }
  }, [results, setOverlay, clear]);
}
