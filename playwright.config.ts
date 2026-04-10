import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { outputFolder: 'tests/e2e/report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Exclude phase-04 specs from the default project so they only run
      // under @phase4-lti (mirrors the Phase 3 pattern).
      testIgnore: /phase-04\/.*\.spec\.ts$/,
    },
    {
      // Phase 4 LTI + labs + report E2E suite.
      // Run with: pnpm exec playwright test --project=@phase4-lti
      name: '@phase4-lti',
      testMatch: /phase-04\/.*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
