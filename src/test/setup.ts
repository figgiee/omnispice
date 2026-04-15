import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom ships no ResizeObserver; Radix Dialog (used by cmdk's Command.Dialog)
// requires it for its scroll lock. Provide a no-op stub for tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}

// jsdom does not implement `window.matchMedia`. uPlot calls it at
// module-init time (`setPxRatio → window.matchMedia('(min-resolution…)')`),
// which crashes any test suite that transitively imports a uPlot-using
// component (WaveformViewer → SweepFanOut → uplot). A no-op stub with
// a matchMedia-shaped return value is enough for uPlot's feature-detect.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  type MediaQueryListShape = {
    matches: boolean;
    media: string;
    onchange: null;
    addListener: () => void;
    removeListener: () => void;
    addEventListener: () => void;
    removeEventListener: () => void;
    dispatchEvent: () => boolean;
  };
  (window as unknown as { matchMedia: (query: string) => MediaQueryListShape }).matchMedia = (
    query: string,
  ) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
}

// jsdom does not implement Element.prototype.scrollIntoView; cmdk calls it
// when the active command item changes. No-op is correct for tests.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

/**
 * Global idb-keyval stub for jsdom-based tests.
 *
 * jsdom ships with no IndexedDB, so any test that ends up touching
 * `src/store/circuitStore.ts` (which now wraps the store in
 * `persist(..., { storage: idb-keyval })`) would blow up with
 * "ReferenceError: indexedDB is not defined" during setState calls.
 *
 * Tests that need deeper introspection can still do
 *   vi.mock('idb-keyval', () => ({ ... }))
 * at the top of their own file — that overrides this global stub.
 */
const __idbMemory = new Map<string, string>();
vi.mock('idb-keyval', () => ({
  get: async (k: string) => __idbMemory.get(k),
  set: async (k: string, v: string) => {
    __idbMemory.set(k, v);
  },
  del: async (k: string) => {
    __idbMemory.delete(k);
  },
  clear: async () => {
    __idbMemory.clear();
  },
}));
