import { createClerkClient } from '@clerk/backend';

/**
 * Mint a short-lived Clerk sign-in ticket for an LTI 1.3 launch.
 *
 * Per CONTEXT.md: one Clerk identity per (iss, sub) tuple, keyed by
 * externalId = `lti|{iss}|{sub}` (Pitfall 5 in 04-RESEARCH.md).
 *
 * Flow:
 *  1. Look up existing Clerk user by externalId
 *  2. If missing → createUser (skipPasswordRequirement, role=student)
 *  3. Mint a 60-second sign-in token — industry standard for auth tickets
 *  4. Return ticket + clerkUserId for the bootstrap page to redeem
 *
 * The function is intentionally not coupled to Hono — tests inject the
 * secretKey directly so they don't need a full request context.
 */

export interface MintLtiTicketArgs {
  /** LMS issuer (the `iss` claim from the verified id_token). */
  iss: string;
  /** LMS user sub (the `sub` claim from the verified id_token). */
  sub: string;
  /** Optional email from the id_token — used only at create time. */
  email: string | undefined;
  /** Optional display name from the id_token — split into first/last. */
  name: string | undefined;
  /** Clerk secret key (env.CLERK_SECRET_KEY at runtime). */
  secretKey: string;
}

export interface MintLtiTicketResult {
  /** Single-use ticket redeemed by signIn.create({strategy:'ticket', ticket}) */
  ticket: string;
  /** Clerk user id — useful for downstream lti_launches audit rows. */
  clerkUserId: string;
}

export async function mintClerkTicketForLtiLaunch(
  args: MintLtiTicketArgs,
): Promise<MintLtiTicketResult> {
  const { iss, sub, email, name, secretKey } = args;
  const clerk = createClerkClient({ secretKey });

  // Pitfall 5: the externalId MUST be `lti|{iss}|{sub}` and not just sub,
  // because the same sub value can collide across LMSes.
  const externalId = `lti|${iss}|${sub}`;

  // Look up existing user. Clerk v3.2.8 users.getUserList supports
  // externalId: string[] filter (confirmed via research doc Pattern 3).
  const existing = await clerk.users.getUserList({
    externalId: [externalId],
    limit: 1,
  });

  let user = existing.data[0];
  if (!user) {
    // Create on first launch. We pass skipPasswordRequirement because the
    // LMS is the only credential store for this identity.
    const firstName = name?.split(' ')[0];
    const lastNameParts = name?.split(' ').slice(1) ?? [];
    const lastName = lastNameParts.length > 0 ? lastNameParts.join(' ') : undefined;

    user = await clerk.users.createUser({
      externalId,
      firstName,
      lastName,
      emailAddress: email ? [email] : undefined,
      publicMetadata: { role: 'student', ltiIss: iss },
      skipPasswordRequirement: true,
    });
  }

  // Mint the short-lived ticket. 60 seconds is the industry standard —
  // long enough for the HTML bootstrap to hand off to Clerk's SPA redemption,
  // short enough to be useless if intercepted.
  const ticket = await clerk.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 60,
  });

  return {
    ticket: ticket.token,
    clerkUserId: user.id,
  };
}
