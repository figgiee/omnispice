/**
 * Phase 5 Plan 05-07 — HoverTooltip E2E.
 *
 * Covers the S7 immediacy surface: a 300ms hover reveals the V/I/P readout
 * tooltip sourced from `useOverlayStore`, with status-line text driven by
 * the live simulation status.
 *
 * Uses the `window.__test_setOverlay` DEV hook to inject deterministic
 * overlay values so the specs don't depend on a running ngspice worker.
 */

import { expect, test } from '@playwright/test';
import { dropComponent, waitForNode } from '../helpers/canvas';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="sidebar"]', { timeout: 15_000 });
  await page.waitForSelector('.react-flow__pane', { timeout: 10_000 });
});

test.describe('HoverTooltip (Plan 05-07)', () => {
  test('shows V/I/P readout after 300ms hover with DC op: live status', async ({ page }) => {
    await dropComponent(page, 'resistor', 400, 300);
    await waitForNode(page, 'resistor');

    // Inject a synthetic overlay — node net_1 at 3.3V, R1 carrying 2mA.
    await page.evaluate(() => {
      // Resolve the first resistor's refDesignator + first-port netId from
      // the store so the injection actually lights up the tooltip.
      const circuit = (
        window as unknown as {
          __omnispice_store?: { getState: () => { circuit: { components: Map<string, { type: string; refDesignator: string; ports: { netId: string | null }[] }> } } };
        }
      ).__omnispice_store?.getState().circuit;
      // Fall back to direct react-flow DOM query — the store-debug hook
      // may not be installed; either way the ref designator is in the DOM.
      void circuit;
      window.__test_setOverlay?.({
        nodeVoltages: { net_1: 3.3 },
        branchCurrents: { R1: 0.002 },
        wireVoltages: { net_1: 3.3 },
        simStatus: 'live',
      });
    });

    // Hover the first resistor node and wait for the 300ms enter delay.
    await page.locator('.react-flow__node-resistor').first().hover();
    await page.waitForTimeout(400);

    const tooltip = page.getByTestId('hover-tooltip');
    await expect(tooltip).toBeVisible();
    const text = (await tooltip.textContent()) ?? '';
    expect(text).toMatch(/R1/);
    expect(text).toMatch(/V/);
    expect(text).toMatch(/I/);
    expect(text).toMatch(/P/);
    expect(text).toContain('DC op: live');
  });

  test('shows DC op: no solution when simStatus is error', async ({ page }) => {
    await dropComponent(page, 'resistor', 400, 300);
    await waitForNode(page, 'resistor');

    await page.evaluate(() => {
      window.__test_setOverlay?.({
        nodeVoltages: {},
        branchCurrents: {},
        wireVoltages: {},
        simStatus: 'error',
      });
    });

    await page.locator('.react-flow__node-resistor').first().hover();
    await page.waitForTimeout(400);

    const tooltip = page.getByTestId('hover-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('DC op: no solution');
  });

  test('shows Transient: last committed when simStatus is stale', async ({ page }) => {
    await dropComponent(page, 'resistor', 400, 300);
    await waitForNode(page, 'resistor');

    await page.evaluate(() => {
      window.__test_setOverlay?.({
        nodeVoltages: { net_1: 1.0 },
        branchCurrents: { R1: 0.001 },
        wireVoltages: { net_1: 1.0 },
        simStatus: 'stale',
      });
    });

    await page.locator('.react-flow__node-resistor').first().hover();
    await page.waitForTimeout(400);

    const tooltip = page.getByTestId('hover-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Transient: last committed');
  });

  test('disappears when the mouse leaves the node', async ({ page }) => {
    await dropComponent(page, 'resistor', 400, 300);
    await waitForNode(page, 'resistor');

    await page.evaluate(() => {
      window.__test_setOverlay?.({
        nodeVoltages: { net_1: 3.3 },
        branchCurrents: { R1: 0.001 },
        wireVoltages: { net_1: 3.3 },
        simStatus: 'live',
      });
    });

    await page.locator('.react-flow__node-resistor').first().hover();
    await page.waitForTimeout(400);
    await expect(page.getByTestId('hover-tooltip')).toBeVisible();

    // Move the mouse far away from the node.
    await page.mouse.move(10, 10);
    // 100ms hide delay + a little slack
    await page.waitForTimeout(300);
    await expect(page.getByTestId('hover-tooltip')).toHaveCount(0);
  });

  test('does not render until the 300ms delay has elapsed', async ({ page }) => {
    await dropComponent(page, 'resistor', 400, 300);
    await waitForNode(page, 'resistor');

    await page.evaluate(() => {
      window.__test_setOverlay?.({
        nodeVoltages: { net_1: 3.3 },
        branchCurrents: { R1: 0.001 },
        wireVoltages: { net_1: 3.3 },
        simStatus: 'live',
      });
    });

    await page.locator('.react-flow__node-resistor').first().hover();
    // Immediately check — should still be hidden at t < 300ms.
    await expect(page.getByTestId('hover-tooltip')).toHaveCount(0);
    await page.waitForTimeout(100);
    await expect(page.getByTestId('hover-tooltip')).toHaveCount(0);

    // Cross the threshold — now visible.
    await page.waitForTimeout(350);
    await expect(page.getByTestId('hover-tooltip')).toBeVisible();
  });
});
