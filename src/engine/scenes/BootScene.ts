import * as Phaser from 'phaser';
import { getGameSettings } from '../ConfigManager';
import { applyBootAudioSettings } from '../applyAudioFromSettings';
import { BENNE_SPEECH_FONT_CACHE_KEY, speechFontLoaderFormat } from '../speechFontKey';
import { getAsepriteAssetPaths, getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/characterAseprite';
import {
  getAsepriteFrameTagNames,
  getNormalizedAsepriteAtlasData,
  getNormalizedRoomAsepriteAtlasData,
  warnIfAnimationConfigKeysMissingFromFrameTags,
} from '../../game/loadAsepriteAtlasData';
import { getRoomAsepriteAssetPaths, getRoomAsepriteTextureKey } from '../../game/roomAseprite';
import { SCENE_BOOT, SCENE_ROOM } from '../../game/constants';
import { loadCharacterData } from '../../game/loadCharacterData';
import { loadStartRoomData } from '../../game/loadStartRoom';
import { resolveGameAssetUrl } from '../../game/resolveGameAssetUrl';
import { resolveGameFontUrl } from '../../game/resolveGameFontUrl';
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
  /** True after BootScene queued `load.font` for speech (see `BENNE_SPEECH_FONT_CACHE_KEY`). */
  speechFontLoaded?: boolean;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_BOOT);
  }

  create(): void {
    applyBootAudioSettings(this);

    const speechFontPath = getGameSettings().speech?.font?.trim();
    let speechFontLoaded = false;
    if (speechFontPath && speechFontPath.length > 0) {
      this.load.font(
        BENNE_SPEECH_FONT_CACHE_KEY,
        resolveGameFontUrl(speechFontPath),
        speechFontLoaderFormat(speechFontPath),
      );
      speechFontLoaded = true;
    }

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
        speechFontLoaded,
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
