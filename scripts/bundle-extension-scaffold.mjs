#!/usr/bin/env node
// @ts-check
/**
 * Bundles engine, editor runtime, configs, and game templates into benne-editor/scaffold/
 * for inclusion in the VSIX (extension-as-SDK).
 */
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SCAFFOLD_ROOT = path.join(REPO_ROOT, 'benne-editor', 'scaffold');
const SHARED_ROOT = path.join(SCAFFOLD_ROOT, 'shared');
const TEMPLATES_ROOT = path.join(SCAFFOLD_ROOT, 'templates');
const GAME_TEMPLATES = path.join(REPO_ROOT, 'game-templates');
const EXTENSION_PKG = path.join(REPO_ROOT, 'benne-editor', 'package.json');

/** @type {Record<string, { displayName: string; description: string }>} */
const TEMPLATE_META = {
  '2-click': {
    displayName: '2-Click Adventure',
    description: 'Two-button verb interface (look / use) with inventory bar and menu GUIs.',
  },
  '9-verb': {
    displayName: '9-Verb SCUMM-style',
    description: 'Classic verb wheel with give, pick up, use, open, and more.',
  },
};

/**
 * @param {string} rel
 * @returns {boolean}
 */
function isUnmanagedEditorArtifact(rel) {
  const base = path.basename(rel);
  if (base === '.DS_Store') return true;
  if (/^\~\$/.test(base)) return true;
  if (/\s-\sCopy\./i.test(base)) return true;
  if (/\s+copy(?:\s+\d+)?\./i.test(base)) return true;
  if (/\s+\(\d+\)\./.test(base)) return true;
  return false;
}

/**
 * @param {string} root
 * @returns {Promise<string[]>}
 */
async function listFilesRecursive(root) {
  /** @type {string[]} */
  const out = [];
  /**
   * @param {string} dir
   * @param {string} rel
   */
  async function walk(dir, rel) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err && /** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return;
      throw err;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(abs, relPath);
      } else if (entry.isFile()) {
        out.push(relPath);
      }
    }
  }
  await walk(root, '');
  out.sort();
  return out;
}

/**
 * @param {string} src
 * @param {string} dest
 */
async function copyTree(src, dest) {
  await cp(src, dest, { recursive: true, force: true });
}

/**
 * @param {string} srcDir
 * @param {string} destDir
 * @param {(rel: string) => boolean} [filter]
 */
async function copyFilteredTree(srcDir, destDir, filter) {
  const files = (await listFilesRecursive(srcDir)).filter((rel) => !filter || filter(rel));
  for (const rel of files) {
    const src = path.join(srcDir, rel);
    const dst = path.join(destDir, rel);
    await mkdir(path.dirname(dst), { recursive: true });
    await cp(src, dst);
  }
}

/**
 * @returns {Promise<string[]>}
 */
async function listTemplateNames() {
  const entries = await readdir(GAME_TEMPLATES, { withFileTypes: true });
  /** @type {string[]} */
  const names = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('_') || e.name.startsWith('.')) continue;
    const configPath = path.join(GAME_TEMPLATES, e.name, 'game-config.json');
    const configStat = await stat(configPath).catch(() => null);
    if (configStat?.isFile()) {
      names.push(e.name);
    }
  }
  names.sort();
  return names;
}

async function bundleShared() {
  await rm(SHARED_ROOT, { recursive: true, force: true });
  await mkdir(SHARED_ROOT, { recursive: true });

  const dirCopies = [
    ['src/engine', 'src/engine'],
    ['src/editor', 'src/editor'],
    ['src/types', 'src/types'],
    ['electron', 'electron'],
    ['scripts/lib', 'scripts/lib'],
  ];
  for (const [from, to] of dirCopies) {
    await copyTree(path.join(REPO_ROOT, from), path.join(SHARED_ROOT, to));
  }

  const fileCopies = [
    'src/main.ts',
    'src/style.css',
    'scripts/generate-game-ids.mjs',
    'scripts/resolveBennePreviewOutDir.mjs',
    'scripts/package-itch.mjs',
    'scripts/prepare-desktop.mjs',
    'scripts/smoke-desktop.cjs',
    'scripts/test-webgl-recovery.cjs',
    'electron-builder.config.cjs',
    'vite.config.ts',
    'vite.room-preview.config.ts',
    'vite.character-preview.config.ts',
    'vite.gui-preview.config.ts',
    'vite.inventory-preview.config.ts',
    'vite.benne-play.config.ts',
    'vite-plugin-bennegame-ids.ts',
    'tsconfig.json',
    'index.html',
    'room-editor.html',
    'character-editor.html',
    'gui-editor.html',
    'inventory-editor.html',
    'benne-play.html',
  ];
  for (const rel of fileCopies) {
    const src = path.join(REPO_ROOT, rel);
    const dst = path.join(SHARED_ROOT, rel);
    try {
      await stat(src);
    } catch {
      console.warn(`[bundle:scaffold] Skipping missing optional file: ${rel}`);
      continue;
    }
    await mkdir(path.dirname(dst), { recursive: true });
    await cp(src, dst);
  }
}

/**
 * @param {string} templateName
 */
async function bundleTemplate(templateName) {
  const srcDir = path.join(GAME_TEMPLATES, templateName);
  const destDir = path.join(TEMPLATES_ROOT, templateName);
  await rm(destDir, { recursive: true, force: true });
  await copyFilteredTree(
    srcDir,
    destDir,
    (rel) => path.basename(rel) !== '.gitkeep' && !isUnmanagedEditorArtifact(rel),
  );
}

async function writeManifest(templateNames) {
  const extPkgRaw = await readFile(EXTENSION_PKG, 'utf8');
  const extPkg = /** @type {{ version?: string }} */ (JSON.parse(extPkgRaw));
  const version = typeof extPkg.version === 'string' ? extPkg.version : '0.0.0';

  const templates = templateNames.map((id) => {
    const meta = TEMPLATE_META[id] ?? {
      displayName: id,
      description: `BENNE game template "${id}".`,
    };
    return { id, displayName: meta.displayName, description: meta.description };
  });

  const manifest = {
    scaffoldVersion: version,
    templates,
    builtAt: new Date().toISOString(),
  };

  await writeFile(
    path.join(SCAFFOLD_ROOT, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
}

async function main() {
  console.log('Bundling extension scaffold payload…');
  await rm(SCAFFOLD_ROOT, { recursive: true, force: true });
  await mkdir(SCAFFOLD_ROOT, { recursive: true });

  await bundleShared();

  const templateNames = await listTemplateNames();
  if (templateNames.length === 0) {
    throw new Error('No game templates found under game-templates/');
  }

  await mkdir(TEMPLATES_ROOT, { recursive: true });
  for (const name of templateNames) {
    console.log(`  template: ${name}`);
    await bundleTemplate(name);
  }

  await writeManifest(templateNames);
  console.log(`Scaffold written to ${path.relative(REPO_ROOT, SCAFFOLD_ROOT).replace(/\\/g, '/')}`);
  console.log(`  templates: ${templateNames.join(', ')}`);
}

main().catch((err) => {
  console.error(`\nError: ${err?.message ?? err}`);
  process.exitCode = 1;
});
