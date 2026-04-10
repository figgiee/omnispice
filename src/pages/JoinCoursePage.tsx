import { SignInButton } from '@clerk/react';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/auth/useCurrentUser';
import { useJoinCourse } from '@/cloud/classroomHooks';
import styles from '@/components/classroom/Dashboard.module.css';

interface Props {
  code: string;
}

export function JoinCoursePage({ code }: Props) {
  const { isSignedIn, isLoaded } = useCurrentUser();
  const joinCourse = useJoinCourse();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || done || joinCourse.isPending) return;
    (async () => {
      try {
        const res = await joinCourse.mutateAsync({ code });
        setDone(true);
        window.location.assign(`/courses/${res.courseId}`);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [isLoaded, isSignedIn, code, done, joinCourse]);

  if (!isLoaded) return <div className={styles.container}>Loading...</div>;

  if (!isSignedIn) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Join a course</h1>
        <p className={styles.subtitle}>
          Course code: <strong style={{ fontFamily: 'var(--font-mono)' }}>{code}</strong>
        </p>
        <p style={{ marginTop: 24 }}>Sign in to join this course.</p>
        <SignInButton mode="modal">
          <button className={styles.ctaButton}>Sign in to join</button>
        </SignInButton>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Could not join course</h1>
        <p style={{ color: 'var(--color-error)' }}>{error}</p>
        <a href="/dashboard">← Back to dashboard</a>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Joining course {code}...</h1>
    </div>
  );
}
