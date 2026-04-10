import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import type { Bindings } from '../index';

interface CircuitRow {
  id: string;
  user_id: string;
  name: string;
  share_token: string | null;
  r2_key: string;
  created_at: number;
  updated_at: number;
}

const circuits = new Hono<{ Bindings: Bindings }>();

// POST /api/circuits — create or upsert
circuits.post('/', async (c) => {
  const userId = requireAuth(c);
  const body = await c.req.json<{ id?: string; name: string; circuit: string }>();

  const id = body.id ?? crypto.randomUUID();
  const r2Key = `circuits/${id}.json`;
  const now = Date.now();

  await c.env.CIRCUIT_BUCKET.put(r2Key, body.circuit, {
    httpMetadata: { contentType: 'application/json' },
  });

  await c.env.DB.prepare(`
    INSERT INTO circuits (id, user_id, name, r2_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at
  `).bind(id, userId, body.name ?? 'Untitled Circuit', r2Key, now, now).run();

  return c.json({ id });
});

// GET /api/circuits — list user's circuits
circuits.get('/', async (c) => {
  const userId = requireAuth(c);
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, share_token, created_at, updated_at FROM circuits WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all<CircuitRow>();
  return c.json(results);
});

// GET /api/circuits/:id — load circuit
circuits.get('/:id', async (c) => {
  const userId = requireAuth(c);
  const { id } = c.req.param();

  const meta = await c.env.DB.prepare(
    'SELECT * FROM circuits WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first<CircuitRow>();

  if (!meta) return c.json({ error: 'Not found' }, 404);

  const obj = await c.env.CIRCUIT_BUCKET.get(meta.r2_key);
  if (!obj) return c.json({ error: 'Circuit data missing' }, 500);

  return new Response(obj.body as ReadableStream, {
    headers: { 'Content-Type': 'application/json' },
  });
});

// PUT /api/circuits/:id — update circuit
circuits.put('/:id', async (c) => {
  const userId = requireAuth(c);
  const { id } = c.req.param();
  const body = await c.req.json<{ name?: string; circuit?: string }>();

  const meta = await c.env.DB.prepare(
    'SELECT * FROM circuits WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first<CircuitRow>();

  if (!meta) return c.json({ error: 'Not found' }, 404);

  const now = Date.now();

  if (body.circuit !== undefined) {
    await c.env.CIRCUIT_BUCKET.put(meta.r2_key, body.circuit, {
      httpMetadata: { contentType: 'application/json' },
    });
  }

  await c.env.DB.prepare(
    'UPDATE circuits SET name=?, updated_at=? WHERE id=? AND user_id=?'
  ).bind(body.name ?? meta.name, now, id, userId).run();

  return c.json({ id });
});

// DELETE /api/circuits/:id — delete circuit
circuits.delete('/:id', async (c) => {
  const userId = requireAuth(c);
  const { id } = c.req.param();

  const meta = await c.env.DB.prepare(
    'SELECT * FROM circuits WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first<CircuitRow>();

  if (!meta) return c.json({ error: 'Not found' }, 404);

  await c.env.CIRCUIT_BUCKET.delete(meta.r2_key);
  await c.env.DB.prepare('DELETE FROM circuits WHERE id = ? AND user_id = ?')
    .bind(id, userId).run();

  return c.json({ deleted: true });
});

// POST /api/circuits/:id/share — generate share token
circuits.post('/:id/share', async (c) => {
  const userId = requireAuth(c);
  const { id } = c.req.param();

  // Verify ownership
  const meta = await c.env.DB.prepare(
    'SELECT id FROM circuits WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first<{ id: string }>();

  if (!meta) return c.json({ error: 'Not found' }, 404);

  // Generate 16-char URL-safe token (server-side only)
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  await c.env.DB.prepare(
    'UPDATE circuits SET share_token = ? WHERE id = ? AND user_id = ?'
  ).bind(token, id, userId).run();

  const shareUrl = `https://omnispice.app/share/${token}`;
  return c.json({ shareUrl, token });
});

export { circuits as circuitsRouter };
