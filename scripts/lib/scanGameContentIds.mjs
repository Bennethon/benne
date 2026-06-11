#!/usr/bin/env node
/**
 * Scans `src/game/` for Bennescript content ids (mirrors benne-editor/gameDiscovery.ts conventions).
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import * as path from 'node:path';

/** Matches engine / editor defaults when `verbs` is omitted in game-config.json. */
export const DEFAULT_GAME_VERBS = [
  { id: 'look', label: 'Look at', preposition: 'at' },
  { id: 'use', label: 'Use', preposition: 'on' },
];

/**
 * @param {string} gameRoot Absolute path to `src/game/`.
 */
export async function scanGameContentIds(gameRoot) {
  const ids = {
    roomIds: [],
    characterIds: [],
    dialogIds: [],
    guiIds: [],
    inventoryItemIds: [],
    propIds: [],
    hotspotIds: [],
    regionIds: [],
    pointIds: [],
    dialogOptionIds: [],
    gameVerbIds: [],
    videoIds: [],
  };

  const meta = {
    rooms: /** @type {Record<string, { name?: string }>} */ ({}),
    characters: /** @type {Record<string, { name?: string }>} */ ({}),
    dialogs: /** @type {Record<string, { displayName?: string }>} */ ({}),
    guis: /** @type {Record<string, { name?: string }>} */ ({}),
    inventory: /** @type {Record<string, { name?: string }>} */ ({}),
    props: /** @type {Record<string, { tag?: string; roomId?: string }>} */ ({}),
    hotspots: /** @type {Record<string, { description?: string; roomId?: string }>} */ ({}),
    regions: /** @type {Record<string, { roomId?: string }>} */ ({}),
    points: /** @type {Record<string, { roomId?: string }>} */ ({}),
    dialogOptions: /** @type {Record<string, { text?: string; dialogId?: string }>} */ ({}),
    verbs: /** @type {Record<string, { label?: string }>} */ ({}),
  };

  const propIdSet = new Set();
  const hotspotIdSet = new Set();
  const regionIdSet = new Set();
  const pointIdSet = new Set();
  const dialogOptionIdSet = new Set();

  await scanFolderEntities(gameRoot, 'rooms', '.room.json', ids.roomIds, meta.rooms, readRoomMeta);
  await scanFolderEntities(
    gameRoot,
    'characters',
    '.character.json',
    ids.characterIds,
    meta.characters,
    readCharacterMeta,
  );
  await scanFolderEntities(
    gameRoot,
    'dialogs',
    '.dialog.json',
    ids.dialogIds,
    meta.dialogs,
    readDialogMeta,
  );
  await scanFolderEntities(gameRoot, 'guis', '.gui.json', ids.guiIds, meta.guis, readGuiMeta);
  await scanFolderEntities(
    gameRoot,
    'inventory',
    '.inventory.json',
    ids.inventoryItemIds,
    meta.inventory,
    readInventoryMeta,
  );

  await scanAllRoomJson(gameRoot, (roomId, data) => {
    collectRoomScopedIds(roomId, data, {
      propIdSet,
      hotspotIdSet,
      regionIdSet,
      pointIdSet,
      meta,
    });
  });

  await scanAllDialogJson(gameRoot, (dialogId, data) => {
    collectDialogOptions(dialogId, data, dialogOptionIdSet, meta.dialogOptions);
  });

  ids.propIds = sortUnique([...propIdSet]);
  ids.hotspotIds = sortUnique([...hotspotIdSet]);
  ids.regionIds = sortUnique([...regionIdSet]);
  ids.pointIds = sortUnique([...pointIdSet]);
  ids.dialogOptionIds = sortUnique([...dialogOptionIdSet]);

  ids.gameVerbIds = await readGameConfigVerbIds(gameRoot, meta.verbs);

  ids.videoIds = await scanAssetStems(path.join(gameRoot, 'assets', 'videos'), ['.mp4', '.webm']);

  sortAllIdArrays(ids);

  return { ids, meta };
}

/**
 * Room-scoped ids from a single room JSON file (editor parity helper).
 * @param {string} roomJsonPath Absolute path to `*.room.json`.
 */
export async function getRoomScopedIds(roomJsonPath) {
  const raw = await readFile(roomJsonPath, 'utf8');
  const data = JSON.parse(raw);
  const roomId = path.basename(path.dirname(roomJsonPath));
  const propIds = [];
  const hotspotIds = [];
  const regionIds = [];
  const pointIds = [];
  const characterIds = [];

  if (Array.isArray(data.props)) {
    for (const p of data.props) {
      if (p && typeof p === 'object' && typeof p.id === 'string' && p.id.length > 0) {
        propIds.push(p.id);
      }
    }
  }
  if (Array.isArray(data.hotspots)) {
    for (const h of data.hotspots) {
      if (h && typeof h === 'object' && typeof h.id === 'string' && h.id.length > 0) {
        hotspotIds.push(h.id);
      }
    }
  }
  if (Array.isArray(data.regions)) {
    for (const r of data.regions) {
      if (r && typeof r === 'object' && typeof r.id === 'string' && r.id.length > 0) {
        regionIds.push(r.id);
      }
    }
  }
  if (Array.isArray(data.points)) {
    for (const pt of data.points) {
      if (pt && typeof pt === 'object' && typeof pt.id === 'string' && pt.id.length > 0) {
        pointIds.push(pt.id);
      }
    }
  }
  if (Array.isArray(data.characters)) {
    for (const c of data.characters) {
      if (c && typeof c === 'object' && typeof c.definition === 'string') {
        const seg = c.definition.split('/')[0]?.trim();
        if (seg) {
          characterIds.push(seg);
        }
      }
    }
  }

  return {
    roomId,
    propIds: sortUnique(propIds),
    hotspotIds: sortUnique(hotspotIds),
    regionIds: sortUnique(regionIds),
    pointIds: sortUnique(pointIds),
    characterIds: sortUnique(characterIds),
  };
}

async function scanFolderEntities(gameRoot, subdir, suffix, outIds, metaMap, readMeta) {
  const dir = path.join(gameRoot, subdir);
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) {
      continue;
    }
    const id = ent.name;
    const jsonPath = path.join(dir, id, `${id}${suffix}`);
    try {
      const st = await stat(jsonPath);
      if (!st.isFile()) {
        continue;
      }
    } catch {
      continue;
    }
    outIds.push(id);
    metaMap[id] = await readMeta(jsonPath, id);
  }
}

/**
 * Recursively collects deduped basename stems (filename without extension) of asset files under
 * `dir` whose extension is in `extensions` (lowercased, including the leading dot). Mirrors the
 * basename-only keying used by `import.meta.glob('../assets/videos/**')` in `resolveGameAssetUrl.ts`.
 * @param {string} dir Absolute path to the asset folder (e.g. `src/game/assets/videos`).
 * @param {string[]} extensions Allowed extensions, e.g. `['.mp4', '.webm']`.
 */
async function scanAssetStems(dir, extensions) {
  const stems = new Set();
  const allowed = new Set(extensions.map((e) => e.toLowerCase()));

  /** @param {string} current */
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!ent.isFile()) {
        continue;
      }
      const ext = path.extname(ent.name).toLowerCase();
      if (!allowed.has(ext)) {
        continue;
      }
      const stem = ent.name.slice(0, ent.name.length - ext.length);
      if (stem.length > 0) {
        stems.add(stem);
      }
    }
  }

  await walk(dir);
  return sortUnique([...stems]);
}

async function scanAllRoomJson(gameRoot, onRoom) {
  const roomsDir = path.join(gameRoot, 'rooms');
  let entries;
  try {
    entries = await readdir(roomsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) {
      continue;
    }
    const roomId = ent.name;
    const jsonPath = path.join(roomsDir, roomId, `${roomId}.room.json`);
    try {
      const raw = await readFile(jsonPath, 'utf8');
      onRoom(roomId, JSON.parse(raw));
    } catch {
      // skip unreadable rooms
    }
  }
}

async function scanAllDialogJson(gameRoot, onDialog) {
  const dialogsDir = path.join(gameRoot, 'dialogs');
  let entries;
  try {
    entries = await readdir(dialogsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) {
      continue;
    }
    const dialogId = ent.name;
    const jsonPath = path.join(dialogsDir, dialogId, `${dialogId}.dialog.json`);
    try {
      const raw = await readFile(jsonPath, 'utf8');
      onDialog(dialogId, JSON.parse(raw));
    } catch {
      // skip
    }
  }
}

function collectRoomScopedIds(roomId, data, ctx) {
  if (Array.isArray(data.props)) {
    for (const p of data.props) {
      if (p && typeof p === 'object' && typeof p.id === 'string' && p.id.length > 0) {
        ctx.propIdSet.add(p.id);
        if (!ctx.meta.props[p.id]) {
          ctx.meta.props[p.id] = {
            tag: typeof p.tag === 'string' ? p.tag : undefined,
            roomId,
          };
        }
      }
    }
  }
  if (Array.isArray(data.hotspots)) {
    for (const h of data.hotspots) {
      if (h && typeof h === 'object' && typeof h.id === 'string' && h.id.length > 0) {
        ctx.hotspotIdSet.add(h.id);
        if (!ctx.meta.hotspots[h.id]) {
          ctx.meta.hotspots[h.id] = {
            description: typeof h.description === 'string' ? h.description : undefined,
            roomId,
          };
        }
      }
    }
  }
  if (Array.isArray(data.regions)) {
    for (const r of data.regions) {
      if (r && typeof r === 'object' && typeof r.id === 'string' && r.id.length > 0) {
        ctx.regionIdSet.add(r.id);
        if (!ctx.meta.regions[r.id]) {
          ctx.meta.regions[r.id] = { roomId };
        }
      }
    }
  }
  if (Array.isArray(data.points)) {
    for (const pt of data.points) {
      if (pt && typeof pt === 'object' && typeof pt.id === 'string' && pt.id.length > 0) {
        ctx.pointIdSet.add(pt.id);
        if (!ctx.meta.points[pt.id]) {
          ctx.meta.points[pt.id] = { roomId };
        }
      }
    }
  }
}

function collectDialogOptions(dialogId, data, optionIdSet, metaMap) {
  if (!Array.isArray(data.options)) {
    return;
  }
  for (const opt of data.options) {
    if (opt && typeof opt === 'object' && typeof opt.id === 'string' && opt.id.length > 0) {
      optionIdSet.add(opt.id);
      if (!metaMap[opt.id]) {
        metaMap[opt.id] = {
          text: typeof opt.text === 'string' ? opt.text : undefined,
          dialogId,
        };
      }
    }
  }
}

async function readGameConfigVerbIds(gameRoot, metaVerbs) {
  const configPath = path.join(gameRoot, 'game-config.json');
  try {
    const raw = await readFile(configPath, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.verbs) || data.verbs.length === 0) {
      return DEFAULT_GAME_VERBS.map((v) => {
        metaVerbs[v.id] = { label: v.label };
        return v.id;
      });
    }
    const out = [];
    for (const v of data.verbs) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) {
        continue;
      }
      const id = typeof v.id === 'string' && v.id.length > 0 ? v.id : undefined;
      if (!id) {
        continue;
      }
      out.push(id);
      metaVerbs[id] = {
        label: typeof v.label === 'string' && v.label.length > 0 ? v.label : undefined,
      };
    }
    return out.length > 0 ? sortUnique(out) : DEFAULT_GAME_VERBS.map((v) => v.id);
  } catch {
    return DEFAULT_GAME_VERBS.map((v) => {
      metaVerbs[v.id] = { label: v.label };
      return v.id;
    });
  }
}

async function readRoomMeta(jsonPath, fallbackId) {
  try {
    const data = JSON.parse(await readFile(jsonPath, 'utf8'));
    const name =
      typeof data.name === 'string' && data.name.length > 0 ? data.name : fallbackId;
    return { name };
  } catch {
    return { name: fallbackId };
  }
}

async function readCharacterMeta(jsonPath, fallbackId) {
  try {
    const data = JSON.parse(await readFile(jsonPath, 'utf8'));
    const name =
      typeof data.name === 'string' && data.name.length > 0 ? data.name : fallbackId;
    return { name };
  } catch {
    return { name: fallbackId };
  }
}

async function readDialogMeta(jsonPath, fallbackId) {
  try {
    const data = JSON.parse(await readFile(jsonPath, 'utf8'));
    const fromDisplay =
      typeof data.displayName === 'string' && data.displayName.trim().length > 0
        ? data.displayName.trim()
        : undefined;
    return { displayName: fromDisplay ?? fallbackId };
  } catch {
    return { displayName: fallbackId };
  }
}

async function readGuiMeta(jsonPath, fallbackId) {
  try {
    const data = JSON.parse(await readFile(jsonPath, 'utf8'));
    const name =
      typeof data.name === 'string' && data.name.length > 0 ? data.name : fallbackId;
    return { name };
  } catch {
    return { name: fallbackId };
  }
}

async function readInventoryMeta(jsonPath, fallbackId) {
  try {
    const data = JSON.parse(await readFile(jsonPath, 'utf8'));
    const name =
      typeof data.name === 'string' && data.name.length > 0 ? data.name : fallbackId;
    return { name };
  } catch {
    return { name: fallbackId };
  }
}

function sortUnique(arr) {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b));
}

function sortAllIdArrays(ids) {
  for (const key of Object.keys(ids)) {
    if (Array.isArray(ids[key])) {
      ids[key].sort((a, b) => a.localeCompare(b));
    }
  }
}
