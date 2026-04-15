/**
 * InsightBadgeLayer — renders pedagogy insight pills in the waveform panel.
 *
 * Each pill shows a green dot + one-line summary. Clicking it expands to a
 * card with the full explanation and an optional KaTeX formula. The dismiss
 * button (×) hides the insight for the session (not persisted).
 */

import katex from 'katex';
import { useState } from 'react';
import type { Insight } from '@/insights/types';
import { useInsightsStore } from '@/store/insightsStore';
import styles from './InsightBadgeLayer.module.css';

export function InsightBadgeLayer() {
  const { insights, dismissedIds, dismiss } = useInsightsStore();
  const visible = insights.filter((i) => !dismissedIds.has(i.id));
  if (visible.length === 0) return null;
  return (
    <div className={styles.layer} role="list" aria-label="Insights">
      {visible.map((insight) => (
        <InsightPill
          key={insight.id}
          insight={insight}
          onDismiss={() => dismiss(insight.id)}
        />
      ))}
    </div>
  );
}

interface InsightPillProps {
  insight: Insight;
  onDismiss: () => void;
}

function InsightPill({ insight, onDismiss }: InsightPillProps) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div className={styles.card} role="listitem">
        <div className={styles.cardHeader}>
          <span className={styles.cardSummary}>{insight.summary}</span>
          <button
            className={styles.dismissBtn}
            onClick={onDismiss}
            aria-label="Dismiss insight"
            type="button"
          >
            ×
          </button>
        </div>
        {insight.expanded && (
          <p className={styles.cardExpanded}>{insight.expanded}</p>
        )}
        {insight.formula && (
          <div
            className={styles.cardFormula}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output is sanitized by katex itself
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(insight.formula, {
                throwOnError: false,
                displayMode: true,
              }),
            }}
          />
        )}
        <button
          className={styles.pill}
          style={{ marginTop: 8, borderRadius: 4 }}
          onClick={() => setExpanded(false)}
          type="button"
        >
          Show less
        </button>
      </div>
    );
  }

  return (
    <button
      className={styles.pill}
      role="listitem"
      onClick={() => setExpanded(true)}
      type="button"
      aria-expanded={false}
    >
      <span
        className={`${styles.dot}${insight.severity === 'warning' ? ` ${styles.warning}` : ''}`}
      />
      <span>{insight.summary}</span>
      <span className={styles.chevron}>›</span>
    </button>
  );
}
