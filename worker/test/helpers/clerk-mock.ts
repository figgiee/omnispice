import { vi } from 'vitest';
import { getAuth } from '@hono/clerk-auth';

export type MockRole = 'instructor' | 'student' | null;

/**
 * Stub the Clerk auth context for a single test.
 * - null userId = unauthenticated (401 path)
 * - role undefined = authenticated student by default
 * - sessionClaims.role mirrors the real JWT custom claim (Pattern 1 in 03-RESEARCH.md)
 */
export function mockClerkAuth(opts: { userId: string | null; role?: MockRole }) {
  if (opts.userId === null) {
    vi.mocked(getAuth).mockReturnValue(null as unknown as ReturnType<typeof getAuth>);
    return;
  }
  vi.mocked(getAuth).mockReturnValue({
    userId: opts.userId,
    sessionClaims: { role: opts.role ?? 'student' },
  } as unknown as ReturnType<typeof getAuth>);
}
