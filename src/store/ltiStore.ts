import { create } from 'zustand';

/**
 * LTI session slice.
 *
 * Tracks whether the current SPA session originated from an LTI launch so
 * downstream UI can hide affordances that don't make sense inside an LMS
 * iframe (e.g. "Sign in with Google", "Create account", external-link
 * footers) and can tag submissions with the originating launch id for
 * grade passback (04-03).
 */

interface LtiState {
  /** True if we redeemed an LTI-minted Clerk ticket on this load. */
  isFromLti: boolean;
  /** Opaque launch id from the Worker's /lti/launch audit row. */
  launchId: string | null;
  /** Target link URI the SPA navigated to after ticket redemption. */
  targetLinkUri: string | null;
  /** 'resource' = LtiResourceLinkRequest, 'deeplink' = LtiDeepLinkingRequest */
  mode: 'resource' | 'deeplink' | null;

  setFromLti: (args: {
    launchId: string;
    target: string;
    mode?: 'resource' | 'deeplink';
  }) => void;
  clear: () => void;
}

export const useLtiStore = create<LtiState>()((set) => ({
  isFromLti: false,
  launchId: null,
  targetLinkUri: null,
  mode: null,

  setFromLti: ({ launchId, target, mode }) =>
    set({
      isFromLti: true,
      launchId,
      targetLinkUri: target,
      mode: mode ?? 'resource',
    }),
  clear: () =>
    set({
      isFromLti: false,
      launchId: null,
      targetLinkUri: null,
      mode: null,
    }),
}));
