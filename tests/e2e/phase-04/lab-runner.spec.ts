import { expect, test } from '@playwright/test';

// RED — Lab editor + runner land in 04-04/04-05. describe.skip keeps the
// spec committed as the contract without breaking CI.
test.describe.skip('@phase4-lti Lab runner — LAB-02 / LAB-03', () => {
  test('instructor creates lab with 1 step + 1 node_voltage checkpoint, student runs sim, chip shows pass', async ({ page }) => {
    // Instructor: /labs/new → add step → add checkpoint → save
    await page.goto('/labs/new');
    // Student: /labs/:id → click Run → wait for chip
    // Assert: chip text contains "pass" or data-status="pass"
    await expect(page.locator('[data-testid="checkpoint-chip-cp-1"]')).toHaveAttribute(
      'data-status',
      'pass',
    );
  });

  test('waveform_match checkpoint with reference CSV renders partial/pass based on tolerance', async ({ page }) => {
    await page.goto('/labs/demo-waveform-match');
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
  });
});
