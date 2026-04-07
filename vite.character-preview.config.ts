import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config';

const dir = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(
  baseConfig,
  defineConfig({
    build: {
      outDir: path.join(dir, 'benne-editor', 'media', 'character-preview'),
      emptyOutDir: true,
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        input: path.join(dir, 'character-editor.html'),
        output: {
          entryFileNames: 'character-preview.js',
          chunkFileNames: 'chunks/[name].js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  }),
);
