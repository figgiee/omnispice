import { useEffect, useState } from 'react';
import { Layout } from '@/app/Layout';
import { useCurrentUser } from '@/auth/useCurrentUser';
import { loadStarterCircuit } from '@/cloud/classroomApi';
import { useAssignment } from '@/cloud/classroomHooks';
import { deserializeCircuit } from '@/cloud/serialization';
import styles from '@/components/classroom/Dashboard.module.css';
import { SubmissionTable } from '@/components/submissions/SubmissionTable';
import { useCircuitStore } from '@/store/circuitStore';
import { useClassroomStore } from '@/store/classroomStore';

interface Props {
  assignmentId: string;
}

export function AssignmentPage({ assignmentId }: Props) {
  const { getToken, isLoaded, isSignedIn } = useCurrentUser();
  const assignmentQ = useAssignment(assignmentId);
  const enterStudentMode = useClassroomStore((s) => s.enterStudentMode);
  const exitClassroomMode = useClassroomStore((s) => s.exitClassroomMode);
  const [starterLoaded, setStarterLoaded] = useState(false);
  const [starterError, setStarterError] = useState<string | null>(null);

  // Student path: load starter circuit into the editor once on mount (D-17).
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !assignmentQ.data || starterLoaded) return;
    if (assignmentQ.data.isInstructor) return; // instructor path does not load starter

    (async () => {
      try {
        const json = await loadStarterCircuit(assignmentId, getToken);
        const circuit = deserializeCircuit(json);
        useCircuitStore.setState({ circuit, refCounters: {} });
        enterStudentMode(assignmentId);
        setStarterLoaded(true);
      } catch (err) {
        setStarterError((err as Error).message);
      }
    })();
    return () => {
      // When the AssignmentPage unmounts (navigation away), clear classroom mode.
      exitClassroomMode();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getToken, enterStudentMode, exitClassroomMode are stable from hooks
  }, [isLoaded, isSignedIn, assignmentQ.data, assignmentId, starterLoaded]);

  if (!isLoaded) return <div className={styles.container}>Loading...</div>;
  if (!isSignedIn) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Sign in to open this assignment</h1>
      </div>
    );
  }
  if (assignmentQ.isLoading) return <div className={styles.container}>Loading assignment...</div>;
  if (assignmentQ.isError || !assignmentQ.data) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Assignment not found</h1>
        <a href="/dashboard">← Back to dashboard</a>
      </div>
    );
  }

  const { assignment, isInstructor } = assignmentQ.data;

  // Instructor branch (submission table lives in Plan 07)
  if (isInstructor) {
    return (
      <div className={styles.container}>
        <div style={{ marginBottom: 16 }}>
          <a
            href={`/courses/${assignment.course_id}`}
            style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none' }}
          >
            ← Course
          </a>
        </div>
        <h1 className={styles.title}>{assignment.title}</h1>
        {assignment.due_at && (
          <p className={styles.subtitle}>Due {new Date(assignment.due_at).toLocaleString()}</p>
        )}
        {assignment.instructions && (
          <details style={{ marginTop: 16, marginBottom: 24 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>
              Instructions
            </summary>
            <div
              style={{
                marginTop: 12,
                padding: 16,
                background: 'var(--bg-elevated)',
                borderRadius: 6,
              }}
            >
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                {assignment.instructions}
              </pre>
            </div>
          </details>
        )}
        <SubmissionTable assignmentId={assignmentId} />
      </div>
    );
  }

  // Student branch — render the full Layout (editor) with the classroom mode bar
  // injected via Layout's classroom-mode hook (see Step 4).
  if (starterError) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Could not load starter</h1>
        <p style={{ color: 'var(--color-error)' }}>{starterError}</p>
      </div>
    );
  }
  if (!starterLoaded) {
    return <div className={styles.container}>Loading starter circuit...</div>;
  }

  return <Layout />;
}
