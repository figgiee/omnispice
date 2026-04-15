/**
 * Plan 05-09 — collab identity + room derivation.
 *
 * Two small helpers kept outside `useCollabProvider` so the Canvas can
 * wire them without dragging Clerk imports into the hook module (which
 * the unit tests mock yjs inside of).
 *
 *   - `useCollabRoomId()` — Returns the collaboration room id. Plan 05-09
 *     scope: if the URL contains `/circuit/:id`, use that; otherwise fall
 *     back to a stable "default-room" id so two tabs on `/` still join the
 *     same room for smoke testing. Tests can override via
 *     `window.__OMNISPICE_FORCE_ROOM`.
 *
 *   - `useCollabUser()` — Returns `{ id, name }` from Clerk when signed
 *     in, otherwise a stable-per-tab guest fallback. Two-browser E2E
 *     tests can inject via `window.__OMNISPICE_FORCE_USER` to bypass Clerk
 *     entirely without wiring a Clerk mock provider.
 */

import { useEffect, useMemo, useState } from 'react';
import type { CollabUser } from './useCollabProvider';

declare global {
  interface Window {
    /** Test override for the collab room id. */
    __OMNISPICE_FORCE_ROOM?: string;
    /** Test override for the collab user. Bypasses Clerk for E2E. */
    __OMNISPICE_FORCE_USER?: CollabUser;
  }
}

/** Parse `/circuit/:id` out of the current URL, or null. */
function parseCircuitId(pathname: string): string | null {
  const match = pathname.match(/^\/circuit\/([a-zA-Z0-9_-]+)\/?$/);
  return match?.[1] ?? null;
}

const DEFAULT_ROOM = 'default-room';

export function useCollabRoomId(): string {
  // Room id has to be reactive to popstate so SPA nav between circuits
  // remounts the provider. In Plan 05-09 there is no in-app routing yet
  // so this mostly returns `default-room`, but the scaffolding is in
  // place for Phase 6 CRDT graduation.
  const [pathname, setPathname] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/',
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return useMemo(() => {
    if (typeof window !== 'undefined' && window.__OMNISPICE_FORCE_ROOM) {
      return window.__OMNISPICE_FORCE_ROOM;
    }
    return parseCircuitId(pathname) ?? DEFAULT_ROOM;
  }, [pathname]);
}

/**
 * Resolve the collab user. Reads from `window.__OMNISPICE_FORCE_USER` first
 * (for E2E + dev), then falls back to a stable-per-tab guest id so users
 * can smoke-test presence without signing in. Clerk integration is wired
 * by the caller passing in a `{ id, name }` via the `overrideUser` param
 * — keeping Clerk out of this module lets the hook unit tests mock yjs
 * without also mocking Clerk.
 */
export function useCollabUser(overrideUser?: CollabUser | null): CollabUser | null {
  return useMemo<CollabUser | null>(() => {
    if (overrideUser) return overrideUser;
    if (typeof window !== 'undefined' && window.__OMNISPICE_FORCE_USER) {
      return window.__OMNISPICE_FORCE_USER;
    }
    // Guest fallback: stable per sessionStorage entry so a tab refresh
    // keeps the same identity (= same color).
    if (typeof sessionStorage !== 'undefined') {
      let guestId = sessionStorage.getItem('omnispice-guest-id');
      if (!guestId) {
        guestId = `guest-${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem('omnispice-guest-id', guestId);
      }
      return { id: guestId, name: 'Guest' };
    }
    return { id: 'guest-ssr', name: 'Guest' };
  }, [overrideUser]);
}
