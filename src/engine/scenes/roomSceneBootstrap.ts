import * as Phaser from 'phaser';
import {
  getAsepriteFrameTagNames,
  getNormalizedAsepriteAtlasData,
  getNormalizedRoomAsepriteAtlasData,
  warnIfAnimationConfigKeysMissingFromFrameTags,
} from '../../game/loadAsepriteAtlasData';
import { getAsepriteAssetPaths, getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/characterAseprite';
import { getRoomAsepriteAssetPaths, getRoomAsepriteTextureKey } from '../../game/roomAseprite';
import { loadCharacterData } from '../../game/loadCharacterData';
import { resolveGameAssetUrl } from '../../game/resolveGameAssetUrl';
import type { RoomCharacterInstance, RoomData } from '../../types/room';
import type { CharacterData } from '../../types/character';
import type { RoomCharacterSpawn, RoomPropSpawn, RoomSceneStartData } from './BootScene';

/**
 * Build {@link RoomSceneStartData} for a **resolved** `room` (same shape as the shipped {@link import('./BootScene.js').BootScene} loader path).
 */
export function buildRoomSceneStartDataFromRoomData(room: RoomData): RoomSceneStartData {
  const backgroundTextureKey = room.background?.image ? `bg:${room.id}` : null;
  const sheetTagNames = room.props?.length ? getAsepriteFrameTagNames('room', room.id) : [];
  const sheetTagSet = new Set(sheetTagNames);

  if (room.props?.length && sheetTagNames.length === 0) {
    console.warn(
      `[Benne] Room '${room.id}' lists props but '${room.id}.json' has no meta.frameTags — no room props will load.`,
    );
  }

  const propsWithSheetTags =
    room.props?.filter((p) => {
      if (sheetTagSet.has(p.tag)) {
        return true;
      }
      console.warn(
        `[Benne] Room '${room.id}' prop '${p.id}' tag '${p.tag}' is not an Aseprite frame tag on this sheet (untagged cels are not props) — skipped.`,
      );
      return false;
    }) ?? [];

  for (const p of propsWithSheetTags) {
    warnIfAnimationConfigKeysMissingFromFrameTags(
      `Room '${room.id}' prop '${p.id}'`,
      sheetTagNames,
      p.animations as Record<string, unknown> | undefined,
    );
  }

  const roomPropsTextureKey = propsWithSheetTags.length > 0 ? getRoomAsepriteTextureKey(room.id) : null;

  const spawns: RoomCharacterSpawn[] = [];
  for (const inst of room.characters ?? []) {
    appendCharacterSpawnForRoom(inst, spawns);
  }

  const propSpawns: RoomPropSpawn[] =
    propsWithSheetTags.length > 0 && roomPropsTextureKey
      ? propsWithSheetTags.map((p) => ({
          id: p.id,
          textureKey: roomPropsTextureKey,
          tag: p.tag,
          x: p.x ?? 0,
          y: p.y ?? 0,
          data: p,
        }))
      : [];

  return {
    room,
    backgroundTextureKey,
    characters: spawns,
    props: propSpawns,
    roomPropsTextureKey,
  };
}

/**
 * Queues the same **room-local** assets the shipped boot path loads for a given {@link RoomSceneStartData}:
 * background, room props Aseprite, and per-character image / Aseprite.
 */
export function queueRoomSceneAssetLoads(scene: Phaser.Scene, data: RoomSceneStartData): void {
  const { room, backgroundTextureKey, roomPropsTextureKey, characters } = data;
  const tex = scene.textures;
  const load = scene.load;

  if (room.background?.image && backgroundTextureKey && !tex.exists(backgroundTextureKey)) {
    load.image(backgroundTextureKey, resolveGameAssetUrl(room.background.image));
  }

  if (roomPropsTextureKey && (room.props?.length ?? 0) > 0 && !tex.exists(roomPropsTextureKey)) {
    const paths = getRoomAsepriteAssetPaths(room.id);
    load.aseprite({
      key: roomPropsTextureKey,
      textureURL: resolveGameAssetUrl(paths.png),
      atlasURL: getNormalizedRoomAsepriteAtlasData(room.id),
    });
  }

  const dedupeAsepriteCharIds = new Set<string>();
  const dedupeImageInstanceKeys = new Set<string>();
  for (const spawn of characters) {
    if (spawn.loadKind === 'aseprite') {
      if (dedupeAsepriteCharIds.has(spawn.data.id) || tex.exists(spawn.textureKey)) {
        continue;
      }
      dedupeAsepriteCharIds.add(spawn.data.id);
      const characterFrameTags = getAsepriteFrameTagNames('character', spawn.data.id);
      warnIfAnimationConfigKeysMissingFromFrameTags(
        `Character '${spawn.data.id}'`,
        characterFrameTags,
        spawn.data.animations as Record<string, unknown> | undefined,
      );
      const paths = getAsepriteAssetPaths(spawn.data.id);
      load.aseprite({
        key: spawn.textureKey,
        textureURL: resolveGameAssetUrl(paths.png),
        atlasURL: getNormalizedAsepriteAtlasData(spawn.data.id),
      });
    } else {
      if (dedupeImageInstanceKeys.has(spawn.textureKey) || tex.exists(spawn.textureKey)) {
        continue;
      }
      dedupeImageInstanceKeys.add(spawn.textureKey);
      load.image(spawn.textureKey, resolveGameAssetUrl(spawn.data.display.defaultImage!));
    }
  }
}

/**
 * Pushes one character row for {@link RoomSceneStartData} (no loader; see {@link queueRoomSceneAssetLoads}).
 */
export function appendCharacterSpawnForRoom(inst: RoomCharacterInstance, spawns: RoomCharacterSpawn[]): void {
  const data: CharacterData = loadCharacterData(inst.definition);

  if (usesAsepriteDisplay(data)) {
    const textureKey = getAsepriteTextureKey(data.id);
    spawns.push({
      instanceId: inst.instanceId,
      x: inst.x,
      y: inst.y,
      data,
      loadKind: 'aseprite',
      textureKey,
      initialFacing: inst.initialFacing,
      initialAnimation: inst.initialAnimation,
      visible: inst.visible,
      zIndex: inst.zIndex,
    });
    return;
  }

  const textureKey = `char:${inst.instanceId}`;
  spawns.push({
    instanceId: inst.instanceId,
    x: inst.x,
    y: inst.y,
    data,
    loadKind: 'image',
    textureKey,
    initialFacing: inst.initialFacing,
    initialAnimation: inst.initialAnimation,
    visible: inst.visible,
    zIndex: inst.zIndex,
  });
}
