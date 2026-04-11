/**
 * OfflineBanner — top strip connectivity indicator.
 *
 * Plan 05-10 + UI-SPEC §9.3/§13 Open Q5:
 *   - Listens to `window.online` / `window.offline` events
 *   - Renders a warning strip when navigator.onLine is false
 *   - Dismissible with × button
 *   - Reappears automatically the next time the user goes offline
 *
 * The banner is mounted once at the App level, positioned fixed at the
 * top of the viewport below the toolbar. aria-live="polite" announces
 * the state change to screen readers without interrupting their current
 * speech.
 */

import { useEffect, useState } from 'react';
import styles from './OfflineBanner.module.css';

export function OfflineBanner() {
  // `navigator.onLine` reflects a best-effort browser heuristic — a true
  // return value does NOT guarantee connectivity (the browser may be on a
  // captive portal). We pair it with fetch-based health checks elsewhere,
  // but for the banner this is sufficient.
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
    };
    const goOffline = () => {
      setIsOnline(false);
      // Reset dismissal so the banner reappears on every fresh offline
      // event. This is the requested "reappears on next connection
      // loss" behavior.
      setDismissed(false);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (isOnline || dismissed) return null;

  return (
    <div
      className={styles.banner}
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
    >
      <span className={styles.text}>
        Working offline. Changes will sync when you reconnect.
      </span>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => setDismissed(true)}
        aria-label="Dismiss offline notice"
        data-testid="offline-banner-dismiss"
      >
        ×
      </button>
    </div>
  );
}
