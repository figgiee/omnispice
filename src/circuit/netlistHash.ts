/**
 * Structural hash of a Circuit — deterministic short string derived from
 * simulation-relevant fields only (type, value, parameters, topology).
 *
 * Layout-only fields (position, rotation) are intentionally excluded so
 * that pure drags don't invalidate the LOAD_CIRCUIT cache in the
 * TieredSimulationController.
 *
 * NOT a cryptographic hash — FNV-1a 64-bit for speed. Collision
 * probability on realistic circuit structures is negligible.
 */

import type { Circuit } from './types';

/** Short deterministic hex string (16 chars). */
export function hashNetlist(circuit: Circuit): string {
  // Stable serialization: sort components/wires by id, sort port arrays,
  // only include simulation-relevant fields.
  const components = Array.from(circuit.components.values())
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => ({
      id: c.id,
      type: c.type,
      refDesignator: c.refDesignator,
      value: c.value,
      spiceModel: c.spiceModel ?? null,
      parameters: c.parameters ? sortKeys(c.parameters) : null,
      ports: c.ports.map((p) => ({ id: p.id, name: p.name })),
    }));

  const wires = Array.from(circuit.wires.values())
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((w) => ({
      id: w.id,
      sourcePortId: w.sourcePortId,
      targetPortId: w.targetPortId,
    }));

  const json = JSON.stringify({ components, wires });
  return fnv1a64(json);
}

/** Return a new object with keys in sorted order (for stable JSON). */
function sortKeys<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    out[k] = obj[k];
  }
  return out;
}

/**
 * FNV-1a 64-bit hash using BigInt. Returns a zero-padded 16-char hex string.
 */
function fnv1a64(str: string): string {
  const FNV_OFFSET = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  const MASK_64 = 0xffffffffffffffffn;

  let h = FNV_OFFSET;
  for (let i = 0; i < str.length; i++) {
    h ^= BigInt(str.charCodeAt(i));
    h = (h * FNV_PRIME) & MASK_64;
  }
  return h.toString(16).padStart(16, '0');
}
