import { useState } from 'react';
import { useClassroomStore } from '@/store/classroomStore';
import { useAssignment, useMySubmission } from '@/cloud/classroomHooks';
import { SubmitAssignmentButton } from '@/components/toolbar/SubmitAssignmentButton';
import { InstructionsDrawer } from '@/components/assignments/InstructionsDrawer';

interface Props {
  assignmentId: string;
}

export function ClassroomModeBar({ assignmentId }: Props) {
  const exitClassroomMode = useClassroomStore((s) => s.exitClassroomMode);
  const assignmentQ = useAssignment(assignmentId);
  const mySubmissionQ = useMySubmission(assignmentId);
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!assignmentQ.data) return null;
  const { assignment } = assignmentQ.data;
  const submission = mySubmissionQ.data;
  const isLate = assignment.due_at && submission?.submitted_at && submission.submitted_at > assignment.due_at;

  function handleExit() {
    exitClassroomMode();
    window.location.assign('/dashboard');
  }

  return (
    <>
      <div
        data-testid="classroom-mode-bar"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 400,
          background: 'var(--bg-elevated)',
          borderBottom: '2px solid var(--accent-primary)',
          padding: '12px 20px',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Classroom Mode — Student</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            {assignment.title}
          </div>
          {assignment.due_at && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Due {new Date(assignment.due_at).toLocaleString()}
            </div>
          )}
          {submission && submission.grade !== null && (
            <div style={{ fontSize: 13, color: 'var(--accent-primary)', marginTop: 4 }}>
              Grade: {submission.grade}/100
              {submission.feedback && <span> · {submission.feedback}</span>}
            </div>
          )}
          {isLate && (
            <span
              style={{
                background: 'var(--color-error)',
                color: 'white',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 11,
                marginLeft: 8,
              }}
            >
              LATE
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            style={{
              background: 'var(--surface-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 4,
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            Instructions
          </button>
          <SubmitAssignmentButton assignmentId={assignmentId} />
          <button
            type="button"
            onClick={handleExit}
            style={{
              background: 'var(--surface-primary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 4,
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            Exit
          </button>
        </div>
      </div>
      <InstructionsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={assignment.title}
        instructions={assignment.instructions}
        dueAt={assignment.due_at}
      />
    </>
  );
}
