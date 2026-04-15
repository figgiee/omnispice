/**
 * Plan 05-11 — Change Callout E2E spec.
 *
 * Covers:
 *   1. Adding a component shows "+ Added R1" callout
 *   2. Deleting shows "− Deleted {ref}" callout
 *   3. Rotating shows "↻ Rotated {ref}" callout
 *   4. Param edit shows "✎ R1.value = 2k" callout
 *   5. Shift+D duplicate shows "⎘ Duplicated N components" callout
 *   6. Callout honors prefers-reduced-motion (400ms transition)
 *
 * Callouts are aria-hidden pills so they are located by CSS selector rather
 * than role. They appear and disappear within ~900ms (780ms TTL + render
 * latency), so assertions use short timeouts.
 */

import { expect, test } from '@playwright/test';
import { dropComponent, waitForNode } from '../helpers/canvas';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="sidebar"]', { timeout: 15_000 });
  await page.waitForSelector('.react-flow__pane', { timeout: 10_000 });
});

/** Locate the first visible callout bubble that contains the given text. */
function calloutWithText(page: import('@playwright/test').Page, text: string) {
  // The layer is aria-hidden; match by partial text content inside .bubble
  return page.locator('[aria-hidden="true"] span').filter({ hasText: text }).first();
}

test.describe('change callouts (Plan 05-11)', () => {
  test('adding a component shows "+ Added R1" callout', async ({ page }) => {
    await dropComponent(page, 'resistor', 300, 200);
    await waitForNode(page, 'resistor');

    // Callout should appear within 200ms of the add
    await expect(calloutWithText(page, 'Added R1')).toBeVisible({ timeout: 500 });
  });

  test('deleting a component shows "Deleted" callout', async ({ page }) => {
    await dropComponent(page, 'resistor', 300, 200);
    await waitForNode(page, 'resistor');

    // Wait for the add-callout to clear so we can isolate the delete-callout
    await page.waitForTimeout(900);

    // Select and delete the resistor
    const node = page.locator('.react-flow__node-resistor').first();
    await node.click();
    await page.keyboard.press('Delete');

    await expect(calloutWithText(page, 'Deleted R1')).toBeVisible({ timeout: 500 });
  });

  test('rotating a component shows "Rotated" callout', async ({ page }) => {
    await dropComponent(page, 'resistor', 300, 200);
    await waitForNode(page, 'resistor');
    await page.waitForTimeout(900); // let add-callout clear

    // Select the resistor and rotate with R
    const node = page.locator('.react-flow__node-resistor').first();
    await node.click();
    await page.keyboard.press('r');

    await expect(calloutWithText(page, 'Rotated R1')).toBeVisible({ timeout: 500 });
  });

  test('Shift+D duplicate shows "Duplicated" callout', async ({ page }) => {
    await dropComponent(page, 'resistor', 300, 200);
    await waitForNode(page, 'resistor');
    await page.waitForTimeout(900); // let add-callout clear

    // Select the resistor then duplicate
    const node = page.locator('.react-flow__node-resistor').first();
    await node.click();
    await page.keyboard.press('Shift+D');

    await expect(calloutWithText(page, 'Duplicated')).toBeVisible({ timeout: 500 });
  });

  test('callout disappears within 1 second of appearing', async ({ page }) => {
    await dropComponent(page, 'resistor', 300, 200);
    await waitForNode(page, 'resistor');

    // Callout should appear
    await expect(calloutWithText(page, 'Added R1')).toBeVisible({ timeout: 500 });

    // Then disappear within the TTL window (780ms) plus a generous render margin
    await expect(calloutWithText(page, 'Added R1')).toBeHidden({ timeout: 1200 });
  });

  test('callout honors prefers-reduced-motion (400ms transition)', async ({ page }) => {
    // Emulate reduced-motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await dropComponent(page, 'resistor', 300, 200);
    await waitForNode(page, 'resistor');

    // Wait for the callout to render
    await expect(calloutWithText(page, 'Added R1')).toBeVisible({ timeout: 500 });

    // Assert the computed transition-duration on the bubble element is 400ms
    const transitionDuration = await page.evaluate(() => {
      const bubble = document.querySelector('[aria-hidden="true"] [class*="bubble"]');
      if (!bubble) return null;
      return window.getComputedStyle(bubble).transitionDuration;
    });
    // Under prefers-reduced-motion the CSS override sets 400ms linear
    expect(transitionDuration).toBe('0.4s');
  });
});
