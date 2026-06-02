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
            outDir: resolveBennePreviewOutDirFromImportMeta(import.meta.url, 'room-preview'),
            emptyOutDir: true,
            chunkSizeWarningLimit: 3000,
            rollupOptions: {
                input: path.join(dir, 'room-editor.html'),
                output: {
                    entryFileNames: 'room-preview.js',
                    chunkFileNames: 'chunks/[name].js',
                    assetFileNames: 'assets/[name][extname]',
                },
            },
        },
    }),
);
