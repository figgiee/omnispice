/** Metadata row returned by GET /api/circuits */
export interface CircuitMeta {
  id: string;
  name: string;
  share_token: string | null;
  created_at: number;
  updated_at: number;
}

/** Request body for POST /api/circuits */
export interface SaveCircuitInput {
  id?: string;
  name: string;
  circuit: string; // serializeCircuit() output
}

/** Response from POST /api/circuits */
export interface SaveCircuitResponse {
  id: string;
}

/** Response from POST /api/circuits/:id/share */
export interface ShareResponse {
  shareUrl: string;
  token: string;
}
