/**
 * LabLibraryPage — mounted at `/labs`.
 *
 * Instructor sees their own labs with a "+ Create Lab" CTA that navigates to
 * `/labs/new/edit`. Students see only labs from courses they're enrolled in
 * (the Worker route filters server-side).
 */
import { useCurrentUser } from '@/auth/useCurrentUser';
import { useRole } from '@/auth/useRole';
import styles from '@/components/classroom/Dashboard.module.css';
import { useLabs } from '@/cloud/labsHooks';

export function LabLibraryPage() {
  const { isLoaded, isSignedIn } = useCurrentUser();
  const role = useRole();
  const labsQ = useLabs();

  if (!isLoaded) return <div className={styles.container}>Loading...</div>;
  if (!isSignedIn) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Sign in to see labs</h1>
      </div>
    );
  }

  const labs = labsQ.data ?? [];
  const isInstructor = role === 'instructor';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{isInstructor ? 'My Labs' : 'Available Labs'}</h1>
          <p className={styles.subtitle}>
            {isInstructor
              ? 'Guided labs you have authored.'
              : 'Guided labs assigned to your enrolled courses.'}
          </p>
        </div>
        {isInstructor && (
          <a href="/labs/new/edit" className={styles.ctaButton}>
            + Create Lab
          </a>
        )}
      </div>

      {labsQ.isLoading ? (
        <p>Loading labs…</p>
      ) : labs.length === 0 ? (
        <div className={styles.empty}>
          <h2 style={{ fontWeight: 500 }}>No labs yet</h2>
          <p>
            {isInstructor
              ? 'Create your first lab to start assigning guided experiments.'
              : "You don't have any labs available yet. Ask your instructor to assign one."}
          </p>
          {isInstructor && (
            <a href="/labs/new/edit" className={styles.ctaButton}>
              Create your first lab
            </a>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {labs.map((lab) => (
            <div key={lab.id} className={styles.card}>
              <h3 className={styles.cardName}>{lab.title}</h3>
              <div className={styles.cardMeta}>
                {lab.updated_at
                  ? `Updated ${new Date(lab.updated_at).toLocaleDateString()}`
                  : '—'}
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <a href={`/labs/${lab.id}/run`}>Run</a>
                {isInstructor && <a href={`/labs/${lab.id}/edit`}>Edit</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
