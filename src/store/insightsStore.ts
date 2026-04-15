/**
 * Zustand store for circuit insights.
 *
 * Receives computed Insight[] from the simulationOrchestrator after each
 * successful simulation run. Dismissal is session-only — not persisted to
 * IndexedDB — so refreshing the page restores all insights.
 */

import { create } from 'zustand';
import type { Insight } from '@/insights/types';

interface InsightsState {
  insights: Insight[];
  dismissedIds: Set<string>;
  setInsights: (insights: Insight[]) => void;
  dismiss: (id: string) => void;
  clearDismissed: () => void;
}

export const useInsightsStore = create<InsightsState>((set) => ({
  insights: [],
  dismissedIds: new Set(),
  setInsights: (insights) => set({ insights }),
  dismiss: (id) =>
    set((s) => ({ dismissedIds: new Set([...s.dismissedIds, id]) })),
  clearDismissed: () => set({ dismissedIds: new Set() }),
}));
