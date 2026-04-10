import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createClerkClient } from '@clerk/backend';
import { requireAuth } from '../middleware/auth';
import type { Bindings } from '../index';

const me = new Hono<{ Bindings: Bindings }>();

// POST /api/me/become-instructor — flips Clerk publicMetadata.role to 'instructor' (D-01).
// Frontend must call user.reload() + getToken({ skipCache: true }) after this to pick up
// the new JWT claim (Pitfall 1).
me.post('/become-instructor', async (c) => {
  const userId = requireAuth(c);
  const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
  await clerk.users.updateUser(userId, {
    publicMetadata: { role: 'instructor' },
  });
  return c.json({ ok: true, role: 'instructor' });
});

export { me as meRouter };
