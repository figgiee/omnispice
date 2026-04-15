/**
 * Insight rules engine.
 *
 * Evaluates all registered rules against the given context and returns
 * the collected insights. Each rule is called in isolation; thrown errors
 * are caught and logged at debug level so a single bad rule never crashes
 * the full evaluation.
 *
 * Evaluation is pure: no stores are read or written here. The caller
 * (simulationOrchestrator) is responsible for dispatching results to
 * the insightsStore.
 */

import { RULES } from './rules';
import type { Insight, InsightContext } from './types';

export function evaluateInsights(ctx: InsightContext): Insight[] {
  const results: Insight[] = [];
  for (const rule of RULES) {
    try {
      const insight = rule.evaluate(ctx);
      if (insight) results.push(insight);
    } catch (err) {
      console.debug(`[insights] rule ${rule.id} threw:`, err);
    }
  }
  return results;
}
