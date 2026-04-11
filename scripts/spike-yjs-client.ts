/**
 * Phase 5-01 y-durableobjects client script (scaffold).
 *
 * Minimal y-websocket client used to validate that two peers can
 * join a shared Y.Doc through the spike worker. Run with:
 *
 *   pnpm add -D y-websocket yjs
 *   pnpm exec tsx scripts/spike-yjs-client.ts
 *
 * To run the full 4-step measurement protocol (handshake / hibernation /
 * reconnect / idle cost) see:
 *   .planning/phases/05-collaboration-and-polish/05-01-COLLAB-SPIKE.md
 *
 * This scaffold is NOT wired into the main test suite. It only runs
 * when invoked manually during the spike.
 */

// @ts-expect-error — spike-only deps, not yet installed
import * as Y from 'yjs';
// @ts-expect-error — spike-only deps, not yet installed
import { WebsocketProvider } from 'y-websocket';

const ROOM = process.env.SPIKE_ROOM ?? 'spike-room';
const URL = process.env.SPIKE_URL ?? 'ws://localhost:8787/spike-editor';
const CLIENT_ID = process.argv[2] ?? `client-${Math.random().toString(36).slice(2, 8)}`;

async function main() {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(URL, ROOM, doc);

  provider.on('status', (event: { status: string }) => {
    console.log(`[${CLIENT_ID}] status: ${event.status}`);
  });

  provider.awareness.setLocalStateField('user', { name: CLIENT_ID });

  // Publish a cursor update every second so peers see awareness flowing.
  setInterval(() => {
    provider.awareness.setLocalStateField('cursor', {
      x: Math.round(Math.random() * 1000),
      y: Math.round(Math.random() * 1000),
      at: Date.now(),
    });
  }, 1000);

  provider.awareness.on('change', () => {
    const states = Array.from(provider.awareness.getStates().entries());
    console.log(`[${CLIENT_ID}] awareness peers: ${states.length}`);
  });

  console.log(`[${CLIENT_ID}] connected to ${URL}/${ROOM}`);
}

main().catch((err) => {
  console.error('spike client error:', err);
  process.exit(1);
});
