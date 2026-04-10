import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useMemo } from 'react';

interface Props {
  markdown: string;
}

/**
 * Render markdown safely. Uses marked (sync mode via async: false per Pitfall 4)
 * + DOMPurify default profile (strips <script>, inline handlers, javascript: URLs).
 * Wrapped in useMemo — re-renders only when markdown changes.
 */
export function RenderedInstructions({ markdown }: Props) {
  const html = useMemo(() => {
    if (!markdown) return '';
    // marked v15 defaults to async; { async: false } forces sync string return (Pitfall 4).
    const rawHtml = marked.parse(markdown, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  }, [markdown]);

  return (
    <div
      className="instructions-body"
      style={{
        fontSize: 14,
        lineHeight: 1.6,
        color: 'var(--text-primary)',
      }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by DOMPurify
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
