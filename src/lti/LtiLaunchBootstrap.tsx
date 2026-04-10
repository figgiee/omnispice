import { useSignIn } from '@clerk/react';
import { useEffect, useState } from 'react';
import { useLtiStore } from '../store/ltiStore';
import { parseBootstrapQuery, redeemTicket } from './launchBootstrap';

/**
 * Legacy Clerk `useSignIn` return shape. Clerk v6 ships two parallel APIs:
 * the new SignalValue-style and the legacy shape. The ticket-strategy flow
 * still works against the legacy shape and that's what our test fixture
 * mocks, so we structurally cast the hook result to the legacy shape.
 */
interface LegacySignInHook {
  isLoaded: boolean;
  signIn?: {
    create: (params: { strategy: 'ticket'; ticket: string }) => Promise<{
      status: string;
      createdSessionId?: string | null;
    }>;
  };
  setActive: (params: { session: string }) => Promise<void>;
}

/**
 * LTI launch landing page.
 *
 * Renders a minimal "Signing you in..." splash while it redeems the
 * Clerk sign-in ticket from the URL. On success, sets the ltiStore flag
 * and navigates to the LMS's target_link_uri. On error, renders a
 * friendly error message with a retry hint.
 *
 * Invariant: this component never mounts the authed app UI itself — it
 * only redeems the ticket and calls window.location.replace so the main
 * App.tsx router can pick up the post-redemption state with a fresh
 * Clerk session. This avoids a flash of unauthenticated content.
 */
type Status = 'loading' | 'redirecting' | 'error';

export function LtiLaunchBootstrap() {
  const signInHook = useSignIn() as unknown as LegacySignInHook | null;
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const setFromLti = useLtiStore((s) => s.setFromLti);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { ticket, launchId, target, mode } = parseBootstrapQuery(window.location.search);

      if (!ticket) {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage('Missing ticket — please relaunch from your LMS.');
        }
        return;
      }

      // Guard: Clerk's useSignIn returns `{ isLoaded: false, signIn: undefined }`
      // until the ClerkProvider hydrates. We wait for isLoaded before calling
      // create() — but in tests the hook is mocked as `{ isLoaded: true, signIn: { create } }`.
      if (!signInHook?.isLoaded || !signInHook.signIn) {
        return;
      }

      const { signIn, setActive } = signInHook;
      const result = await redeemTicket(
        signIn as unknown as Parameters<typeof redeemTicket>[0],
        setActive as unknown as Parameters<typeof redeemTicket>[1],
        ticket,
      );

      if (cancelled) return;

      if (result.ok) {
        if (launchId) {
          setFromLti({ launchId, target, mode });
        }
        setStatus('redirecting');
        // Deep-link mode stays on /lti/bootstrap so the App router renders
        // the DeepLinkPickerPage. We strip the ticket param but keep
        // `mode=deeplink&launch=...` so the picker can read the launch id.
        //
        // Resource-link mode navigates to the LMS's target_link_uri.
        //
        // Using history.replaceState instead of location.assign(target)
        // because (a) Clerk's setActive has already put the session where
        // the rest of the SPA looks for it, and (b) replaceState updates
        // window.location.pathname in jsdom for tests while still behaving
        // correctly in a real browser.
        if (mode === 'deeplink' && launchId) {
          const pickerUrl = `/lti/bootstrap?mode=deeplink&launch=${encodeURIComponent(launchId)}`;
          window.history.replaceState({}, '', pickerUrl);
        } else {
          window.history.replaceState({}, '', target);
        }
        // Nudge the App.tsx pathname router to re-evaluate in production
        // by dispatching a popstate event. In jsdom, the assertions hit on
        // the updated location.pathname without the event.
        window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        setStatus('error');
        setErrorMessage(result.error);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [signInHook, setFromLti]);

  if (status === 'error') {
    return (
      <div
        role="alert"
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: 24,
          textAlign: 'center',
          background: '#0b0d12',
          color: '#dde',
        }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Cannot sign you in</h1>
        <p style={{ maxWidth: 480, marginBottom: 16 }}>{errorMessage}</p>
        <p style={{ opacity: 0.7, fontSize: 13 }}>
          Return to your LMS and click the OmniSpice link again.
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0b0d12',
        color: '#dde',
      }}
    >
      <p style={{ fontSize: 15 }}>Signing you in from your LMS...</p>
    </div>
  );
}
