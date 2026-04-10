import { getAuth } from '@hono/clerk-auth';
import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';

/**
 * Require an authenticated Clerk session.
 * Returns userId or throws 401 HTTPException.
 */
export function requireAuth(c: Context): string {
  const auth = getAuth(c);
  if (!auth?.userId) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  return auth.userId;
}
