import { describe, it, expect, beforeEach } from 'vitest';
import { useSimulationStore } from '../simulationStore';

function resetStore() {
  useSimulationStore.getState().reset();
}

describe('simulationStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('setStatus', () => {
    it('changes simulation status', () => {
      const statuses = ['idle', 'loading_engine', 'running', 'complete', 'error', 'cancelled'] as const;
      for (const status of statuses) {
        useSimulationStore.getState().setStatus(status);
        expect(useSimulationStore.getState().status).toBe(status);
      }
    });
  });

  describe('setResults', () => {
    it('stores VectorData array', () => {
      const vectors = [
        { name: 'time', data: new Float64Array([0, 1, 2]), unit: 's', isComplex: false },
        { name: 'v(out)', data: new Float64Array([0, 2.5, 5]), unit: 'V', isComplex: false },
      ];
      useSimulationStore.getState().setResults(vectors);
      const results = useSimulationStore.getState().results;
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('time');
      expect(results[1].data[2]).toBe(5);
    });
  });

  describe('setErrors', () => {
    it('stores TranslatedError array', () => {
      const errors = [
        {
          message: 'Node "out" has a problem.',
          suggestion: 'Check for floating nodes.',
          componentRef: 'R1',
          severity: 'error' as const,
          raw: 'singular matrix at node out',
        },
      ];
      useSimulationStore.getState().setErrors(errors);
      expect(useSimulationStore.getState().errors).toHaveLength(1);
      expect(useSimulationStore.getState().errors[0].componentRef).toBe('R1');
    });
  });

  describe('setValidationErrors', () => {
    it('stores ValidationError array', () => {
      const validationErrors = [
        {
          type: 'no_ground' as const,
          message: 'No ground connection',
          suggestion: 'Add a ground symbol.',
          componentIds: [],
          severity: 'error' as const,
        },
      ];
      useSimulationStore.getState().setValidationErrors(validationErrors);
      expect(useSimulationStore.getState().validationErrors).toHaveLength(1);
      expect(useSimulationStore.getState().validationErrors[0].type).toBe('no_ground');
    });
  });

  describe('setAnalysisConfig', () => {
    it('updates analysis configuration', () => {
      useSimulationStore.getState().setAnalysisConfig({
        type: 'ac',
        startFreq: '1',
        stopFreq: '1Meg',
        pointsPerDecade: 100,
      });
      const config = useSimulationStore.getState().analysisConfig;
      expect(config.type).toBe('ac');
      expect(config.startFreq).toBe('1');
    });
  });

  describe('reset', () => {
    it('clears results and errors', () => {
      useSimulationStore.getState().setStatus('complete');
      useSimulationStore.getState().setResults([
        { name: 'time', data: new Float64Array([0, 1]), unit: 's', isComplex: false },
      ]);
      useSimulationStore.getState().setErrors([
        {
          message: 'err',
          suggestion: 'fix',
          severity: 'error' as const,
          raw: 'raw',
        },
      ]);

      useSimulationStore.getState().reset();
      expect(useSimulationStore.getState().status).toBe('idle');
      expect(useSimulationStore.getState().results).toHaveLength(0);
      expect(useSimulationStore.getState().errors).toHaveLength(0);
    });
  });
});
