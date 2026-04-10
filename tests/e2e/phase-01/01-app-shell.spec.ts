/**
 * Phase 1 E2E — App shell and sidebar
 *
 * Covers: dark theme, sidebar categories, component search,
 * toolbar rendering, bottom panel tabs.
 */
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="sidebar"]', { timeout: 15_000 });
});

test('app renders with dark background', async ({ page }) => {
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // #1a1a2e → rgb(26, 26, 46)
  expect(bg).toBe('rgb(26, 26, 46)');
});

test('toolbar renders logo and controls', async ({ page }) => {
  const toolbar = page.getByTestId('toolbar');
  await expect(toolbar).toBeVisible();
  await expect(toolbar).toContainText('OmniSpice');
  await expect(page.getByTestId('run-simulation-btn')).toBeVisible();
});

test('sidebar shows all 4 component categories', async ({ page }) => {
  const sidebar = page.getByTestId('sidebar');
  await expect(sidebar).toContainText('Passives');
  await expect(sidebar).toContainText('Semiconductors');
  await expect(sidebar).toContainText('Sources');
  await expect(sidebar).toContainText('Op-Amps');
});

test('sidebar lists common components', async ({ page }) => {
  const sidebar = page.getByTestId('sidebar');
  await expect(sidebar).toContainText('Resistor');
  await expect(sidebar).toContainText('Capacitor');
  await expect(sidebar).toContainText('DC Voltage Source');
  await expect(sidebar).toContainText('Ground');
});

test('searching "741" surfaces op-amp components', async ({ page }) => {
  const search = page.getByPlaceholder(/search components/i);
  await search.fill('741');
  const sidebar = page.getByTestId('sidebar');
  await expect(sidebar).toContainText('uA741');
  await expect(sidebar).toContainText('LM741');
  // Passives should not appear
  await expect(sidebar).not.toContainText('Resistor');
});

test('searching "res" surfaces Resistor', async ({ page }) => {
  const search = page.getByPlaceholder(/search components/i);
  await search.fill('res');
  await expect(page.getByTestId('sidebar')).toContainText('Resistor');
});

test('bottom panel shows Errors, Waveform, Properties tabs', async ({ page }) => {
  const panel = page.getByTestId('bottom-panel');
  await expect(panel).toContainText('Errors');
  await expect(panel).toContainText('Waveform');
  await expect(panel).toContainText('Properties');
});

test('canvas pane is present', async ({ page }) => {
  await expect(page.locator('.react-flow__pane')).toBeVisible();
});
