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
      // Exclude phase-04, phase5 and phase5-offline specs from the default
      // project so they only run under their dedicated projects (mirrors
      // the Phase 3 pattern).
      testIgnore: [
        /phase-04\/.*\.spec\.ts$/,
        /phase5\/.*\.spec\.ts$/,
        /phase5-offline\/.*\.spec\.ts$/,
        /phase6\/.*\.spec\.ts$/,
      ],
    },
    {
      // Phase 4 LTI + labs + report E2E suite.
      // Run with: pnpm exec playwright test --project=@phase4-lti
      name: '@phase4-lti',
      testMatch: /phase-04\/.*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Phase 5 editor UX quick-wins E2E suite.
      // Run with: pnpm exec playwright test --project=phase5
      // NOTE: phase5 intentionally targets a separate port (5174) so
      // parallel executors in git worktrees do not collide on the shared
      // 5173 dev server managed by the default webServer config.
      name: 'phase5',
      testMatch: /phase5\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5174',
      },
    },
    {
      // Phase 5 offline / PWA suite (Plan 05-10).
      // Requires a production build served by `pnpm preview` because the
      // service worker is only emitted by the production Vite build —
      // `pnpm dev` does not generate sw.js (devOptions.enabled=false).
      //
      // Run with: pnpm build && pnpm exec playwright test --project=phase5-offline
      // The preview server is started manually or by the webServer entry
      // below when PHASE5_OFFLINE=1 is set.
      name: 'phase5-offline',
      testMatch: /phase5-offline\/.*\.spec\.ts$/,
      testDir: './tests/e2e',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4173',
      },
    },
    {
      // Phase 6 Circuit CRDT E2E suite (Plan 06-05).
      // Single-browser smoke tests run against pnpm dev (port 5175).
      // Two-browser CRDT sync tests require wrangler dev (port 8787) and
      // are skipped in CI via process.env.CI guard in the spec.
      //
      // Run with: pnpm exec playwright test --project=phase6
      name: 'phase6',
      testMatch: /phase6\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5175',
      },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
