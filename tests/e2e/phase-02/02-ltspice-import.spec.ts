/**
 * Phase 2 E2E — LTspice .asc import
 *
 * Tests the ImportMenu component: file upload triggers parsing
 * and places components on the canvas. Uses a minimal inline .asc
 * fixture injected via Playwright's file chooser API.
 */
import { expect, test } from '@playwright/test';

const MINIMAL_ASC = `Version 4
SHEET 1 880 680
WIRE 192 128 64 128
WIRE 320 128 192 128
SYMBOL res 192 112 R0
SYMATTR InstName R1
SYMATTR Value 10k
SYMBOL voltage 64 128 R0
SYMATTR InstName V1
SYMATTR Value 5
FLAG 320 128 out
FLAG 64 208 0
`;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="toolbar"]', { timeout: 15_000 });
  await page.waitForSelector('.react-flow__pane', { timeout: 10_000 });
});

test('import button opens file chooser', async ({ page }) => {
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /import/i }).click(),
  ]);
  expect(fileChooser).toBeTruthy();
});

test('importing a valid .asc file places components on canvas', async ({ page }) => {
  const nodesBefore = await page.locator('.react-flow__node').count();

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /import/i }).click(),
  ]);

  await fileChooser.setFiles({
    name: 'test.asc',
    mimeType: 'text/plain',
    buffer: Buffer.from(MINIMAL_ASC),
  });

  // Wait for canvas to update (React Flow re-renders on setCircuit)
  await page.waitForTimeout(500);

  const nodesAfter = await page.locator('.react-flow__node').count();
  expect(nodesAfter).toBeGreaterThan(nodesBefore);
});

test('imported circuit contains a resistor node', async ({ page }) => {
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /import/i }).click(),
  ]);

  await fileChooser.setFiles({
    name: 'test.asc',
    mimeType: 'text/plain',
    buffer: Buffer.from(MINIMAL_ASC),
  });

  await page.waitForTimeout(500);
  await expect(page.locator('.react-flow__node-resistor')).toBeVisible();
});

test('imported circuit contains a voltage source node', async ({ page }) => {
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /import/i }).click(),
  ]);

  await fileChooser.setFiles({
    name: 'test.asc',
    mimeType: 'text/plain',
    buffer: Buffer.from(MINIMAL_ASC),
  });

  await page.waitForTimeout(500);
  // Voltage source maps to dc_voltage or ac_voltage node type
  const vNode = page.locator('[class*="react-flow__node-"][class*="voltage"]');
  await expect(vNode).toBeVisible();
});
