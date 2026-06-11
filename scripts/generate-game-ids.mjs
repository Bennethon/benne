#!/usr/bin/env node
/**
 * Generates src/types/generated/benne-game-ids.d.ts from src/game/ content.
 */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanGameContentIds } from './lib/scanGameContentIds.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gameRoot = path.join(repoRoot, 'src', 'game');
const outDir = path.join(repoRoot, 'src', 'types', 'generated');
const outPath = path.join(outDir, 'benne-game-ids.d.ts');
const tmpPath = `${outPath}.tmp`;

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
    `/** Prop, hotspot, or spawned character id for room verb handlers (whenLookAt, whenVerb, whenInventoryUsedOn). */\nexport type VerbTargetId = PropId | HotspotId | CharacterId;\n`,
    `/** Walk / teleport string target: prop → hotspot → character → room point (see RoomScene.resolveMovementTarget). */\nexport type ResolvableTargetId = PropId | HotspotId | CharacterId | PointId;\n`,
  ];

  const content = header + blocks.join('\n');

  await mkdir(outDir, { recursive: true });
  await writeFile(tmpPath, content, 'utf8');
  await rename(tmpPath, outPath);

  console.log(`[generate-game-ids] Wrote ${path.relative(repoRoot, outPath)}`);
}

main().catch((err) => {
  console.error('[generate-game-ids] Failed:', err);
  process.exit(1);
});
