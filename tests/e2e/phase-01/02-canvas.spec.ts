/**
 * Phase 1 E2E — Canvas interactions
 *
 * Covers: drop components onto canvas, component renders with correct
 * node type, undo removes last component, rotation.
 */
import { test, expect } from '@playwright/test';
import { dropComponent, waitForNode, nodeCount } from '../helpers/canvas';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="sidebar"]', { timeout: 15_000 });
  // Wait for React Flow to be fully initialized
  await page.waitForSelector('.react-flow__pane', { timeout: 10_000 });
});

test('drop resistor onto canvas creates a node', async ({ page }) => {
  const before = await nodeCount(page);
  await dropComponent(page, 'resistor', 300, 200);
  await waitForNode(page, 'resistor');
  const after = await nodeCount(page);
  expect(after).toBe(before + 1);
});

test('drop capacitor onto canvas creates a node', async ({ page }) => {
  await dropComponent(page, 'capacitor', 450, 200);
  await waitForNode(page, 'capacitor');
});

test('drop dc_voltage source onto canvas creates a node', async ({ page }) => {
  await dropComponent(page, 'dc_voltage', 600, 200);
  await waitForNode(page, 'dc_voltage');
});

test('drop ground onto canvas creates a node', async ({ page }) => {
  await dropComponent(page, 'ground', 600, 350);
  await waitForNode(page, 'ground');
});

test('undo removes the last placed component', async ({ page }) => {
  await dropComponent(page, 'resistor', 300, 200);
  await waitForNode(page, 'resistor');
  const before = await nodeCount(page);

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);

  const after = await nodeCount(page);
  expect(after).toBe(before - 1);
});

test('redo restores undone component', async ({ page }) => {
  await dropComponent(page, 'resistor', 300, 200);
  await waitForNode(page, 'resistor');
  const before = await nodeCount(page);

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);
  await page.keyboard.press('Control+Shift+Z');
  await page.waitForTimeout(200);

  const after = await nodeCount(page);
  expect(after).toBe(before);
});

test('clicking component selects it and shows Properties tab', async ({ page }) => {
  await dropComponent(page, 'resistor', 300, 250);
  await waitForNode(page, 'resistor');

  const node = page.locator('.react-flow__node-resistor').first();
  await node.click();

  // Properties tab should become active
  const panel = page.getByTestId('bottom-panel');
  await expect(panel.locator('[aria-selected="true"]')).toContainText('Properties');
});

test('delete key removes selected component', async ({ page }) => {
  await dropComponent(page, 'resistor', 300, 200);
  await waitForNode(page, 'resistor');

  const node = page.locator('.react-flow__node-resistor').first();
  await node.click();
  const before = await nodeCount(page);

  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);

  const after = await nodeCount(page);
  expect(after).toBe(before - 1);
});
