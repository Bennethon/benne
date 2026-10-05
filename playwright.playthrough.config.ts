import { defineConfig, devices } from '@playwright/test';

/**
 * `npm run test:playthrough`: the real game in `src/game`, served by the Vite dev server, driven
 * through the dev/test hooks in `src/engine/testing/benneTestHooks.ts`. Separate from
 * `playwright.config.ts`, which runs the small isolated fixture game.
 */
const port = 4179;
export default defineConfig({
  testDir: './tests/playthrough',
  outputDir: './test-results/playthrough',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/playthrough' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: !process.env.BENNE_HEADED,
    viewport: { width: 1056, height: 594 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1056, height: 594 } } }],
  webServer: {
    command: `node scripts/generate-game-ids.mjs && vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
