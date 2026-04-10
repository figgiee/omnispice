import type { Circuit, Component, Wire, Net } from '@/circuit/types';

interface SerializedCircuit {
  components: [string, Component][];
  wires: [string, Wire][];
  nets: [string, Net][];
}

/**
 * Serialize a Circuit for JSON storage (R2).
 * Converts Map fields to [key, value][] arrays (JSON.stringify-safe).
 * JSON.stringify(new Map()) produces {}, so Maps must be converted first.
 */
export function serializeCircuit(circuit: Circuit): string {
  const payload: SerializedCircuit = {
    components: Array.from(circuit.components.entries()),
    wires: Array.from(circuit.wires.entries()),
    nets: Array.from(circuit.nets.entries()),
  };
  return JSON.stringify(payload);
}

/**
 * Deserialize a Circuit from JSON (R2 → store).
 * Converts [key, value][] arrays back to Map fields.
 */
export function deserializeCircuit(json: string): Circuit {
  const payload = JSON.parse(json) as SerializedCircuit;
  return {
    components: new Map(payload.components ?? []),
    wires: new Map(payload.wires ?? []),
    nets: new Map(payload.nets ?? []),
  };
}
