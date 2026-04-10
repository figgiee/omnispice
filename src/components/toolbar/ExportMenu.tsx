import { useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCircuitStore } from '@/store/circuitStore';
import { useSimulationStore } from '@/store/simulationStore';
import { generateNetlist } from '@/circuit/netlister';
import { exportSchematicAsPng } from '@/export/exportPng';
import { exportWaveformAsCsv } from '@/export/exportCsv';
import { exportNetlist } from '@/export/exportNetlist';

/**
 * Toolbar dropdown for one-click schematic/waveform/netlist export.
 * PNG: captures the React Flow canvas via html-to-image 1.11.13.
 * CSV: dumps all simulation vectors (disabled when no results).
 * Netlist: generates .cir from the current circuit (disabled when circuit empty).
 */
export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const { getNodes } = useReactFlow();
  const circuit = useCircuitStore((s) => s.circuit);
  const results = useSimulationStore((s) => s.results);
  const analysisConfig = useSimulationStore((s) => s.analysisConfig);

  const hasResults = results.length > 0;
  const hasCircuit = circuit.components.size > 0;

  const handlePng = async () => {
    setOpen(false);
    await exportSchematicAsPng(getNodes());
  };

  const handleCsv = () => {
    setOpen(false);
    exportWaveformAsCsv(results);
  };

  const handleNetlist = () => {
    setOpen(false);
    const netlistStr = generateNetlist(circuit, analysisConfig);
    exportNetlist(netlistStr);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'none',
          border: '1px solid var(--border-default)',
          borderRadius: 4,
          padding: '4px 10px',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontSize: 'var(--font-size-label)',
          fontFamily: 'var(--font-body)',
        }}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Export
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 4,
              padding: '4px 0',
              minWidth: 180,
              zIndex: 20,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handlePng}
              style={menuItemStyle}
            >
              PNG (schematic)
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleCsv}
              disabled={!hasResults}
              title={hasResults ? undefined : 'Run a simulation first'}
              style={{ ...menuItemStyle, opacity: hasResults ? 1 : 0.4, cursor: hasResults ? 'pointer' : 'not-allowed' }}
            >
              CSV (waveform)
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleNetlist}
              disabled={!hasCircuit}
              title={hasCircuit ? undefined : 'Add components to the schematic first'}
              style={{ ...menuItemStyle, opacity: hasCircuit ? 1 : 0.4, cursor: hasCircuit ? 'pointer' : 'not-allowed' }}
            >
              Netlist (.cir)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '6px 16px',
  background: 'none',
  border: 'none',
  color: 'var(--text-primary)',
  fontSize: 'var(--font-size-label)',
  fontFamily: 'var(--font-body)',
  textAlign: 'left',
  cursor: 'pointer',
};
