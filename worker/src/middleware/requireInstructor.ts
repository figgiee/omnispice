import { createMiddleware } from 'hono/factory';
import { getAuth } from '@hono/clerk-auth';
import { HTTPException } from 'hono/http-exception';
import type { Bindings } from '../index';

/**
 * Require an authenticated Clerk user AND role === 'instructor' (from JWT custom claim).
 * Sets c.var.userId for downstream handlers. Per D-02.
 * 401 if unauthenticated, 403 if not instructor.
 */
export const requireInstructor = createMiddleware<{
  Bindings: Bindings;
  Variables: { userId: string };
}>(async (c, next) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  const role = (auth.sessionClaims as { role?: string } | null)?.role;
  if (role !== 'instructor') {
    throw new HTTPException(403, { message: 'Instructor role required' });
  }
  c.set('userId', auth.userId);
  await next();
});
