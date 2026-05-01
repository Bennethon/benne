#!/usr/bin/env node
// @ts-check
/**
 * BENNE game-template switcher.
 *
 * Subcommands:
 *   sync-bootstrap-down          Mirror bootstrap files from src/game/ → game-templates/_bootstrap/.
 *   sync-template-down           Mirror template files from src/game/ → game-templates/<active>/.
 *   set-template <name>          Save current (both syncs), then replace src/game/ with _bootstrap + <name>.
 *
 * Flags:
 *   --yes, -y                    Skip interactive confirmation.
 *
 * Active template name is read from src/game/game-config.json → `name`.
 *
 * Bootstrap files are every **top-level file** under src/game/ except
 * **`game-config.json`** and **`globalScript.ts`** (subdirectories never count).
 * That list drives sync-bootstrap-down and defines which root files belong in
 * `game-templates/_bootstrap/`, so new engine-side helpers added at the repo
 * root of `src/game/` are captured automatically.
 *
 * Template sync ignores editor / OS duplicate filenames (e.g. macOS
 * `game-config copy.json`, Windows `foo - Copy.json`, `foo (1).json`) so they
 * are never written into game-templates/ and are removed from the template
 * folder when they appear as orphans.
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  unlink,
} from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SRC_GAME = path.join(REPO_ROOT, 'src', 'game');
const GAME_TEMPLATES = path.join(REPO_ROOT, 'game-templates');
const BOOTSTRAP_DIR = path.join(GAME_TEMPLATES, '_bootstrap');
const GAME_CONFIG_JSON = 'game-config.json';
/** Game-only bootstrap at repo root (`src/game/`); everything else flat + non-dir is sync’d to `_bootstrap/`. */
const GLOBAL_SCRIPT_TS = 'globalScript.ts';

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('-'));
const flags = new Set(argv.filter((a) => a.startsWith('-')));
const ASSUME_YES = flags.has('--yes') || flags.has('-y');

const subcommand = positional[0];

// ---------------------------------------------------------------------------
// Helpers: fs walking
// ---------------------------------------------------------------------------

/**
 * Recursively list all files under `root`, returning posix-style paths
 * relative to `root`. Ignores `.gitkeep` markers by default (callers can
 * override via filter).
 *
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
 * Top-level filenames (non-dir) in `dir`.
 *
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function listTopLevelFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .sort();
}

/**
 * Fast comparison: size mismatch → different; equal size → compare SHA-256.
 *
 * @param {string} a
 * @param {string} b
 * @returns {Promise<boolean>}
 */
async function filesEqual(a, b) {
  const [sa, sb] = await Promise.all([stat(a), stat(b)]);
  if (sa.size !== sb.size) return false;
  const [ha, hb] = await Promise.all([hashFile(a), hashFile(b)]);
  return ha === hb;
}

/**
 * @param {string} filepath
 * @returns {Promise<string>}
 */
function hashFile(filepath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filepath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Safe copy: ensures destination directory exists, then copies.
 *
 * @param {string} src
 * @param {string} dest
 */
async function safeCopyFile(src, dest) {
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(src, dest);
}

/**
 * Guard: `candidate` must be inside `root` (prevents `..` escaping).
 *
 * @param {string} root
 * @param {string} candidate
 */
function assertInside(root, candidate) {
  const rel = path.relative(root, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Refusing to touch path outside ${root}: ${candidate}`);
  }
}

// ---------------------------------------------------------------------------
// Mirror planning + application
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} MirrorPlan
 * @property {string} sourceRoot
 * @property {string} destRoot
 * @property {string} label
 * @property {string[]} toCopyNew           Files in source not in dest.
 * @property {string[]} toCopyModified      Files in both but byte-different.
 * @property {string[]} unchanged           Files in both and byte-equal.
 * @property {string[]} toDelete            Files in dest not in source.
 */

/**
 * Walk both trees and compute a mirror plan.
 *
 * @param {Object} args
 * @param {string} args.sourceRoot
 * @param {string} args.destRoot
 * @param {string} args.label
 * @param {(relPath: string) => boolean} [args.sourceFilter]   Keep source files where true (default: all).
 * @param {(relPath: string) => boolean} [args.destFilter]     Keep dest files where true (default: same as sourceFilter).
 * @returns {Promise<MirrorPlan>}
 */
async function planMirror({ sourceRoot, destRoot, label, sourceFilter, destFilter }) {
  const keepSrc = sourceFilter ?? (() => true);
  const keepDst = destFilter ?? keepSrc;

  const srcFiles = (await listFilesRecursive(sourceRoot)).filter(keepSrc);
  const dstFiles = (await listFilesRecursive(destRoot)).filter(keepDst);

  const srcSet = new Set(srcFiles);
  const dstSet = new Set(dstFiles);

  /** @type {string[]} */ const toCopyNew = [];
  /** @type {string[]} */ const toCopyModified = [];
  /** @type {string[]} */ const unchanged = [];
  /** @type {string[]} */ const toDelete = [];

  for (const rel of srcFiles) {
    if (!dstSet.has(rel)) {
      toCopyNew.push(rel);
    } else {
      const same = await filesEqual(path.join(sourceRoot, rel), path.join(destRoot, rel));
      if (same) unchanged.push(rel);
      else toCopyModified.push(rel);
    }
  }
  for (const rel of dstFiles) {
    if (!srcSet.has(rel)) toDelete.push(rel);
  }

  return {
    sourceRoot,
    destRoot,
    label,
    toCopyNew,
    toCopyModified,
    unchanged,
    toDelete,
  };
}

/**
 * @param {MirrorPlan} plan
 * @returns {boolean}
 */
function planHasChanges(plan) {
  return (
    plan.toCopyNew.length > 0 ||
    plan.toCopyModified.length > 0 ||
    plan.toDelete.length > 0
  );
}

/**
 * Format a relative path list with a cap to keep output compact.
 *
 * @param {string[]} items
 * @param {number} cap
 * @returns {string}
 */
function formatList(items, cap = 8) {
  if (items.length === 0) return '';
  const shown = items.slice(0, cap);
  const more = items.length - shown.length;
  const tail = more > 0 ? `, … (+${more} more)` : '';
  return `    ${shown.join('\n    ')}${tail ? `\n    ${tail}` : ''}`;
}

/**
 * @param {MirrorPlan} plan
 */
function renderPlan(plan) {
  const relSrc = path.relative(REPO_ROOT, plan.sourceRoot).replace(/\\/g, '/') || '.';
  const relDst = path.relative(REPO_ROOT, plan.destRoot).replace(/\\/g, '/') || '.';
  console.log(`\n${plan.label}`);
  console.log(`  ${relSrc}/ → ${relDst}/`);
  console.log(`  new:       ${plan.toCopyNew.length}`);
  if (plan.toCopyNew.length > 0) console.log(formatList(plan.toCopyNew));
  console.log(`  modified:  ${plan.toCopyModified.length}`);
  if (plan.toCopyModified.length > 0) console.log(formatList(plan.toCopyModified));
  console.log(`  unchanged: ${plan.unchanged.length}`);
  console.log(`  delete:    ${plan.toDelete.length}${plan.toDelete.length > 0 ? '  <-- orphan' : ''}`);
  if (plan.toDelete.length > 0) console.log(formatList(plan.toDelete));
}

/**
 * Apply a previously-confirmed plan to disk.
 *
 * @param {MirrorPlan} plan
 */
async function applyPlan(plan) {
  for (const rel of plan.toCopyNew) {
    const src = path.join(plan.sourceRoot, rel);
    const dst = path.join(plan.destRoot, rel);
    assertInside(plan.sourceRoot, src);
    assertInside(plan.destRoot, dst);
    await safeCopyFile(src, dst);
  }
  for (const rel of plan.toCopyModified) {
    const src = path.join(plan.sourceRoot, rel);
    const dst = path.join(plan.destRoot, rel);
    assertInside(plan.sourceRoot, src);
    assertInside(plan.destRoot, dst);
    await safeCopyFile(src, dst);
  }
  for (const rel of plan.toDelete) {
    const dst = path.join(plan.destRoot, rel);
    assertInside(plan.destRoot, dst);
    await unlink(dst);
  }
}

// ---------------------------------------------------------------------------
// Interactive confirm
// ---------------------------------------------------------------------------

/**
 * Ask y/N, unless --yes is set. Returns true on confirm.
 *
 * @param {string} question
 * @returns {Promise<boolean>}
 */
async function confirm(question) {
  if (ASSUME_YES) {
    console.log(`${question} [y/N] y  (--yes)`);
    return true;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

// ---------------------------------------------------------------------------
// Template metadata
// ---------------------------------------------------------------------------

/**
 * Read `name` from the given game-config.json.
 *
 * @param {string} configPath
 * @returns {Promise<string>}
 */
async function readTemplateName(configPath) {
  let raw;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch (err) {
    if (err && /** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') {
      throw new Error(`Missing ${path.relative(REPO_ROOT, configPath).replace(/\\/g, '/')}`);
    }
    throw err;
  }
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${configPath}: ${/** @type {Error} */ (err).message}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`${configPath} must be a JSON object.`);
  }
  const name = /** @type {{ name?: unknown }} */ (parsed).name;
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error(
      `Missing "name" field in ${path.relative(REPO_ROOT, configPath).replace(/\\/g, '/')}. ` +
        `Set it to the template id (e.g. "2-click") so the switcher knows which game-templates/<name>/ folder to target.`
    );
  }
  return name;
}

/**
 * Files macOS / VS Code / Explorer create when duplicating or auto-renaming
 * (e.g. `game-config copy.json`). These must not be treated as game content
 * when mirroring to game-templates/.
 *
 * @param {string} rel
 * @returns {boolean}
 */
function isUnmanagedEditorArtifact(rel) {
  const base = path.basename(rel);
  if (base === '.DS_Store') return true;
  if (/^\~\$/.test(base)) return true;
  // Windows: `name - Copy.ext`
  if (/\s-\sCopy\./i.test(base)) return true;
  // macOS duplicate: `name copy.ext`, `name copy 2.ext`
  if (/\s+copy(?:\s+\d+)?\./i.test(base)) return true;
  // Explorer: `name (1).ext`
  if (/\s+\(\d+\)\./.test(base)) return true;
  return false;
}

/**
 * `rel` is a bootstrap artifact under src/game/: top-level file, not game
 * config, not global script, not editor duplicate noise.
 *
 * @param {string} rel Relative path (bootstrap mirror uses flat names only).
 * @returns {boolean}
 */
function isLiveBootstrapRootFile(rel) {
  if (rel.includes('/')) return false;
  if (rel === GAME_CONFIG_JSON || rel === GLOBAL_SCRIPT_TS) return false;
  if (isUnmanagedEditorArtifact(rel)) return false;
  return true;
}

/**
 * Basenames mirrored to `game-templates/_bootstrap/` (same rules as
 * {@link isLiveBootstrapRootFile}).
 *
 * @returns {Promise<Set<string>>}
 */
async function getLiveBootstrapFilenameSet() {
  const entries = await readdir(SRC_GAME, { withFileTypes: true });
  /** @type {string[]} */
  const names = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!isLiveBootstrapRootFile(e.name)) continue;
    names.push(e.name);
  }
  return new Set(names);
}

/**
 * Template-side files under src/game/: subdirectories, `.gitkeep` excluded,
 * and exactly the two canonical **top-level** game files (`game-config.json`,
 * `globalScript.ts`).
 *
 * @param {string} rel
 * @returns {boolean}
 */
function isTemplateFile(rel) {
  if (path.basename(rel) === '.gitkeep') return false;
  if (rel.includes('/')) return true;
  return rel === GAME_CONFIG_JSON || rel === GLOBAL_SCRIPT_TS;
}

/**
 * @param {string} rel
 * @returns {boolean}
 */
function isManagedTemplateFile(rel) {
  return isTemplateFile(rel) && !isUnmanagedEditorArtifact(rel);
}

/**
 * Dest-side mirror domain: managed template files plus editor junk so orphans
 * get deleted when syncing down.
 *
 * @param {string} rel
 * @returns {boolean}
 */
function isTemplateMirrorDestFile(rel) {
  return isManagedTemplateFile(rel) || isUnmanagedEditorArtifact(rel);
}

// ---------------------------------------------------------------------------
// Safety / preflight
// ---------------------------------------------------------------------------

async function preflightRepoRoot() {
  const [srcGameStat, gameTemplatesStat] = await Promise.all([
    stat(SRC_GAME).catch(() => null),
    stat(GAME_TEMPLATES).catch(() => null),
  ]);
  if (!srcGameStat?.isDirectory() || !gameTemplatesStat?.isDirectory()) {
    throw new Error(
      `This script must run from the BENNE repo root (cwd is "${process.cwd()}"). ` +
        `Expected src/game/ and game-templates/ relative to ${REPO_ROOT}.`
    );
  }
}

// ---------------------------------------------------------------------------
// Subcommand implementations
// ---------------------------------------------------------------------------

/**
 * @returns {Promise<{ plan: MirrorPlan; bootstrapNames: Set<string> }>}
 */
async function buildBootstrapDownPlan() {
  const bootstrapNames = await getLiveBootstrapFilenameSet();
  const plan = await planMirror({
    sourceRoot: SRC_GAME,
    destRoot: BOOTSTRAP_DIR,
    label: 'Sync bootstrap files (src/game → game-templates/_bootstrap)',
    sourceFilter: (rel) => isLiveBootstrapRootFile(rel),
    destFilter: (rel) => !rel.includes('/'),
  });
  return { plan, bootstrapNames };
}

/**
 * @param {string} templateName
 * @returns {Promise<MirrorPlan>}
 */
async function buildTemplateDownPlan(templateName) {
  const destRoot = path.join(GAME_TEMPLATES, templateName);
  const destStat = await stat(destRoot).catch(() => null);
  if (!destStat?.isDirectory()) {
    throw new Error(
      `Template folder game-templates/${templateName}/ does not exist. ` +
        `Create it (with at least a game-config.json containing "name": "${templateName}") before syncing down.`
    );
  }
  return planMirror({
    sourceRoot: SRC_GAME,
    destRoot,
    label: `Sync template files (src/game → game-templates/${templateName})`,
    sourceFilter: (rel) => isManagedTemplateFile(rel),
    destFilter: (rel) => isTemplateMirrorDestFile(rel),
  });
}

async function runSyncBootstrapDown() {
  const { plan } = await buildBootstrapDownPlan();
  renderPlan(plan);
  if (!planHasChanges(plan)) {
    console.log('\nAlready in sync. Nothing to do.');
    return;
  }
  const ok = await confirm('\nApply this bootstrap sync?');
  if (!ok) {
    console.log('Aborted. No changes written.');
    process.exitCode = 1;
    return;
  }
  await applyPlan(plan);
  console.log('Bootstrap sync applied.');
}

async function runSyncTemplateDown() {
  const activeName = await readTemplateName(path.join(SRC_GAME, GAME_CONFIG_JSON));
  const plan = await buildTemplateDownPlan(activeName);
  renderPlan(plan);
  if (!planHasChanges(plan)) {
    console.log('\nAlready in sync. Nothing to do.');
    return;
  }
  const ok = await confirm('\nApply this template sync?');
  if (!ok) {
    console.log('Aborted. No changes written.');
    process.exitCode = 1;
    return;
  }
  await applyPlan(plan);
  console.log(`Template "${activeName}" sync applied.`);
}

/**
 * @param {string} targetName
 */
async function runSetTemplate(targetName) {
  if (!targetName) {
    throw new Error('set-template requires a template name argument, e.g. `set-template 9-verb`.');
  }

  const targetDir = path.join(GAME_TEMPLATES, targetName);
  const targetConfig = path.join(targetDir, GAME_CONFIG_JSON);
  const targetDirStat = await stat(targetDir).catch(() => null);
  if (!targetDirStat?.isDirectory()) {
    throw new Error(`Target template folder does not exist: game-templates/${targetName}/`);
  }
  const targetName2 = await readTemplateName(targetConfig);
  if (targetName2 !== targetName) {
    throw new Error(
      `game-templates/${targetName}/game-config.json has "name": "${targetName2}", ` +
        `which does not match the folder name "${targetName}". Fix one of them.`
    );
  }

  // Read current active template, if any.
  /** @type {string | null} */
  let currentName = null;
  try {
    currentName = await readTemplateName(path.join(SRC_GAME, GAME_CONFIG_JSON));
  } catch (err) {
    console.warn(
      `\n[warn] Could not determine active template from src/game/game-config.json (${
        /** @type {Error} */ (err).message
      }). Skipping sync-down steps.`
    );
  }

  // Build sync-down plans (if we have a current template to save).
  const { plan: bootstrapPlan, bootstrapNames } = await buildBootstrapDownPlan();
  /** @type {MirrorPlan | null} */
  let templatePlan = null;
  if (currentName) {
    const currentTemplateDir = path.join(GAME_TEMPLATES, currentName);
    const currentStat = await stat(currentTemplateDir).catch(() => null);
    if (currentStat?.isDirectory()) {
      templatePlan = await buildTemplateDownPlan(currentName);
    } else {
      console.warn(
        `\n[warn] Active template "${currentName}" has no game-templates/${currentName}/ folder. Skipping sync-template-down.`
      );
    }
  }

  // Check for top-level filename overlap between _bootstrap/ and target template.
  const targetTopLevel = new Set(await listTopLevelFiles(targetDir));
  const overlap = [...bootstrapNames].filter((n) => targetTopLevel.has(n));
  if (overlap.length > 0) {
    throw new Error(
      `Bootstrap / template filename conflict in game-templates/${targetName}/: ` +
        `${overlap.join(', ')}. Remove these from the template folder (they belong to _bootstrap/).`
    );
  }

  // Preview everything up-front.
  console.log(`\n=== set-template: ${currentName ?? '(unknown)'} → ${targetName} ===`);
  renderPlan(bootstrapPlan);
  if (templatePlan) renderPlan(templatePlan);
  console.log('\nThen:');
  console.log(`  - delete src/game/ (full recursive removal)`);
  console.log(`  - copy game-templates/_bootstrap/* → src/game/`);
  console.log(`  - copy game-templates/${targetName}/** → src/game/`);

  const ok = await confirm('\nProceed with full template switch?');
  if (!ok) {
    console.log('Aborted. No changes written.');
    process.exitCode = 1;
    return;
  }

  // 1. Apply sync-down plans so the current template is saved.
  if (planHasChanges(bootstrapPlan)) {
    await applyPlan(bootstrapPlan);
    console.log('[1/5] Bootstrap sync-down applied.');
  } else {
    console.log('[1/5] Bootstrap already in sync.');
  }
  if (templatePlan && planHasChanges(templatePlan)) {
    await applyPlan(templatePlan);
    console.log(`[2/5] Template "${currentName}" sync-down applied.`);
  } else {
    console.log('[2/5] Active template already in sync (or skipped).');
  }

  // 2. Wipe src/game/.
  assertInside(REPO_ROOT, SRC_GAME);
  await rm(SRC_GAME, { recursive: true, force: true });
  await mkdir(SRC_GAME, { recursive: true });
  console.log('[3/5] src/game/ cleared.');

  // 3. Copy bootstrap files in.
  const bootstrapFiles = await listFilesRecursive(BOOTSTRAP_DIR);
  for (const rel of bootstrapFiles) {
    const src = path.join(BOOTSTRAP_DIR, rel);
    const dst = path.join(SRC_GAME, rel);
    assertInside(BOOTSTRAP_DIR, src);
    assertInside(SRC_GAME, dst);
    await safeCopyFile(src, dst);
  }
  console.log(`[4/5] Copied ${bootstrapFiles.length} bootstrap file(s) into src/game/.`);

  // 4. Copy target template files in (skip .gitkeep markers used only to pin empty folders).
  const templateFiles = (await listFilesRecursive(targetDir)).filter(
    (rel) => path.basename(rel) !== '.gitkeep' && !isUnmanagedEditorArtifact(rel)
  );
  for (const rel of templateFiles) {
    const src = path.join(targetDir, rel);
    const dst = path.join(SRC_GAME, rel);
    assertInside(targetDir, src);
    assertInside(SRC_GAME, dst);
    await safeCopyFile(src, dst);
  }
  console.log(
    `[5/5] Copied ${templateFiles.length} file(s) from game-templates/${targetName}/ into src/game/.`
  );

  console.log(`\nDone. src/game/ is now running template "${targetName}".`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function printUsage() {
  console.log(`Usage:
  node scripts/switch-game-template.mjs sync-bootstrap-down [--yes]
  node scripts/switch-game-template.mjs sync-template-down  [--yes]
  node scripts/switch-game-template.mjs set-template <name> [--yes]
`);
}

async function main() {
  if (!subcommand) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  await preflightRepoRoot();

  switch (subcommand) {
    case 'sync-bootstrap-down':
      await runSyncBootstrapDown();
      break;
    case 'sync-template-down':
      await runSyncTemplateDown();
      break;
    case 'set-template':
      await runSetTemplate(positional[1] ?? '');
      break;
    case '-h':
    case '--help':
    case 'help':
      printUsage();
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      printUsage();
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`\nError: ${err?.message ?? err}`);
  process.exitCode = 1;
});
