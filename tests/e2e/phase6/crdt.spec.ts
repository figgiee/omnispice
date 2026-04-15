/**
 * Plan 06-05 — Phase 6 Circuit CRDT E2E tests.
 *
 * Two-browser tests require a live Yjs WebSocket server (wrangler dev on port
 * 8787) and are therefore skipped in CI. Single-browser smoke tests verify the
 * CRDT plumbing is wired and can run against the standard pnpm dev server.
 *
 * Run manually (local only, two-browser suite):
 *   wrangler dev worker          # terminal 1 — starts y-durableobjects at :8787
 *   pnpm dev --port 5175         # terminal 2 — app dev server
 *   pnpm exec playwright test --project=phase6 tests/e2e/phase6/crdt.spec.ts
 *
 * CI smoke only (no wrangler dev needed):
 *   pnpm exec playwright test --project=phase6 -g "CI smoke"
 */

import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { dropComponent } from '../helpers/canvas';

const CIRCUIT_ID = 'e2e-phase6-crdt';
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5175';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Open a fresh browser context pointing at the shared CRDT circuit room. */
async function openUserContext(
  browser: Browser,
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}/?circuitId=${CIRCUIT_ID}`);
  // Wait for React Flow canvas to be ready.
  await page.waitForSelector('.react-flow__renderer', { state: 'visible', timeout: 15_000 });
  // Wait for the Yjs provider 'sync' event — signalled via a testing-only DOM
  // attribute set in useCollabProvider.ts:onSync.
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-collab-connected') === 'true',
    { timeout: 8_000 },
  );
  return { ctx, page };
}

/**
 * Place a resistor on the canvas via the DnD helper (mirrors existing E2E
 * pattern from tests/e2e/helpers/canvas.ts). Returns the data-id of the newly
 * added node.
 *
 * We use dropComponent rather than the 'R' keyboard shortcut because the
 * shortcut behaviour differs across Phase 5 plan revisions, while the DnD
 * event path is stable and explicitly tested in earlier suites.
 */
async function placeResistor(page: Page, x = 300, y = 250): Promise<string> {
  const before = await page.locator('.react-flow__node').count();
  await dropComponent(page, 'resistor', x, y);
  // Wait for the node to appear in the DOM.
  await page.waitForFunction(
    (expectedCount) => document.querySelectorAll('.react-flow__node').length >= expectedCount,
    before + 1,
    { timeout: 3_000 },
  );
  // Return the data-id of the last added node.
  const nodes = page.locator('.react-flow__node');
  const count = await nodes.count();
  const id = await nodes.nth(count - 1).getAttribute('data-id');
  return id ?? '';
}

// ---------------------------------------------------------------------------
// Two-browser CRDT sync tests (skipped in CI — require wrangler dev :8787)
// ---------------------------------------------------------------------------

test.describe('Phase 6 CRDT co-editing (two-browser)', () => {
  test.skip(!!process.env.CI, 'Requires wrangler dev (y-durableobjects backend on port 8787)');

  test('User A adds resistor; User B sees it within 500ms', async ({ browser }) => {
    const a = await openUserContext(browser);
    const b = await openUserContext(browser);

    const initialCountB = await b.page.locator('.react-flow__node').count();

    await placeResistor(a.page);

    // Peer B should receive the Y.Doc update and render the new node within 500ms.
    await expect(b.page.locator('.react-flow__node')).toHaveCount(initialCountB + 1, {
      timeout: 500,
    });

    await a.ctx.close();
    await b.ctx.close();
  });

  test('User A edits R1 value; User B sees updated value within 500ms', async ({ browser }) => {
    const a = await openUserContext(browser);
    const b = await openUserContext(browser);

    const nodeId = await placeResistor(a.page);

    // Wait for B to receive the add before proceeding with the edit.
    await expect(b.page.locator(`.react-flow__node[data-id="${nodeId}"]`)).toBeVisible({
      timeout: 500,
    });

    // User A double-clicks the component to open the inline parameter chip editor.
    await a.page.locator(`.react-flow__node[data-id="${nodeId}"]`).dblclick();
    const input = a.page.locator('[data-testid="param-chip-input"]');
    await input.fill('10k');
    await input.press('Enter');

    // User B should see the updated value text within 500ms.
    await expect(
      b.page.locator(`.react-flow__node[data-id="${nodeId}"]`),
    ).toContainText('10k', { timeout: 500 });

    await a.ctx.close();
    await b.ctx.close();
  });

  test('User A deletes R1; User B sees it disappear within 500ms', async ({ browser }) => {
    const a = await openUserContext(browser);
    const b = await openUserContext(browser);

    const nodeId = await placeResistor(a.page);
    await expect(b.page.locator(`.react-flow__node[data-id="${nodeId}"]`)).toBeVisible({
      timeout: 500,
    });

    // Select and delete on User A's canvas.
    await a.page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
    await a.page.keyboard.press('Delete');

    // User B should see the node removed within 500ms.
    await expect(
      b.page.locator(`.react-flow__node[data-id="${nodeId}"]`),
    ).toHaveCount(0, { timeout: 500 });

    await a.ctx.close();
    await b.ctx.close();
  });

  test('User A undoes delete (Ctrl+Z); User B sees component reappear within 500ms', async ({
    browser,
  }) => {
    const a = await openUserContext(browser);
    const b = await openUserContext(browser);

    const nodeId = await placeResistor(a.page);
    await expect(b.page.locator(`.react-flow__node[data-id="${nodeId}"]`)).toBeVisible({
      timeout: 500,
    });

    // Delete on A.
    await a.page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
    await a.page.keyboard.press('Delete');
    await expect(
      b.page.locator(`.react-flow__node[data-id="${nodeId}"]`),
    ).toHaveCount(0, { timeout: 500 });

    // Y.UndoManager undo on A — propagates to all Yjs peers.
    await a.page.keyboard.press('Control+z');

    // User B should see the node reappear within 500ms.
    await expect(b.page.locator(`.react-flow__node[data-id="${nodeId}"]`)).toBeVisible({
      timeout: 500,
    });

    await a.ctx.close();
    await b.ctx.close();
  });

  test('Concurrent adds from A and B; both canvases show all components after 1s', async ({
    browser,
  }) => {
    const a = await openUserContext(browser);
    const b = await openUserContext(browser);

    const initialCount = await a.page.locator('.react-flow__node').count();

    // Both users add a resistor simultaneously — no await between them.
    const [idFromA, idFromB] = await Promise.all([
      placeResistor(a.page, 200, 250),
      placeResistor(b.page, 400, 250),
    ]);

    // Allow 1 second for CRDT convergence.
    await a.page.waitForTimeout(1_000);

    // Both canvases must contain both new nodes.
    await expect(a.page.locator('.react-flow__node')).toHaveCount(initialCount + 2, {
      timeout: 500,
    });
    await expect(b.page.locator('.react-flow__node')).toHaveCount(initialCount + 2, {
      timeout: 500,
    });

    // Each canvas can locate the other user's node by its specific data-id.
    await expect(
      a.page.locator(`.react-flow__node[data-id="${idFromB}"]`),
    ).toBeVisible();
    await expect(
      b.page.locator(`.react-flow__node[data-id="${idFromA}"]`),
    ).toBeVisible();

    await a.ctx.close();
    await b.ctx.close();
  });
});

// ---------------------------------------------------------------------------
// CI smoke tests (single-browser, always run — no wrangler dev needed)
// ---------------------------------------------------------------------------

test.describe('Phase 6 CRDT — CI smoke (single browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('.react-flow__renderer', { state: 'visible', timeout: 15_000 });
  });

  test('App loads without circuitBinding JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // Reload so the pageerror listener is active from page start.
    await page.reload();
    await page.waitForSelector('.react-flow__renderer', { state: 'visible', timeout: 15_000 });

    // No JS errors related to the CRDT binding modules.
    const bindingErrors = errors.filter(
      (e) =>
        e.includes('circuitBinding') ||
        e.includes('bindCircuitToYjs') ||
        e.includes('useCollabUndoManager') ||
        e.includes('useYIndexedDB'),
    );
    expect(bindingErrors).toHaveLength(0);
  });

  test('CRDT binding modules are importable (no circular dependency crash)', async ({ page }) => {
    // If there were circular imports the page would throw and the renderer would
    // never attach. Reaching this assertion means the module graph is clean.
    await expect(page.locator('.react-flow__renderer')).toBeAttached();
  });

  test('data-collab-connected attribute is absent without an active circuit URL param', async ({
    page,
  }) => {
    // Without a circuitId query param the collab provider should not activate,
    // so the testing hook attribute must be absent (or explicitly false).
    const value = await page.evaluate(() =>
      document.documentElement.getAttribute('data-collab-connected'),
    );
    expect(value).not.toBe('true');
  });
});
