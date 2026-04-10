import { expect, test } from '@playwright/test';
import { mockPlatformRoutes } from '../fixtures/mock-lms/platform';

// RED — deep-link flow lands in 04-02. describe.skip keeps the suite
// non-breaking while the spec file is committed as the contract.
test.describe.skip('@phase4-lti LTI Deep Linking flow (LMS-02)', () => {
  test('instructor creates OmniSpice assignment, DL response posted with ContentItem', async ({ page }) => {
    const platform = await mockPlatformRoutes(page);
    // Instructor launches tool with a LtiDeepLinkingRequest message_type
    // Navigates through the course-picker UI
    // Selects a starter circuit, clicks "Add to Canvas"
    // Assert platform.lineItemsPosted has 1 entry with correct scoreMaximum
    expect(platform.lineItemsPosted).toHaveLength(1);
  });

  test('lineItem row created in D1 lti_line_items on DL response', async ({ page }) => {
    const platform = await mockPlatformRoutes(page);
    await page.goto('/lti/deeplink/demo');
    // Assert that the assignment/lineitem linkage exists after POST
    expect(platform.lineItemsPosted).toBeDefined();
  });
});
