import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
  getAuth: vi.fn(),
}));

// Mock @clerk/backend createClerkClient so tests don't hit the real API.
const createSignInToken = vi.fn();
const getUserList = vi.fn();
const createUser = vi.fn();
vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    users: {
      getUserList,
      createUser,
    },
    signInTokens: {
      createSignInToken,
    },
  }),
}));

// RED — worker/src/lti/mintClerkTicket lands in 04-02.
// @ts-expect-error — module does not exist yet (Wave 0 scaffold).
import { mintClerkTicketForLtiLaunch } from '../../src/lti/mintClerkTicket';

describe('lti/mintClerkTicket — LMS-03 LTI→Clerk bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserList.mockReset();
    createUser.mockReset();
    createSignInToken.mockReset();
  });

  it('first call with unknown externalId creates a new Clerk user then mints a ticket', async () => {
    getUserList.mockResolvedValueOnce({ data: [], totalCount: 0 });
    createUser.mockResolvedValueOnce({ id: 'user_clerk_new_01' });
    createSignInToken.mockResolvedValueOnce({ token: 'ticket-new-01' });

    const { ticket, clerkUserId } = await mintClerkTicketForLtiLaunch({
      iss: 'https://canvas.test.instructure.com',
      sub: 'lti-sub-student-01',
      email: 'student01@example.edu',
      name: 'Test Student',
      secretKey: 'sk_test_placeholder',
    });

    expect(ticket).toBe('ticket-new-01');
    expect(clerkUserId).toBe('user_clerk_new_01');
    expect(createUser).toHaveBeenCalledTimes(1);
    // externalId must use the lti|{iss}|{sub} format per Pitfall 5
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: 'lti|https://canvas.test.instructure.com|lti-sub-student-01',
      }),
    );
  });

  it('second call with same externalId re-uses the existing Clerk user', async () => {
    getUserList.mockResolvedValueOnce({
      data: [{ id: 'user_clerk_existing_01' }],
      totalCount: 1,
    });
    createSignInToken.mockResolvedValueOnce({ token: 'ticket-existing-01' });

    const { clerkUserId } = await mintClerkTicketForLtiLaunch({
      iss: 'https://canvas.test.instructure.com',
      sub: 'lti-sub-student-01',
      email: 'student01@example.edu',
      name: 'Test Student',
      secretKey: 'sk_test_placeholder',
    });

    expect(clerkUserId).toBe('user_clerk_existing_01');
    expect(createUser).not.toHaveBeenCalled();
  });

  it('externalId uses the lti|{iss}|{sub} form (Pitfall 5)', async () => {
    getUserList.mockResolvedValueOnce({ data: [], totalCount: 0 });
    createUser.mockResolvedValueOnce({ id: 'user_x' });
    createSignInToken.mockResolvedValueOnce({ token: 't' });
    await mintClerkTicketForLtiLaunch({
      iss: 'https://moodle.test.example.edu',
      sub: 'moodle-user-42',
      email: undefined,
      name: 'No Email Instructor',
      secretKey: 'sk_test_placeholder',
    });
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: 'lti|https://moodle.test.example.edu|moodle-user-42',
      }),
    );
  });

  it('ticket is requested with expiresInSeconds: 60', async () => {
    getUserList.mockResolvedValueOnce({ data: [{ id: 'user_y' }], totalCount: 1 });
    createSignInToken.mockResolvedValueOnce({ token: 'ticket-y' });
    await mintClerkTicketForLtiLaunch({
      iss: 'https://canvas.test.instructure.com',
      sub: 'lti-sub-y',
      email: 'y@example.edu',
      name: 'Y',
      secretKey: 'sk_test_placeholder',
    });
    expect(createSignInToken).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInSeconds: 60 }),
    );
  });
});
