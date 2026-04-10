import { vi } from 'vitest';

/**
 * In-memory D1 test double.
 * Tests register expected queries via fixture.setResult(query, result).
 * The prepare().bind().first()/all()/run() chain returns those results in order.
 * This is intentionally minimal — do NOT build a SQL engine. Per-test fixtures only.
 */
export function makeTestD1() {
  const queue: unknown[] = [];
  const prepared = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
    first: vi.fn(async () => queue.shift() ?? null),
    all: vi.fn(async () => ({ results: (queue.shift() as unknown[]) ?? [] })),
  };
  return {
    prepare: vi.fn().mockReturnValue(prepared),
    /** Push a result to the queue — consumed by the next first()/all() call. */
    pushResult(result: unknown) { queue.push(result); },
    /** Reset all queued results and mock call history. */
    reset() {
      queue.length = 0;
      vi.clearAllMocks();
    },
  };
}

/** In-memory R2 test double. */
export function makeTestR2() {
  const store = new Map<string, string>();
  return {
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    get: vi.fn(async (key: string) => {
      const v = store.get(key);
      if (v === undefined) return null;
      return {
        body: new ReadableStream(),
        text: async () => v,
        json: async () => JSON.parse(v),
      };
    }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
    _store: store,
  };
}

/** Standard test bindings factory — matches Bindings type in worker/src/index.ts. */
export function makeTestEnv() {
  return {
    DB: makeTestD1(),
    CIRCUIT_BUCKET: makeTestR2(),
    CLERK_PUBLISHABLE_KEY: 'pk_test',
    CLERK_SECRET_KEY: 'sk_test',
  };
}
