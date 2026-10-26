// Renders card.html to public/images/social-card.png, the 1200×630 image link previews show for
// benne.games (the og:image and twitter:image in .vitepress/config.ts). Needs Chromium or Chrome;
// set CHROME to its path if it is not `chromium` on the PATH.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const card = new URL('./card.html', import.meta.url);
const out = fileURLToPath(new URL('../public/images/social-card.png', import.meta.url));

const result = spawnSync(
  process.env.CHROME ?? 'chromium',
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    // The card loads the site's fonts and monitor image from disk.
    '--allow-file-access-from-files',
    '--window-size=1200,630',
    '--virtual-time-budget=3000',
    `--screenshot=${out}`,
    card.href,
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Wrote ${out}`);
