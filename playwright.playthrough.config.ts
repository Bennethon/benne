import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import { activeTemplate, testsDir } from './tests/playthrough/templates';

/**
 * `npm run test:playthrough`: the game template in `src/game` (whichever `set-template` swapped
 * in), served by the Vite dev server and driven through the dev/test hooks in
 * `src/engine/testing/benneTestHooks.ts`. Plays that template's tests, `tests/playthrough/<name>/`.
 * `test:templates` plays every template without touching `src/game`; `playwright.config.ts` runs
 * the small isolated fixture game.
 */
const template = activeTemplate();
if (!existsSync(testsDir(template))) {
  throw new Error(`src/game is template "${template}", which has no playthrough tests (${testsDir(template)}/).`);
}
// Specs that read game content (e.g. play-from) read the game being served.
process.env.BENNE_PLAYTHROUGH_GAME_DIR = 'src/game';
const port = 4179;
export default defineConfig({
  testDir: testsDir(template),
  outputDir: `./test-results/playthrough/${template}`,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 5 * 60_000,
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
  projects: [{ name: template, use: { ...devices['Desktop Chrome'], viewport: { width: 1056, height: 594 } } }],
  webServer: {
    command: `node scripts/generate-game-ids.mjs && vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
