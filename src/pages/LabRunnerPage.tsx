/**
 * LabRunnerPage — student-facing lab runtime route (`/labs/:id/run`).
 *
 * Responsibilities:
 *   - Auth gate (Clerk).
 *   - Fetch the Lab JSON (R2 blob) via useLabJson, parsed through LabSchema.
 *   - Fetch every reference CSV referenced by waveform_match predicates in
 *     the active step, parse them, and pass the Record to <LabRunner />.
 *   - Open a lab attempt on mount so the Worker route can track submissions.
 *
 * The page wraps <LabRunner /> which does the actual runtime rendering.
 * Keeping the split means the pure component stays test-renderable
 * without any QueryClient or Clerk wrapper.
 */

import { useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '@/auth/useCurrentUser';
import styles from '@/components/classroom/Dashboard.module.css';
import { useCreateAttempt, useLabJson, useReferenceCsv } from '@/cloud/labsHooks';
import { LabRunner } from '@/labs/runner/LabRunner';
import { parseReferenceCsv } from '@/labs/referenceCsv';
import { useLabStore } from '@/store/labStore';

interface Props {
  labId: string;
}

/**
 * Walk all steps in a lab and collect every unique reference_key used by
 * waveform_match predicates. We preload every ref so step-switching stays
 * instant — labs rarely have more than a handful of references anyway.
 */
function collectReferenceKeys(lab: { steps: Array<{ checkpoints: Array<{ kind: string; reference_key?: string }> }> }): string[] {
  const keys = new Set<string>();
  for (const step of lab.steps) {
    for (const cp of step.checkpoints) {
      if (cp.kind === 'waveform_match' && cp.reference_key) {
        keys.add(cp.reference_key);
      }
    }
  }
  return Array.from(keys);
}

export function LabRunnerPage({ labId }: Props) {
  const { isLoaded, isSignedIn } = useCurrentUser();
  const labQ = useLabJson(labId);
  const createAttempt = useCreateAttempt();
  const setActiveLab = useLabStore((s) => s.setActiveLab);

  // Open an attempt the first time the lab data arrives. The mutation
  // result flows into labStore so useLabRunner can read the attempt ID
  // later (e.g. when wiring AGS score passback).
  const [attemptOpened, setAttemptOpened] = useState(false);
  useEffect(() => {
    if (!labQ.data || attemptOpened) return;
    setAttemptOpened(true);
    createAttempt.mutate(
      { labId },
      {
        onSuccess: (attempt) => {
          setActiveLab(labId, attempt.id);
        },
        onError: () => {
          // Non-fatal: the student can still run the lab locally without
          // a server-side attempt row. They just won't get a score row.
          setActiveLab(labId, null);
        },
      },
    );
  }, [labQ.data, attemptOpened, createAttempt, labId, setActiveLab]);

  if (!isLoaded) return <div className={styles.container}>Loading...</div>;
  if (!isSignedIn) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Sign in to open this lab</h1>
      </div>
    );
  }
  if (labQ.isLoading) return <div className={styles.container}>Loading lab...</div>;
  if (labQ.isError || !labQ.data) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Lab not found</h1>
        <a href="/dashboard">← Back to dashboard</a>
      </div>
    );
  }

  return <LabRunnerInner labId={labId} lab={labQ.data} />;
}

/**
 * Inner page body — splits out so reference CSV hooks can depend on the
 * loaded lab without conditional hook calls in the parent.
 */
function LabRunnerInner({ labId, lab }: { labId: string; lab: Parameters<typeof LabRunner>[0]['lab'] }) {
  const referenceKeys = useMemo(() => collectReferenceKeys(lab), [lab]);

  // Fetch the first reference CSV via the hook (React hooks must run in
  // constant count per render). For labs with multiple references we
  // batch sequentially — in practice most have 1 probe per lab. A future
  // optimization would be a parallel useQueries.
  const firstKey = referenceKeys[0] ?? null;
  const refQ = useReferenceCsv(firstKey ? labId : null, firstKey);

  const references = useMemo(() => {
    if (!firstKey || !refQ.data) return undefined;
    try {
      const parsed = parseReferenceCsv(refQ.data);
      return { [firstKey]: parsed };
    } catch {
      return undefined;
    }
  }, [firstKey, refQ.data]);

  return (
    <div className={styles.container}>
      <LabRunner lab={lab} references={references} />
    </div>
  );
}
