import * as Phaser from 'phaser';
import { applyBootAudioSettings } from '../applyAudioFromSettings';
import {
  getAsepriteFrameTagNames,
  getCursorAsepriteFrameTagNames,
  getNormalizedCursorAsepriteAtlasData,
  getNormalizedGuiAsepriteAtlasData,
  getNormalizedInventoryAsepriteAtlasData,
  getNormalizedSharedInventoryAsepriteAtlasData,
  hasBundledCursorSheet,
  hasBundledSharedInventorySheet,
  warnIfAnimationConfigKeysMissingFromFrameTags,
} from '../../game/boot/loadAsepriteAtlasData';
import {
  getPerItemInventoryAsepritePaths,
  getPerItemInventoryTextureKey,
  sharedInventoryAssetPaths,
  sharedInventoryTextureKey,
  usesPerItemInventoryAseprite,
  usesSharedInventoryAseprite,
} from '../../game/boot/inventoryAseprite';
import { getInventoryDefinition, getRegisteredInventoryDefinitionIds } from '../inventory/inventoryDefinitionRegistry.js';
import { SCENE_BOOT, SCENE_ROOM } from '../../game/boot/constants';
import { loadStartRoomData } from '../../game/boot/loadStartRoom';
import {
  getAsepriteAssetPaths as getGuiAsepriteAssetPaths,
  getAsepriteTextureKey as getGuiAsepriteTextureKey,
  usesAsepriteDisplay as usesGuiAsepriteDisplay,
} from '../../game/boot/guiAseprite';
import { getAllGuiData } from '../../game/boot/loadGuiData';
import { queueGuiFontsForBootLoader } from '../../game/boot/queueGuiFontsForBootLoader';
import { resolveGameAssetUrl } from '../../game/boot/resolveGameAssetUrl';
import { CURSOR_TEXTURE_KEY, getCursorAsepriteAssetPaths, isBenneGameCursorAsepriteEnabled } from '../../game/boot/cursorAseprite';
import { getGameSettings } from '../ConfigManager';
import type { CharacterFacingLetter, CharacterData } from '../../types/character';
import type { RoomData, RoomPropInstance } from '../../types/room';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager';
import { isBenneAudioScriptDisabled } from '../sound/benneSoundRegistry.js';
import { queueBenneAudioForBootLoader } from '../sound/queueBenneAudioBoot.js';
import { isBenneVideoScriptDisabled } from '../video/benneVideoRegistry.js';
import { queueBenneVideoForBootLoader } from '../video/queueBenneVideoBoot.js';
import { buildRoomSceneStartDataFromRoomData, queueRoomSceneAssetLoads } from './roomSceneBootstrap';
import { BENNE_ROOM_START_KIND_KEY } from './roomStartKindConstants';
import { tryGetRoomTransitionOrchestrator } from './roomTransitionGlobals';
import { syncBenneRuntimeHiDpiSceneMainCameras } from '../benneRuntimeHiDpiScale.js';
import { ensureRoomScriptLoaded } from '../scripting/registerRoomScript';

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
  /**
   * Editor room preview only: unprefixed GUI sheet JSON (`meta.slices`) keyed by GUI id — same shape as on disk.
   * Used when nine-slice controls cannot read slices from the Vite-bundled glob inside the webview build.
   */
  previewGuiAsepriteSheetJsonById?: Record<string, Record<string, unknown>>;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_BOOT);
  }

  create(): void {
    applyBootAudioSettings(this);
    syncBenneRuntimeHiDpiSceneMainCameras(this.game);

    const room = loadStartRoomData();
    const startData = buildRoomSceneStartDataFromRoomData(room);
    queueRoomSceneAssetLoads(this, startData);

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

    if (!isBenneAudioScriptDisabled(this.game)) {
      queueBenneAudioForBootLoader(this.load);
    }

    if (!isBenneVideoScriptDisabled(this.game)) {
      queueBenneVideoForBootLoader(this.load);
    }

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      void (async () => {
        await ensureRoomScriptLoaded(startData.room.id);
        const orch = tryGetRoomTransitionOrchestrator();
        if (orch) {
          orch.startInitialRoomFromBoot(startData);
        } else {
          resolveGameStateManager(this.game).setLastRoom(null);
          this.game.registry.set(BENNE_ROOM_START_KIND_KEY, 'boot');
          this.scene.start(SCENE_ROOM, startData);
        }
      })();
    });
    this.load.start();
  }
}
