#!/usr/bin/env node
// @ts-check
/**
 * Resolves Vite preview bundle output directory.
 *
 * Monorepo dev (benne-editor/ sibling exists): benne-editor/media/<previewName>/
 * Standalone scaffolded game: .benne/preview-bundles/<previewName>/
 */
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {string} projectRoot Absolute path to the game / monorepo root (directory containing vite.config.ts).
 * @param {string} previewName e.g. room-preview, benne-play
 * @returns {string}
 */
export function resolveBennePreviewOutDir(projectRoot, previewName) {
  const monorepoMedia = path.join(projectRoot, 'benne-editor', 'media', previewName);
  if (existsSync(path.join(projectRoot, 'benne-editor'))) {
    return monorepoMedia;
  }
  return path.join(projectRoot, '.benne', 'preview-bundles', previewName);
}

/**
 * @param {string} importMetaUrl import.meta.url from the calling vite config module
 * @param {string} previewName
 * @returns {string}
 */
export function resolveBennePreviewOutDirFromImportMeta(importMetaUrl, previewName) {
  const dir = path.dirname(fileURLToPath(importMetaUrl));
  return resolveBennePreviewOutDir(dir, previewName);
}
