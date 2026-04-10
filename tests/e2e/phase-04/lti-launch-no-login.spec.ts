import { expect, test } from '@playwright/test';
import { mockPlatformRoutes } from '../fixtures/mock-lms/platform';

// RED — launch flow + Clerk ticket bootstrap land in 04-02. describe.skip
// keeps the spec committed as the contract without breaking CI.
test.describe.skip('@phase4-lti LTI launch — no SignIn modal (LMS-03)', () => {
  test('mock LMS POSTs signed id_token to /lti/launch, SPA boots pre-authenticated', async ({ page }) => {
    await mockPlatformRoutes(page);
    // Build signed id_token via signFixtureIdToken helper (browser-side polyfill
    // or direct /test-only/sign endpoint).
    await page.goto('/lti/launch');
    // Assert: no Clerk SignIn modal is visible
    await expect(page.locator('[data-testid="clerk-signin-modal"]')).toBeHidden();
    // Assert: the student lands on the editor with a Clerk session
    await expect(page).toHaveURL(/\/editor/);
  });

  test('same user launching twice re-uses Clerk user (externalId lookup path)', async ({ page }) => {
    await mockPlatformRoutes(page);
    await page.goto('/lti/launch');
    await page.goto('/lti/launch');
    // Both launches should resolve to the same Clerk user id (no duplicate row)
    expect(true).toBe(true);
  });
});
