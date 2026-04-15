/**
 * InsightAnchor — a small floating label overlaid on a schematic node that
 * has one or more schematic-node-anchored insights. Rendered inside a React
 * Flow custom node so it inherits the node's coordinate system.
 */

import { useInsightsStore } from '@/store/insightsStore';

interface InsightAnchorProps {
  componentId: string;
}

export function InsightAnchor({ componentId }: InsightAnchorProps) {
  const insights = useInsightsStore((s) =>
    s.insights.filter(
      (i) =>
        i.anchor.kind === 'schematic-node' &&
        i.anchor.componentId === componentId &&
        !s.dismissedIds.has(i.id),
    ),
  );

  if (insights.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: -20,
        left: 0,
        fontSize: 10,
        color: 'var(--signal-ok, #4caf7d)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {insights.map((i) => i.summary).join(' · ')}
    </div>
  );
}
