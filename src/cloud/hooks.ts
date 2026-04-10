import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/auth/useCurrentUser';
import { useCircuitStore } from '@/store/circuitStore';
import { serializeCircuit, deserializeCircuit } from './serialization';
import { saveCircuit, listCircuits, loadCircuit, shareCircuit } from './api';
import type { SaveCircuitInput } from './types';

/** List all circuits for the current user */
export function useCircuits() {
  const { getToken, isSignedIn } = useCurrentUser();
  return useQuery({
    queryKey: ['circuits'],
    queryFn: () => listCircuits(getToken),
    enabled: isSignedIn,
    staleTime: 30_000,
  });
}

/** Save the current editor circuit to the cloud */
export function useSaveCircuit() {
  const { getToken } = useCurrentUser();
  const queryClient = useQueryClient();
  const circuit = useCircuitStore((s) => s.circuit);

  return useMutation({
    mutationFn: async (input: { id?: string; name: string }) => {
      const serialized = serializeCircuit(circuit);
      const payload: SaveCircuitInput = {
        id: input.id,
        name: input.name,
        circuit: serialized,
      };
      return saveCircuit(payload, getToken);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['circuits'] });
    },
  });
}

/** Load a circuit from the cloud into the editor */
export function useLoadCircuit() {
  const { getToken } = useCurrentUser();

  return useMutation({
    mutationFn: async (id: string) => {
      const json = await loadCircuit(id, getToken);
      const loadedCircuit = deserializeCircuit(json);
      useCircuitStore.setState({ circuit: loadedCircuit, refCounters: {} });
    },
  });
}

/** Generate a share link for a circuit */
export function useShareCircuit() {
  const { getToken } = useCurrentUser();
  return useMutation({
    mutationFn: (id: string) => shareCircuit(id, getToken),
  });
}
