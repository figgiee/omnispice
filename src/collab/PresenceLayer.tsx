/**
 * Plan 05-09 — PresenceLayer.
 *
 * Renders the three presence overlays for every remote peer:
 *   1. Remote cursor (svg arrow + name label)
 *   2. Remote selection outline (1px border + 10% color fill on the
 *      currently selected React Flow nodes)
 *   3. Ghost chip (50% opacity pill floating above the component a peer
 *      currently has a parameter chip open against — Plan 05-05 carrier)
 *
 * Circuit data NEVER crosses the Yjs wire; everything rendered here is
 * derived from presenceStore which is itself a projection of the Yjs
 * awareness map.
 *
 * The component MUST be rendered inside a `ReactFlowProvider` because it
 * subscribes to the React Flow internal transform store to re-render on
 * pan/zoom (otherwise cached `getBoundingClientRect` reads go stale).
 */

import { useStore } from '@xyflow/react';
import type { PeerState } from '@/store/presenceStore';
import { usePresenceStore } from '@/store/presenceStore';
import styles from './PresenceLayer.module.css';

type Transform = readonly [number, number, number];

export function PresenceLayer() {
  // Subscribe to the Map identity so this re-renders on every peer diff.
  const remotePeers = usePresenceStore((s) => s.remotePeers);
  // Subscribing to React Flow transform forces a re-render on pan/zoom so
  // getBoundingClientRect reads stay fresh for selection/chip anchors.
  const transform = useStore((s) => s.transform) as Transform;

  const peers: PeerState[] = Array.from(remotePeers.values());

  return (
    <div className={styles.layer} aria-hidden="true" data-testid="presence-layer">
      {peers.map((peer) => (
        <RemoteCursor
          key={`cursor-${peer.clientId}`}
          peer={peer}
          transform={transform}
        />
      ))}
      {peers.flatMap((peer) =>
        peer.selection.map((componentId) => (
          <RemoteSelectionOutline
            key={`sel-${peer.clientId}-${componentId}`}
            componentId={componentId}
            color={peer.user.color}
          />
        )),
      )}
      {peers
        .filter((peer) => peer.chipAnchor)
        .map((peer) => (
          <GhostChip
            key={`chip-${peer.clientId}`}
            componentId={peer.chipAnchor as string}
            color={peer.user.color}
          />
        ))}
    </div>
  );
}

// --- internal subcomponents ---------------------------------------------

interface RemoteCursorProps {
  peer: PeerState;
  transform: Transform;
}

/**
 * Render a single remote cursor. Flow-space coordinates are converted to
 * layer-local (pixel) coordinates using the current React Flow transform:
 *   left = cursor.x * zoom + tx
 *   top  = cursor.y * zoom + ty
 *
 * The layer itself is `position: absolute` matching the ReactFlow pane,
 * so the math stays pane-local (not viewport-absolute).
 */
function RemoteCursor({ peer, transform }: RemoteCursorProps) {
  if (!peer.cursor) return null;
  const [tx, ty, zoom] = transform;
  const left = peer.cursor.x * zoom + tx;
  const top = peer.cursor.y * zoom + ty;
  return (
    <div
      className={styles.cursor}
      style={{ left, top, color: peer.user.color }}
      data-testid={`presence-cursor-${peer.clientId}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <title>{peer.user.name}</title>
        <path
          d="M 0 0 L 12 6 L 6 8 L 8 14 Z"
          fill="currentColor"
          stroke="#ffffff"
          strokeWidth="0.5"
        />
      </svg>
      <div className={styles.label} style={{ background: peer.user.color }}>
        {peer.user.name}
      </div>
    </div>
  );
}

interface RemoteSelectionOutlineProps {
  componentId: string;
  color: string;
}

/**
 * Remote peer selection outline. Anchored to the React Flow DOM node via
 * `[data-id]` — React Flow sets this attribute on every rendered node
 * wrapper, so we can read its live `getBoundingClientRect` on each render
 * (the parent layer re-renders on transform change so this stays fresh).
 */
function RemoteSelectionOutline({ componentId, color }: RemoteSelectionOutlineProps) {
  const nodeEl = typeof document !== 'undefined'
    ? document.querySelector(`[data-id="${componentId}"]`)
    : null;
  if (!nodeEl) return null;
  const rect = (nodeEl as Element).getBoundingClientRect();
  return (
    <div
      className={styles.remoteSelection}
      data-testid={`presence-selection-${componentId}`}
      style={{
        left: rect.left - 4,
        top: rect.top - 4,
        width: rect.width + 8,
        height: rect.height + 8,
        border: `1px solid ${color}`,
        background: `color-mix(in oklab, ${color} 10%, transparent)`,
      }}
    />
  );
}

interface GhostChipProps {
  componentId: string;
  color: string;
}

/**
 * Ghost parameter chip — rendered at 50% opacity above the target
 * component when a peer is actively editing its inline chip (Plan 05-05).
 *
 * The chip text is intentionally generic ("editing") since the peer's
 * in-progress value does NOT cross the Yjs wire — awareness carries only
 * the component id the peer is focused on.
 */
function GhostChip({ componentId, color }: GhostChipProps) {
  const nodeEl = typeof document !== 'undefined'
    ? document.querySelector(`[data-id="${componentId}"]`)
    : null;
  if (!nodeEl) return null;
  const rect = (nodeEl as Element).getBoundingClientRect();
  return (
    <div
      className={styles.ghostChip}
      data-testid={`presence-chip-${componentId}`}
      style={{
        left: rect.left,
        top: rect.top - 28,
        borderColor: color,
      }}
    >
      editing
    </div>
  );
}
