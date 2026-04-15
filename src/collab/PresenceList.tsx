/**
 * Plan 05-09 — PresenceList.
 *
 * Top-right avatar bar of connected peers. Each avatar is a button that
 * frames the peer's viewport via React Flow's `setCenter` when clicked.
 * Empty state (no peers) is hidden entirely via CSS `:empty`.
 *
 * Must be rendered inside a `ReactFlowProvider` (uses `useReactFlow`).
 */

import { useReactFlow } from '@xyflow/react';
import type { PeerState } from '@/store/presenceStore';
import { usePresenceStore } from '@/store/presenceStore';
import styles from './PresenceList.module.css';

function initials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  const first = parts[0]?.[0] ?? '';
  const last = parts[parts.length - 1]?.[0] ?? '';
  return (first + last).toUpperCase();
}

export function PresenceList() {
  const remotePeers = usePresenceStore((s) => s.remotePeers);
  const peers: PeerState[] = Array.from(remotePeers.values());
  const { setCenter } = useReactFlow();

  const handleFrame = (peer: PeerState) => {
    if (!peer.viewport) return;
    // Convert the peer's viewport (React Flow transform) into a world-space
    // center coordinate. Flow transform is [tx, ty, zoom] such that
    // viewport_center = (-tx / zoom, -ty / zoom) in world coords.
    const zoom = peer.viewport.zoom > 0 ? peer.viewport.zoom : 1;
    const cx = -peer.viewport.x / zoom;
    const cy = -peer.viewport.y / zoom;
    setCenter(cx, cy, { duration: 200, zoom });
  };

  return (
    <div
      className={styles.list}
      role="list"
      aria-label="Collaborators"
      data-testid="presence-list"
    >
      {peers.map((peer) => (
        <button
          key={peer.clientId}
          type="button"
          className={styles.avatar}
          style={{ background: peer.user.color }}
          onClick={() => handleFrame(peer)}
          aria-label={`Frame ${peer.user.name}'s viewport`}
          title={peer.user.name}
          data-testid={`presence-avatar-${peer.clientId}`}
        >
          {initials(peer.user.name)}
        </button>
      ))}
    </div>
  );
}
