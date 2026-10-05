import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { benneGenerateGameIdsPlugin } from './vite-plugin-bennegame-ids';
import { benneScriptPlugin } from './vite-plugin-bennescript';

const dir = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
  name?: string;
  benne?: { displayName?: string };
};
const slug = (pkg.name || 'benne-game').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-|-$/g, '');
const displayName = pkg.benne?.displayName?.trim() || slug.split('-').map(
  (part: string) => part.slice(0, 1).toUpperCase() + part.slice(1),
).join(' ');
const iconExists = fs.existsSync(path.join(dir, 'src/game/assets/images/icon.png'));

/**
 * Phaser publishes `browser` → UMD (`phaser.js`) and `module` → ESM (`phaser.esm.js`).
 * Vite can resolve the UMD file, which has no `default` export — force the ESM build.
 */
export default defineConfig({
  // Allow itch.io and other static hosts to serve a game under a generated subdirectory.
  base: './',
  // BENNE Play and the editor previews merge this config, so they get the BenneScript transform too.
  plugins: [benneGenerateGameIdsPlugin(), benneScriptPlugin(), {
    name: 'benne-game-page',
    transformIndexHtml(html: string) {
      return html.replace(/<title>[^<]*<\/title>/, `<title>${displayName.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>`)
        .replace(/<link rel="icon"[^>]*\/>/, iconExists
          ? '<link rel="icon" type="image/png" href="./src/game/assets/images/icon.png" />'
          : '');
    },
  }],
  resolve: {
    alias: {
      phaser: path.join(dir, 'node_modules/phaser/dist/phaser.esm.js'),
      '@engine': path.join(dir, 'src/engine'),
      '@benne/script': path.join(dir, 'src/engine/bennescript/index.ts'),
      '@game': path.join(dir, 'src/game/game.ids.ts'),
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
