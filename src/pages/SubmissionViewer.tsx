import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/auth/useCurrentUser';
import type { Circuit } from '@/circuit/types';
import { loadSubmissionCircuit } from '@/cloud/classroomApi';
import { useSubmission } from '@/cloud/classroomHooks';
import { deserializeCircuit } from '@/cloud/serialization';
import { GradingPanel } from '@/components/submissions/GradingPanel';
import { ReadOnlyCircuitCanvas } from '@/components/submissions/ReadOnlyCircuitCanvas';

interface Props {
  submissionId: string;
}

export function SubmissionViewer({ submissionId }: Props) {
  const { getToken, isSignedIn, isLoaded } = useCurrentUser();
  const submissionQ = useSubmission(submissionId);
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !submissionQ.data) return;
    (async () => {
      try {
        const json = await loadSubmissionCircuit(submissionId, getToken);
        setCircuit(deserializeCircuit(json));
      } catch (err) {
        setLoadError((err as Error).message);
      }
    })();
  }, [isLoaded, isSignedIn, submissionQ.data, submissionId, getToken]);

  if (!isLoaded) return <div style={{ padding: 32 }}>Loading...</div>;
  if (!isSignedIn) return <div style={{ padding: 32 }}>Sign in to view this submission</div>;
  if (submissionQ.isError)
    return <div style={{ padding: 32, color: 'var(--color-error)' }}>Not found or forbidden</div>;
  if (!submissionQ.data) return <div style={{ padding: 32 }}>Loading submission...</div>;

  const submission = submissionQ.data;
  const assignmentId = submission.assignment_id;

  return (
    <div
      style={{ display: 'flex', width: '100vw', height: '100vh', background: 'var(--bg-primary)' }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            padding: '12px 20px',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <a
              href={`/assignments/${assignmentId}`}
              style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none' }}
            >
              ← Assignment
            </a>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 2 }}>
              Submission by{' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>{submission.student_id}</span>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {loadError ? (
            <div style={{ padding: 24, color: 'var(--color-error)' }}>
              Failed to load circuit: {loadError}
            </div>
          ) : circuit ? (
            <ReadOnlyCircuitCanvas circuit={circuit} />
          ) : (
            <div style={{ padding: 24 }}>Loading circuit...</div>
          )}
        </div>
      </div>
      <GradingPanel
        submission={submission}
        assignmentId={assignmentId}
        isInstructor={submission.isInstructor === true}
      />
    </div>
  );
}
