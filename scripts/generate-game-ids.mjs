#!/usr/bin/env node
/**
 * Generates the BenneScript handle modules (gitignored) from src/game/ content:
 * src/game/game.ids.ts (`@game`) and rooms/dialogs/guis `<id>/<id>.ids.ts`
 * (docs/bennescript-ergonomics-refactor.md §7, §8).
 *
 * `--check` writes nothing: it fails when the handles can't be generated (name collisions,
 * reserved verb IDs, bad `scriptName`s).
 * `--quiet` prints only errors.
 */
import { mkdir, readdir, rename, unlink, writeFile, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERATED_MARKER, generateGameHandles } from './lib/generateGameHandles.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gameRoot = path.join(repoRoot, 'src', 'game');
const quiet = process.argv.includes('--quiet');
const check = process.argv.includes('--check');

/** Writes `content` unless the file already has it, so watchers don't see a change. */
async function writeIfChanged(file, content) {
  const existing = await readFile(file, 'utf8').catch(() => null);
  if (existing === content) return false;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, content, 'utf8');
  await rename(`${file}.tmp`, file);
  return true;
}

/** Generated `.ids.ts` files currently on disk (only ones carrying the generated marker). */
async function existingGeneratedModules() {
  const candidates = [path.join(gameRoot, 'game.ids.ts')];
  for (const kind of ['rooms', 'dialogs', 'guis']) {
    const dir = path.join(gameRoot, kind);
    const folders = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const folder of folders) {
      if (!folder.isDirectory()) continue;
      const files = await readdir(path.join(dir, folder.name)).catch(() => []);
      for (const file of files) if (file.endsWith('.ids.ts')) candidates.push(path.join(dir, folder.name, file));
    }
  }
  const out = [];
  for (const file of candidates) {
    const text = await readFile(file, 'utf8').catch(() => null);
    if (text?.startsWith(GENERATED_MARKER)) out.push(file);
  }
  return out;
}

/** @returns {Promise<boolean>} false when generation failed */
async function generateHandles() {
  const { files, errors, warnings } = generateGameHandles(gameRoot);
  if (!quiet) for (const w of warnings) console.warn(`[generate-game-ids] warning: ${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`[generate-game-ids] error: ${e}`);
    console.error(`[generate-game-ids] ${errors.length} error(s): BenneScript handles were not generated.`);
    return false;
  }
  if (check) {
    if (!quiet) console.log(`[generate-game-ids] Handles generate cleanly (${files.size} modules).`);
    return true;
  }
  const wanted = new Set();
  let written = 0;
  for (const [rel, content] of files) {
    const file = path.join(gameRoot, rel);
    wanted.add(file);
    if (await writeIfChanged(file, content)) written++;
  }
  let removed = 0;
  for (const file of await existingGeneratedModules()) {
    if (!wanted.has(file)) {
      await unlink(file);
      removed++;
    }
  }
  if (!quiet && (written > 0 || removed > 0)) {
    console.log(`[generate-game-ids] Handles: ${written} module(s) written, ${removed} removed (${files.size} total).`);
  }
  return true;
}

async function main() {
  if (!(await generateHandles())) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[generate-game-ids] Failed:', err);
  process.exit(1);
});
