import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config';
import { resolveBennePreviewOutDirFromImportMeta } from './scripts/resolveBennePreviewOutDir.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(
  baseConfig,
  defineConfig({
    build: {
      outDir: resolveBennePreviewOutDirFromImportMeta(import.meta.url, 'benne-play'),
      emptyOutDir: true,
      chunkSizeWarningLimit: 5000,
      rollupOptions: {
        input: path.join(dir, 'benne-play.html'),
        output: {
          entryFileNames: 'benne-play.js',
          chunkFileNames: 'chunks/[name].js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  }),
);
