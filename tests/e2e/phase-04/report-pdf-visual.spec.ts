import { expect, test } from '@playwright/test';

// Per 04-VALIDATION.md, the PDF *itself* is not visually regressed —
// only the on-screen ReportLayout is screenshotted. PDF visual
// regression is a manual pre-ship check (04-06 Task 5).
test.describe('@phase4-lti Report layout visual regression (RPT-01)', () => {
  test('RPT-01: /reports/sample on-screen layout matches baseline', async ({ page }) => {
    await page.goto('/reports/sample');
    const layout = page.locator('[data-testid="report-layout"]');
    await layout.waitFor({ state: 'visible' });
    // Wait for any figures inside the layout to finish decoding so the
    // screenshot is pixel stable. The sample fixture uses inline data
    // URLs so this resolves synchronously in practice.
    await page.waitForLoadState('networkidle');
    await expect(layout).toHaveScreenshot('report-layout-baseline.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});
