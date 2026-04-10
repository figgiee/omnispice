import { useState } from 'react';
import { useRole } from '@/auth/useRole';
import { useCourses, useJoinCourse } from '@/cloud/classroomHooks';
import { CreateCourseModal } from '@/components/classroom/CreateCourseModal';
import styles from '@/components/classroom/Dashboard.module.css';

export function Dashboard() {
  const role = useRole();
  const courses = useCourses();
  const joinCourse = useJoinCourse();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return;
    try {
      const res = await joinCourse.mutateAsync({ code });
      window.location.assign(`/courses/${res.courseId}`);
    } catch (err) {
      console.error('Failed to join course:', err);
    }
  }

  // Instructor view per D-22, D-38
  if (role === 'instructor') {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>My Courses</h1>
            <p className={styles.subtitle}>Classroom instructor dashboard</p>
          </div>
          <button className={styles.ctaButton} onClick={() => setCreateOpen(true)}>
            + New Course
          </button>
        </div>
        {courses.data?.length === 0 ? (
          <div className={styles.empty}>
            <h2 style={{ fontWeight: 500 }}>No courses yet</h2>
            <p>Create your first course to start assigning circuits to students.</p>
            <button className={styles.ctaButton} onClick={() => setCreateOpen(true)}>
              Create your first course
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {courses.data?.map((c) => (
              <a
                key={c.id}
                href={`/courses/${c.id}`}
                className={styles.card}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <h3 className={styles.cardName}>{c.name}</h3>
                <div className={styles.cardMeta}>{c.term ?? 'No term'}</div>
                <div className={styles.cardCode}>{c.join_code}</div>
              </a>
            ))}
          </div>
        )}
        <CreateCourseModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => window.location.assign(`/courses/${id}`)}
        />
      </div>
    );
  }

  // Student view per D-22, D-39
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Enrolled Courses</h1>
          <p className={styles.subtitle}>Your classroom dashboard</p>
        </div>
      </div>
      <form onSubmit={handleJoin} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          className={styles.joinInput}
          placeholder="JOIN CODE"
          value={joinCodeInput}
          onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
          maxLength={6}
        />
        <button type="submit" className={styles.ctaButton} disabled={joinCourse.isPending}>
          {joinCourse.isPending ? 'Joining...' : 'Join Course'}
        </button>
      </form>
      {joinCourse.isError && (
        <p style={{ color: 'var(--color-error)' }}>Invalid code. Ask your instructor.</p>
      )}
      {courses.data?.length === 0 ? (
        <div className={styles.empty}>
          <h2 style={{ fontWeight: 500 }}>No enrolled courses</h2>
          <p>Enter a join code from your instructor to enroll.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {courses.data?.map((c) => (
            <a
              key={c.id}
              href={`/courses/${c.id}`}
              className={styles.card}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <h3 className={styles.cardName}>{c.name}</h3>
              <div className={styles.cardMeta}>{c.term ?? 'No term'}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
