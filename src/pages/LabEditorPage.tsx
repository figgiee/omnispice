/**
 * LabEditorPage — instructor authoring route at `/labs/:id/edit`.
 *
 * If `:id === 'new'` the page initializes an empty draft in local state and
 * saves via `useCreateLab` on first save. Otherwise it loads the lab via
 * `useLabJson` and saves via `useUpdateLab`.
 *
 * Reference waveforms:
 *   On save, after the lab JSON is persisted, we walk the draft with
 *   `referenceRunner.collectProbes()` and — using the current circuit in
 *   `circuitStore` as the reference — run the simulation controller against
 *   the CURRENT simulation results already in `simulationStore.results`.
 *
 *   If the instructor has not yet run a simulation, the page prompts them
 *   to run one from the main canvas first. This keeps the page decoupled
 *   from the simulation worker lifecycle (no parallel controllers) at the
 *   cost of a small UX step.
 */
import { useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '@/auth/useCurrentUser';
import { useRole } from '@/auth/useRole';
import styles from '@/components/classroom/Dashboard.module.css';
import {
  useCreateLab,
  useLabJson,
  useUpdateLab,
  useUploadReference,
} from '@/cloud/labsHooks';
import { LabEditor } from '@/labs/editor/LabEditor';
import { generateAndUploadReferences } from '@/labs/referenceRunner';
import { type Lab, LabSchema } from '@/labs/schema';
import { useSimulationStore } from '@/store/simulationStore';

interface Props {
  labId: string;
}

function emptyLab(): Lab {
  return LabSchema.parse({
    schema_version: 1,
    id: 'draft',
    title: 'Untitled Lab',
    description: '',
    steps: [
      {
        id: `step-${Date.now().toString(36)}`,
        title: 'Step 1',
        instructions: '',
        checkpoints: [],
      },
    ],
  });
}

export function LabEditorPage({ labId }: Props) {
  const { isLoaded, isSignedIn } = useCurrentUser();
  const role = useRole();
  const isNew = labId === 'new';
  const labQ = useLabJson(isNew ? null : labId);
  const createLab = useCreateLab();
  const updateLab = useUpdateLab();
  const uploadReference = useUploadReference();
  const simulationResults = useSimulationStore((s) => s.results);

  const [draft, setDraft] = useState<Lab | null>(null);
  const [savedLabId, setSavedLabId] = useState<string | null>(isNew ? null : labId);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Seed the draft when the lab JSON arrives (or immediately for `new`).
  useEffect(() => {
    if (draft) return;
    if (isNew) {
      setDraft(emptyLab());
    } else if (labQ.data) {
      setDraft(labQ.data);
    }
  }, [draft, isNew, labQ.data]);

  const probeCount = useMemo(() => {
    if (!draft) return 0;
    let n = 0;
    for (const step of draft.steps) {
      for (const cp of step.checkpoints) {
        if (cp.kind === 'waveform_match') n++;
      }
    }
    return n;
  }, [draft]);

  async function handleSave(lab: Lab) {
    setSaving(true);
    setStatusMessage(null);
    try {
      // Save the lab body first so we have a real id for reference uploads.
      let id = savedLabId;
      if (!id) {
        const created = await createLab.mutateAsync({ lab, courseId: null });
        id = created.id;
        setSavedLabId(id);
      } else {
        await updateLab.mutateAsync({ id, lab });
      }

      // Generate + upload reference CSVs for every waveform_match probe.
      if (probeCount > 0 && simulationResults.length > 0) {
        setStatusMessage('Uploading reference waveforms…');
        const results = await generateAndUploadReferences({
          lab,
          vectors: simulationResults,
          uploadReference: (probe, csv) =>
            uploadReference.mutateAsync({ labId: id!, probe, csvText: csv }),
        });
        const uploaded = results.filter((r) => r.status === 'uploaded').length;
        const missing = results.filter((r) => r.status === 'missing').length;
        const failed = results.filter((r) => r.status === 'failed').length;
        setStatusMessage(
          `Lab saved. ${uploaded} reference${uploaded === 1 ? '' : 's'} uploaded` +
            (missing ? `, ${missing} probe${missing === 1 ? '' : 's'} missing from sim results` : '') +
            (failed ? `, ${failed} failed` : '') +
            '.',
        );
      } else if (probeCount > 0) {
        setStatusMessage(
          'Lab saved. Run a simulation on the canvas first to capture reference waveforms.',
        );
      } else {
        setStatusMessage('Lab saved.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Save failed: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  function handlePreviewAsStudent() {
    if (!savedLabId) {
      setStatusMessage('Save the lab first, then try as student.');
      return;
    }
    window.open(`/labs/${savedLabId}/run`, '_blank');
  }

  if (!isLoaded) return <div className={styles.container}>Loading...</div>;
  if (!isSignedIn) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Sign in to author labs</h1>
      </div>
    );
  }
  if (role !== 'instructor') {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Instructor role required</h1>
        <p>Only instructors can author labs.</p>
      </div>
    );
  }
  if (!isNew && labQ.isLoading) {
    return <div className={styles.container}>Loading lab…</div>;
  }
  if (!isNew && (labQ.isError || !labQ.data)) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Lab not found</h1>
        <a href="/labs">← Back to library</a>
      </div>
    );
  }
  if (!draft) return <div className={styles.container}>Preparing editor…</div>;

  return (
    <div className={styles.container}>
      <div style={{ marginBottom: '1rem' }}>
        <a href="/labs">← Back to library</a>
      </div>
      {statusMessage && (
        <div
          role="status"
          style={{
            marginBottom: '0.75rem',
            padding: '0.5rem',
            background: '#eef6ff',
            border: '1px solid #99c',
            borderRadius: 4,
          }}
        >
          {statusMessage}
        </div>
      )}
      <LabEditor
        lab={draft}
        onChange={setDraft}
        onSave={handleSave}
        onPreviewAsStudent={handlePreviewAsStudent}
        saving={saving}
      />
    </div>
  );
}
