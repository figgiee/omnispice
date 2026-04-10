import { Hono } from 'hono';
import type { Bindings } from '../index';

interface CircuitShareRow {
  r2_key: string;
  name: string;
}

const share = new Hono<{ Bindings: Bindings }>();

// GET /api/share/:token — public, no auth required
share.get('/:token', async (c) => {
  const { token } = c.req.param();

  const meta = await c.env.DB.prepare(
    'SELECT r2_key, name FROM circuits WHERE share_token = ?'
  ).bind(token).first<CircuitShareRow>();

  if (!meta) return c.json({ error: 'Not found' }, 404);

  const obj = await c.env.CIRCUIT_BUCKET.get(meta.r2_key);
  if (!obj) return c.json({ error: 'Circuit data missing' }, 500);

  return new Response(obj.body as ReadableStream, {
    headers: {
      'Content-Type': 'application/json',
      'X-Circuit-Name': meta.name,
    },
  });
});

export { share as shareRouter };
