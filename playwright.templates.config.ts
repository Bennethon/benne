import { defineConfig, devices } from '@playwright/test';
import { testedTemplates, testsDir } from './tests/support/templates';

/**
 * `npm run test:templates`: plays every game template that has tests (`tests/playthrough/<name>/`)
 * through the dev/test hooks. Each template runs in its own workspace
 * (`scripts/template-workspace.mjs`: this repo's engine with the template as `src/game`) on its own
 * dev server, so `src/game` is never touched. `--project <name>` plays one template.
 */
const templates = testedTemplates().map((name, i) => ({ name, port: 4191 + i }));

export default defineConfig({
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
  projects: templates.map(({ name, port }) => ({
    name,
    testDir: testsDir(name),
    use: { ...devices['Desktop Chrome'], viewport: { width: 1056, height: 594 }, baseURL: `http://127.0.0.1:${port}` },
  })),
  webServer: templates.map(({ name, port }) => ({
    command: `node scripts/template-workspace.mjs ${name} --serve ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  })),
});
