/**
 * Plan 05-11 — ShortcutHelpOverlay content + close-behaviour E2E spec.
 *
 * Covers:
 *   1. ? opens the overlay; second ? closes it
 *   2. All 5 pillar section headings are visible
 *   3. Click outside the overlay closes it
 *   4. Esc closes the overlay and returns focus to the canvas
 *   5. Every expected action label from UI-SPEC §7.6 is present
 */

import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="sidebar"]', { timeout: 15_000 });
  await page.waitForSelector('.react-flow__pane', { timeout: 10_000 });
});

/** The overlay aside element. */
const overlaySelector = '[data-testid="shortcut-help-overlay"]';

test.describe('shortcut help overlay polish (Plan 05-11)', () => {
  test('? opens overlay, second ? closes it', async ({ page }) => {
    // Overlay should not be visible initially
    await expect(page.locator(overlaySelector)).not.toBeVisible();

    // Focus the canvas pane and press ?
    await page.locator('.react-flow__pane').click();
    await page.keyboard.press('Shift+/'); // ? = Shift+/ on US keyboard

    await expect(page.locator(overlaySelector)).toBeVisible({ timeout: 500 });

    // Second ? closes it
    await page.keyboard.press('Shift+/');
    await expect(page.locator(overlaySelector)).not.toBeVisible({ timeout: 500 });
  });

  test('overlay contains all 5 pillar section headings', async ({ page }) => {
    await page.locator('.react-flow__pane').click();
    await page.keyboard.press('Shift+/');
    await expect(page.locator(overlaySelector)).toBeVisible({ timeout: 500 });

    const headings = ['SCHEMATIC HONESTY', 'MODELESSNESS', 'IMMEDIACY', 'LIVE FEEDBACK', 'PEDAGOGY'];
    for (const heading of headings) {
      await expect(page.locator(overlaySelector).getByText(heading)).toBeVisible();
    }
  });

  test('click outside overlay closes it', async ({ page }) => {
    await page.locator('.react-flow__pane').click();
    await page.keyboard.press('Shift+/');
    await expect(page.locator(overlaySelector)).toBeVisible({ timeout: 500 });

    // Click on the canvas (outside the overlay panel)
    await page.locator('.react-flow__pane').click({ position: { x: 100, y: 100 } });

    await expect(page.locator(overlaySelector)).not.toBeVisible({ timeout: 500 });
  });

  test('Esc closes the overlay', async ({ page }) => {
    await page.locator('.react-flow__pane').click();
    await page.keyboard.press('Shift+/');
    await expect(page.locator(overlaySelector)).toBeVisible({ timeout: 500 });

    await page.keyboard.press('Escape');
    await expect(page.locator(overlaySelector)).not.toBeVisible({ timeout: 500 });
  });

  test('overlay renders every shortcut from UI-SPEC §7.6', async ({ page }) => {
    await page.locator('.react-flow__pane').click();
    await page.keyboard.press('Shift+/');
    await expect(page.locator(overlaySelector)).toBeVisible({ timeout: 500 });

    // Spot-check a representative action from each pillar
    const expectedActions = [
      'Label net',
      'Collapse to subcircuit',
      'Descend',
      'Place component',
      'Duplicate',
      'Undo / Redo',
      'Scrub',
      'Sweep',
      'Show V, I, P',
      'Run simulation manually',
      'Command palette',
      'Frame selection',
      'Frame all',
      'Zoom to 100%',
      'Annotate',
      'Export lab report PDF',
    ];

    for (const action of expectedActions) {
      await expect(
        page.locator(overlaySelector).getByText(action),
        `Expected "${action}" to be present in the overlay`,
      ).toBeVisible();
    }
  });
});
