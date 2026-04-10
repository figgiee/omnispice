/**
 * Phase 2 E2E — Toolbar feature presence (auth-independent)
 *
 * Tests the Phase 2 toolbar additions that render regardless of auth state:
 * OverlayToggle, ExportMenu, ImportMenu, UserMenu.
 * Auth-gated items (SaveButton, My Circuits) are tested structurally only.
 */
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="toolbar"]', { timeout: 15_000 });
});

test('overlay toggle button is visible in toolbar', async ({ page }) => {
  // OverlayToggle renders an Eye/EyeOff button (data-testid or aria-label)
  const toggle = page.getByRole('button', { name: /overlay|eye/i });
  await expect(toggle).toBeVisible();
});

test('export button is visible in toolbar', async ({ page }) => {
  const exportBtn = page.getByRole('button', { name: /export/i });
  await expect(exportBtn).toBeVisible();
});

test('export menu opens with PNG, CSV, Netlist options', async ({ page }) => {
  const exportBtn = page.getByRole('button', { name: /export/i });
  await exportBtn.click();

  await expect(page.getByRole('menuitem', { name: /png/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /csv/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /netlist/i })).toBeVisible();
});

test('CSV export is disabled when no simulation results', async ({ page }) => {
  const exportBtn = page.getByRole('button', { name: /export/i });
  await exportBtn.click();

  const csvOption = page.getByRole('menuitem', { name: /csv/i });
  // CSV should be disabled (aria-disabled or pointer-events: none) before simulation
  const isDisabled =
    (await csvOption.getAttribute('aria-disabled')) === 'true' ||
    (await csvOption.evaluate((el) => (el as HTMLElement).style.pointerEvents)) === 'none' ||
    (await csvOption.evaluate((el) => (el as HTMLElement).hasAttribute('disabled')));
  expect(isDisabled).toBe(true);
});

test('import menu button is visible in toolbar', async ({ page }) => {
  const importBtn = page.getByRole('button', { name: /import/i });
  await expect(importBtn).toBeVisible();
});

test('user menu / sign-in button is visible in toolbar', async ({ page }) => {
  // UserMenu renders sign-in button when signed out
  const toolbar = page.getByTestId('toolbar');
  // Either "Sign In" text or a user button (when signed in) should be present
  await expect(toolbar.getByRole('button').last()).toBeVisible();
});

test('overlay toggle disables when no simulation data', async ({ page }) => {
  // With no simulation results, OverlayToggle should be disabled
  const toggle = page.getByRole('button', { name: /overlay|eye/i });
  const isDisabled = await toggle.evaluate((el) => (el as HTMLButtonElement).disabled);
  expect(isDisabled).toBe(true);
});
