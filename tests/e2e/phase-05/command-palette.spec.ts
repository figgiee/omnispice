/**
 * Phase 5 E2E — Command Palette (Plan 05-06)
 *
 * Covers the Ctrl+K front door, locked decision #3 disambiguation,
 * fuzzy filter, template insertion, and action dispatch.
 */

import { expect, test } from '@playwright/test';
import { nodeCount } from '../helpers/canvas';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="sidebar"]', { timeout: 15_000 });
  await page.waitForSelector('.react-flow__pane', { timeout: 10_000 });
});

test('Ctrl+K with canvas focus opens the command palette', async ({ page }) => {
  // Click an empty canvas spot to move focus off the sidebar.
  await page.locator('.react-flow__pane').first().click({ position: { x: 400, y: 300 } });
  await page.keyboard.press('Control+K');

  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toBeVisible();
  await expect(page.getByPlaceholder(/Search actions, circuits, templates/i)).toBeVisible();
});

test('Ctrl+K with sidebar library input focused does NOT open the palette', async ({ page }) => {
  // Focus the sidebar library search input directly.
  const libraryInput = page.getByPlaceholder(/Search components/i);
  await libraryInput.click();
  await expect(libraryInput).toBeFocused();

  await page.keyboard.press('Control+K');

  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toHaveCount(0);
  // Library input should still be focused (sidebar claimed the shortcut).
  await expect(libraryInput).toBeFocused();
});

test('Typing filters palette results', async ({ page }) => {
  await page.locator('.react-flow__pane').first().click({ position: { x: 400, y: 300 } });
  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toBeVisible();

  await page.keyboard.type('voltage');

  // The Voltage Divider template row should survive the filter.
  await expect(dialog.getByText('Voltage Divider')).toBeVisible();
  // An unrelated action like "Keyboard shortcut reference" should not.
  await expect(dialog.getByText('Keyboard shortcut reference')).toHaveCount(0);
});

test('Enter selects a template and inserts components', async ({ page }) => {
  const before = await nodeCount(page);
  await page.locator('.react-flow__pane').first().click({ position: { x: 400, y: 300 } });
  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toBeVisible();

  await page.keyboard.type('divider');
  // cmdk auto-selects the first matching row; Enter activates it.
  await page.keyboard.press('Enter');

  await expect(dialog).toHaveCount(0);
  // Voltage Divider ships with 4 components.
  await page.waitForFunction(
    (seed) => document.querySelectorAll('.react-flow__node').length >= seed + 4,
    before,
    { timeout: 5_000 },
  );
  const after = await nodeCount(page);
  expect(after - before).toBeGreaterThanOrEqual(4);
});

test('Escape closes the palette', async ({ page }) => {
  await page.locator('.react-flow__pane').first().click({ position: { x: 400, y: 300 } });
  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('Run DC Operating Point action fires the omnispice:run-simulation event', async ({ page }) => {
  // Attach an in-page listener that writes to window for the test to observe.
  await page.evaluate(() => {
    const w = window as unknown as { __phase5RunEvents: unknown[] };
    w.__phase5RunEvents = [];
    window.addEventListener('omnispice:run-simulation', (event) => {
      w.__phase5RunEvents.push((event as CustomEvent).detail);
    });
  });

  await page.locator('.react-flow__pane').first().click({ position: { x: 400, y: 300 } });
  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toBeVisible();

  await page.keyboard.type('operating point');
  await page.keyboard.press('Enter');

  await expect(dialog).toHaveCount(0);
  const events = await page.evaluate(() => {
    const w = window as unknown as { __phase5RunEvents: unknown[] };
    return w.__phase5RunEvents;
  });
  expect(events.length).toBeGreaterThanOrEqual(1);
  expect(events[0]).toEqual({ analysis: 'dc_op' });
});
