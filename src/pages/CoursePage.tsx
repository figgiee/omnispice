import { useState } from 'react';
import { useCourse, useDeleteCourse } from '@/cloud/classroomHooks';
import { CreateAssignmentModal } from '@/components/assignments/CreateAssignmentModal';
import styles from '@/components/classroom/Dashboard.module.css';
import { DeleteConfirmModal } from '@/components/classroom/DeleteConfirmModal';
import { JoinCodeBanner } from '@/components/classroom/JoinCodeBanner';

interface Props {
  courseId: string;
}

export function CoursePage({ courseId }: Props) {
  const courseQ = useCourse(courseId);
  const deleteCourse = useDeleteCourse();
  const [tab, setTab] = useState<'assignments' | 'students'>('assignments');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  if (courseQ.isLoading) return <div className={styles.container}>Loading course...</div>;
  if (courseQ.isError || !courseQ.data) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Course not found</h1>
        <a href="/dashboard">← Back to dashboard</a>
      </div>
    );
  }

  const { course, assignments, students, isInstructor } = courseQ.data;

  async function handleDelete() {
    await deleteCourse.mutateAsync(courseId);
    window.location.assign('/dashboard');
  }

  return (
    <div className={styles.container}>
      <div style={{ marginBottom: 16 }}>
        <a
          href="/dashboard"
          style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none' }}
        >
          ← My Courses
        </a>
      </div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{course.name}</h1>
          <p className={styles.subtitle}>{course.term ?? 'No term'}</p>
        </div>
        {isInstructor && (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setDeleteOpen(true)}
            style={{ color: 'var(--color-error)' }}
          >
            Delete Course
          </button>
        )}
      </div>

      {isInstructor && <JoinCodeBanner code={course.join_code} />}

      <div className={styles.tabButtons}>
        <button
          type="button"
          className={`${styles.tabButton} ${tab === 'assignments' ? styles.active : ''}`}
          onClick={() => setTab('assignments')}
        >
          Assignments ({assignments.length})
        </button>
        {isInstructor && (
          <button
            type="button"
            className={`${styles.tabButton} ${tab === 'students' ? styles.active : ''}`}
            onClick={() => setTab('students')}
          >
            Students ({students.length})
          </button>
        )}
      </div>

      {tab === 'assignments' && (
        <>
          {isInstructor && (
            <div style={{ marginBottom: 16 }}>
              <button
                type="button"
                className={styles.ctaButton}
                onClick={() => setAssignModalOpen(true)}
                data-testid="new-assignment-button"
              >
                + New Assignment
              </button>
            </div>
          )}
          {assignments.length === 0 ? (
            <div className={styles.empty}>
              <p>No assignments yet.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {assignments.map((a) => (
                <a
                  key={a.id}
                  href={`/assignments/${a.id}`}
                  className={styles.card}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <h3 className={styles.cardName}>{a.title}</h3>
                  <div className={styles.cardMeta}>
                    {a.due_at ? `Due ${new Date(a.due_at).toLocaleString()}` : 'No due date'}
                  </div>
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'students' && isInstructor && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
              <th
                style={{
                  textAlign: 'left',
                  padding: 8,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                }}
              >
                Student
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: 8,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                }}
              >
                Joined
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.student_id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                <td style={{ padding: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {s.student_id}
                </td>
                <td style={{ padding: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {new Date(s.joined_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <DeleteConfirmModal
        isOpen={deleteOpen}
        title="Delete course?"
        confirmName={course.name}
        description={`This will permanently delete the course, all its assignments, and all student submissions. This cannot be undone. Type the course name below to confirm.`}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        isDeleting={deleteCourse.isPending}
      />

      <CreateAssignmentModal
        courseId={courseId}
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        onCreated={(id) => {
          setAssignModalOpen(false);
          /* stay on CoursePage — useCourse invalidates */
        }}
      />
    </div>
  );
}
