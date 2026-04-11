/**
 * JSON replacer/reviver that losslessly round-trips native Map and Set
 * instances. `JSON.stringify` drops both by default, which corrupts the
 * circuit store state on persist → rehydrate (circuits use Maps for
 * components, wires, and nets per Plan 05-10).
 *
 * Encoding:
 *   Map → { __type: '__$map$__', entries: [...] }
 *   Set → { __type: '__$set$__', values: [...] }
 *
 * Anything that does NOT carry one of those sentinel tags passes through
 * untouched, so consumers with their own `__type` fields are unaffected.
 */

const MAP_TYPE = '__$map$__';
const SET_TYPE = '__$set$__';

interface MapSentinel {
  __type: typeof MAP_TYPE;
  entries: unknown[];
}

interface SetSentinel {
  __type: typeof SET_TYPE;
  values: unknown[];
}

function isMapSentinel(value: unknown): value is MapSentinel {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { __type?: unknown }).__type === MAP_TYPE &&
    Array.isArray((value as { entries?: unknown }).entries)
  );
}

function isSetSentinel(value: unknown): value is SetSentinel {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { __type?: unknown }).__type === SET_TYPE &&
    Array.isArray((value as { values?: unknown }).values)
  );
}

/**
 * `JSON.stringify` replacer that encodes Maps and Sets as tagged objects.
 * Use in tandem with `mapReviver` to round-trip state that uses either.
 */
export function mapReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return {
      __type: MAP_TYPE,
      entries: Array.from(value.entries()),
    };
  }
  if (value instanceof Set) {
    return {
      __type: SET_TYPE,
      values: Array.from(value.values()),
    };
  }
  return value;
}

/**
 * `JSON.parse` reviver that decodes tagged objects produced by
 * `mapReplacer` back into Map / Set instances.
 */
export function mapReviver(_key: string, value: unknown): unknown {
  if (isMapSentinel(value)) {
    return new Map(value.entries as [unknown, unknown][]);
  }
  if (isSetSentinel(value)) {
    return new Set(value.values);
  }
  return value;
}

/**
 * Drop-in convenience wrapper with the same shape as the global `JSON`
 * object. Passed to `zustand/middleware` `createJSONStorage` so the persist
 * middleware uses Map/Set-aware serialization automatically.
 */
export const mapAwareJSON = {
  parse: (text: string): unknown => JSON.parse(text, mapReviver),
  stringify: (value: unknown): string => JSON.stringify(value, mapReplacer),
};
