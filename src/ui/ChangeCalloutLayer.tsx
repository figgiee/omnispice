/**
 * ChangeCalloutLayer — floating mutation feedback pills (UI-SPEC §7.11).
 *
 * Listens for `omnispice:change-callout` window events dispatched by
 * circuitStore mutations, converts them to ChangeCallout entries in
 * uiStore.changeCalloutQueue, and renders each as an anchored pill above
 * the affected component.
 *
 * Timing per UI-SPEC §7.11:
 *   80ms fade-in → 500ms hold → 200ms fade-out = 780ms total TTL
 *
 * Plan 05-11.
 */

import { useEffect } from 'react';
import { useStore } from '@xyflow/react';
import { useCircuitStore } from '@/store/circuitStore';
import type { ChangeCallout } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';
import styles from './ChangeCalloutLayer.module.css';

// ---------------------------------------------------------------------------
// Copy-text formatter (UI-SPEC §9.1 callout copy table)
// ---------------------------------------------------------------------------

interface CalloutDetail {
  kind: 'add' | 'delete' | 'rotate' | 'param-edit' | 'duplicate' | 'insert-template';
  ref?: string;
  componentId?: string;
  value?: string;
  param?: string;
  count?: number;
  lastPosition?: { x: number; y: number };
  name?: string;
}

function formatCalloutText(detail: CalloutDetail): {
  icon: ChangeCallout['icon'];
  text: string;
} {
  switch (detail.kind) {
    case 'add':
      return { icon: '+', text: `Added ${detail.ref ?? ''}` };
    case 'delete':
      return { icon: '−', text: `Deleted ${detail.ref ?? ''}` };
    case 'rotate':
      return { icon: '↻', text: `Rotated ${detail.ref ?? ''}` };
    case 'param-edit':
      return {
        icon: '✎',
        text: `${detail.ref ?? ''}.${detail.param ?? ''} = ${detail.value ?? ''}`,
      };
    case 'duplicate':
      return { icon: '⎘', text: `Duplicated ${detail.count ?? 1} component${(detail.count ?? 1) !== 1 ? 's' : ''}` };
    case 'insert-template':
      return { icon: '⎘', text: `Inserted ${detail.name ?? ''} (${detail.count ?? 0} parts)` };
    default:
      return { icon: '+', text: '' };
  }
}

// ---------------------------------------------------------------------------
// Main layer component
// ---------------------------------------------------------------------------

export function ChangeCalloutLayer() {
  const queue = useUiStore((s) => s.changeCalloutQueue);
  const enqueue = useUiStore((s) => s.enqueueChangeCallout);
  const expire = useUiStore((s) => s.expireCallouts);
  // React Flow viewport transform: [translateX, translateY, zoom]
  const transform = useStore((s) => s.transform);

  // Listen for local dispatch events from circuitStore mutations
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CalloutDetail>).detail;
      const { icon, text } = formatCalloutText(detail);

      // Look up the component's current position for the anchor
      const component = detail.componentId
        ? useCircuitStore.getState().circuit.components.get(detail.componentId)
        : undefined;

      enqueue({
        icon,
        text,
        anchor: {
          componentId: detail.componentId,
          lastPosition: detail.lastPosition ?? component?.position,
        },
      });
    };

    window.addEventListener('omnispice:change-callout', handler);
    return () => window.removeEventListener('omnispice:change-callout', handler);
  }, [enqueue]);

  // Expire stale callouts every 100ms
  useEffect(() => {
    const interval = setInterval(() => expire(), 100);
    return () => clearInterval(interval);
  }, [expire]);

  return (
    <div className={styles.layer} aria-hidden="true">
      {queue.map((c) => (
        <ChangeCalloutBubble key={c.id} callout={c} transform={transform} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual bubble
// ---------------------------------------------------------------------------

interface BubbleProps {
  callout: ChangeCallout;
  transform: readonly [number, number, number];
}

function ChangeCalloutBubble({ callout, transform }: BubbleProps) {
  const [tx, ty, zoom] = transform;
  const now = Date.now();
  const age = now - callout.addedAt;

  // Per-frame opacity: 80ms fade-in, 500ms hold, 200ms fade-out
  let opacity = 1;
  if (age < 80) {
    opacity = age / 80;
  } else if (age > 580) {
    opacity = Math.max(0, (780 - age) / 200);
  }

  // Anchor: prefer the live DOM element for non-deleted components;
  // fall back to lastPosition (flow-space coords) for deleted ones.
  let screenX = 0;
  let screenY = 0;

  if (callout.anchor.componentId) {
    const nodeEl = document.querySelector(`[data-id="${callout.anchor.componentId}"]`);
    if (nodeEl) {
      const rect = nodeEl.getBoundingClientRect();
      screenX = rect.left + rect.width / 2 - 50;
      screenY = rect.top - 40;
    } else if (callout.anchor.lastPosition) {
      // Component was just deleted — use its cached flow-space position
      screenX = callout.anchor.lastPosition.x * zoom + tx - 50;
      screenY = callout.anchor.lastPosition.y * zoom + ty - 40;
    }
  } else if (callout.anchor.lastPosition) {
    screenX = callout.anchor.lastPosition.x * zoom + tx - 50;
    screenY = callout.anchor.lastPosition.y * zoom + ty - 40;
  }

  return (
    <div
      className={styles.bubble}
      style={{
        left: screenX,
        top: screenY,
        opacity,
        borderColor: callout.presenceColor ?? 'var(--callout-border)',
      }}
    >
      <span className={styles.icon}>{callout.icon}</span>
      <span className={styles.text}>{callout.text}</span>
    </div>
  );
}
