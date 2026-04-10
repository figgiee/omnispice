import { useEffect, useState } from 'react';
import { useSaveGrade } from '@/cloud/classroomHooks';
import type { Submission } from '@/cloud/classroomTypes';

interface Props {
  submission: Submission;
  assignmentId: string;
  isInstructor: boolean;
}

export function GradingPanel({ submission, isInstructor }: Props) {
  const [grade, setGrade] = useState<string>(submission.grade?.toString() ?? '');
  const [feedback, setFeedback] = useState<string>(submission.feedback ?? '');
  const [saveToast, setSaveToast] = useState(false);
  const saveGradeMutation = useSaveGrade();

  useEffect(() => {
    setGrade(submission.grade?.toString() ?? '');
    setFeedback(submission.feedback ?? '');
  }, [submission.grade, submission.feedback]);

  async function handleSave() {
    const parsed = grade === '' ? null : Number.parseInt(grade, 10);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0 || parsed > 100)) {
      alert('Grade must be an integer between 0 and 100');
      return;
    }
    if (feedback.length > 2000) {
      alert('Feedback cannot exceed 2000 characters');
      return;
    }
    await saveGradeMutation.mutateAsync({
      submissionId: submission.id,
      input: { grade: parsed, feedback },
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  }

  return (
    <div
      style={{
        width: 360,
        background: 'var(--bg-elevated)',
        borderLeft: '1px solid var(--border-default)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        overflowY: 'auto',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18 }}>Grading</h2>

      <div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Submitted</div>
        <div style={{ fontSize: 14 }}>{new Date(submission.submitted_at).toLocaleString()}</div>
      </div>

      {!isInstructor ? (
        <>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Grade</div>
            <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--accent-primary)' }}>
              {submission.grade !== null ? `${submission.grade}/100` : 'Not graded'}
            </div>
          </div>
          {submission.feedback && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Feedback</div>
              <div
                style={{
                  fontSize: 14,
                  background: 'var(--surface-primary)',
                  padding: 12,
                  borderRadius: 4,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {submission.feedback}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginBottom: 4,
              }}
            >
              Grade (0–100)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 4,
                padding: '8px 12px',
                fontSize: 16,
                boxSizing: 'border-box',
              }}
              data-testid="grade-input"
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginBottom: 4,
              }}
            >
              Feedback ({feedback.length}/2000)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={10}
              maxLength={2000}
              style={{
                width: '100%',
                background: 'var(--surface-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 4,
                padding: 12,
                fontSize: 13,
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
              data-testid="feedback-input"
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveGradeMutation.isPending}
            style={{
              background: 'var(--accent-primary)',
              color: 'var(--bg-primary)',
              border: 'none',
              borderRadius: 6,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            data-testid="save-grade"
          >
            {saveGradeMutation.isPending ? 'Saving...' : saveToast ? '✓ Saved' : 'Save Grade'}
          </button>
          {submission.graded_at && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Last graded: {new Date(submission.graded_at).toLocaleString()}
            </div>
          )}
          {saveGradeMutation.isError && (
            <div role="alert" style={{ color: 'var(--color-error)', fontSize: 13 }}>
              {saveGradeMutation.error?.message}
            </div>
          )}
        </>
      )}
    </div>
  );
}
