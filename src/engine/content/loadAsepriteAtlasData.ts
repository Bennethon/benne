import {
  cursorPhaserAnimationKey,
  guiPhaserAnimationKey,
  perItemInventoryPhaserAnimationKey,
  roomPropPhaserAnimationKey,
} from './asepritePhaserAnimationKeys';
import { normalizeAsepriteJsonForPhaser } from './normalizeAsepriteJson';

const characterJsonModules = import.meta.glob('/src/game/assets/images/characters/**/*.json', {
  eager: true,
}) as Record<string, { default?: Record<string, unknown> } | Record<string, unknown>>;

const roomJsonModules = import.meta.glob('/src/game/assets/images/rooms/**/*.json', {
  eager: true,
}) as Record<string, { default?: Record<string, unknown> } | Record<string, unknown>>;

/** Aseprite sheets for collectibles / inventory UI: `images/inventory/<id>/<id>.json` + `.png` (same layout as characters). */
const inventoryJsonModules = import.meta.glob('/src/game/assets/images/inventory/**/*.json', {
  eager: true,
}) as Record<string, { default?: Record<string, unknown> } | Record<string, unknown>>;

/** GUI overlay sheets: `images/guis/<id>/<id>.json` + `.png`. */
const guiJsonModules = import.meta.glob('/src/game/assets/images/guis/**/*.json', {
  eager: true,
}) as Record<string, { default?: Record<string, unknown> } | Record<string, unknown>>;

const CURSOR_JSON_KEY = '/src/game/assets/images/cursor/cursor.json';

const cursorJsonModules = import.meta.glob('/src/game/assets/images/cursor/cursor.json', {
  eager: true,
}) as Record<string, { default?: Record<string, unknown> } | Record<string, unknown>>;

const SHARED_INVENTORY_JSON_KEY = '/src/game/assets/images/inventory/inventory.json';

export type AsepriteAssetSheetKind = 'character' | 'room' | 'inventory' | 'gui';

function rawJsonFromModule(mod: { default?: Record<string, unknown> } | Record<string, unknown>): Record<string, unknown> {
  if (mod && typeof mod === 'object' && 'default' in mod && mod.default && typeof mod.default === 'object') {
    return mod.default as Record<string, unknown>;
  }
  return mod as Record<string, unknown>;
}

function bundledAsepriteJsonKey(kind: AsepriteAssetSheetKind, id: string): string {
  switch (kind) {
    case 'character':
      return `/src/game/assets/images/characters/${id}/${id}.json`;
    case 'room':
      return `/src/game/assets/images/rooms/${id}/${id}.json`;
    case 'inventory':
      return `/src/game/assets/images/inventory/${id}/${id}.json`;
    case 'gui':
      return `/src/game/assets/images/guis/${id}/${id}.json`;
  }
}

function moduleMapForKind(kind: AsepriteAssetSheetKind): Record<string, { default?: Record<string, unknown> } | Record<string, unknown>> {
  switch (kind) {
    case 'character':
      return characterJsonModules;
    case 'room':
      return roomJsonModules;
    case 'inventory':
      return inventoryJsonModules;
    case 'gui':
      return guiJsonModules;
  }
}

function kindLabel(kind: AsepriteAssetSheetKind): string {
  switch (kind) {
    case 'character':
      return 'character';
    case 'room':
      return 'room';
    case 'inventory':
      return 'inventory';
    case 'gui':
      return 'gui';
  }
}

function getBundledAsepriteRawJson(kind: AsepriteAssetSheetKind, id: string): Record<string, unknown> {
  const key = bundledAsepriteJsonKey(kind, id);
  const mod = moduleMapForKind(kind)[key];
  if (!mod) {
    const available = Object.keys(moduleMapForKind(kind)).join(', ');
    throw new Error(
      `Missing Aseprite JSON for ${kindLabel(kind)} '${id}' (expected Vite glob key '${key}'). Keys: ${available}`,
    );
  }
  return rawJsonFromModule(mod);
}

/** Raw GUI sheet JSON (unprefixed `meta.frameTags` / `meta.slices`; used by 9-slice layout). */
export function getBundledGuiAsepriteRawJson(guiId: string): Record<string, unknown> {
  return getBundledAsepriteRawJson('gui', guiId);
}

/**
 * Names from Aseprite `meta.frameTags`. Cels with no tag do not appear — only tagged clips can be referenced
 * as prop `tag`, character animation keys, inventory sheet tags, etc.
 */
export function readAsepriteFrameTagNamesFromRawJson(raw: Record<string, unknown>): readonly string[] {
  const meta = raw.meta;
  if (!meta || typeof meta !== 'object') {
    return [];
  }
  const frameTags = (meta as { frameTags?: readonly { name: string }[] }).frameTags;
  if (!Array.isArray(frameTags) || frameTags.length === 0) {
    return [];
  }
  return frameTags.map((t) => t.name);
}

/**
 * Frame-tag names for a bundled character, room, inventory, or GUI Aseprite sheet (`images/<kind folder>/<id>/<id>.json`).
 */
export function getAsepriteFrameTagNames(kind: AsepriteAssetSheetKind, id: string): readonly string[] {
  const raw = getBundledAsepriteRawJson(kind, id);
  return readAsepriteFrameTagNamesFromRawJson(raw);
}

/** @see getAsepriteFrameTagNames */
export function getCharacterAsepriteFrameTagNames(characterId: string): readonly string[] {
  return getAsepriteFrameTagNames('character', characterId);
}

/** @see getAsepriteFrameTagNames */
export function getRoomAsepriteFrameTagNames(roomId: string): readonly string[] {
  return getAsepriteFrameTagNames('room', roomId);
}

/** @see getAsepriteFrameTagNames */
export function getInventoryAsepriteFrameTagNames(inventoryId: string): readonly string[] {
  return getAsepriteFrameTagNames('inventory', inventoryId);
}

/** @see getAsepriteFrameTagNames */
export function getGuiAsepriteFrameTagNames(guiId: string): readonly string[] {
  return getAsepriteFrameTagNames('gui', guiId);
}

/**
 * Logs a warning for each key in `animationConfig` that is not present on the sheet’s `frameTags`.
 */
export function warnIfAnimationConfigKeysMissingFromFrameTags(
  contextLabel: string,
  frameTagNames: readonly string[],
  animationConfig: Record<string, unknown> | undefined,
): void {
  if (!animationConfig || Object.keys(animationConfig).length === 0) {
    return;
  }
  const set = new Set(frameTagNames);
  if (set.size === 0) {
    console.warn(`[Benne] ${contextLabel}: sheet has no meta.frameTags; animation config keys cannot be validated.`);
    return;
  }
  for (const key of Object.keys(animationConfig)) {
    if (!set.has(key)) {
      console.warn(
        `[Benne] ${contextLabel}: animations['${key}'] is not an Aseprite frame tag on this sheet (untagged cels are not animations).`,
      );
    }
  }
}

/**
 * Loads bundled Aseprite JSON for `images/characters/<id>/<id>.json`, normalizes frame keys for Phaser, and returns a plain object for `load.aseprite({ atlasURL })`.
 */
export function getNormalizedAsepriteAtlasData(characterId: string): Record<string, unknown> {
  return normalizeAsepriteJsonForPhaser(getBundledAsepriteRawJson('character', characterId)) as Record<string, unknown>;
}

/** In-place; used by runtime normalization and editor preview blobs. */
export function prefixRoomAsepriteFrameTags(data: Record<string, unknown>, roomId: string): void {
  const meta = data.meta;
  if (!meta || typeof meta !== 'object') {
    return;
  }
  const frameTags = (meta as { frameTags?: { name: string }[] }).frameTags;
  if (!Array.isArray(frameTags)) {
    return;
  }
  for (const tag of frameTags) {
    if (tag && typeof tag.name === 'string' && tag.name.length > 0) {
      tag.name = roomPropPhaserAnimationKey(roomId, tag.name);
    }
  }
}

/**
 * Loads bundled Aseprite JSON for `images/rooms/<roomId>/<roomId>.json`, with `meta.frameTags[].name`
 * prefixed as `room:<roomId>:<tag>` so clips do not collide with GUI / inventory / other rooms on the global
 * {@link Phaser.Animations.AnimationManager}.
 */
export function getNormalizedRoomAsepriteAtlasData(roomId: string): Record<string, unknown> {
  const normalized = normalizeAsepriteJsonForPhaser(getBundledAsepriteRawJson('room', roomId)) as Record<
    string,
    unknown
  >;
  prefixRoomAsepriteFrameTags(normalized, roomId);
  return normalized;
}

/** In-place; used by runtime normalization and editor preview blobs. */
export function prefixPerItemInventoryAsepriteFrameTags(data: Record<string, unknown>, inventoryId: string): void {
  const meta = data.meta;
  if (!meta || typeof meta !== 'object') {
    return;
  }
  const frameTags = (meta as { frameTags?: { name: string }[] }).frameTags;
  if (!Array.isArray(frameTags)) {
    return;
  }
  for (const tag of frameTags) {
    if (tag && typeof tag.name === 'string' && tag.name.length > 0) {
      tag.name = perItemInventoryPhaserAnimationKey(inventoryId, tag.name);
    }
  }
}

/**
 * Loads bundled Aseprite JSON for `images/inventory/<id>/<id>.json`, with each `meta.frameTags[].name`
 * prefixed as `invitem:<id>:<tag>` so per-item clips do not collide with room props or other sheets.
 */
export function getNormalizedInventoryAsepriteAtlasData(inventoryId: string): Record<string, unknown> {
  const normalized = normalizeAsepriteJsonForPhaser(getBundledAsepriteRawJson('inventory', inventoryId)) as Record<
    string,
    unknown
  >;
  prefixPerItemInventoryAsepriteFrameTags(normalized, inventoryId);
  return normalized;
}

function prefixSharedInventoryFrameTagNames(data: Record<string, unknown>): void {
  const meta = data.meta;
  if (!meta || typeof meta !== 'object') {
    return;
  }
  const frameTags = (meta as { frameTags?: { name: string }[] }).frameTags;
  if (!Array.isArray(frameTags)) {
    return;
  }
  for (const tag of frameTags) {
    if (tag && typeof tag.name === 'string' && tag.name.length > 0 && !tag.name.startsWith('inventory:')) {
      tag.name = `inventory:${tag.name}`;
    }
  }
}

export function hasBundledSharedInventorySheet(): boolean {
  return SHARED_INVENTORY_JSON_KEY in inventoryJsonModules;
}

function getBundledSharedInventoryRawJson(): Record<string, unknown> {
  const mod = inventoryJsonModules[SHARED_INVENTORY_JSON_KEY];
  if (!mod) {
    throw new Error(
      `Missing shared inventory Aseprite JSON (expected Vite glob key '${SHARED_INVENTORY_JSON_KEY}').`,
    );
  }
  return rawJsonFromModule(mod);
}

/**
 * Shared `inventory.json` normalized for Phaser, with each `meta.frameTags[].name` prefixed as `inventory:<tag>`
 * so animations do not collide with per-item sheets or room/character tags.
 */
export function getNormalizedSharedInventoryAsepriteAtlasData(): Record<string, unknown> {
  const normalized = normalizeAsepriteJsonForPhaser(getBundledSharedInventoryRawJson()) as Record<
    string,
    unknown
  >;
  prefixSharedInventoryFrameTagNames(normalized);
  return normalized;
}

/** Frame-tag names after the `inventory:` prefix applied for the shared sheet. */
export function getSharedInventoryAsepriteFrameTagNames(): readonly string[] {
  const raw = getBundledSharedInventoryRawJson();
  const names = readAsepriteFrameTagNamesFromRawJson(raw);
  return names.map((n) => (n.startsWith('inventory:') ? n : `inventory:${n}`));
}

/** In-place; used by runtime normalization and editor preview blobs. */
export function prefixGuiAsepriteFrameTags(data: Record<string, unknown>, guiId: string): void {
  const meta = data.meta;
  if (!meta || typeof meta !== 'object') {
    return;
  }
  const frameTags = (meta as { frameTags?: { name: string }[] }).frameTags;
  if (!Array.isArray(frameTags)) {
    return;
  }
  for (const tag of frameTags) {
    if (tag && typeof tag.name === 'string' && tag.name.length > 0) {
      tag.name = guiPhaserAnimationKey(guiId, tag.name);
    }
  }
}

/**
 * Loads bundled Aseprite JSON for `images/guis/<id>/<id>.json`, with each `meta.frameTags[].name` prefixed as
 * `gui:<guiId>:<tag>` so GUI clips do not collide with room props or inventory on the global animation manager.
 */
export function getNormalizedGuiAsepriteAtlasData(guiId: string): Record<string, unknown> {
  const normalized = normalizeAsepriteJsonForPhaser(getBundledAsepriteRawJson('gui', guiId)) as Record<
    string,
    unknown
  >;
  prefixGuiAsepriteFrameTags(normalized, guiId);
  return normalized;
}

function getBundledCursorAsepriteRawJson(): Record<string, unknown> {
  const mod = cursorJsonModules[CURSOR_JSON_KEY];
  if (!mod) {
    throw new Error(`Missing Aseprite JSON for game cursor (expected Vite glob key '${CURSOR_JSON_KEY}').`);
  }
  return rawJsonFromModule(mod);
}

/** True when `src/game/assets/images/cursor/cursor.json` is present in the bundle. */
export function hasBundledCursorSheet(): boolean {
  return CURSOR_JSON_KEY in cursorJsonModules;
}

/** In-place; used by runtime normalization and editor preview blobs. */
export function prefixCursorAsepriteFrameTags(data: Record<string, unknown>): void {
  const meta = data.meta;
  if (!meta || typeof meta !== 'object') {
    return;
  }
  const frameTags = (meta as { frameTags?: { name: string }[] }).frameTags;
  if (!Array.isArray(frameTags)) {
    return;
  }
  for (const tag of frameTags) {
    if (tag && typeof tag.name === 'string' && tag.name.length > 0) {
      tag.name = cursorPhaserAnimationKey(tag.name);
    }
  }
}

export function getNormalizedCursorAsepriteAtlasData(): Record<string, unknown> {
  const normalized = normalizeAsepriteJsonForPhaser(getBundledCursorAsepriteRawJson()) as Record<string, unknown>;
  prefixCursorAsepriteFrameTags(normalized);
  return normalized;
}

/** Frame-tag names on the bundled cursor sheet (`images/cursor/cursor.json`). */
export function getCursorAsepriteFrameTagNames(): readonly string[] {
  return readAsepriteFrameTagNamesFromRawJson(getBundledCursorAsepriteRawJson());
}
