import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const dir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Phaser publishes `browser` → UMD (`phaser.js`) and `module` → ESM (`phaser.esm.js`).
 * Vite can resolve the UMD file, which has no `default` export — force the ESM build.
 */
export default defineConfig({
  resolve: {
    alias: {
      phaser: path.join(dir, 'node_modules/phaser/dist/phaser.esm.js'),
      '@engine': path.join(dir, 'src/engine'),
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
