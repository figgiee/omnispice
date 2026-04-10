/**
 * Client-side LTI launch ticket redemption.
 *
 * The Worker's /lti/launch handler returns an HTML bootstrap page that
 * navigates to /lti/bootstrap?ticket=...&launch=...&target=...&mode=...
 * The React <LtiLaunchBootstrap /> component calls `redeemTicket` on mount
 * and, on success, navigates to the target URL.
 *
 * Using signIn.create({ strategy: 'ticket', ticket }) sidesteps third-party
 * cookies (the session ends up in the OmniSpice origin's own storage), so
 * iframe embeds in Canvas/Moodle do NOT need third-party-cookie support.
 */

/** Minimal structural type for Clerk's SignInResource.create method. */
export interface SignInLike {
  create: (params: {
    strategy: 'ticket';
    ticket: string;
  }) => Promise<{
    status: string;
    createdSessionId?: string | null;
  }>;
}

/** Clerk setActive signature — accepts the session id created by ticket redemption. */
export type SetActiveLike = (params: { session: string }) => Promise<void>;

export type RedeemResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

/**
 * Redeem a Clerk sign-in ticket. Returns an ok/error tagged union rather
 * than throwing so the caller can render a friendly error page.
 */
export async function redeemTicket(
  signIn: SignInLike,
  setActive: SetActiveLike,
  ticket: string,
): Promise<RedeemResult> {
  if (!ticket) {
    return { ok: false, error: 'Missing ticket' };
  }
  try {
    const attempt = await signIn.create({ strategy: 'ticket', ticket });
    if (attempt.status === 'complete' && attempt.createdSessionId) {
      await setActive({ session: attempt.createdSessionId });
      return { ok: true, sessionId: attempt.createdSessionId };
    }
    return {
      ok: false,
      error: `Ticket redemption not complete (status=${attempt.status})`,
    };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error).message ?? 'Ticket redemption failed',
    };
  }
}

/**
 * Parse the bootstrap URL query string produced by the Worker.
 * Accepts either `target_link_uri` or `target` as the navigation target
 * because the Worker uses `target` but LTI spec uses `target_link_uri`.
 */
export function parseBootstrapQuery(search: string): {
  ticket: string | null;
  launchId: string | null;
  target: string;
  mode: 'resource' | 'deeplink';
} {
  const params = new URLSearchParams(search);
  const ticket = params.get('ticket');
  const launchId = params.get('launch');
  const target =
    params.get('target_link_uri') ?? params.get('target') ?? '/';
  const modeRaw = params.get('mode');
  const mode: 'resource' | 'deeplink' =
    modeRaw === 'deeplink' ? 'deeplink' : 'resource';
  return { ticket, launchId, target, mode };
}
