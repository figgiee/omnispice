import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/auth/useCurrentUser';
import { getCourse } from '@/cloud/classroomApi';
import { useCourses } from '@/cloud/classroomHooks';
import type { Assignment, CourseDetail } from '@/cloud/classroomTypes';
import { useEmbedInLms } from '@/cloud/ltiAdminHooks';

/**
 * Deep Linking picker — LMS-01 / LMS-02.
 *
 * Mounted at `/lti/bootstrap?mode=deeplink` (the LTI launch handler sets
 * `mode=deeplink` in the HTML bootstrap URL when the incoming
 * message_type is `LtiDeepLinkingRequest`).
 *
 * Workflow:
 *  1. Parse `launch` id from the URL — this is the lti_launches row id
 *     the Worker minted during /lti/launch. Also a capability token for
 *     POST /lti/deeplink/response.
 *  2. Show the instructor a flat list of all their assignments (across
 *     all their courses).
 *  3. On "Embed Selected in LMS", call POST /lti/deeplink/response with
 *     the selected assignment ids. The Worker responds with an HTML
 *     document containing an auto-submitting form pointing at the LMS.
 *  4. Document.open/write/close that HTML so the form submit fires in
 *     the same browsing context. The LMS then returns the instructor to
 *     the gradebook with the new line item(s) materialized.
 */
export function DeepLinkPickerPage() {
  const url = new URL(window.location.href);
  const launchId = url.searchParams.get('launch') ?? '';

  const { getToken, isSignedIn } = useCurrentUser();
  const courses = useCourses();
  const embed = useEmbedInLms();

  const [courseDetails, setCourseDetails] = useState<CourseDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      if (!courses.data || courses.data.length === 0) return;
      setLoading(true);
      try {
        const details = await Promise.all(courses.data.map((c) => getCourse(c.id, getToken)));
        if (!cancelled) setCourseDetails(details);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [courses.data, getToken]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleEmbed() {
    if (selected.size === 0) return;
    setError(null);
    try {
      const html = await embed.mutateAsync({
        launchId,
        assignmentIds: [...selected],
      });
      // Write the returned HTML into the current document so its
      // auto-submit form fires in the same browsing context (rather
      // than via fetch + XHR, which would not execute the POST to the
      // LMS return URL).
      document.open();
      document.write(html);
      document.close();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!launchId) {
    return (
      <div style={containerStyle}>
        <h1 style={titleStyle}>Deep Link Picker</h1>
        <p style={errorStyle}>Missing launch id — open this page from your LMS, not directly.</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div style={containerStyle}>
        <h1 style={titleStyle}>Signing you in…</h1>
      </div>
    );
  }

  const allAssignments: Array<Assignment & { courseTitle: string }> = courseDetails.flatMap((c) =>
    (c.assignments ?? []).map((a) => ({
      ...a,
      courseTitle: c.course.name,
    })),
  );

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Embed an OmniSpice assignment</h1>
      <p style={{ color: '#9aa' }}>
        Select one or more assignments to embed in your LMS course. Each selection becomes a
        gradebook column with automatic grade passback.
      </p>

      {error ? <p style={errorStyle}>{error}</p> : null}

      {courses.isLoading || loading ? (
        <p>Loading your courses…</p>
      ) : allAssignments.length === 0 ? (
        <p style={{ color: '#9aa' }}>
          You don&apos;t have any assignments yet. Create one in the instructor dashboard first,
          then relaunch from your LMS.
        </p>
      ) : (
        <ul style={listStyle}>
          {allAssignments.map((a) => (
            <li key={a.id} style={itemStyle}>
              <label style={labelStyle}>
                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                <span>
                  <strong>{a.title}</strong>
                  <span style={{ color: '#778', marginLeft: 8 }}>{a.courseTitle}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={handleEmbed}
        disabled={selected.size === 0 || embed.isPending}
        style={{
          ...buttonStyle,
          opacity: selected.size === 0 ? 0.5 : 1,
          cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
        }}
      >
        {embed.isPending
          ? 'Embedding…'
          : `Embed ${selected.size} assignment${selected.size === 1 ? '' : 's'} in LMS`}
      </button>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '48px auto',
  padding: '0 24px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#dde',
};

const titleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 600,
  marginBottom: 12,
};

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '24px 0',
};

const itemStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #222',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  cursor: 'pointer',
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 6,
  border: 'none',
  background: '#2b7fff',
  color: 'white',
  fontSize: 14,
  fontWeight: 500,
};

const errorStyle: React.CSSProperties = {
  padding: '12px 16px',
  background: '#3a1717',
  color: '#fbb',
  borderRadius: 6,
};
