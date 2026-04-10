import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo } from 'react';

/**
 * Renders the annotations section from a markdown source. Uses the
 * Phase 3 pattern: marked synchronous parse + DOMPurify sanitise.
 */
export function AnnotationsSection({ markdown }: { markdown: string }) {
  const html = useMemo(() => {
    if (!markdown) return '';
    const raw = marked.parse(markdown, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [markdown]);

  return (
    <section className="report-annotations" data-section="annotations">
      <h2>4. Annotations</h2>
      {html ? (
        <div
          className="annotations-body"
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: '#24292f',
          }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised by DOMPurify
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p style={{ fontStyle: 'italic', color: '#57606a' }}>No annotations.</p>
      )}
    </section>
  );
}
