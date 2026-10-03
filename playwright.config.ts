import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', outputDir: './test-results/browser', fullyParallel: true, forbidOnly: !!process.env.CI,
  retries: 0, timeout: 30000, expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4178', viewport: { width: 960, height: 540 }, trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 960, height: 540 } } },
    ...(process.env.BENNE_BROWSER_MATRIX ? [
      { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 960, height: 540 } } },
      { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 960, height: 540 } } },
    ] : []),
  ],
  webServer: { command: 'node scripts/serve-test-game.mjs', url: 'http://127.0.0.1:4178', reuseExistingServer: false, timeout: 60000 },
});
