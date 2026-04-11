import '@testing-library/jest-dom/vitest';

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

// jsdom does not implement Element.prototype.scrollIntoView; cmdk calls it
// when the active command item changes. No-op is correct for tests.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
