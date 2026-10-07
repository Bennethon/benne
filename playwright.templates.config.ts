import { defineConfig, devices } from '@playwright/test';

/**
 * `npm run test:templates`: plays the game templates other than the one in `src/game` (9-verb,
 * played by `test:playthrough`) through the dev/test hooks. Each template runs in its own
 * workspace (`scripts/template-workspace.mjs`: this repo's engine with the template as `src/game`)
 * on its own dev server, so `src/game` is never touched.
 */
const templates = { '2-click': 4192 } as const;

export default defineConfig({
  testDir: './tests/templates',
  outputDir: './test-results/templates',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 5 * 60_000,
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/templates' }]],
  use: {
    headless: !process.env.BENNE_HEADED,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: Object.entries(templates).map(([name, port]) => ({
    name,
    testMatch: `${name}.spec.ts`,
    use: { ...devices['Desktop Chrome'], viewport: { width: 1056, height: 594 }, baseURL: `http://127.0.0.1:${port}` },
  })),
  webServer: Object.entries(templates).map(([name, port]) => ({
    command: `node scripts/template-workspace.mjs ${name} --serve ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  })),
});
