import { useState } from 'react';
import { useSubmitAssignment } from '@/cloud/classroomHooks';
import { useCircuitStore } from '@/store/circuitStore';
import { serializeCircuit } from '@/cloud/serialization';

interface Props {
  assignmentId: string;
}

export function SubmitAssignmentButton({ assignmentId }: Props) {
  const submit = useSubmitAssignment();
  const circuit = useCircuitStore((s) => s.circuit);
  const [toast, setToast] = useState<string | null>(null);

  async function handleSubmit() {
    const circuitJson = serializeCircuit(circuit);
    const result = await submit.mutateAsync({
      assignmentId,
      circuitJson,
    });
    setToast(`Submitted at ${new Date(result.submittedAt).toLocaleTimeString()}`);
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submit.isPending}
        style={{
          background: 'var(--accent-primary)',
          color: 'var(--bg-primary)',
          border: 'none',
          borderRadius: 6,
          padding: '8px 20px',
          fontSize: 14,
          fontWeight: 600,
          cursor: submit.isPending ? 'not-allowed' : 'pointer',
        }}
        data-testid="submit-assignment"
      >
        {submit.isPending ? 'Submitting...' : 'Submit Assignment'}
      </button>
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--accent-primary)',
            borderRadius: 6,
            padding: '12px 20px',
            color: 'var(--text-primary)',
            zIndex: 2000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          ✓ {toast}
        </div>
      )}
      {submit.isError && (
        <div role="alert" style={{ color: 'var(--color-error)', fontSize: 13 }}>
          Submit failed: {submit.error?.message}
        </div>
      )}
    </>
  );
}
