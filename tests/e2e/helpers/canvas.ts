/**
 * Canvas interaction helpers for Playwright E2E tests.
 *
 * React Flow uses HTML5 drag-and-drop with a custom MIME type that
 * Playwright cannot simulate natively. We inject the drop event directly.
 */
import type { Page } from '@playwright/test';

const DND_MIME = 'application/omnispice-component';

/** Drop a component from the sidebar onto the canvas at flow coordinates. */
export async function dropComponent(
  page: Page,
  componentType: string,
  canvasX: number,
  canvasY: number,
) {
  const canvas = page.locator('.react-flow__pane').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  const clientX = box.x + canvasX;
  const clientY = box.y + canvasY;

  await page.evaluate(
    ({ type, x, y, mime }) => {
      const dt = new DataTransfer();
      dt.setData(mime, type);
      const pane = document.querySelector('.react-flow__pane');
      if (!pane) throw new Error('.react-flow__pane not found');
      pane.dispatchEvent(
        new DragEvent('dragover', {
          dataTransfer: dt,
          clientX: x,
          clientY: y,
          bubbles: true,
        }),
      );
      pane.dispatchEvent(
        new DragEvent('drop', {
          dataTransfer: dt,
          clientX: x,
          clientY: y,
          bubbles: true,
        }),
      );
    },
    { type: componentType, x: clientX, y: clientY, mime: DND_MIME },
  );
}

/** Wait for a React Flow node of a given type to appear on canvas. */
export async function waitForNode(page: Page, nodeType: string) {
  await page.waitForSelector(`.react-flow__node-${nodeType}`, { timeout: 5_000 });
}

/** Count React Flow nodes currently on canvas. */
export async function nodeCount(page: Page): Promise<number> {
  return page.locator('.react-flow__node').count();
}

/** Wait for the dev server to be ready and app to render. */
export async function waitForApp(page: Page) {
  await page.goto('/');
  // Sidebar is the reliable render signal
  await page.waitForSelector('[data-testid="sidebar"]', { timeout: 15_000 });
}
