/**
 * Phase 5-09: y-durableobjects collaboration transport.
 *
 * Mounts a Hono sub-app that delegates WebSocket upgrades at `/editor/:id`
 * to a per-room `YDurableObjects` instance. The `:id` path parameter is
 * the room key — Plan 05-09 uses the circuit id as the room key so two
 * users viewing the same circuit share one Durable Object.
 *
 * Per the locked Plan 05-09 scope, this DO only carries the Yjs awareness
 * protocol — cursors, selections, viewport, chip anchors. Circuit data
 * remains authoritative in the client-side Zustand store and is NEVER
 * pushed through the Yjs wire.
 *
 * See:
 * - .planning/phases/05-collaboration-and-polish/05-01-COLLAB-SPIKE.md
 * - .planning/phases/05-collaboration-and-polish/05-09-PLAN.md
 */

import { Hono } from 'hono';
import { YDurableObjects as _YDurableObjects, yRoute } from 'y-durableobjects';
import type { Bindings } from './index';

type YjsEnv = { Bindings: Bindings };

const app = new Hono<YjsEnv>();

// yRoute mounts `GET /:id` that upgrades the WebSocket and forwards to a
// `YDurableObjects` instance keyed by the `:id` path param. Mounting under
// `/editor` yields the final path `GET /editor/:circuitId`.
app.route(
  '/editor',
  yRoute<YjsEnv>((env) => env.Y_DURABLE_OBJECTS),
);

export default app;

/**
 * Concrete Durable Object class bound to the `Y_DURABLE_OBJECTS` namespace
 * in wrangler.toml. The base `YDurableObjects` class from y-durableobjects
 * provides the full hibernatable WebSocket handler and awareness-protocol
 * plumbing — we just need to extend it so wrangler can register the class
 * under our own export name.
 */
export class YDurableObjects extends _YDurableObjects<YjsEnv> {}
