import { expect, test } from '@playwright/test';

// RED — /reports/sample page lands in 04-06. describe.skip keeps the spec
// committed as the contract without breaking CI.
//
// NOTE: per 04-VALIDATION.md, the PDF *itself* is not visually regressed —
// only the on-screen ReportLayout is screenshotted. PDF visual regression
// is a manual pre-ship check.
test.describe.skip('@phase4-lti Report layout visual regression (RPT-01)', () => {
  test('/reports/sample screenshot matches baseline', async ({ page }) => {
    await page.goto('/reports/sample');
    await expect(page.locator('[data-testid="report-layout"]')).toHaveScreenshot(
      'report-layout-baseline.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });
});
