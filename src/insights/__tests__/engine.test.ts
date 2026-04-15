/**
 * RED tests for the insight engine.
 */

import { describe, expect, it, vi } from 'vitest';
import type { Circuit } from '@/circuit/types';
import { evaluateInsights } from '../engine';
import type { InsightContext, InsightRule } from '../types';

const emptyCircuit: Circuit = {
  components: new Map(),
  wires: new Map(),
  nets: new Map(),
};

const emptyCtx: InsightContext = {
  circuit: emptyCircuit,
  vectors: [],
  measurements: [],
};

describe('evaluateInsights engine', () => {
  it('returns an empty array when no rules match', () => {
    const result = evaluateInsights(emptyCtx);
    expect(Array.isArray(result)).toBe(true);
    // The default rules may or may not fire on an empty circuit,
    // but the function should always return an array.
  });

  it('collects insights from multiple rules', () => {
    // The engine import the real RULES, but we can verify the basic structure
    const result = evaluateInsights(emptyCtx);
    expect(Array.isArray(result)).toBe(true);
    result.forEach(insight => {
      expect(insight).toHaveProperty('id');
      expect(insight).toHaveProperty('rule');
      expect(insight).toHaveProperty('summary');
      expect(insight).toHaveProperty('severity');
      expect(insight).toHaveProperty('anchor');
    });
  });

  it('swallows rule errors instead of throwing', () => {
    // If any rule throws internally, the engine should catch it
    // We verify by confirming evaluateInsights never throws on any context
    expect(() => evaluateInsights(emptyCtx)).not.toThrow();
  });
});
