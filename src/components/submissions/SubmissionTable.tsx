import { useMemo, useState } from 'react';
import { useSubmissions, useAssignment } from '@/cloud/classroomHooks';
import type { SubmissionListRow } from '@/cloud/classroomTypes';

type Filter = 'all' | 'ungraded' | 'graded' | 'late' | 'not_submitted';
type SortKey = 'student' | 'submitted' | 'grade';

interface Props {
  assignmentId: string;
}

export function SubmissionTable({ assignmentId }: Props) {
  const submissionsQ = useSubmissions(assignmentId);
  const assignmentQ = useAssignment(assignmentId);
  const [filter, setFilter] = useState<Filter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('submitted');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const dueAt = assignmentQ.data?.assignment.due_at ?? null;
  const rows = submissionsQ.data ?? [];

  const filtered = useMemo(() => {
    const result = rows.filter((r) => {
      const submitted = r.submission_id !== null;
      const late = submitted && dueAt && r.submitted_at && r.submitted_at > dueAt;
      if (filter === 'ungraded') return submitted && r.grade === null;
      if (filter === 'graded') return submitted && r.grade !== null;
      if (filter === 'late') return !!late;
      if (filter === 'not_submitted') return !submitted;
      return true;
    });
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'student') cmp = a.student_id.localeCompare(b.student_id);
      if (sortKey === 'submitted') cmp = (a.submitted_at ?? 0) - (b.submitted_at ?? 0);
      if (sortKey === 'grade') cmp = (a.grade ?? -1) - (b.grade ?? -1);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [rows, filter, sortKey, sortDir, dueAt]);

  function onSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function renderStatus(r: SubmissionListRow): React.ReactNode {
    if (r.submission_id === null) {
      return <span style={{ color: 'var(--text-secondary)' }}>Not submitted</span>;
    }
    const late = dueAt && r.submitted_at && r.submitted_at > dueAt;
    return (
      <>
        {r.grade !== null ? 'Graded' : 'Submitted'}
        {late && (
          <span
            style={{
              background: 'var(--color-error)',
              color: 'white',
              borderRadius: 4,
              padding: '1px 6px',
              fontSize: 10,
              marginLeft: 6,
            }}
          >
            LATE
          </span>
        )}
      </>
    );
  }

  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: `All (${rows.length})` },
    { key: 'ungraded', label: 'Ungraded' },
    { key: 'graded', label: 'Graded' },
    { key: 'late', label: 'Late' },
    { key: 'not_submitted', label: 'Not submitted' },
  ];

  return (
    <div data-testid="submission-table">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            style={{
              background: filter === c.key ? 'var(--accent-primary)' : 'var(--surface-primary)',
              color: filter === c.key ? 'var(--bg-primary)' : 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 999,
              padding: '4px 12px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {submissionsQ.isLoading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Loading submissions...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', padding: 24, textAlign: 'center' }}>
          No submissions match the current filter.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-default)' }}>
              <th
                onClick={() => onSort('student')}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Student {sortKey === 'student' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th
                onClick={() => onSort('submitted')}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Submitted At {sortKey === 'submitted' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                }}
              >
                Status
              </th>
              <th
                onClick={() => onSort('grade')}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Grade {sortKey === 'grade' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.student_id}
                style={{ borderBottom: '1px solid var(--border-default)' }}
                data-testid={`submission-row-${r.student_id}`}
              >
                <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {r.student_id}
                </td>
                <td style={{ padding: '8px 12px', fontSize: 13 }}>
                  {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}
                </td>
                <td style={{ padding: '8px 12px', fontSize: 13 }}>{renderStatus(r)}</td>
                <td style={{ padding: '8px 12px', fontSize: 14, fontWeight: 600 }}>
                  {r.grade !== null ? `${r.grade}/100` : '—'}
                </td>
                <td style={{ padding: '8px 12px', fontSize: 13 }}>
                  {r.submission_id && (
                    <a
                      href={`/submissions/${r.submission_id}`}
                      style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
                    >
                      Open →
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
