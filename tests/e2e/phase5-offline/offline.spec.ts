/**
 * Phase 5 Plan 05-10 — offline / PWA Playwright suite.
 *
 * REQUIRED prerequisites:
 *   1. `pnpm build` produces dist/ including sw.js and the manifest
 *   2. `pnpm preview` (or another static server on port 4173) serves dist/
 *
 * Run with:
 *   pnpm build && pnpm preview &   # in a separate terminal
 *   pnpm exec playwright test --project=phase5-offline
 *
 * What we verify:
 *   - Test 1: Circuit state persists across an offline reload
 *   - Test 2: Going offline shows the OfflineBanner and dismissing hides it
 *   - Test 3: Going back online immediately removes the banner
 *
 * Note on SW registration: vite-plugin-pwa emits sw.js only in the
 * production build, so `pnpm preview` is the correct server here.
 * `navigator.serviceWorker.ready` resolves once the SW has taken
 * control of the page, which is our gate for "offline is viable".
 */

import { expect, test } from '@playwright/test';
import { dropComponent, nodeCount, waitForNode } from '../helpers/canvas';

test.beforeEach(async ({ page, context }) => {
  // Make sure we start each test online (previous run may have left
  // context offline if the test crashed mid-flight).
  await context.setOffline(false);
  await page.goto('/');
  await page.waitForSelector('[data-testid="sidebar"]', { timeout: 20_000 });
  await page.waitForSelector('.react-flow__pane', { timeout: 10_000 });

  // Wait for the service worker to be active before measuring offline
  // behavior. In dev mode this returns immediately (no SW); in preview
  // mode this ensures the install/activate cycle has completed.
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.ready;
      } catch {
        // Dev mode — no SW. Tests that depend on the SW will skip.
      }
    }
  });
});

test.describe('Phase 5 offline / PWA', () => {
  test('reload while offline preserves circuit state via IndexedDB persist', async ({
    page,
    context,
  }) => {
    // Place one resistor and one capacitor so we have something to
    // observe surviving the reload.
    await dropComponent(page, 'resistor', 300, 200);
    await waitForNode(page, 'resistor');
    await dropComponent(page, 'capacitor', 500, 200);
    await waitForNode(page, 'capacitor');

    // Wait briefly for zustand persist middleware to flush to idb-keyval.
    // The persist write is async — 200ms is comfortably above the
    // typical microtask + idb write window observed in dev.
    await page.waitForTimeout(400);
    const before = await nodeCount(page);
    expect(before).toBeGreaterThanOrEqual(2);

    // Go offline and reload. The app shell comes from the SW cache, and
    // circuit state rehydrates from idb-keyval via the zustand persist
    // middleware we wired in Task 2.
    await context.setOffline(true);
    await page.reload();
    await page.waitForSelector('[data-testid="sidebar"]', { timeout: 20_000 });
    await page.waitForSelector('.react-flow__pane', { timeout: 10_000 });

    // Allow the rehydrate promise to settle.
    await page.waitForTimeout(500);

    const after = await nodeCount(page);
    expect(after).toBe(before);
  });

  test('offline banner appears when network drops and hides after dismiss', async ({
    page,
    context,
  }) => {
    // Ensure the banner is not showing before we kill the network.
    await expect(page.getByTestId('offline-banner')).toBeHidden();

    await context.setOffline(true);
    // The browser's onOffline event fires as soon as Playwright flips
    // the network state. React state update is synchronous after that.
    await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('status')).toContainText(/working offline/i);

    // Dismiss the banner and confirm it disappears.
    await page.getByTestId('offline-banner-dismiss').click();
    await expect(page.getByTestId('offline-banner')).toBeHidden();
  });

  test('going back online removes the offline banner', async ({ page, context }) => {
    // Start online → offline → banner visible → back online → banner gone.
    await context.setOffline(true);
    await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 3_000 });

    await context.setOffline(false);
    await expect(page.getByTestId('offline-banner')).toBeHidden({ timeout: 3_000 });
  });
});
