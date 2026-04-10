/**
 * Simulation controls component.
 *
 * Manages analysis type selection, parameter configuration, run/cancel buttons.
 * Pre-validates circuit before simulation per the plan's simulation workflow.
 */

import { Play, Settings, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { generateNetlist } from '@/circuit/netlister';
import type { AnalysisType } from '@/circuit/types';
import { validateCircuit } from '@/circuit/validator';
import type { SimulationController } from '@/simulation/controller';
import { useCircuitStore } from '@/store/circuitStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useUiStore } from '@/store/uiStore';
import { AnalysisParamsPopover } from './AnalysisParamsPopover';
import styles from './SimulationControls.module.css';

interface SimulationControlsProps {
  controller: SimulationController | null;
}

const ANALYSIS_OPTIONS: { value: AnalysisType; label: string }[] = [
  { value: 'dc_op', label: 'DC Operating Point' },
  { value: 'transient', label: 'Transient Analysis' },
  { value: 'ac', label: 'AC Analysis (Bode)' },
  { value: 'dc_sweep', label: 'DC Sweep' },
];

export function SimulationControls({ controller }: SimulationControlsProps) {
  const [showParams, setShowParams] = useState(false);
  const paramsRef = useRef<HTMLDivElement>(null);

  const status = useSimulationStore((s) => s.status);
  const elapsedTime = useSimulationStore((s) => s.elapsedTime);
  const analysisConfig = useSimulationStore((s) => s.analysisConfig);
  const setAnalysisConfig = useSimulationStore((s) => s.setAnalysisConfig);
  const setStatus = useSimulationStore((s) => s.setStatus);
  const setErrors = useSimulationStore((s) => s.setErrors);
  const setValidationErrors = useSimulationStore((s) => s.setValidationErrors);
  const setResults = useSimulationStore((s) => s.setResults);
  const setElapsedTime = useSimulationStore((s) => s.setElapsedTime);

  const setBottomTab = useUiStore((s) => s.setBottomTab);
  const circuit = useCircuitStore((s) => s.circuit);

  const isRunning = status === 'running';
  const isLoading = status === 'loading_engine';
  const isBusy = isRunning || isLoading;

  // Close params popover when clicking outside
  useEffect(() => {
    if (!showParams) return;
    const handler = (e: MouseEvent) => {
      if (paramsRef.current && !paramsRef.current.contains(e.target as Node)) {
        setShowParams(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showParams]);

  const handleAnalysisChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setAnalysisConfig({
        ...analysisConfig,
        type: e.target.value as AnalysisType,
      });
    },
    [analysisConfig, setAnalysisConfig],
  );

  const handleRun = useCallback(async () => {
    if (!controller || isBusy) return;

    // Step 1: Pre-simulation validation
    const validationErrors = validateCircuit(circuit);
    const hasErrors = validationErrors.some((e) => e.severity === 'error');

    if (hasErrors || validationErrors.length > 0) {
      setValidationErrors(validationErrors);
      if (hasErrors) {
        setBottomTab('errors');
        return;
      }
    } else {
      setValidationErrors([]);
    }

    // Step 2: Generate netlist
    let netlist: string;
    try {
      netlist = generateNetlist(circuit, analysisConfig);
    } catch (err) {
      setErrors([
        {
          message: `Failed to generate netlist: ${err instanceof Error ? err.message : String(err)}`,
          suggestion: 'Check your circuit components and connections.',
          severity: 'error',
          raw: String(err),
        },
      ]);
      setBottomTab('errors');
      return;
    }

    // Step 3: Run simulation
    setStatus('running');
    setElapsedTime(0);
    setErrors([]);

    try {
      await controller.runSimulation(netlist, analysisConfig.type);
    } catch {
      // Errors handled by the controller's onError callback in Layout
    }
  }, [
    controller,
    isBusy,
    circuit,
    analysisConfig,
    setValidationErrors,
    setErrors,
    setStatus,
    setElapsedTime,
    setBottomTab,
  ]);

  const handleCancel = useCallback(() => {
    if (!controller || !isRunning) return;
    controller.cancelSimulation();
    setStatus('cancelled');
  }, [controller, isRunning, setStatus]);

  // Listen for F5 run simulation event from canvas interactions
  useEffect(() => {
    const handler = () => handleRun();
    window.addEventListener('omnispice:run-simulation', handler);
    return () => window.removeEventListener('omnispice:run-simulation', handler);
  }, [handleRun]);

  // Listen for Ctrl+. cancel simulation event
  useEffect(() => {
    const handler = () => handleCancel();
    window.addEventListener('omnispice:cancel-simulation', handler);
    return () => window.removeEventListener('omnispice:cancel-simulation', handler);
  }, [handleCancel]);

  let runLabel = 'Run Simulation';
  if (status === 'loading_engine') runLabel = 'Loading engine...';
  else if (status === 'running') runLabel = `Simulating... ${elapsedTime.toFixed(1)}s`;

  return (
    <div className={styles.controls}>
      {/* Analysis type dropdown */}
      <select
        className={styles.analysisSelect}
        value={analysisConfig.type}
        onChange={handleAnalysisChange}
        disabled={isBusy}
        aria-label="Analysis type"
      >
        {ANALYSIS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Parameters popover toggle */}
      <div className={styles.paramsWrapper} ref={paramsRef}>
        <button
          type="button"
          className={`${styles.paramsBtn} ${showParams ? styles.active : ''}`}
          onClick={() => setShowParams((v) => !v)}
          disabled={isBusy || analysisConfig.type === 'dc_op'}
          title="Configure analysis parameters"
          aria-label="Configure parameters"
        >
          <Settings size={14} />
        </button>
        {showParams && analysisConfig.type !== 'dc_op' && (
          <AnalysisParamsPopover
            config={analysisConfig}
            onChange={setAnalysisConfig}
            onClose={() => setShowParams(false)}
          />
        )}
      </div>

      {/* Run / Cancel buttons */}
      {isRunning ? (
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={handleCancel}
          title="Cancel Simulation (Ctrl+.)"
          aria-label="Cancel simulation"
        >
          <Square size={14} />
          <span>Cancel</span>
        </button>
      ) : null}

      <button
        type="button"
        className={`${styles.runBtn} ${isBusy ? styles.busy : ''}`}
        onClick={handleRun}
        disabled={isBusy}
        title={isBusy ? undefined : 'Run Simulation (F5)'}
        aria-label="Run simulation"
        data-testid="run-simulation-btn"
      >
        {!isBusy && <Play size={14} />}
        {isBusy && <span className={styles.spinner} />}
        <span>{runLabel}</span>
      </button>
    </div>
  );
}
