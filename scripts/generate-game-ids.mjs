#!/usr/bin/env node
/**
 * Generates from src/game/ content:
 * - src/types/generated/benne-game-ids.d.ts: content ID unions, re-exported by `src/types` (committed);
 * - the BenneScript handle modules (gitignored): src/game/game.ids.ts (`@game`) and
 *   rooms/dialogs/guis `<id>/<id>.ids.ts` (docs/bennescript-ergonomics-refactor.md §7, §8).
 *
 * `--check` writes nothing: it fails when the committed declarations are stale or the handles
 * can't be generated (name collisions, reserved verb IDs, bad `scriptName`s).
 * `--quiet` prints only errors.
 */
import { mkdir, readdir, rename, unlink, writeFile, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERATED_MARKER, generateGameHandles } from './lib/generateGameHandles.mjs';
import { scanGameContentIds } from './lib/scanGameContentIds.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gameRoot = path.join(repoRoot, 'src', 'game');
const outDir = path.join(repoRoot, 'src', 'types', 'generated');
const outPath = path.join(outDir, 'benne-game-ids.d.ts');
const tmpPath = `${outPath}.tmp`;
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

/**
 * @param {string[]} literals
 */
function formatLiteralUnion(literals) {
  if (literals.length === 0) {
    return 'string';
  }
  return literals.map((id) => `'${id.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(' | ');
}

/**
 * @param {string} typeName
 * @param {string} jsDoc
 * @param {string[]} literals
 */
function emitLooseStringType(typeName, jsDoc, literals) {
  const union = formatLiteralUnion(literals);
  const body =
    literals.length === 0
      ? 'LooseString'
      : `LooseString<${union}>`;
  return `/** ${jsDoc} */\nexport type ${typeName} = ${body};\n`;
}

async function main() {
  const { ids } = await scanGameContentIds(gameRoot);

  const header = `/**
 * AUTO-GENERATED — do not edit manually.
 *
 * Regenerate: npm run generate:game-ids
 * Source: src/game/ (rooms, characters, dialogs, guis, inventory, game-config.json, assets/videos)
 */

/** Preserves autocomplete for known ids while still accepting any string at compile time. */
type LooseString<T extends string = string> = T | (string & {});

`;

  const blocks = [
    emitLooseStringType(
      'RoomId',
      'Room definition ids from src/game/rooms/<id>/<id>.room.json (folder name).',
      ids.roomIds,
    ),
    emitLooseStringType(
      'CharacterId',
      'Character definition ids from src/game/characters/<id>/<id>.character.json.',
      ids.characterIds,
    ),
    emitLooseStringType(
      'DialogId',
      'Dialog topic ids from src/game/dialogs/<id>/<id>.dialog.json.',
      ids.dialogIds,
    ),
    emitLooseStringType(
      'GuiId',
      'GUI overlay ids from src/game/guis/<id>/<id>.gui.json.',
      ids.guiIds,
    ),
    emitLooseStringType(
      'InventoryItemId',
      'Inventory item ids from src/game/inventory/<id>/<id>.inventory.json.',
      ids.inventoryItemIds,
    ),
    emitLooseStringType(
      'PropId',
      'Prop ids from all *.room.json props[] — global namespace (first match wins at runtime).',
      ids.propIds,
    ),
    emitLooseStringType(
      'HotspotId',
      'Hotspot ids from all *.room.json hotspots[].',
      ids.hotspotIds,
    ),
    emitLooseStringType(
      'RegionId',
      'Region ids from all *.room.json regions[].',
      ids.regionIds,
    ),
    emitLooseStringType(
      'WalkableId',
      'Walkable polygon ids from all *.room.json walkable.polygons[].',
      ids.walkableIds,
    ),
    emitLooseStringType(
      'PointId',
      'Named room point ids from all *.room.json points[].',
      ids.pointIds,
    ),
    emitLooseStringType(
      'DialogOptionId',
      'Dialog option ids from all *.dialog.json options[].id.',
      ids.dialogOptionIds,
    ),
    emitLooseStringType(
      'GameVerbId',
      'Verb ids from src/game/game-config.json verbs[] (or engine defaults when omitted).',
      ids.gameVerbIds,
    ),
    emitLooseStringType(
      'VideoId',
      'Video stem ids from src/game/assets/videos/<stem>.{mp4,webm} (basename without extension).',
      ids.videoIds,
    ),
    `/** Prop, hotspot, or spawned character id: something a verb can target in a room. */\nexport type VerbTargetId = PropId | HotspotId | CharacterId;\n`,
    `/** Walk / teleport string target: prop → hotspot → character → room point (see RoomScene.resolveMovementTarget). */\nexport type ResolvableTargetId = PropId | HotspotId | CharacterId | PointId;\n`,
  ];

  const content = header + blocks.join('\n');

  if (check) {
    const existing = await readFile(outPath, 'utf8').catch(() => '');
    if (existing !== content) throw new Error('Generated game IDs are stale. Run npm run generate:game-ids.');
    if (!quiet) console.log('[generate-game-ids] Declarations are current.');
  } else {
    const existing = await readFile(outPath, 'utf8').catch(() => null);
    if (existing !== content) {
      await mkdir(outDir, { recursive: true });
      await writeFile(tmpPath, content, 'utf8');
      await rename(tmpPath, outPath);
      if (!quiet) console.log(`[generate-game-ids] Wrote ${path.relative(repoRoot, outPath)}`);
    }
  }

  if (!(await generateHandles())) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[generate-game-ids] Failed:', err);
  process.exit(1);
});
