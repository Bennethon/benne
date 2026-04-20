import * as Phaser from 'phaser';
import { applyBootAudioSettings } from '../applyAudioFromSettings';
import { getAsepriteAssetPaths, getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/characterAseprite';
import {
  getAsepriteFrameTagNames,
  getCursorAsepriteFrameTagNames,
  getNormalizedAsepriteAtlasData,
  getNormalizedCursorAsepriteAtlasData,
  getNormalizedGuiAsepriteAtlasData,
  getNormalizedInventoryAsepriteAtlasData,
  getNormalizedRoomAsepriteAtlasData,
  getNormalizedSharedInventoryAsepriteAtlasData,
  hasBundledCursorSheet,
  hasBundledSharedInventorySheet,
  warnIfAnimationConfigKeysMissingFromFrameTags,
} from '../../game/loadAsepriteAtlasData';
import {
  getPerItemInventoryAsepritePaths,
  getPerItemInventoryTextureKey,
  sharedInventoryAssetPaths,
  sharedInventoryTextureKey,
  usesPerItemInventoryAseprite,
  usesSharedInventoryAseprite,
} from '../../game/inventoryAseprite';
import { getInventoryDefinition, getRegisteredInventoryDefinitionIds } from '../inventory/inventoryDefinitionRegistry.js';
import { getRoomAsepriteAssetPaths, getRoomAsepriteTextureKey } from '../../game/roomAseprite';
import { SCENE_BOOT, SCENE_ROOM } from '../../game/constants';
import { loadCharacterData } from '../../game/loadCharacterData';
import { loadStartRoomData } from '../../game/loadStartRoom';
import {
  getAsepriteAssetPaths as getGuiAsepriteAssetPaths,
  getAsepriteTextureKey as getGuiAsepriteTextureKey,
  usesAsepriteDisplay as usesGuiAsepriteDisplay,
} from '../../game/guiAseprite';
import { getAllGuiData } from '../../game/loadGuiData';
import { queueGuiFontsForBootLoader } from '../../game/queueGuiFontsForBootLoader';
import { resolveGameAssetUrl } from '../../game/resolveGameAssetUrl';
import { CURSOR_TEXTURE_KEY, getCursorAsepriteAssetPaths, isBenneGameCursorAsepriteEnabled } from '../../game/cursorAseprite';
import { getGameSettings } from '../ConfigManager';
import type { CharacterFacingLetter, CharacterData } from '../../types/character';
import type { RoomCharacterInstance, RoomData, RoomPropInstance } from '../../types/room';

export type CharacterSpawnLoadKind = 'aseprite' | 'image';

export interface RoomCharacterSpawn {
  instanceId: string;
  x: number;
  y: number;
  data: CharacterData;
  loadKind: CharacterSpawnLoadKind;
  /** `aseprite:<id>` or `char:<instanceId>` */
  textureKey: string;
  initialFacing?: CharacterFacingLetter;
  initialAnimation?: string;
  visible?: boolean;
  zIndex?: number;
}

export interface RoomPropSpawn {
  id: string;
  textureKey: string;
  tag: string;
  x: number;
  y: number;
  data: RoomPropInstance;
}

export interface RoomSceneStartData {
  room: RoomData;
  backgroundTextureKey: string | null;
  characters: RoomCharacterSpawn[];
  props: RoomPropSpawn[];
  /** Aseprite key for `room.props`; null when the room has no props. */
  roomPropsTextureKey: string | null;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_BOOT);
  }

  create(): void {
    applyBootAudioSettings(this);

    const room = loadStartRoomData();
    const backgroundTextureKey = room.background?.image ? `bg:${room.id}` : null;
    if (room.background?.image && backgroundTextureKey) {
      this.load.image(backgroundTextureKey, resolveGameAssetUrl(room.background.image));
    }

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

    const roomPropsTextureKey =
      propsWithSheetTags.length > 0 ? getRoomAsepriteTextureKey(room.id) : null;
    if (roomPropsTextureKey) {
      const paths = getRoomAsepriteAssetPaths(room.id);
      this.load.aseprite({
        key: roomPropsTextureKey,
        textureURL: resolveGameAssetUrl(paths.png),
        atlasURL: getNormalizedRoomAsepriteAtlasData(room.id),
      });
    }

    const spawns: RoomCharacterSpawn[] = [];
    const loadedAsepriteCharacterIds = new Set<string>();

    for (const inst of room.characters ?? []) {
      this.queueCharacterLoads(inst, spawns, loadedAsepriteCharacterIds);
    }

    let queuedSharedInventory = false;
    const queuedPerItemInventoryIds = new Set<string>();
    for (const id of getRegisteredInventoryDefinitionIds()) {
      const def = getInventoryDefinition(id);
      if (!def) {
        continue;
      }
      if (usesSharedInventoryAseprite(def)) {
        if (queuedSharedInventory) {
          continue;
        }
        if (hasBundledSharedInventorySheet()) {
          const paths = sharedInventoryAssetPaths();
          this.load.aseprite({
            key: sharedInventoryTextureKey,
            textureURL: resolveGameAssetUrl(paths.png),
            atlasURL: getNormalizedSharedInventoryAsepriteAtlasData(),
          });
          queuedSharedInventory = true;
        } else {
          console.warn(
            `[Benne] Inventory item "${id}" uses display.aseprite "shared" but assets/images/inventory/inventory.json is not bundled — export the shared sheet from Aseprite.`,
          );
        }
      } else if (usesPerItemInventoryAseprite(def)) {
        if (queuedPerItemInventoryIds.has(id)) {
          continue;
        }
        queuedPerItemInventoryIds.add(id);
        try {
          const sheetTags = getAsepriteFrameTagNames('inventory', id);
          warnIfAnimationConfigKeysMissingFromFrameTags(
            `Inventory '${id}'`,
            sheetTags,
            undefined,
          );
          const paths = getPerItemInventoryAsepritePaths(id);
          this.load.aseprite({
            key: getPerItemInventoryTextureKey(id),
            textureURL: resolveGameAssetUrl(paths.png),
            atlasURL: getNormalizedInventoryAsepriteAtlasData(id),
          });
        } catch (err) {
          console.warn(`[Benne] Could not queue per-item inventory Aseprite for "${id}":`, err);
        }
      }
    }

    queueGuiFontsForBootLoader(this.load);

    const queuedGuiAsepriteIds = new Set<string>();
    for (const gui of getAllGuiData()) {
      if (!usesGuiAsepriteDisplay(gui)) {
        continue;
      }
      if (queuedGuiAsepriteIds.has(gui.id)) {
        continue;
      }
      try {
        const sheetTags = getAsepriteFrameTagNames('gui', gui.id);
        if (sheetTags.length === 0) {
          console.warn(
            `[Benne] GUI '${gui.id}' has display.aseprite true but the sheet has no meta.frameTags — GUI frames cannot be used as textures.`,
          );
        }
        const paths = getGuiAsepriteAssetPaths(gui.id);
        this.load.aseprite({
          key: getGuiAsepriteTextureKey(gui.id),
          textureURL: resolveGameAssetUrl(paths.png),
          atlasURL: getNormalizedGuiAsepriteAtlasData(gui.id),
        });
        queuedGuiAsepriteIds.add(gui.id);
      } catch (err) {
        console.warn(`[Benne] Could not queue GUI Aseprite for "${gui.id}":`, err);
      }
    }

    const gameSettings = getGameSettings();
    if (isBenneGameCursorAsepriteEnabled(gameSettings)) {
      if (hasBundledCursorSheet()) {
        const cursorCfg = gameSettings.cursor!;
        const cursorTags = getCursorAsepriteFrameTagNames();
        const tagSet = new Set(cursorTags);
        warnIfAnimationConfigKeysMissingFromFrameTags(
          'Game cursor',
          cursorTags,
          cursorCfg.animations as Record<string, unknown> | undefined,
        );
        if (!tagSet.has(cursorCfg.idleAnimation)) {
          console.warn(
            `[Benne] game-config cursor.idleAnimation "${cursorCfg.idleAnimation}" is not a frame tag on images/cursor/cursor.json — cursor may not load.`,
          );
        }
        if (!tagSet.has(cursorCfg.activeAnimation)) {
          console.warn(
            `[Benne] game-config cursor.activeAnimation "${cursorCfg.activeAnimation}" is not a frame tag on images/cursor/cursor.json — cursor may not load.`,
          );
        }
        const paths = getCursorAsepriteAssetPaths();
        this.load.aseprite({
          key: CURSOR_TEXTURE_KEY,
          textureURL: resolveGameAssetUrl(paths.png),
          atlasURL: getNormalizedCursorAsepriteAtlasData(),
        });
      } else {
        console.warn(
          '[Benne] game-config enables cursor.display.aseprite but assets/images/cursor/cursor.json is not bundled — add the Aseprite export.',
        );
      }
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

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.scene.start(SCENE_ROOM, {
        room,
        backgroundTextureKey,
        characters: spawns,
        props: propSpawns,
        roomPropsTextureKey,
      } satisfies RoomSceneStartData);
    });
    this.load.start();
  }

  private queueCharacterLoads(
    inst: RoomCharacterInstance,
    spawns: RoomCharacterSpawn[],
    loadedAsepriteCharacterIds: Set<string>,
  ): void {
    const data = loadCharacterData(inst.definition);

    if (usesAsepriteDisplay(data)) {
      const textureKey = getAsepriteTextureKey(data.id);
      if (!loadedAsepriteCharacterIds.has(data.id)) {
        const characterFrameTags = getAsepriteFrameTagNames('character', data.id);
        warnIfAnimationConfigKeysMissingFromFrameTags(
          `Character '${data.id}'`,
          characterFrameTags,
          data.animations as Record<string, unknown> | undefined,
        );
        const paths = getAsepriteAssetPaths(data.id);
        this.load.aseprite({
          key: textureKey,
          textureURL: resolveGameAssetUrl(paths.png),
          atlasURL: getNormalizedAsepriteAtlasData(data.id),
        });
        loadedAsepriteCharacterIds.add(data.id);
      }
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
    this.load.image(textureKey, resolveGameAssetUrl(data.display.defaultImage!));
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
}
