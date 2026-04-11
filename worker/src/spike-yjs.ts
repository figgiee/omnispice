/**
 * Phase 5-01 y-durableobjects transport spike (scaffold).
 *
 * This file is the minimal y-durableobjects wiring used by the
 * 05-01-COLLAB-SPIKE.md hibernation spike. It is intentionally NOT
 * imported from worker/src/index.ts — the plan 05-01 author ships
 * it as inert scaffolding so plan 05-09 can decide whether to adopt
 * y-durableobjects as the collaboration transport, or fall back to
 * plain y-websocket.
 *
 * See .planning/phases/05-collaboration-and-polish/05-01-COLLAB-SPIKE.md
 * for the spike decision document and measurement protocol.
 *
 * HOW TO RUN (once deps are installed; see COLLAB-SPIKE.md step 1):
 *   1. Install y-durableobjects: `cd worker && pnpm add y-durableobjects yjs`
 *   2. Wire this module into worker/src/index.ts:
 *        import spikeYjs, { YDurableObjects } from './spike-yjs';
 *        app.route('/spike-editor', spikeYjs);
 *        export { YDurableObjects };
 *   3. Uncomment the [[durable_objects.bindings]] block in worker/wrangler.toml
 *      and add the migration `[[migrations]] tag="spike-yjs" new_classes=["YDurableObjects"]`.
 *   4. Run `wrangler dev` and connect two clients via scripts/spike-yjs-client.ts.
 *
 * Until those manual steps are taken, importing this file has zero runtime
 * effect. The TypeScript `@ts-expect-error` below suppresses the missing
 * y-durableobjects dep so CI builds stay green without the package installed.
 */

// @ts-expect-error — y-durableobjects is a spike-only dev dep, not yet in worker/package.json
import { YDurableObjects as _YDurableObjects, yRoute } from 'y-durableobjects';
import { Hono } from 'hono';

type SpikeEnv = {
  Bindings: {
    Y_DURABLE_OBJECTS: DurableObjectNamespace;
  };
};

const app = new Hono<SpikeEnv>();

// Wire the y-route helper so `/spike-editor/:room` accepts WebSocket
// upgrades and routes them to a per-room Durable Object instance.
// yRoute signature is from y-durableobjects README.
app.get(
  '/spike-editor/*',
  // @ts-expect-error — y-durableobjects types are loose; install to get real types
  yRoute((env: SpikeEnv['Bindings']) => env.Y_DURABLE_OBJECTS),
);

export default app;
// Re-export so wrangler.toml's new_classes binding can reference the class.
// @ts-expect-error — see above
export const YDurableObjects = _YDurableObjects;
