This file is a merged representation of a subset of the codebase, containing specifically included files and files not matching ignore patterns, combined into a single document by Repomix.

<file_summary>
This section contains a summary of this file.

<purpose>
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.
</purpose>

<file_format>
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  - File path as an attribute
  - Full contents of the file
</file_format>

<usage_guidelines>
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.
</usage_guidelines>

<notes>
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: src/**/*.ts, src/**/*.json, architecture.md, package.json, vite.config.ts
- Files matching these patterns are excluded: node_modules, dist, benne-editor/build, *.log
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)
</notes>

</file_summary>

<directory_structure>
package.json
src/editor/preview/buildPreviewManifest.ts
src/editor/preview/characterEditorMain.ts
src/editor/preview/createCharacterPreviewGame.ts
src/editor/preview/createGuiPreviewGame.ts
src/editor/preview/createInventoryPreviewGame.ts
src/editor/preview/createRoomPreviewGame.ts
src/editor/preview/guiEditorMain.ts
src/editor/preview/guiVisibilityBridge.ts
src/editor/preview/inventoryEditorMain.ts
src/editor/preview/polygonEditBridge.ts
src/editor/preview/polygonPatchTypes.ts
src/editor/preview/previewPolygonOverlay.ts
src/editor/preview/previewUrls.ts
src/editor/preview/roomEditorMain.ts
src/editor/preview/RoomPolygonEditScene.ts
src/engine/applyAudioFromSettings.ts
src/engine/characterAnimationPlayback.ts
src/engine/characterFeet.ts
src/engine/ConfigManager.ts
src/engine/directionalCharacterAnimation.ts
src/engine/events/characterAnimationEvents.ts
src/engine/events/EventBus.ts
src/engine/events/guiButtonEvents.ts
src/engine/events/guiControlHoverEvents.ts
src/engine/events/inventoryVerbEvents.ts
src/engine/events/playerWalkEvents.ts
src/engine/events/propInteractionEvents.ts
src/engine/events/verbInteractionEvents.ts
src/engine/Game.ts
src/engine/gameConfig.ts
src/engine/gameState/GameStateManager.ts
src/engine/gameState/registryKey.ts
src/engine/gameState/resolveGameStateManager.ts
src/engine/gui/buildGuiOverlay.ts
src/engine/InteractiveObject.ts
src/engine/inventory/inventoryDefinitionRegistry.ts
src/engine/pathfinding.ts
src/engine/postfx/PostEffects.ts
src/engine/Room.ts
src/engine/scenes/BootScene.ts
src/engine/scenes/RoomScene.ts
src/engine/scripting/BenneScript.ts
src/engine/scripting/BenneScriptCore.ts
src/engine/scripting/benneScriptFacades.ts
src/engine/scripting/benneScriptGameStateApi.ts
src/engine/scripting/benneScriptPayloads.ts
src/engine/scripting/CharacterBenneScript.ts
src/engine/scripting/CharacterScriptContext.ts
src/engine/scripting/GlobalBenneScript.ts
src/engine/scripting/GuiBenneScript.ts
src/engine/scripting/GuiRuntime.ts
src/engine/scripting/index.ts
src/engine/scripting/InventoryBenneScript.ts
src/engine/scripting/InventoryScriptContext.ts
src/engine/scripting/registerCharacterScript.ts
src/engine/scripting/registerGlobalScript.ts
src/engine/scripting/registerGuiScript.ts
src/engine/scripting/registerInventoryScript.ts
src/engine/scripting/registerRoomScript.ts
src/engine/scripting/RoomScriptContext.ts
src/engine/scripting/types.ts
src/engine/scripting/wireBenneGlobalScripts.ts
src/engine/verbs/dispatchInventoryVerb.ts
src/engine/verbs/dispatchVerb.ts
src/engine/verbs/normalizeHandlers.ts
src/engine/verbs/resolvePointerVerb.ts
src/engine/verbs/verbConfig.ts
src/engine/walkable.ts
src/game/assets/fonts/fonts.json
src/game/assets/images/characters/hank/hank.json
src/game/assets/images/characters/henry/henry.json
src/game/assets/images/cursor/cursor.json
src/game/assets/images/guis/inventoryBar/inventoryBar.json
src/game/assets/images/inventory/inventory.json
src/game/assets/images/rooms/apartment/apartment.json
src/game/assets/images/rooms/office/office.json
src/game/characterAseprite.ts
src/game/characterPreviewIdleTag.ts
src/game/characters/hank/hank.character.json
src/game/characters/hank/hank.character.ts
src/game/characters/henry/henry.character.json
src/game/characters/henry/henry.character.ts
src/game/collectFontLoadsForGui.ts
src/game/constants.ts
src/game/cursorAseprite.ts
src/game/game-config.json
src/game/globalScript.ts
src/game/guiAseprite.ts
src/game/guis/dialog-text/dialog-text.gui.json
src/game/guis/dialog-text/dialog-text.gui.ts
src/game/guis/inventoryBar/inventoryBar.gui.json
src/game/guis/inventoryBar/inventoryBar.gui.ts
src/game/guis/random-text/random-text.gui.json
src/game/guis/random-text/random-text.gui.ts
src/game/inventory/Broom/Broom.inventory.json
src/game/inventory/Broom/Broom.inventory.ts
src/game/inventory/Candy1/Candy1.inventory.json
src/game/inventory/Candy1/Candy1.inventory.ts
src/game/inventory/Chainsaw/Chainsaw.inventory.json
src/game/inventory/Chainsaw/Chainsaw.inventory.ts
src/game/inventory/Glue/Glue.inventory.json
src/game/inventory/Glue/Glue.inventory.ts
src/game/inventory/Key/Key.inventory.json
src/game/inventory/Key/Key.inventory.ts
src/game/inventory/Ladder/Ladder.inventory.json
src/game/inventory/Ladder/Ladder.inventory.ts
src/game/inventory/Lantern/Lantern.inventory.json
src/game/inventory/Lantern/Lantern.inventory.ts
src/game/inventory/Newspaper/Newspaper.inventory.json
src/game/inventory/Newspaper/Newspaper.inventory.ts
src/game/inventory/SheetMusic/SheetMusic.inventory.json
src/game/inventory/SheetMusic/SheetMusic.inventory.ts
src/game/inventory/Vacuum/Vacuum.inventory.json
src/game/inventory/Vacuum/Vacuum.inventory.ts
src/game/inventoryAseprite.ts
src/game/loadAsepriteAtlasData.ts
src/game/loadCharacterData.ts
src/game/loadGuiData.ts
src/game/loadStartRoom.ts
src/game/normalizeAsepriteJson.ts
src/game/queueGuiFontsForBootLoader.ts
src/game/registerGameContent.ts
src/game/registerInventoryDefinitions.ts
src/game/resolveGameAssetUrl.ts
src/game/roomAseprite.ts
src/game/rooms/apartment/apartment.room.json
src/game/rooms/apartment/apartment.room.ts
src/game/rooms/office/office.room.json
src/game/rooms/office/office.room.ts
src/game/rooms/rooms.manifest.json
src/main.ts
src/types/character.ts
src/types/dialogue.ts
src/types/fonts.ts
src/types/game.ts
src/types/gameState.ts
src/types/gui.ts
src/types/inventory.ts
src/types/room.ts
vite.config.ts
</directory_structure>

<files>
This section contains the contents of the repository's files.

<file path="src/editor/preview/createInventoryPreviewGame.ts">
import * as Phaser from 'phaser';
import { applyBootAudioSettings } from '../../engine/applyAudioFromSettings';
import type { InventoryItemData } from '../../types/inventory';

const BOOT = 'BenneInventoryPreviewBoot';
const PREVIEW = 'BenneInventoryPreview';

export type InventoryPreviewGamePayload = {
  textureKey: string;
  textureURL: string;
  atlasURL: string;
  inventory: InventoryItemData;
  animationKey: string;
  animationTagLabel: string;
  revokeObjectUrls: string[];
};

function editorGameConfig(
  parent: HTMLElement,
  width: number,
  height: number,
): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
  return {
    /** Keep parity with runtime UI rendering (`getBennePhaserGameConfigBase` in `gameConfig.ts`). */
    type: Phaser.CANVAS,
    parent,
    width,
    height,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: {
      parent,
      mode: Phaser.Scale.FIT,
      width,
      height,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      zoom: Phaser.Scale.MAX_ZOOM,
      autoRound: true,
    },
    render: {
      powerPreference: 'high-performance',
    },
  };
}

class BenneInventoryPreviewBoot extends Phaser.Scene {
  private readonly payload: InventoryPreviewGamePayload;

  constructor(payload: InventoryPreviewGamePayload) {
    super(BOOT);
    this.payload = payload;
  }

  preload(): void {
    this.load.aseprite({
      key: this.payload.textureKey,
      textureURL: this.payload.textureURL,
      atlasURL: this.payload.atlasURL,
    });
  }

  create(): void {
    applyBootAudioSettings(this);
    this.scene.start(PREVIEW, this.payload);
    for (const u of this.payload.revokeObjectUrls) {
      URL.revokeObjectURL(u);
    }
  }
}

class InventoryPreviewScene extends Phaser.Scene {
  private payload!: InventoryPreviewGamePayload;

  constructor() {
    super(PREVIEW);
  }

  init(data: InventoryPreviewGamePayload): void {
    this.payload = data;
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x1a1a2e);

    const sprite = this.add
      .sprite(cam.width / 2, cam.height / 2, this.payload.textureKey)
      .setOrigin(0.5, 0.5);

    if (!this.anims.exists(this.payload.animationKey)) {
      this.anims.createFromAseprite(this.payload.textureKey);
    }
    if (this.anims.exists(this.payload.animationKey)) {
      sprite.play(this.payload.animationKey);
    }

    this.add
      .text(8, 6, `${this.payload.inventory.id} · ${this.payload.animationTagLabel}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#8892a8',
      })
      .setScrollFactor(0);
  }
}

export function createInventoryPreviewPhaserGame(
  parent: HTMLElement,
  payload: InventoryPreviewGamePayload,
): Phaser.Game {
  return new Phaser.Game({
    ...editorGameConfig(parent, 352, 198),
    scene: [new BenneInventoryPreviewBoot(payload), InventoryPreviewScene],
  });
}
</file>

<file path="src/editor/preview/guiVisibilityBridge.ts">
/**
 * Small state holder for the BENNE room preview "Show GUIs" toolbar toggle.
 *
 * Mirrors the pattern of {@link polygonEditBridge}: a single mutable flag plus a subscribe/notify
 * API so the DOM toolbar and the live `RoomScene` (via `RoomScene.setGenericGuisVisible`) stay
 * in sync without passing references around.
 */
class GuiVisibilityBridgeImpl {
    /**
     * Whether non-`dialog-text` GUI overlays should be visible in the room preview. The webview
     * persists this across reloads via `vscode.getState()`; default on first ever open is `false`.
     */
    visible = false;

    private readonly listeners = new Set<(visible: boolean) => void>();

    subscribe(fn: (visible: boolean) => void): () => void {
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    }

    setVisible(visible: boolean): void {
        if (this.visible === visible) {
            return;
        }
        this.visible = visible;
        for (const f of this.listeners) {
            f(visible);
        }
    }
}

export const guiVisibilityBridge = new GuiVisibilityBridgeImpl();
</file>

<file path="src/editor/preview/inventoryEditorMain.ts">
import type { Game } from 'phaser';
import {
  getPerItemInventoryAsepritePaths,
  getPerItemInventoryTextureKey,
  inventoryPhaserAnimationKeyForTag,
  sharedInventoryAssetPaths,
  sharedInventoryTextureKey,
  usesPerItemInventoryAseprite,
  usesSharedInventoryAseprite,
} from '../../game/inventoryAseprite';
import { readAsepriteFrameTagNamesFromRawJson } from '../../game/loadAsepriteAtlasData';
import { normalizeAsepriteJsonForPhaser } from '../../game/normalizeAsepriteJson';
import type { InventoryItemData } from '../../types/inventory';
import {
  createInventoryPreviewPhaserGame,
  type InventoryPreviewGamePayload,
} from './createInventoryPreviewGame';
import { joinGameWebviewUri } from './previewUrls';

declare function acquireVsCodeApi(): { postMessage(data: unknown): void };

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
let game: Game | null = null;

try {
  vscodeApi = acquireVsCodeApi();
} catch {
  /* not inside a VS Code webview */
}

function destroyPreviewGame(): void {
  if (game) {
    game.destroy(true);
    game = null;
  }
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function ensureSharedInventoryTagPrefixes(normalized: Record<string, unknown>): void {
  const meta = normalized.meta;
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

function pickInventoryPreviewTagName(data: InventoryItemData, rawTagNames: readonly string[]): string | null {
  const preferred = data.defaultAnimation ?? data.id;
  if (rawTagNames.includes(preferred)) {
    return preferred;
  }
  return rawTagNames.length > 0 ? rawTagNames[0]! : null;
}

async function runLoadInventory(msg: {
  inventory: InventoryItemData;
  inventoryId: string;
  gameSrcWebviewUri: string;
  inventoryJsonUri: string;
}): Promise<void> {
  const root = document.getElementById('benne-inventory-preview-root');
  if (!root) {
    return;
  }
  root.innerHTML = '';
  destroyPreviewGame();

  const inventory = msg.inventory;
  if (!usesSharedInventoryAseprite(inventory) && !usesPerItemInventoryAseprite(inventory)) {
    root.innerHTML =
      '<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">Inventory preview needs <code>display.aseprite: "shared"</code> or <code>display.aseprite: true</code>.</div>';
    return;
  }

  const assetsBase = joinGameWebviewUri(msg.gameSrcWebviewUri, 'assets');
  const paths = usesSharedInventoryAseprite(inventory)
    ? sharedInventoryAssetPaths()
    : getPerItemInventoryAsepritePaths(msg.inventoryId);
  const textureKey = usesSharedInventoryAseprite(inventory)
    ? sharedInventoryTextureKey
    : getPerItemInventoryTextureKey(msg.inventoryId);
  const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
  const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);

  let raw: Record<string, unknown>;
  try {
    raw = await fetchJson(jsonUrl);
  } catch (e) {
    root.innerHTML = `<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">Could not load sheet JSON: ${e instanceof Error ? e.message : String(e)}</div>`;
    return;
  }

  const rawTagNames = readAsepriteFrameTagNamesFromRawJson(raw);
  const tagName = pickInventoryPreviewTagName(inventory, rawTagNames);
  if (!tagName) {
    root.innerHTML =
      '<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">No animation tags on this sheet.</div>';
    return;
  }
  const animationKey = inventoryPhaserAnimationKeyForTag(inventory, tagName);

  const normalized = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
  if (usesSharedInventoryAseprite(inventory)) {
    ensureSharedInventoryTagPrefixes(normalized);
  }
  const atlasBlob = new Blob([JSON.stringify(normalized)], { type: 'application/json' });
  const atlasURL = URL.createObjectURL(atlasBlob);

  const inner = document.createElement('div');
  inner.style.cssText = 'position:relative;width:100%;height:100%;min-height:180px;';
  root.appendChild(inner);

  const payload: InventoryPreviewGamePayload = {
    textureKey,
    textureURL: pngUrl,
    atlasURL,
    inventory,
    animationKey,
    animationTagLabel: tagName,
    revokeObjectUrls: [atlasURL],
  };

  game = createInventoryPreviewPhaserGame(inner, payload);
}

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as { type?: string };
  if (msg?.type === 'benne/inventoryPreview/loadInventory') {
    const m = event.data as {
      type: string;
      inventory: InventoryItemData;
      inventoryId: string;
      gameSrcWebviewUri: string;
      inventoryJsonUri: string;
    };
    void runLoadInventory(m);
    return;
  }
  if (msg?.type === 'benne/inventoryPreview/clear') {
    destroyPreviewGame();
    const root = document.getElementById('benne-inventory-preview-root');
    if (root) {
      root.innerHTML = '';
    }
  }
});

vscodeApi?.postMessage({ type: 'benne/inventoryPreview/ready' });
</file>

<file path="src/editor/preview/previewUrls.ts">
/** Join a VS Code webview resource base URI with path segments (no leading slashes on segments). */
export function joinGameWebviewUri(base: string, ...segments: string[]): string {
    const trimmed = base.replace(/\/+$/, '');
    const path = segments
        .filter((s) => s.length > 0)
        .map((s) => s.replace(/^\/+/, '').replaceAll('\\', '/'))
        .join('/');
    return path.length > 0 ? `${trimmed}/${path}` : trimmed;
}
</file>

<file path="src/engine/applyAudioFromSettings.ts">
import * as Phaser from 'phaser';
import { getGameSettings } from './ConfigManager';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Global Sound Manager cap (Phaser applies one manager volume to active sounds). */
export function applyBootAudioSettings(scene: Phaser.Scene): void {
  const master = clamp01(getGameSettings().audio.masterVolume);
  scene.sound.setVolume(master);
}

/** Use when playing SFX (multiply with per-sound volume if needed). */
export function getEffectiveSfxVolume(): number {
  const a = getGameSettings().audio;
  return clamp01(a.masterVolume * a.sfxVolume);
}

export function getEffectiveMusicVolume(): number {
  const a = getGameSettings().audio;
  return clamp01(a.masterVolume * a.musicVolume);
}

export function getEffectiveDialogueVolume(): number {
  const a = getGameSettings().audio;
  return clamp01(a.masterVolume * a.dialogueVolume);
}
</file>

<file path="src/engine/characterAnimationPlayback.ts">
import * as Phaser from 'phaser';
import type { CharacterAnimationFrameEvent, CharacterAnimationsConfig, CharacterData } from '../types/character';
import { gameEvents } from './events/EventBus';
import {
  CHARACTER_ANIMATION_EVENT,
  type CharacterAnimationEventPayload,
} from './events/characterAnimationEvents';

export interface CharacterAnimSprite extends Phaser.GameObjects.Sprite {
  playCharacterAnimation(key: string, ignoreIfPlaying?: boolean): boolean;
}

function buildFrameEventLookup(
  config: CharacterAnimationsConfig | undefined,
): Map<string, Map<number, CharacterAnimationFrameEvent[]>> {
  const byAnim = new Map<string, Map<number, CharacterAnimationFrameEvent[]>>();
  if (!config) {
    return byAnim;
  }

  for (const [animKey, clip] of Object.entries(config)) {
    if (!clip.events?.length) {
      continue;
    }
    let byFrame = byAnim.get(animKey);
    if (!byFrame) {
      byFrame = new Map();
      byAnim.set(animKey, byFrame);
    }
    for (const ev of clip.events) {
      const list = byFrame.get(ev.frame) ?? [];
      list.push(ev);
      byFrame.set(ev.frame, list);
    }
  }
  return byAnim;
}

/**
 * Phaser uses each {@link Phaser.Animations.AnimationFrame#duration} when it matches the clip's
 * frame rate (Aseprite import sets this), so changing only {@link Phaser.Animations.Animation#msPerFrame}
 * does not affect playback. We set every frame's duration explicitly.
 */
function applyUniformFrameDurationMs(anim: Phaser.Animations.Animation, frameDurationMs: number): void {
  if (!Number.isFinite(frameDurationMs) || frameDurationMs <= 0) {
    return;
  }
  const n = anim.getTotalFrames();
  for (let i = 0; i < n; i++) {
    const frame = anim.frames[i];
    if (frame) {
      frame.duration = frameDurationMs;
    }
  }
  const totalMs = frameDurationMs * n;
  anim.duration = totalMs;
  anim.frameRate = n / (totalMs / 1000);
  anim.msPerFrame = 1000 / anim.frameRate;
}

/**
 * Applies JSON loop / optional uniform `frameDuration` to `createFromAseprite` clips.
 * Omitted tags keep Aseprite per-frame timing; `loop` defaults to non-repeating when unspecified.
 */
export function applyCharacterAnimationClips(
  created: Phaser.Animations.Animation[],
  animationsConfig: CharacterAnimationsConfig | undefined,
): void {
  for (const anim of created) {
    const clip = animationsConfig?.[anim.key];
    anim.repeat = clip?.loop === true ? -1 : 0;
    if (typeof clip?.frameDuration === 'number') {
      applyUniformFrameDurationMs(anim, clip.frameDuration);
    }
  }
}

function attachCharacterAnimationEventBridge(sprite: Phaser.GameObjects.Sprite, character: CharacterData): void {
  const lookup = buildFrameEventLookup(character.animations);
  if (lookup.size === 0) {
    return;
  }

  let lastSignature = '';

  const handler = (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void => {
    const signature = `${anim.key}\0${frame.index}`;
    if (signature === lastSignature) {
      return;
    }
    lastSignature = signature;

    const byFrame = lookup.get(anim.key);
    if (!byFrame) {
      return;
    }
    const events = byFrame.get(frame.index);
    if (!events?.length) {
      return;
    }

    const characterId = character.id;
    const instanceId = sprite.getData('instanceId') as string | undefined;
    for (const ev of events) {
      gameEvents.emit(CHARACTER_ANIMATION_EVENT, {
        characterId,
        instanceId,
        animationKey: anim.key,
        frameIndex: frame.index,
        type: ev.type,
        data: ev.data,
      } satisfies CharacterAnimationEventPayload);
    }
  };

  sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, handler);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
    sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, handler);
  });
}

/**
 * Plays a local or global animation by key, respecting `ignoreIfPlaying` (same clip already running).
 */
export function playCharacterAnimation(
  sprite: Phaser.GameObjects.Sprite,
  key: string,
  ignoreIfPlaying = false,
): boolean {
  if (!sprite.anims.exists(key)) {
    return false;
  }
  if (ignoreIfPlaying && sprite.anims.isPlaying && sprite.anims.getName() === key) {
    return true;
  }
  sprite.play(key);
  return true;
}

export function attachCharacterPlaybackApi(sprite: Phaser.GameObjects.Sprite): CharacterAnimSprite {
  const extended = sprite as CharacterAnimSprite;
  extended.playCharacterAnimation = (key: string, ignoreIfPlaying?: boolean): boolean =>
    playCharacterAnimation(extended, key, ignoreIfPlaying ?? false);
  return extended;
}

/**
 * After `sprite.anims.createFromAseprite`, applies character JSON and wires frame events + playback API.
 */
export function setupCharacterAsepritePlayback(
  sprite: Phaser.GameObjects.Sprite,
  character: CharacterData,
  createdAnims: Phaser.Animations.Animation[],
): CharacterAnimSprite {
  applyCharacterAnimationClips(createdAnims, character.animations);
  attachCharacterAnimationEventBridge(sprite, character);
  return attachCharacterPlaybackApi(sprite);
}
</file>

<file path="src/engine/characterFeet.ts">
import type { CharacterData } from '../types/character';

/** Pixel offset from the top-left of the character texture frame to the ground contact (feet). */
export type CharacterFeetLocal = { x: number; y: number };

const FEET_LOCAL_X = 'feetLocalX';
const FEET_LOCAL_Y = 'feetLocalY';

/**
 * Resolves feet in frame space: explicit `character.feet`, else bottom-centre of the current frame.
 */
export function resolveCharacterFeetLocal(data: CharacterData, sprite: Phaser.GameObjects.Sprite): CharacterFeetLocal {
  if (data.feet) {
    return { x: data.feet.x, y: data.feet.y };
  }
  const f = sprite.frame;
  return { x: f.width * 0.5, y: f.height };
}

/** Top-left sprite position so world feet sit at `(worldFeetX, worldFeetY)`. */
export function placeSpriteByFeet(
  sprite: Phaser.GameObjects.Sprite,
  feet: CharacterFeetLocal,
  worldFeetX: number,
  worldFeetY: number,
): void {
  sprite.setOrigin(0, 0);
  sprite.setPosition(worldFeetX - feet.x, worldFeetY - feet.y);
  sprite.setData(FEET_LOCAL_X, feet.x);
  sprite.setData(FEET_LOCAL_Y, feet.y);
}

export function getCharacterWorldFeet(sprite: Phaser.GameObjects.Sprite): { x: number; y: number } {
  const lx = sprite.getData(FEET_LOCAL_X) as number | undefined;
  const ly = sprite.getData(FEET_LOCAL_Y) as number | undefined;
  if (typeof lx !== 'number' || typeof ly !== 'number') {
    return { x: sprite.x, y: sprite.y };
  }
  return { x: sprite.x + lx, y: sprite.y + ly };
}

/** Camera `startFollow` offset so the follow target is the feet, not the sprite top-left. */
export function cameraFollowOffsetForFeet(feet: CharacterFeetLocal): { x: number; y: number } {
  return { x: -feet.x, y: -feet.y };
}
</file>

<file path="src/engine/events/characterAnimationEvents.ts">
/** Emitted on `gameEvents` when a clip hits a configured frame marker. */
export const CHARACTER_ANIMATION_EVENT = 'character.animationEvent' as const;

export type CharacterAnimationEventPayload = {
  characterId: string;
  /** Room placement id when set on the sprite (`instanceId` from room JSON). */
  instanceId?: string;
  animationKey: string;
  /** Same `frame` as in JSON (0-based index in the tag). */
  frameIndex: number;
  type: string;
  data?: unknown;
};
</file>

<file path="src/engine/events/EventBus.ts">
import * as Phaser from 'phaser';

/**
 * Global event bus for gameplay, puzzles, and UI (decoupled from Phaser scenes).
 */
export class EventBus extends Phaser.Events.EventEmitter {
  constructor() {
    super();
  }
}

export const gameEvents = new EventBus();
</file>

<file path="src/engine/events/guiButtonEvents.ts">
/**
 * Event names for GUI button clicks (GUI-scoped Bennescript + future compositor input).
 * The overlay compositor should emit these on `gameEvents`; {@link GuiBenneScript} subscribes here.
 */

/** Payload for {@link guiAllButtonsClickEventId} (catch-all within one GUI). */
export interface GuiAllButtonsClickPayload {
  buttonId: string;
}

const GUI_PREFIX = 'gui:';

/** `gui:<guiId>:button:<buttonId>:click` — one control id per GUI script file. */
export function guiButtonClickEventId(guiId: string, buttonId: string): string {
  return `${GUI_PREFIX}${guiId}:button:${buttonId}:click`;
}

/**
 * `gui:<guiId>:allButtons:click` — fired for every enabled button activation; handlers receive
 * {@link GuiAllButtonsClickPayload}. Distinct from any literal `buttonId` so ids cannot collide.
 */
export function guiAllButtonsClickEventId(guiId: string): string {
  return `${GUI_PREFIX}${guiId}:allButtons:click`;
}
</file>

<file path="src/engine/events/guiControlHoverEvents.ts">
/**
 * Event names for **GUI control pointer hover** (enter / leave).
 * Emitted by `buildGuiOverlay` for any control with a stable **`id`** (`button`, `image`,
 * `inventoryPanel`, `trigger`, `text`); {@link import('../scripting/GuiBenneScript.js').GuiBenneScript}
 * subscribes here via **`B.whenMouseEnter`** / **`B.whenMouseLeave`**.
 */

const GUI_PREFIX = 'gui:';

/** `gui:<guiId>:control:<controlId>:mouseenter` — pointer entered a GUI control’s hit area. */
export function guiControlMouseEnterEventId(guiId: string, controlId: string): string {
  return `${GUI_PREFIX}${guiId}:control:${controlId}:mouseenter`;
}

/** `gui:<guiId>:control:<controlId>:mouseleave` — pointer left a GUI control’s hit area. */
export function guiControlMouseLeaveEventId(guiId: string, controlId: string): string {
  return `${GUI_PREFIX}${guiId}:control:${controlId}:mouseleave`;
}
</file>

<file path="src/engine/events/inventoryVerbEvents.ts">
const VERB_ROOM_PREFIX = 'verb:room:';
const VERB_INVENTORY_PREFIX = 'verb:inventory:';

/** `verb:room:<roomId>:inventory:<itemId>:<verbId>` */
export function roomInventoryVerbEventId(roomId: string, itemId: string, verbId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:inventory:${itemId}:${verbId}`;
}

/** `verb:inventory:<itemId>:<verbId>` — global inventory handler (after no room-scoped listener). */
export function inventoryVerbEventId(itemId: string, verbId: string): string {
  return `${VERB_INVENTORY_PREFIX}${itemId}:${verbId}`;
}

export interface InventoryVerbInteractPayload {
  itemId: string;
  roomId: string;
  verbId: string;
}
</file>

<file path="src/engine/events/playerWalkEvents.ts">
/** Emitted on `gameEvents` when the player starts walking to a point. */
export const PLAYER_WALK_START = 'player:walk:start' as const;

/** Emitted when a walk finishes (arrived) or is cancelled (new destination / shutdown). */
export const PLAYER_WALK_STOP = 'player:walk:stop' as const;

export type PlayerWalkStartPayload = {
  roomId: string;
  targetX: number;
  targetY: number;
};

export type PlayerWalkStopReason = 'complete' | 'interrupted';

export type PlayerWalkStopPayload = {
  roomId: string;
  reason: PlayerWalkStopReason;
};
</file>

<file path="src/engine/gameState/registryKey.ts">
/** Phaser `game.registry` key for {@link import('./GameStateManager.js').GameStateManager}. */
export const BENNE_GAME_STATE_REGISTRY_KEY = 'benneGameState';
</file>

<file path="src/engine/gameState/resolveGameStateManager.ts">
import * as Phaser from 'phaser';
import type { GameStateManager } from './GameStateManager.js';
import { BENNE_GAME_STATE_REGISTRY_KEY } from './registryKey.js';

export function resolveGameStateManager(game: Phaser.Game): GameStateManager {
  const manager = game.registry.get(BENNE_GAME_STATE_REGISTRY_KEY) as GameStateManager | undefined;
  if (!manager) {
    throw new Error(
      '[Benne] GameStateManager missing from game.registry — createBenneGame must register it.',
    );
  }
  return manager;
}
</file>

<file path="src/engine/inventory/inventoryDefinitionRegistry.ts">
import type { InventoryItemData } from '../../types/inventory.js';

const definitions = new Map<string, InventoryItemData>();

export function registerInventoryDefinition(data: InventoryItemData): void {
  definitions.set(data.id, data);
}

export function getInventoryDefinition(itemId: string): InventoryItemData | undefined {
  return definitions.get(itemId);
}

export function getRegisteredInventoryDefinitionIds(): string[] {
  return [...definitions.keys()].sort((a, b) => a.localeCompare(b));
}
</file>

<file path="src/engine/postfx/PostEffects.ts">
import type * as Phaser from 'phaser';

/**
 * Post-processing hook for Phaser 4’s camera {@link Phaser.GameObjects.Components.FilterList}.
 *
 * Custom full-frame effects use `camera.filters.internal` (and optionally `external`).
 * GLSL snippets are typically registered via {@link Phaser.GameObjects.BaseShader} and composed
 * with {@link Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader} render nodes (see Phaser docs).
 *
 * This module is intentionally a no-op until you add CRT, dither wipes, etc.
 */
export function attachPostProcessingPlaceholder(camera: Phaser.Cameras.Scene2D.Camera): void {
  void camera;
  // Example (disabled): camera.filters.internal.addVignette(0.2, 0.3);
}
</file>

<file path="src/engine/scripting/benneScriptFacades.ts">
import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import type { BenneScriptSayArgs, BlockingWithNow } from './BenneScriptCore.js';

/** Visibility + description overrides for one prop (`BenneScript.prop`). */
export interface BenneScriptPropFacade {
  hide(): void;
  show(): void;
  get visible(): boolean;
  set visible(v: boolean);
  get description(): string;
  set description(v: string);
}

/** Movement + animation + facing for the player. */
export interface BenneScriptPlayerFacade {
  walkTo: BlockingWithNow<[Point2 | string]>;
  playAnimation: BlockingWithNow<[string]>;
  say: BlockingWithNow<BenneScriptSayArgs>;
  face: BlockingWithNow<[CharacterFacingLetter]>;
}

/** Movement + animation + facing for an NPC. */
export interface BenneScriptCharacterFacade {
  walkTo: BlockingWithNow<[Point2 | string]>;
  playAnimation: BlockingWithNow<[string]>;
  say: BlockingWithNow<BenneScriptSayArgs>;
  face: BlockingWithNow<[CharacterFacingLetter]>;
}
</file>

<file path="src/engine/scripting/benneScriptPayloads.ts">
import type { RoomPropInteractPayload } from '../events/propInteractionEvents.js';

/** Payload for whenGive — prop interaction plus the item id from the sugar API. */
export type GivePropInteractPayload = RoomPropInteractPayload & { itemId: string };
</file>

<file path="src/engine/scripting/CharacterScriptContext.ts">
import * as Phaser from 'phaser';
import type { CharacterScriptContext } from './types.js';
import { CharacterBenneScript } from './CharacterBenneScript.js';
import type { RoomScene } from '../scenes/RoomScene.js';

export function createCharacterScriptContext(
  events: Phaser.Events.EventEmitter,
  characterId: string,
  roomId: string,
  roomScene: RoomScene,
): CharacterScriptContext {
  const B = new CharacterBenneScript(events, characterId, roomScene);

  return {
    B,
    events,
    characterId,
    roomId,
    roomScene,
  };
}
</file>

<file path="src/engine/scripting/GuiRuntime.ts">
import * as Phaser from 'phaser';
import { withNow, type BlockingWithNow } from './BenneScriptCore.js';

export type ControlTweenProps = Partial<Phaser.Types.Tweens.TweenBuilderConfig>;

/**
 * Authoring handle for one control’s live Phaser object; tweens can queue on the owning GUI script’s interaction tail.
 */
export class ControlFacade {
  readonly gameObject: Phaser.GameObjects.GameObject;

  readonly tweenTo: BlockingWithNow<[props: ControlTweenProps, duration?: number, easing?: string]>;

  private readonly scene: Phaser.Scene;

  constructor(
    gameObject: Phaser.GameObjects.GameObject,
    scene: Phaser.Scene,
    queueInteraction: (factory: () => Promise<unknown>) => void,
  ) {
    this.gameObject = gameObject;
    this.scene = scene;

    const runTween = (
      props: ControlTweenProps,
      duration: number | undefined,
      easing: string | undefined,
      resolve?: () => void,
    ): Phaser.Tweens.Tween => {
      const { onComplete: userOnComplete, targets: _ignoreTargets, duration: dProp, ease: easeProp, ...rest } = props;
      const dur = duration ?? dProp ?? 0;
      const ease = easing ?? easeProp ?? 'Linear';
      return this.scene.tweens.add({
        targets: this.gameObject,
        ...rest,
        duration: dur,
        ease,
        onComplete: (tw: Phaser.Tweens.Tween, targets: unknown[]) => {
          userOnComplete?.(tw, targets);
          resolve?.();
        },
      });
    };

    this.tweenTo = withNow(
      (props: ControlTweenProps, duration?: number, easing?: string) => {
        queueInteraction(
          () =>
            new Promise<void>((resolve) => {
              runTween(props, duration, easing, resolve);
            }),
        );
      },
      (props: ControlTweenProps, duration?: number, easing?: string) => {
        runTween(props, duration, easing);
      },
    );
  }

  setX(x: number): void {
    const go = this.gameObject as { x?: number; setX?: (v: number) => void };
    if (typeof go.setX === 'function') {
      go.setX(x);
    } else if (typeof go.x === 'number') {
      go.x = x;
    }
  }

  setY(y: number): void {
    const go = this.gameObject as { y?: number; setY?: (v: number) => void };
    if (typeof go.setY === 'function') {
      go.setY(y);
    } else if (typeof go.y === 'number') {
      go.y = y;
    }
  }

  setVisible(visible: boolean): void {
    const go = this.gameObject as { setVisible?: (v: boolean) => void; visible?: boolean };
    if (typeof go.setVisible === 'function') {
      go.setVisible(visible);
    } else {
      go.visible = visible;
    }
  }

  setAlpha(alpha: number): void {
    const go = this.gameObject as { setAlpha?: (v: number) => void; alpha?: number };
    if (typeof go.setAlpha === 'function') {
      go.setAlpha(alpha);
    } else {
      go.alpha = alpha;
    }
  }
}

export interface GuiRuntimeOptions {
  scene: Phaser.Scene;
  guiId: string;
  /** Overlay base depth from {@link buildGuiOverlay} (same as the packed content root). */
  baseDepth: number;
  /**
   * Parent for every **non-fixed** authored control (see **`GuiData.fixedControls`**). Tween {@link GuiRuntime.root}
   * to move that packed subtree; listed fixed controls stay scene-rooted siblings and are not parented here.
   */
  contentRoot: Phaser.GameObjects.Container;
  controlGameObjectsById: ReadonlyMap<string, Phaser.GameObjects.GameObject>;
  queueInteraction: (factory: () => Promise<unknown>) => void;
}

/**
 * Per-overlay GUI behavior surface: whole-GUI {@link GuiRuntime.root} facade and per-control lookup.
 * Constructed after {@link buildGuiOverlay}; call {@link dispose} (or destroy the overlay handle) on room teardown.
 *
 * **Hover events** (pointer enter / leave) for any control with an **`id`** — including the dedicated **`trigger`**
 * control type — are routed through Bennescript (**`B.whenMouseEnter`** / **`B.whenMouseLeave`**), not this class.
 */
export class GuiRuntime {
  readonly guiId: string;
  /** The scene hosting this overlay (scale, tweens, input). */
  readonly scene: Phaser.Scene;
  /**
   * The root container for the **packed** authored GUI: every control **except** those listed in **`fixedControls`**
   * on the GUI JSON (those stay outside this container so they do not move with root-level tweens).
   * Tweening or moving this (via **`tweenTo`**, **`setY`**, …) affects only that subtree — same interaction queue as
   * {@link getControl} facades.
   */
  readonly root: ControlFacade;

  private readonly queueInteraction: (factory: () => Promise<unknown>) => void;
  private readonly controlObjects: ReadonlyMap<string, Phaser.GameObjects.GameObject>;
  private readonly facadeCache = new Map<string, ControlFacade>();
  private disposed = false;

  constructor(options: GuiRuntimeOptions) {
    this.scene = options.scene;
    this.guiId = options.guiId;
    this.controlObjects = options.controlGameObjectsById;
    this.queueInteraction = options.queueInteraction;

    this.root = new ControlFacade(options.contentRoot, options.scene, options.queueInteraction);
  }

  /**
   * Resolves a control by **`id`** from **`*.gui.json`**, or **`null`** if missing / blank / unknown.
   * Use this when a control may legitimately be absent and you will branch (optional UI, feature flags).
   * When the control must exist for the behavior to make sense, prefer {@link getControlOrThrow} so callers get a **`ControlFacade`** without null checks.
   */
  getControl(controlId: string): ControlFacade | null {
    const id = controlId.trim();
    if (!id) {
      return null;
    }
    const existing = this.facadeCache.get(id);
    if (existing) {
      return existing;
    }
    const go = this.controlObjects.get(id);
    if (!go) {
      return null;
    }
    const facade = new ControlFacade(go, this.scene, this.queueInteraction);
    this.facadeCache.set(id, facade);
    return facade;
  }

  /**
   * Same as {@link getControl}, but throws if the control is missing (unknown id, blank string, or not in the overlay).
   * Recommended default for `onGuiBuilt` wiring when a missing control indicates an authoring bug.
   */
  getControlOrThrow(controlId: string): ControlFacade {
    const facade = this.getControl(controlId);
    if (!facade) {
      const id = controlId.trim();
      throw new Error(
        `[Benne] GUI "${this.guiId}" has no control with id "${id.length > 0 ? id : controlId}" (check *.gui.json and buildGuiOverlay control ids).`,
      );
    }
    return facade;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const fac of this.facadeCache.values()) {
      this.scene.tweens.killTweensOf(fac.gameObject);
    }
    this.facadeCache.clear();
    this.scene.tweens.killTweensOf(this.root.gameObject);
  }
}
</file>

<file path="src/engine/scripting/InventoryBenneScript.ts">
import * as Phaser from 'phaser';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import { getStartingPlayerCharacterId } from '../../game/constants.js';
import type { InventoryVerbInteractPayload } from '../events/inventoryVerbEvents.js';
import { inventoryVerbEventId, roomInventoryVerbEventId } from '../events/inventoryVerbEvents.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import {
  playDirectionalAnimation,
  type DirectionalCharacterSprite,
} from '../directionalCharacterAnimation.js';
import {
  BenneScriptCore,
  withNow,
  type BenneScriptSayLineOptions,
} from './BenneScriptCore.js';
import {
  createBenneScriptGameStateNamespace,
  createBenneScriptInventoryNamespace,
  type BenneScriptGameStateNamespace,
  type BenneScriptInventoryNamespace,
} from './benneScriptGameStateApi.js';
import type {
  BenneScriptCharacterFacade,
  BenneScriptPlayerFacade,
} from './benneScriptFacades.js';

/**
 * Bennescript facade for `*.inventory.ts`: subscribes to room-scoped and global inventory verb ids so
 * {@link import('../verbs/dispatchInventoryVerb.js').dispatchInventoryVerbInteraction} precedence matches characters.
 */
export class InventoryBenneScript extends BenneScriptCore {
  private readonly itemId: string;
  private readonly roomId: string;
  private readonly roomScene: RoomScene;

  readonly state: BenneScriptGameStateNamespace;
  readonly inventory: BenneScriptInventoryNamespace;

  constructor(events: Phaser.Events.EventEmitter, itemId: string, roomId: string, roomScene: RoomScene) {
    super(events, () => roomScene.time);
    this.itemId = itemId;
    this.roomId = roomId;
    this.roomScene = roomScene;
    const manager = resolveGameStateManager(roomScene.game);
    this.state = createBenneScriptGameStateNamespace(manager);
    this.inventory = createBenneScriptInventoryNamespace(manager);
  }

  private subscribeInventoryVerb(
    verbId: string,
    handler: ((p: InventoryVerbInteractPayload) => void) | (() => void),
  ): void {
    const inner = (payload: unknown) => {
      const p = payload as InventoryVerbInteractPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: InventoryVerbInteractPayload) => void)(p);
      }
    };
    this.subscribe(roomInventoryVerbEventId(this.roomId, this.itemId, verbId), inner);
    this.subscribe(inventoryVerbEventId(this.itemId, verbId), inner);
  }

  whenLookAt(handler: () => void): void;
  whenLookAt(handler: (p: InventoryVerbInteractPayload) => void): void;
  whenLookAt(handler: ((p: InventoryVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeInventoryVerb(this.resolveVerbId('look'), handler);
  }

  whenUse(handler: () => void): void;
  whenUse(handler: (p: InventoryVerbInteractPayload) => void): void;
  whenUse(handler: ((p: InventoryVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeInventoryVerb(this.resolveVerbId('use'), handler);
  }

  whenPickUp(handler: () => void): void;
  whenPickUp(handler: (p: InventoryVerbInteractPayload) => void): void;
  whenPickUp(handler: ((p: InventoryVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeInventoryVerb(this.resolveVerbId('pickUp'), handler);
  }

  whenPush(handler: () => void): void;
  whenPush(handler: (p: InventoryVerbInteractPayload) => void): void;
  whenPush(handler: ((p: InventoryVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeInventoryVerb(this.resolveVerbId('push'), handler);
  }

  whenPull(handler: () => void): void;
  whenPull(handler: (p: InventoryVerbInteractPayload) => void): void;
  whenPull(handler: ((p: InventoryVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeInventoryVerb(this.resolveVerbId('pull'), handler);
  }

  whenOpen(handler: () => void): void;
  whenOpen(handler: (p: InventoryVerbInteractPayload) => void): void;
  whenOpen(handler: ((p: InventoryVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeInventoryVerb(this.resolveVerbId('open'), handler);
  }

  whenClose(handler: () => void): void;
  whenClose(handler: (p: InventoryVerbInteractPayload) => void): void;
  whenClose(handler: ((p: InventoryVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeInventoryVerb(this.resolveVerbId('close'), handler);
  }

  whenTalkTo(handler: () => void): void;
  whenTalkTo(handler: (p: InventoryVerbInteractPayload) => void): void;
  whenTalkTo(handler: ((p: InventoryVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeInventoryVerb(this.resolveVerbId('talkTo'), handler);
  }

  whenVerb(verbId: string, handler: () => void): void;
  whenVerb(verbId: string, handler: (p: InventoryVerbInteractPayload) => void): void;
  whenVerb(
    verbId: string,
    handler: ((p: InventoryVerbInteractPayload) => void) | (() => void),
  ): void {
    this.subscribeInventoryVerb(verbId, handler);
  }

  character(definitionId: string): BenneScriptCharacterFacade {
    return this.makeCharacterFacade(definitionId);
  }

  get player(): BenneScriptPlayerFacade {
    return this.makePlayerFacade();
  }

  private makeCharacterFacade(definitionId: string): BenneScriptCharacterFacade {
    const scene = this.roomScene;

    const runCharacterPlayAnimation = (tag: string): void => {
      const sprite = scene.getCharacterSprite(definitionId);
      if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
        if (scene.anims.exists(tag)) {
          sprite.play(tag);
        } else {
          console.warn(`[Benne] Unknown animation tag "${tag}" for character "${definitionId}"`);
        }
      }
    };

    const runCharacterFace = (direction: CharacterFacingLetter): void => {
      const sprite = scene.getCharacterSprite(definitionId) as DirectionalCharacterSprite | undefined;
      if (sprite?.anims) {
        playDirectionalAnimation(sprite, 'Idle', direction);
      }
    };

    const logCharacterSay = (line: string): void => {
      console.log(`[Character ${definitionId}] ${line}`);
    };

    return {
      walkTo: withNow(
        (target: Point2 | string) => {
          this.chain(() => scene.walkCharacterTo(definitionId, target));
        },
        (target: Point2 | string) => {
          void scene.walkCharacterTo(definitionId, target);
        },
      ),
      playAnimation: withNow(
        (tag: string) => {
          this.chain(() => {
            runCharacterPlayAnimation(tag);
            return Promise.resolve();
          });
        },
        runCharacterPlayAnimation,
      ),
      say: withNow(
        (line: string, options?: BenneScriptSayLineOptions) => {
          logCharacterSay(line);
          this.queueSayDialogWithInputLock(scene, line, definitionId, true, options);
        },
        (line: string, options?: BenneScriptSayLineOptions) => {
          logCharacterSay(line);
          this.queueSayDialogWithInputLock(scene, line, definitionId, false, options);
        },
      ),
      face: withNow(
        (direction: CharacterFacingLetter) => {
          this.chain(() => {
            runCharacterFace(direction);
            return Promise.resolve();
          });
        },
        runCharacterFace,
      ),
    };
  }

  private makePlayerFacade(): BenneScriptPlayerFacade {
    const scene = this.roomScene;

    const runPlayerPlayAnimation = (tag: string): void => {
      const pl = scene.player;
      if (pl?.anims) {
        if (scene.anims.exists(tag)) {
          pl.play(tag);
        } else {
          console.warn(`[Benne] Unknown animation tag "${tag}" for player`);
        }
      }
    };

    const runPlayerFace = (direction: CharacterFacingLetter): void => {
      const pl = scene.player;
      if (pl) {
        playDirectionalAnimation(pl, 'Idle', direction);
      }
    };

    const logPlayerSay = (line: string): void => {
      console.log(`[Player] ${line}`);
    };

    return {
      walkTo: withNow(
        (target: Point2 | string) => {
          this.chain(() => scene.walkPlayerTo(target));
        },
        (target: Point2 | string) => {
          void scene.walkPlayerTo(target);
        },
      ),
      playAnimation: withNow(
        (tag: string) => {
          this.chain(() => {
            runPlayerPlayAnimation(tag);
            return Promise.resolve();
          });
        },
        runPlayerPlayAnimation,
      ),
      say: withNow(
        (line: string, options?: BenneScriptSayLineOptions) => {
          logPlayerSay(line);
          this.queueSayDialogWithInputLock(scene, line, getStartingPlayerCharacterId(), true, options);
        },
        (line: string, options?: BenneScriptSayLineOptions) => {
          logPlayerSay(line);
          this.queueSayDialogWithInputLock(scene, line, getStartingPlayerCharacterId(), false, options);
        },
      ),
      face: withNow(
        (direction: CharacterFacingLetter) => {
          this.chain(() => {
            runPlayerFace(direction);
            return Promise.resolve();
          });
        },
        runPlayerFace,
      ),
    };
  }

  cutscene(callback: () => void): void {
    callback();
  }
}
</file>

<file path="src/engine/scripting/InventoryScriptContext.ts">
import * as Phaser from 'phaser';
import type { InventoryScriptContext } from './types.js';
import { InventoryBenneScript } from './InventoryBenneScript.js';
import type { RoomScene } from '../scenes/RoomScene.js';

export function createInventoryScriptContext(
  events: Phaser.Events.EventEmitter,
  itemId: string,
  roomId: string,
  roomScene: RoomScene,
): InventoryScriptContext {
  const B = new InventoryBenneScript(events, itemId, roomId, roomScene);

  return {
    B,
    events,
    itemId,
    roomId,
    roomScene,
  };
}
</file>

<file path="src/engine/scripting/registerCharacterScript.ts">
import type { CharacterScriptContext } from './types.js';

const benneCharacterScriptRegistrations: Array<{
  characterId: string;
  registerFn: (context: CharacterScriptContext) => void;
}> = [];

export function getBenneCharacterScriptRegistrations(): ReadonlyArray<{
  characterId: string;
  registerFn: (context: CharacterScriptContext) => void;
}> {
  return benneCharacterScriptRegistrations;
}

/**
 * Call at the top level of each `*.character.ts` to register Bennescript handlers for that character definition.
 * Handlers subscribe to **character-global** verb ids only; room-scoped handlers in `*.room.ts` still take precedence
 * (see {@link import('../verbs/dispatchVerb.js').dispatchVerbInteraction}).
 */
export function registerCharacterScript(
  characterId: string,
  registerFn: (context: CharacterScriptContext) => void,
): void {
  benneCharacterScriptRegistrations.push({ characterId, registerFn });
}
</file>

<file path="src/engine/scripting/registerGlobalScript.ts">
import type { GlobalScriptContext } from './types.js';

const benneGlobalScriptRegistrations: Array<(context: GlobalScriptContext) => void> = [];

export function getBenneGlobalScriptRegistrations(): ReadonlyArray<(context: GlobalScriptContext) => void> {
  return benneGlobalScriptRegistrations;
}

/**
 * Call from `globalScript.ts` (side effect) to register global Bennescript handlers.
 * Run after {@link import('./wireBenneGlobalScripts.js').wireBenneGlobalScripts} so `ctx.game` and timers are available.
 */
export function registerGlobalScript(registerFn: (context: GlobalScriptContext) => void): void {
  benneGlobalScriptRegistrations.push(registerFn);
}
</file>

<file path="src/engine/scripting/registerInventoryScript.ts">
import type { InventoryScriptContext } from './types.js';

const benneInventoryScriptRegistrations: Array<{
  itemId: string;
  registerFn: (context: InventoryScriptContext) => void;
}> = [];

export function getBenneInventoryScriptRegistrations(): ReadonlyArray<{
  itemId: string;
  registerFn: (context: InventoryScriptContext) => void;
}> {
  return benneInventoryScriptRegistrations;
}

/**
 * Call at the top level of each `*.inventory.ts` to register Bennescript handlers for that item.
 * Handlers subscribe to **room-scoped and global** inventory verb ids so
 * {@link import('../verbs/dispatchInventoryVerb.js').dispatchInventoryVerbInteraction} can prefer room listeners first.
 */
export function registerInventoryScript(
  itemId: string,
  registerFn: (context: InventoryScriptContext) => void,
): void {
  benneInventoryScriptRegistrations.push({ itemId, registerFn });
}
</file>

<file path="src/engine/scripting/wireBenneGlobalScripts.ts">
import * as Phaser from 'phaser';
import type { EventBus } from '../events/EventBus.js';
import { GlobalBenneScript } from './GlobalBenneScript.js';
import { getBenneGlobalScriptRegistrations } from './registerGlobalScript.js';
import type { GlobalScriptContext } from './types.js';

/**
 * Invokes all `registerGlobalScript` callbacks with a {@link GlobalBenneScript} bound to the live game.
 * Call from `main.ts` immediately after {@link import('../Game.js').createBenneGame}.
 */
export function wireBenneGlobalScripts(game: Phaser.Game, events: EventBus): void {
  const registrations = getBenneGlobalScriptRegistrations();
  if (registrations.length === 0) {
    return;
  }

  const B = new GlobalBenneScript(events, game);
  const ctx: GlobalScriptContext = { B, events, game };

  for (const registerFn of registrations) {
    try {
      registerFn(ctx);
    } catch (err) {
      console.error('[Benne] Error in global script:', err);
    }
  }
}
</file>

<file path="src/engine/verbs/dispatchInventoryVerb.ts">
import type { EventBus } from '../events/EventBus';
import { inventoryVerbEventId, roomInventoryVerbEventId } from '../events/inventoryVerbEvents.js';

function listenerCount(bus: EventBus, event: string): number {
  return bus.listeners(event).length;
}

/**
 * Dispatch order: `verb:room:<roomId>:inventory:<itemId>:<verbId>` → `verb:inventory:<itemId>:<verbId>` →
 * emit room id anyway (parity with character dispatch when no global listener).
 */
export function dispatchInventoryVerbInteraction(
  bus: EventBus,
  verbId: string,
  itemId: string,
  roomId: string,
): void {
  const payload = { itemId, roomId, verbId };
  const roomScoped = roomInventoryVerbEventId(roomId, itemId, verbId);
  if (listenerCount(bus, roomScoped) > 0) {
    bus.emit(roomScoped, payload);
    return;
  }
  const globalScoped = inventoryVerbEventId(itemId, verbId);
  if (listenerCount(bus, globalScoped) > 0) {
    bus.emit(globalScoped, payload);
    return;
  }
  bus.emit(roomScoped, payload);
}
</file>

<file path="src/engine/verbs/resolvePointerVerb.ts">
import type * as Phaser from 'phaser';
import type { VerbInputProfileTwoVerb } from '../../types/game';

/** Resolve which verb id the player intended from a pointer event (two-button profile). */
export function resolveVerbIdFromPointer(
  pointer: Phaser.Input.Pointer,
  profile: VerbInputProfileTwoVerb,
): string | null {
  if (pointer.leftButtonDown()) {
    return profile.primaryButtonVerb;
  }
  if (pointer.rightButtonDown()) {
    return profile.secondaryButtonVerb;
  }
  return null;
}
</file>

<file path="src/game/assets/images/characters/hank/hank.json">
{ "frames": {
   "hank 0.aseprite": {
    "frame": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 130
   },
   "hank 1.aseprite": {
    "frame": { "x": 36, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 130
   },
   "hank 2.aseprite": {
    "frame": { "x": 72, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 130
   },
   "hank 3.aseprite": {
    "frame": { "x": 108, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 4.aseprite": {
    "frame": { "x": 144, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 5.aseprite": {
    "frame": { "x": 180, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 6.aseprite": {
    "frame": { "x": 0, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 7.aseprite": {
    "frame": { "x": 36, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 8.aseprite": {
    "frame": { "x": 72, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 9.aseprite": {
    "frame": { "x": 108, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 10.aseprite": {
    "frame": { "x": 144, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 11.aseprite": {
    "frame": { "x": 180, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 12.aseprite": {
    "frame": { "x": 0, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 13.aseprite": {
    "frame": { "x": 36, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 14.aseprite": {
    "frame": { "x": 72, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 15.aseprite": {
    "frame": { "x": 108, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 16.aseprite": {
    "frame": { "x": 144, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 17.aseprite": {
    "frame": { "x": 180, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 18.aseprite": {
    "frame": { "x": 0, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 19.aseprite": {
    "frame": { "x": 36, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 20.aseprite": {
    "frame": { "x": 72, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 21.aseprite": {
    "frame": { "x": 108, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 22.aseprite": {
    "frame": { "x": 144, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 23.aseprite": {
    "frame": { "x": 180, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 24.aseprite": {
    "frame": { "x": 0, "y": 256, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 25.aseprite": {
    "frame": { "x": 72, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "hank 26.aseprite": {
    "frame": { "x": 36, "y": 256, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   }
 },
 "meta": {
  "app": "https://www.aseprite.org/",
  "version": "1.3.18-beta1-x64",
  "image": "hank.png",
  "format": "RGBA8888",
  "size": { "w": 216, "h": 320 },
  "scale": "1",
  "frameTags": [
   { "name": "IdleL", "from": 0, "to": 0, "direction": "forward", "color": "#000000ff" },
   { "name": "IdleD", "from": 1, "to": 1, "direction": "forward", "color": "#000000ff" },
   { "name": "IdleU", "from": 2, "to": 2, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkL", "from": 3, "to": 8, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkD", "from": 9, "to": 14, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkU", "from": 15, "to": 20, "direction": "forward", "color": "#000000ff" },
   { "name": "TalkL", "from": 21, "to": 22, "direction": "forward", "color": "#000000ff" },
   { "name": "TalkD", "from": 23, "to": 24, "direction": "forward", "color": "#000000ff" },
   { "name": "TalkU", "from": 25, "to": 26, "direction": "forward", "color": "#000000ff" }
  ],
  "layers": [
   { "name": "Layer 2", "opacity": 255, "blendMode": "normal" }
  ],
  "slices": [
  ]
 }
}
</file>

<file path="src/game/assets/images/cursor/cursor.json">
{ "frames": {
   "cursor 0.aseprite": {
    "frame": { "x": 0, "y": 0, "w": 32, "h": 32 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 32 },
    "sourceSize": { "w": 32, "h": 32 },
    "duration": 100
   },
   "cursor 1.aseprite": {
    "frame": { "x": 0, "y": 0, "w": 32, "h": 32 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 32 },
    "sourceSize": { "w": 32, "h": 32 },
    "duration": 100
   },
   "cursor 2.aseprite": {
    "frame": { "x": 32, "y": 0, "w": 32, "h": 32 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 32 },
    "sourceSize": { "w": 32, "h": 32 },
    "duration": 100
   },
   "cursor 3.aseprite": {
    "frame": { "x": 0, "y": 0, "w": 32, "h": 32 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 32 },
    "sourceSize": { "w": 32, "h": 32 },
    "duration": 100
   },
   "cursor 4.aseprite": {
    "frame": { "x": 0, "y": 32, "w": 32, "h": 32 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 32 },
    "sourceSize": { "w": 32, "h": 32 },
    "duration": 100
   }
 },
 "meta": {
  "app": "https://www.aseprite.org/",
  "version": "1.3.18-beta1-x64",
  "image": "cursor.png",
  "format": "RGBA8888",
  "size": { "w": 64, "h": 64 },
  "scale": "1",
  "frameTags": [
   { "name": "Idle", "from": 0, "to": 0, "direction": "forward", "color": "#000000ff" },
   { "name": "Active", "from": 1, "to": 4, "direction": "forward", "color": "#000000ff" }
  ],
  "layers": [
   { "name": "Idle", "opacity": 255, "blendMode": "normal" }
  ],
  "slices": [
  ]
 }
}
</file>

<file path="src/game/assets/images/guis/inventoryBar/inventoryBar.json">
{ "frames": {
   "inventoryBar 0.aseprite": {
    "frame": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "sourceSize": { "w": 320, "h": 180 },
    "duration": 100
   },
   "inventoryBar 1.aseprite": {
    "frame": { "x": 320, "y": 0, "w": 320, "h": 180 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "sourceSize": { "w": 320, "h": 180 },
    "duration": 100
   },
   "inventoryBar 2.aseprite": {
    "frame": { "x": 0, "y": 180, "w": 320, "h": 180 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "sourceSize": { "w": 320, "h": 180 },
    "duration": 100
   },
   "inventoryBar 3.aseprite": {
    "frame": { "x": 320, "y": 180, "w": 320, "h": 180 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "sourceSize": { "w": 320, "h": 180 },
    "duration": 100
   }
 },
 "meta": {
  "app": "https://www.aseprite.org/",
  "version": "1.3.18-beta1-x64",
  "image": "inventoryBar.png",
  "format": "I8",
  "size": { "w": 640, "h": 360 },
  "scale": "1",
  "frameTags": [
   { "name": "InvBG", "from": 1, "to": 1, "direction": "forward", "color": "#000000ff" },
   { "name": "BackBtn", "from": 2, "to": 2, "direction": "forward", "color": "#000000ff" },
   { "name": "FwBtn", "from": 3, "to": 3, "direction": "forward", "color": "#000000ff" }
  ],
  "layers": [
   { "name": "BG", "opacity": 255, "blendMode": "normal" },
   { "name": "InvBG", "opacity": 255, "blendMode": "normal" },
   { "name": "Slots", "opacity": 255, "blendMode": "normal" },
   { "name": "Back Button", "opacity": 255, "blendMode": "normal" },
   { "name": "Forward Button", "opacity": 255, "blendMode": "normal" }
  ],
  "slices": [
  ]
 }
}
</file>

<file path="src/game/characterAseprite.ts">
import type { CharacterData } from '../types/character';

export function usesAsepriteDisplay(data: CharacterData): boolean {
  return data.display.aseprite === true;
}

/** Loader / texture cache key shared by all instances of this character definition. */
export function getAsepriteTextureKey(characterId: string): string {
  return `aseprite:${characterId}`;
}

/** PNG + JSON paths under `src/game/assets/` for Aseprite export. */
export function getAsepriteAssetPaths(characterId: string): { png: string; json: string } {
  const base = `images/characters/${characterId}/${characterId}`;
  return { png: `${base}.png`, json: `${base}.json` };
}
</file>

<file path="src/game/characterPreviewIdleTag.ts">
/**
 * Picks an idle clip for the character preview (editor). Prefers `IdleD`, then other common idles,
 * then any tag starting with `Idle` (lexicographic).
 */
const PREVIEW_IDLE_PRIORITY: readonly string[] = [
  'IdleD',
  'IdleDR',
  'IdleDL',
  'IdleR',
  'IdleL',
  'IdleU',
  'IdleUR',
  'IdleUL',
];

export function pickCharacterPreviewIdleTag(frameTagNames: readonly string[]): string | null {
  const set = new Set(frameTagNames);
  for (const t of PREVIEW_IDLE_PRIORITY) {
    if (set.has(t)) {
      return t;
    }
  }
  const idles = frameTagNames.filter((n) => n.startsWith('Idle')).sort();
  return idles[0] ?? null;
}
</file>

<file path="src/game/cursorAseprite.ts">
import type * as Phaser from 'phaser';
import type { GameSettings, GameSettingsCursor, GameSettingsCursorHotspot } from '../types/game';

/** Phaser texture / animation atlas key for `images/cursor/cursor.{png,json}`. */
export const CURSOR_TEXTURE_KEY = 'aseprite:cursor';

/** Allowed `game-config.json` `cursor.hotspot` string values. */
export const CURSOR_HOTSPOT_PRESETS: readonly GameSettingsCursorHotspot[] = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
  'custom',
];

/** @internal Exported for {@link assertCursorSettings} tests of allowed literals. */
export function isValidGameSettingsCursorHotspot(value: string): value is GameSettingsCursorHotspot {
  return (CURSOR_HOTSPOT_PRESETS as readonly string[]).includes(value);
}

/**
 * Places the cursor sprite so the configured hotspot aligns with `pointer` (game / canvas space).
 */
export function applyGameCursorSpriteHotspot(
  sprite: Phaser.GameObjects.Sprite,
  pointer: { x: number; y: number },
  cursor: GameSettingsCursor,
): void {
  const mode = cursor.hotspot ?? 'top-left';
  if (mode === 'custom') {
    const p = cursor.hotspotPixel;
    const hx = p !== undefined && Number.isFinite(p.x) ? p.x : 0;
    const hy = p !== undefined && Number.isFinite(p.y) ? p.y : 0;
    sprite.setOrigin(0, 0);
    sprite.setPosition(pointer.x - hx, pointer.y - hy);
    return;
  }
  let ox = 0;
  let oy = 0;
  switch (mode) {
    case 'top-left':
      ox = 0;
      oy = 0;
      break;
    case 'top-center':
      ox = 0.5;
      oy = 0;
      break;
    case 'top-right':
      ox = 1;
      oy = 0;
      break;
    case 'center-left':
      ox = 0;
      oy = 0.5;
      break;
    case 'center':
      ox = 0.5;
      oy = 0.5;
      break;
    case 'center-right':
      ox = 1;
      oy = 0.5;
      break;
    case 'bottom-left':
      ox = 0;
      oy = 1;
      break;
    case 'bottom-center':
      ox = 0.5;
      oy = 1;
      break;
    case 'bottom-right':
      ox = 1;
      oy = 1;
      break;
    default:
      ox = 0;
      oy = 0;
  }
  sprite.setOrigin(ox, oy);
  sprite.setPosition(pointer.x, pointer.y);
}

export function getCursorAsepriteAssetPaths(): { png: string; json: string } {
  return { png: 'images/cursor/cursor.png', json: 'images/cursor/cursor.json' };
}

/** True when `game-config.json` requests the bundled Aseprite cursor with usable tag names. */
export function isBenneGameCursorAsepriteEnabled(settings: GameSettings): boolean {
  const c = settings.cursor;
  if (!c || c.display?.aseprite !== true) {
    return false;
  }
  return (
    typeof c.idleAnimation === 'string' &&
    c.idleAnimation.trim().length > 0 &&
    typeof c.activeAnimation === 'string' &&
    c.activeAnimation.trim().length > 0
  );
}
</file>

<file path="src/game/guiAseprite.ts">
import type { GuiData } from '../types/gui';

export function usesAsepriteDisplay(data: GuiData): boolean {
  return data.display?.aseprite === true;
}

/** Loader / texture cache key for this GUI definition. */
export function getAsepriteTextureKey(guiId: string): string {
  return `aseprite:gui:${guiId}`;
}

/** PNG + JSON paths under `src/game/assets/` for Aseprite export. */
export function getAsepriteAssetPaths(guiId: string): { png: string; json: string } {
  const base = `images/guis/${guiId}/${guiId}`;
  return { png: `${base}.png`, json: `${base}.json` };
}
</file>

<file path="src/game/inventory/Candy1/Candy1.inventory.json">
{
  "id": "Candy1",
  "name": "Candy1",
  "description": "",
  "onVerb": {},
  "stackable": false,
  "animations": {},
  "display": {
    "aseprite": "shared"
  }
}
</file>

<file path="src/game/inventory/Candy1/Candy1.inventory.ts">
import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Candy1', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;
});
</file>

<file path="src/game/inventory/Chainsaw/Chainsaw.inventory.json">
{
  "id": "Chainsaw",
  "name": "Chainsaw",
  "description": "",
  "onVerb": {},
  "stackable": false,
  "animations": {},
  "display": {
    "aseprite": "shared"
  }
}
</file>

<file path="src/game/inventory/Chainsaw/Chainsaw.inventory.ts">
import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Chainsaw', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;
});
</file>

<file path="src/game/inventory/Glue/Glue.inventory.json">
{
  "id": "Glue",
  "name": "Glue",
  "description": "",
  "onVerb": {},
  "stackable": false,
  "animations": {},
  "display": {
    "aseprite": "shared"
  }
}
</file>

<file path="src/game/inventory/Glue/Glue.inventory.ts">
import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Glue', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;
});
</file>

<file path="src/game/inventory/Key/Key.inventory.json">
{
  "id": "Key",
  "name": "Key",
  "description": "",
  "onVerb": {},
  "stackable": false,
  "animations": {},
  "display": {
    "aseprite": "shared"
  }
}
</file>

<file path="src/game/inventory/Key/Key.inventory.ts">
import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Key', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;
});
</file>

<file path="src/game/inventory/Newspaper/Newspaper.inventory.json">
{
  "id": "Newspaper",
  "name": "Newspaper",
  "description": "",
  "onVerb": {},
  "stackable": false,
  "animations": {},
  "display": {
    "aseprite": "shared"
  }
}
</file>

<file path="src/game/inventory/Newspaper/Newspaper.inventory.ts">
import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Newspaper', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;
});
</file>

<file path="src/game/inventory/SheetMusic/SheetMusic.inventory.json">
{
  "id": "SheetMusic",
  "name": "SheetMusic",
  "description": "",
  "onVerb": {},
  "stackable": false,
  "animations": {},
  "display": {
    "aseprite": "shared"
  }
}
</file>

<file path="src/game/inventory/SheetMusic/SheetMusic.inventory.ts">
import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('SheetMusic', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;
});
</file>

<file path="src/game/inventory/Vacuum/Vacuum.inventory.json">
{
  "id": "Vacuum",
  "name": "Vacuum",
  "description": "",
  "onVerb": {},
  "stackable": false,
  "animations": {},
  "display": {
    "aseprite": "shared"
  }
}
</file>

<file path="src/game/inventory/Vacuum/Vacuum.inventory.ts">
import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Vacuum', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;
});
</file>

<file path="src/game/loadCharacterData.ts">
import type { CharacterData } from '../types/character';
import { usesAsepriteDisplay } from './characterAseprite';

const characterJsonModules = import.meta.glob('./characters/**/*.character.json', {
  eager: true,
}) as Record<string, { default: CharacterData }>;

function assertValidCharacterDisplay(data: CharacterData): void {
  if (usesAsepriteDisplay(data)) {
    return;
  }
  const img = data.display.defaultImage;
  if (!img || img.length === 0) {
    throw new Error(`Character '${data.id}': set display.aseprite true or display.defaultImage`);
  }
}

export function loadCharacterData(definitionRelativePath: string): CharacterData {
  const normalized = definitionRelativePath.replace(/^\.?\/+/, '').replaceAll('\\', '/');
  const key = `./characters/${normalized}`;
  const mod = characterJsonModules[key];

  if (!mod) {
    throw new Error(
      `Character JSON not found '${definitionRelativePath}' (expected key '${key}'). Keys: ${Object.keys(characterJsonModules).join(', ')}`,
    );
  }

  const data = mod.default;
  assertValidCharacterDisplay(data);
  return data;
}
</file>

<file path="src/game/normalizeAsepriteJson.ts">
/**
 * Phaser's AnimationManager#createFromAseprite expects `frames` keys to be "0", "1", "2", …
 * matching tag `from` / `to` indices. Aseprite hash exports often use keys like "name 0.aseprite" instead,
 * which produces empty animations and crashes on sprite.play().
 */
export function normalizeAsepriteJsonForPhaser(data: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  const frames = clone.frames as Record<string, unknown> | undefined;
  if (!frames || typeof frames !== 'object') {
    return clone;
  }

  const keys = Object.keys(frames);
  if (keys.length === 0) {
    return clone;
  }

  const allNumericKeys = keys.every((k) => /^\d+$/.test(k));
  if (allNumericKeys) {
    return clone;
  }

  const sortedKeys = [...keys].sort((a, b) => extractFrameSortIndex(a) - extractFrameSortIndex(b));
  const newFrames: Record<string, unknown> = {};
  sortedKeys.forEach((oldKey, index) => {
    newFrames[String(index)] = frames[oldKey];
  });

  clone.frames = newFrames;
  return clone;
}

function extractFrameSortIndex(frameKey: string): number {
  const match = frameKey.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}
</file>

<file path="src/game/roomAseprite.ts">
/** Loader / animation cache key for a room’s prop spritesheet (`images/rooms/<roomId>/`). */
export function getRoomAsepriteTextureKey(roomId: string): string {
  return `roomAseprite:${roomId}`;
}

export function getRoomAsepriteAssetPaths(roomId: string): { png: string; json: string } {
  const base = `images/rooms/${roomId}/${roomId}`;
  return { png: `${base}.png`, json: `${base}.json` };
}
</file>

<file path="src/types/dialogue.ts">
export interface DialogueLine {
  speaker?: string;
  text: string;
}

export interface DialogueNode {
  id: string;
  lines: DialogueLine[];
  choices?: { text: string; nextNodeId: string }[];
}

export interface DialogueTree {
  id: string;
  startNodeId: string;
  nodes: Record<string, DialogueNode>;
}
</file>

<file path="src/engine/Room.ts">
import type { RoomData } from '../types/room';

/**
 * Base class for data-driven rooms. Scenes will compose engine systems with JSON definitions.
 */
export abstract class Room {
  readonly definition: RoomData;

  constructor(definition: RoomData) {
    this.definition = definition;
  }

  abstract get id(): string;
}
</file>

<file path="src/engine/scripting/BenneScriptCore.ts">
import * as Phaser from 'phaser';
import { computeDialogLineDurationMs, getDialogSettings, getGameSettings } from '../ConfigManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import {
  playDirectionalAnimation,
  resolveInitialIdleFacing,
  type CharacterFacing,
} from '../directionalCharacterAnimation.js';
import { getEffectiveVerbDefinitions } from '../verbs/verbConfig.js';

/**
 * Callable that participates in the interaction queue; **`fn.now`** runs the same action immediately
 * without blocking subsequent chained steps (fire-and-forget).
 */
export type BlockingWithNow<TArgs extends readonly unknown[] = readonly unknown[]> = ((
  ...args: TArgs
) => void) & { now: (...args: TArgs) => void };

export function withNow<TArgs extends readonly unknown[]>(
  blocking: (...args: TArgs) => void,
  nowImpl: (...args: TArgs) => void,
): BlockingWithNow<TArgs> {
  const fn = blocking as BlockingWithNow<TArgs>;
  fn.now = nowImpl;
  return fn;
}

/** Internal keys for {@link BenneScriptCore.resolveVerbId}. */
export type VerbAlias =
  | 'look'
  | 'use'
  | 'pickUp'
  | 'give'
  | 'talkTo'
  | 'push'
  | 'pull'
  | 'open'
  | 'close';

const VERB_ALIAS_CANDIDATES: Record<VerbAlias, readonly string[]> = {
  look: ['look', 'examine'],
  use: ['use', 'interact'],
  pickUp: ['pickUp', 'pickup', 'take'],
  give: ['give'],
  talkTo: ['talkTo', 'talk', 'speak'],
  push: ['push'],
  pull: ['pull'],
  open: ['open'],
  close: ['close'],
};

/** Optional flags for `say` / `.say.now` on character/player facades. */
export interface BenneScriptSayLineOptions {
  clickToSkip?: boolean;
}

export type BenneScriptSayArgs = [line: string, options?: BenneScriptSayLineOptions];

/**
 * Shared interaction queue, verb alias resolution, dialog line + input lock, and `wait` / `raw`
 * for room, character, global, and GUI Bennescript facades.
 */
export abstract class BenneScriptCore {
  private static unresolvedVerbWarnings = new Set<string>();

  protected readonly events: Phaser.Events.EventEmitter;
  private disposers: Array<() => void> = [];
  private interactionTail: Promise<void> = Promise.resolve();
  private readonly getClock: () => Phaser.Time.Clock | null;

  /**
   * Pause the interaction chain for **`seconds`**. **`.wait.now`** schedules the delay only (does not block the queue).
   */
  readonly wait: BlockingWithNow<[number]>;

  readonly raw: {
    on: (event: string | symbol, fn: (...args: unknown[]) => void, context?: unknown) => void;
    once: (event: string | symbol, fn: (...args: unknown[]) => void, context?: unknown) => void;
    off: (event: string | symbol, fn?: (...args: unknown[]) => void, context?: unknown) => void;
    emit: (event: string | symbol, ...args: unknown[]) => boolean;
  };

  constructor(events: Phaser.Events.EventEmitter, getClock: () => Phaser.Time.Clock | null) {
    this.events = events;
    this.getClock = getClock;

    this.raw = {
      on: (event, fn, context) => this.events.on(event, fn as (...args: unknown[]) => void, context),
      once: (event, fn, context) => this.events.once(event, fn as (...args: unknown[]) => void, context),
      off: (event, fn, context) => this.events.off(event, fn as never, context),
      emit: (event, ...args) => this.events.emit(event, ...args),
    };

    this.wait = withNow(
      (seconds: number) => {
        const ms = Math.max(0, seconds * 1000);
        this.chain(
          () =>
            new Promise<void>((resolve) => {
              const clock = this.getClock();
              if (!clock) {
                resolve();
                return;
              }
              clock.delayedCall(ms, () => resolve());
            }),
        );
      },
      (seconds: number) => {
        const ms = Math.max(0, seconds * 1000);
        this.getClock()?.delayedCall(ms, () => {});
      },
    );
  }

  dispose(): void {
    for (const off of this.disposers) {
      off();
    }
    this.disposers = [];
  }

  private beginInteraction(): void {
    this.interactionTail = Promise.resolve();
  }

  private endInteraction(): Promise<void> {
    return this.interactionTail;
  }

  /**
   * Append async work to the interaction tail (lazy `factory` — see class docstring).
   * Subclasses (e.g. GUI Bennescript) use this for queued tweens.
   */
  protected chain(factory: () => Promise<unknown>): void {
    this.interactionTail = this.interactionTail.then(factory).then(() => undefined);
  }

  protected subscribe(eventId: string, run: (payload: unknown) => void): void {
    const wrapped = async (payload: unknown) => {
      this.beginInteraction();
      try {
        run(payload);
        await this.endInteraction();
      } catch (err) {
        console.error(`[Benne] Error in ${eventId} handler:`, err);
      }
    };
    this.events.on(eventId, wrapped);
    this.disposers.push(() => this.events.off(eventId, wrapped));
  }

  /**
   * Like {@link subscribe}, but the handler runs **synchronously** and never awaits the interaction tail.
   * Use for high-frequency events (e.g. GUI pointer hover) that must not serialize behind queued tweens.
   */
  protected subscribeImmediate(eventId: string, run: () => void): void {
    const fn = (): void => {
      try {
        run();
      } catch (err) {
        console.error(`[Benne] Error in ${eventId} handler:`, err);
      }
    };
    this.events.on(eventId, fn);
    this.disposers.push(() => this.events.off(eventId, fn));
  }

  /**
   * Maps a Bennescript alias to the first matching `verbs[].id` from `game-config.json`.
   */
  protected resolveVerbId(alias: VerbAlias): string {
    const settings = getGameSettings();
    const configured = new Set(getEffectiveVerbDefinitions(settings).map((v) => v.id));
    const candidates = VERB_ALIAS_CANDIDATES[alias];
    for (const id of candidates) {
      if (configured.has(id)) {
        return id;
      }
    }
    const warnKey = alias;
    if (!BenneScriptCore.unresolvedVerbWarnings.has(warnKey)) {
      BenneScriptCore.unresolvedVerbWarnings.add(warnKey);
      console.warn(
        `[Benne] No verb in game-config matches alias "${alias}" (tried: ${candidates.join(', ')}). ` +
          `Handlers register under id "${alias}". Add a matching verb to game-config.json.`,
      );
    }
    return alias;
  }

  protected applySayLineDirectionalBase(
    scene: RoomScene,
    characterDefinitionId: string,
    baseName: 'Talk' | 'Idle',
  ): void {
    const sprite = scene.getCharacterSprite(characterDefinitionId);
    if (!sprite || !(sprite instanceof Phaser.GameObjects.Sprite) || !sprite.anims) {
      return;
    }
    const facing: CharacterFacing =
      (sprite.getData('facing') as CharacterFacing | undefined) ?? resolveInitialIdleFacing(sprite);
    playDirectionalAnimation(sprite, baseName, facing);
  }

  protected queueSayDialogWithInputLock(
    scene: RoomScene,
    line: string,
    talkCharacterDefinitionId: string,
    chain: boolean,
    options?: BenneScriptSayLineOptions,
  ): void {
    const ms = computeDialogLineDurationMs(line);
    const lineOpt = options?.clickToSkip;
    const allowClickToSkip =
      lineOpt === true || (lineOpt !== false && getDialogSettings().clickToSkip);

    const runLine = (resolve?: () => void): void => {
      let completed = false;
      let timer: Phaser.Time.TimerEvent | null = null;

      const finish = (): void => {
        if (completed) {
          return;
        }
        completed = true;
        timer?.remove(false);
        timer = null;
        scene.clearScriptedDialogClickToSkip();
        this.applySayLineDirectionalBase(scene, talkCharacterDefinitionId, 'Idle');
        scene.setDialogTextOverlay({ visible: false });
        scene.popScriptedDialogInputSuppression();
        resolve?.();
      };

      scene.pushScriptedDialogInputSuppression();
      scene.setDialogTextOverlay({
        visible: true,
        text: line,
        talkCharacterDefinitionId,
      });
      this.applySayLineDirectionalBase(scene, talkCharacterDefinitionId, 'Talk');

      timer = scene.time.delayedCall(ms, finish);

      if (allowClickToSkip) {
        scene.setScriptedDialogClickToSkip(() => {
          timer?.remove(false);
          timer = null;
          finish();
        });
      }
    };

    if (chain) {
      this.chain(() => new Promise<void>((resolve) => runLine(resolve)));
    } else {
      runLine();
    }
  }
}
</file>

<file path="src/engine/scripting/CharacterBenneScript.ts">
import * as Phaser from 'phaser';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import { getStartingPlayerCharacterId } from '../../game/constants.js';
import type { CharacterVerbInteractPayload } from '../events/propInteractionEvents.js';
import { characterVerbEventId } from '../events/verbInteractionEvents.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import {
  playDirectionalAnimation,
  type DirectionalCharacterSprite,
} from '../directionalCharacterAnimation.js';
import {
  BenneScriptCore,
  withNow,
  type BenneScriptSayLineOptions,
} from './BenneScriptCore.js';
import {
  createBenneScriptGameStateNamespace,
  createBenneScriptInventoryNamespace,
  type BenneScriptGameStateNamespace,
  type BenneScriptInventoryNamespace,
} from './benneScriptGameStateApi.js';
import type {
  BenneScriptCharacterFacade,
  BenneScriptPlayerFacade,
} from './benneScriptFacades.js';

/**
 * Bennescript facade for `*.character.ts`: self-only verb channels (`characterVerbEventId`) so
 * {@link import('../verbs/dispatchVerb.js').dispatchVerbInteraction} still prefers room-scoped handlers first.
 */
export class CharacterBenneScript extends BenneScriptCore {
  private readonly characterId: string;
  private readonly roomScene: RoomScene;

  readonly state: BenneScriptGameStateNamespace;
  readonly inventory: BenneScriptInventoryNamespace;

  constructor(events: Phaser.Events.EventEmitter, characterId: string, roomScene: RoomScene) {
    super(events, () => roomScene.time);
    this.characterId = characterId;
    this.roomScene = roomScene;
    const manager = resolveGameStateManager(roomScene.game);
    this.state = createBenneScriptGameStateNamespace(manager);
    this.inventory = createBenneScriptInventoryNamespace(manager);
  }

  private subscribeSelfVerb(
    verbId: string,
    handler: ((p: CharacterVerbInteractPayload) => void) | (() => void),
  ): void {
    const eventId = characterVerbEventId(this.characterId, verbId);
    this.subscribe(eventId, (payload) => {
      const p = payload as CharacterVerbInteractPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: CharacterVerbInteractPayload) => void)(p);
      }
    });
  }

  whenLookAt(handler: () => void): void;
  whenLookAt(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenLookAt(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('look'), handler);
  }

  whenUse(handler: () => void): void;
  whenUse(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenUse(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('use'), handler);
  }

  whenPickUp(handler: () => void): void;
  whenPickUp(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenPickUp(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('pickUp'), handler);
  }

  whenPush(handler: () => void): void;
  whenPush(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenPush(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('push'), handler);
  }

  whenPull(handler: () => void): void;
  whenPull(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenPull(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('pull'), handler);
  }

  whenOpen(handler: () => void): void;
  whenOpen(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenOpen(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('open'), handler);
  }

  whenClose(handler: () => void): void;
  whenClose(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenClose(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('close'), handler);
  }

  whenTalkTo(handler: () => void): void;
  whenTalkTo(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenTalkTo(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('talkTo'), handler);
  }

  whenVerb(verbId: string, handler: () => void): void;
  whenVerb(verbId: string, handler: (p: CharacterVerbInteractPayload) => void): void;
  whenVerb(
    verbId: string,
    handler: ((p: CharacterVerbInteractPayload) => void) | (() => void),
  ): void {
    this.subscribeSelfVerb(verbId, handler);
  }

  character(definitionId: string): BenneScriptCharacterFacade {
    return this.makeCharacterFacade(definitionId);
  }

  get player(): BenneScriptPlayerFacade {
    return this.makePlayerFacade();
  }

  private makeCharacterFacade(definitionId: string): BenneScriptCharacterFacade {
    const scene = this.roomScene;

    const runCharacterPlayAnimation = (tag: string): void => {
      const sprite = scene.getCharacterSprite(definitionId);
      if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
        if (scene.anims.exists(tag)) {
          sprite.play(tag);
        } else {
          console.warn(`[Benne] Unknown animation tag "${tag}" for character "${definitionId}"`);
        }
      }
    };

    const runCharacterFace = (direction: CharacterFacingLetter): void => {
      const sprite = scene.getCharacterSprite(definitionId) as DirectionalCharacterSprite | undefined;
      if (sprite?.anims) {
        playDirectionalAnimation(sprite, 'Idle', direction);
      }
    };

    const logCharacterSay = (line: string): void => {
      console.log(`[Character ${definitionId}] ${line}`);
    };

    return {
      walkTo: withNow(
        (target: Point2 | string) => {
          this.chain(() => scene.walkCharacterTo(definitionId, target));
        },
        (target: Point2 | string) => {
          void scene.walkCharacterTo(definitionId, target);
        },
      ),
      playAnimation: withNow(
        (tag: string) => {
          this.chain(() => {
            runCharacterPlayAnimation(tag);
            return Promise.resolve();
          });
        },
        runCharacterPlayAnimation,
      ),
      say: withNow(
        (line: string, options?: BenneScriptSayLineOptions) => {
          logCharacterSay(line);
          this.queueSayDialogWithInputLock(scene, line, definitionId, true, options);
        },
        (line: string, options?: BenneScriptSayLineOptions) => {
          logCharacterSay(line);
          this.queueSayDialogWithInputLock(scene, line, definitionId, false, options);
        },
      ),
      face: withNow(
        (direction: CharacterFacingLetter) => {
          this.chain(() => {
            runCharacterFace(direction);
            return Promise.resolve();
          });
        },
        runCharacterFace,
      ),
    };
  }

  private makePlayerFacade(): BenneScriptPlayerFacade {
    const scene = this.roomScene;

    const runPlayerPlayAnimation = (tag: string): void => {
      const pl = scene.player;
      if (pl?.anims) {
        if (scene.anims.exists(tag)) {
          pl.play(tag);
        } else {
          console.warn(`[Benne] Unknown animation tag "${tag}" for player`);
        }
      }
    };

    const runPlayerFace = (direction: CharacterFacingLetter): void => {
      const pl = scene.player;
      if (pl) {
        playDirectionalAnimation(pl, 'Idle', direction);
      }
    };

    const logPlayerSay = (line: string): void => {
      console.log(`[Player] ${line}`);
    };

    return {
      walkTo: withNow(
        (target: Point2 | string) => {
          this.chain(() => scene.walkPlayerTo(target));
        },
        (target: Point2 | string) => {
          void scene.walkPlayerTo(target);
        },
      ),
      playAnimation: withNow(
        (tag: string) => {
          this.chain(() => {
            runPlayerPlayAnimation(tag);
            return Promise.resolve();
          });
        },
        runPlayerPlayAnimation,
      ),
      say: withNow(
        (line: string, options?: BenneScriptSayLineOptions) => {
          logPlayerSay(line);
          this.queueSayDialogWithInputLock(scene, line, getStartingPlayerCharacterId(), true, options);
        },
        (line: string, options?: BenneScriptSayLineOptions) => {
          logPlayerSay(line);
          this.queueSayDialogWithInputLock(scene, line, getStartingPlayerCharacterId(), false, options);
        },
      ),
      face: withNow(
        (direction: CharacterFacingLetter) => {
          this.chain(() => {
            runPlayerFace(direction);
            return Promise.resolve();
          });
        },
        runPlayerFace,
      ),
    };
  }

  cutscene(callback: () => void): void {
    callback();
  }
}
</file>

<file path="src/engine/scripting/GlobalBenneScript.ts">
import * as Phaser from 'phaser';
import {
  VERB_GLOBAL_FALLBACK_EVENT,
  VERB_UNHANDLED_EVENT,
  globalVerbHandlerEventId,
} from '../events/verbInteractionEvents.js';
import type { VerbGlobalFallbackPayload, VerbUnhandledPayload } from '../events/verbInteractionEvents.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { SCENE_ROOM } from '../../game/constants.js';
import { BenneScriptCore } from './BenneScriptCore.js';
import {
  createBenneScriptGameStateNamespace,
  createBenneScriptInventoryNamespace,
  type BenneScriptGameStateNamespace,
  type BenneScriptInventoryNamespace,
} from './benneScriptGameStateApi.js';

/**
 * Bennescript facade for `globalScript.ts`: global verb fallback chain and `raw` bus access.
 */
export class GlobalBenneScript extends BenneScriptCore {
  readonly state: BenneScriptGameStateNamespace;
  readonly inventory: BenneScriptInventoryNamespace;

  constructor(events: Phaser.Events.EventEmitter, game: Phaser.Game) {
    super(events, () => {
      const room = game.scene.getScene(SCENE_ROOM) as RoomScene | undefined;
      return room?.time ?? null;
    });
    const manager = resolveGameStateManager(game);
    this.state = createBenneScriptGameStateNamespace(manager);
    this.inventory = createBenneScriptInventoryNamespace(manager);
  }

  whenGlobalFallback(
    handler: ((payload: VerbGlobalFallbackPayload) => void) | (() => void),
  ): void {
    this.subscribe(VERB_GLOBAL_FALLBACK_EVENT, (payload) => {
      const p = payload as VerbGlobalFallbackPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: VerbGlobalFallbackPayload) => void)(p);
      }
    });
  }

  whenVerbUnhandled(
    handler: ((payload: VerbUnhandledPayload) => void) | (() => void),
  ): void {
    this.subscribe(VERB_UNHANDLED_EVENT, (payload) => {
      const p = payload as VerbUnhandledPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: VerbUnhandledPayload) => void)(p);
      }
    });
  }

  whenGlobalVerb(
    verbId: string,
    handler: ((payload: VerbGlobalFallbackPayload) => void) | (() => void),
  ): void {
    const eventId = globalVerbHandlerEventId(verbId);
    this.subscribe(eventId, (payload) => {
      const p = payload as VerbGlobalFallbackPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: VerbGlobalFallbackPayload) => void)(p);
      }
    });
  }
}
</file>

<file path="src/engine/scripting/registerGuiScript.ts">
import type { GuiBenneScript } from './GuiBenneScript.js';
import type { GuiScriptContext } from './types.js';

const benneGuiScriptRegistrations: Array<{
  guiId: string;
  registerFn: (context: GuiScriptContext) => void;
}> = [];

/** Live facade per `guiId` (last wins if multiple modules register the same id). Wired in `registerGameContent`. */
const guiBenneScriptById = new Map<string, GuiBenneScript>();

export function getBenneGuiScriptRegistrations(): ReadonlyArray<{
  guiId: string;
  registerFn: (context: GuiScriptContext) => void;
}> {
  return benneGuiScriptRegistrations;
}

/** Called when a {@link GuiBenneScript} is constructed for a `registerGuiScript` registration. */
export function registerGuiBenneScriptInstance(guiId: string, script: GuiBenneScript): void {
  guiBenneScriptById.set(guiId, script);
}

export function getGuiBenneScript(guiId: string): GuiBenneScript | undefined {
  return guiBenneScriptById.get(guiId);
}

/** Call at the top level of each `*.gui.ts` to register GUI-scoped Bennescript (or `raw`) handlers. */
export function registerGuiScript(
  guiId: string,
  registerFn: (context: GuiScriptContext) => void,
): void {
  benneGuiScriptRegistrations.push({ guiId, registerFn });
}
</file>

<file path="src/engine/scripting/RoomScriptContext.ts">
import type { RoomScriptContext as ContextType } from './types.js';
import { BenneScript } from './BenneScript.js';
import type { RoomScene } from '../scenes/RoomScene.js';

export function createRoomScriptContext(
  events: Phaser.Events.EventEmitter,
  roomId: string,
  roomScene: RoomScene
): ContextType {
  const B = new BenneScript(events, roomId, roomScene);

  const context: ContextType = {
    B,
    events,
    roomId,
    roomScene,
    onProp: B.onProp.bind(B),
    whenLookAt: B.whenLookAt.bind(B),
    whenUse: B.whenUse.bind(B),
    whenPickUp: B.whenPickUp.bind(B),
    whenGive: B.whenGive.bind(B),
    whenPush: B.whenPush.bind(B),
    whenPull: B.whenPull.bind(B),
    whenOpen: B.whenOpen.bind(B),
    whenClose: B.whenClose.bind(B),
    whenVerb: B.whenVerb.bind(B),
    whenTalkTo: B.whenTalkTo.bind(B),
  };

  return context;
}
</file>

<file path="src/engine/verbs/verbConfig.ts">
import type { GameSettings, GameVerbDefinition, VerbInputProfileTwoVerb } from '../../types/game';

const DEFAULT_VERBS: GameVerbDefinition[] = [{ id: 'look' }, { id: 'use' }];

/** Effective verb list: explicit `settings.verbs` or implicit `look` + `use`. */
export function getEffectiveVerbDefinitions(settings: GameSettings): GameVerbDefinition[] {
  if (settings.verbs && settings.verbs.length > 0) {
    return settings.verbs;
  }
  return DEFAULT_VERBS;
}

/**
 * Two-button profile. When `inputProfile` is omitted, defaults to
 * left (primary) → `look`, right (secondary) → `use`.
 */
export function getEffectiveTwoVerbProfile(settings: GameSettings): VerbInputProfileTwoVerb {
  const ip = settings.inputProfile;
  if (ip?.kind === 'twoVerb') {
    return ip;
  }
  return {
    kind: 'twoVerb',
    primaryButtonVerb: 'look',
    secondaryButtonVerb: 'use',
  };
}
</file>

<file path="src/game/assets/images/characters/henry/henry.json">
{ "frames": {
   "henry 0.aseprite": {
    "frame": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 130
   },
   "henry 1.aseprite": {
    "frame": { "x": 36, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 130
   },
   "henry 2.aseprite": {
    "frame": { "x": 72, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 130
   },
   "henry 3.aseprite": {
    "frame": { "x": 108, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 4.aseprite": {
    "frame": { "x": 144, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 5.aseprite": {
    "frame": { "x": 180, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 6.aseprite": {
    "frame": { "x": 0, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 7.aseprite": {
    "frame": { "x": 36, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 8.aseprite": {
    "frame": { "x": 72, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 9.aseprite": {
    "frame": { "x": 108, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 10.aseprite": {
    "frame": { "x": 144, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 11.aseprite": {
    "frame": { "x": 180, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 12.aseprite": {
    "frame": { "x": 0, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 13.aseprite": {
    "frame": { "x": 36, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 14.aseprite": {
    "frame": { "x": 72, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 15.aseprite": {
    "frame": { "x": 108, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 16.aseprite": {
    "frame": { "x": 144, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 17.aseprite": {
    "frame": { "x": 180, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 18.aseprite": {
    "frame": { "x": 0, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 19.aseprite": {
    "frame": { "x": 36, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 20.aseprite": {
    "frame": { "x": 72, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 21.aseprite": {
    "frame": { "x": 108, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 22.aseprite": {
    "frame": { "x": 144, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 23.aseprite": {
    "frame": { "x": 180, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 24.aseprite": {
    "frame": { "x": 0, "y": 256, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 25.aseprite": {
    "frame": { "x": 72, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "henry 26.aseprite": {
    "frame": { "x": 36, "y": 256, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   }
 },
 "meta": {
  "app": "https://www.aseprite.org/",
  "version": "1.3.18-beta1-x64",
  "image": "henry.png",
  "format": "RGBA8888",
  "size": { "w": 216, "h": 320 },
  "scale": "1",
  "frameTags": [
   { "name": "IdleL", "from": 0, "to": 0, "direction": "forward", "color": "#000000ff" },
   { "name": "IdleD", "from": 1, "to": 1, "direction": "forward", "color": "#000000ff" },
   { "name": "IdleU", "from": 2, "to": 2, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkL", "from": 3, "to": 8, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkD", "from": 9, "to": 14, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkU", "from": 15, "to": 20, "direction": "forward", "color": "#000000ff" },
   { "name": "TalkL", "from": 21, "to": 22, "direction": "forward", "color": "#000000ff" },
   { "name": "TalkD", "from": 23, "to": 24, "direction": "forward", "color": "#000000ff" },
   { "name": "TalkU", "from": 25, "to": 26, "direction": "forward", "color": "#000000ff" }
  ],
  "layers": [
   { "name": "Layer 2", "opacity": 255, "blendMode": "normal" }
  ],
  "slices": [
  ]
 }
}
</file>

<file path="src/game/assets/images/inventory/inventory.json">
{ "frames": {
   "inventory 0.aseprite": {
    "frame": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 1.aseprite": {
    "frame": { "x": 38, "y": 0, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 2.aseprite": {
    "frame": { "x": 76, "y": 0, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 3.aseprite": {
    "frame": { "x": 114, "y": 0, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 4.aseprite": {
    "frame": { "x": 152, "y": 0, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 5.aseprite": {
    "frame": { "x": 190, "y": 0, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 6.aseprite": {
    "frame": { "x": 0, "y": 30, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 7.aseprite": {
    "frame": { "x": 38, "y": 30, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 8.aseprite": {
    "frame": { "x": 76, "y": 30, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 9.aseprite": {
    "frame": { "x": 114, "y": 30, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 10.aseprite": {
    "frame": { "x": 152, "y": 30, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 11.aseprite": {
    "frame": { "x": 190, "y": 30, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 12.aseprite": {
    "frame": { "x": 0, "y": 60, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 13.aseprite": {
    "frame": { "x": 38, "y": 60, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 14.aseprite": {
    "frame": { "x": 76, "y": 60, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 15.aseprite": {
    "frame": { "x": 114, "y": 60, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 16.aseprite": {
    "frame": { "x": 152, "y": 60, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 17.aseprite": {
    "frame": { "x": 190, "y": 60, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 18.aseprite": {
    "frame": { "x": 0, "y": 90, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 19.aseprite": {
    "frame": { "x": 38, "y": 90, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 20.aseprite": {
    "frame": { "x": 76, "y": 90, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 21.aseprite": {
    "frame": { "x": 114, "y": 90, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 22.aseprite": {
    "frame": { "x": 152, "y": 90, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 23.aseprite": {
    "frame": { "x": 190, "y": 90, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 24.aseprite": {
    "frame": { "x": 0, "y": 120, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 25.aseprite": {
    "frame": { "x": 38, "y": 120, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 26.aseprite": {
    "frame": { "x": 76, "y": 120, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 27.aseprite": {
    "frame": { "x": 114, "y": 120, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 28.aseprite": {
    "frame": { "x": 152, "y": 120, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   },
   "inventory 29.aseprite": {
    "frame": { "x": 190, "y": 120, "w": 38, "h": 30 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 38, "h": 30 },
    "sourceSize": { "w": 38, "h": 30 },
    "duration": 100
   }
 },
 "meta": {
  "app": "https://www.aseprite.org/",
  "version": "1.3.18-beta1-x64",
  "image": "inventory.png",
  "format": "RGBA8888",
  "size": { "w": 228, "h": 150 },
  "scale": "1",
  "frameTags": [
   { "name": "Broom", "from": 0, "to": 0, "direction": "forward", "color": "#000000ff" },
   { "name": "Ladder", "from": 1, "to": 1, "direction": "forward", "color": "#000000ff" },
   { "name": "Lantern", "from": 2, "to": 2, "direction": "forward", "color": "#000000ff" },
   { "name": "Lantern-glowing", "from": 3, "to": 3, "direction": "forward", "color": "#000000ff" },
   { "name": "SheetMusic", "from": 4, "to": 4, "direction": "forward", "color": "#000000ff" },
   { "name": "Key", "from": 5, "to": 5, "direction": "forward", "color": "#000000ff" },
   { "name": "Vacuum", "from": 6, "to": 6, "direction": "forward", "color": "#000000ff" },
   { "name": "Candy1", "from": 7, "to": 7, "direction": "forward", "color": "#000000ff" },
   { "name": "Candy2", "from": 8, "to": 8, "direction": "forward", "color": "#000000ff" },
   { "name": "Candy3", "from": 9, "to": 9, "direction": "forward", "color": "#000000ff" },
   { "name": "Chainsaw", "from": 10, "to": 10, "direction": "forward", "color": "#000000ff" },
   { "name": "Newspaper", "from": 11, "to": 11, "direction": "forward", "color": "#000000ff" },
   { "name": "Glue", "from": 12, "to": 12, "direction": "forward", "color": "#000000ff" },
   { "name": "IceSalt", "from": 13, "to": 13, "direction": "forward", "color": "#000000ff" },
   { "name": "GlueyNewspaper", "from": 14, "to": 14, "direction": "forward", "color": "#000000ff" },
   { "name": "Sandpaper", "from": 15, "to": 15, "direction": "forward", "color": "#000000ff" },
   { "name": "Icing", "from": 16, "to": 16, "direction": "forward", "color": "#000000ff" },
   { "name": "Paintbrush", "from": 17, "to": 17, "direction": "forward", "color": "#000000ff" },
   { "name": "Bottlecaps", "from": 18, "to": 18, "direction": "forward", "color": "#000000ff" },
   { "name": "Nails", "from": 19, "to": 19, "direction": "forward", "color": "#000000ff" },
   { "name": "CarDone", "from": 20, "to": 20, "direction": "forward", "color": "#000000ff" },
   { "name": "BrushWithPaint", "from": 21, "to": 21, "direction": "forward", "color": "#000000ff" },
   { "name": "Wheels", "from": 22, "to": 22, "direction": "forward", "color": "#000000ff" },
   { "name": "Todo", "from": 23, "to": 23, "direction": "forward", "color": "#000000ff" },
   { "name": "binoculars", "from": 24, "to": 24, "direction": "forward", "color": "#000000ff" },
   { "name": "rope", "from": 25, "to": 25, "direction": "forward", "color": "#000000ff" },
   { "name": "bucket", "from": 26, "to": 26, "direction": "forward", "color": "#000000ff" },
   { "name": "hammer", "from": 27, "to": 27, "direction": "forward", "color": "#000000ff" },
   { "name": "dynamite", "from": 28, "to": 28, "direction": "forward", "color": "#000000ff" },
   { "name": "lens", "from": 29, "to": 29, "direction": "forward", "color": "#000000ff" }
  ],
  "layers": [
   { "name": "Layer 4", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 2", "opacity": 255, "blendMode": "normal" },
   { "name": "Items", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 1", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 3", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 5", "opacity": 255, "blendMode": "normal" }
  ],
  "slices": [
  ]
 }
}
</file>

<file path="src/game/assets/images/rooms/apartment/apartment.json">
{ "frames": {
   "apartment 0.aseprite": {
    "frame": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "sourceSize": { "w": 320, "h": 180 },
    "duration": 100
   },
   "apartment 1.aseprite": {
    "frame": { "x": 320, "y": 0, "w": 320, "h": 180 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "sourceSize": { "w": 320, "h": 180 },
    "duration": 100
   },
   "apartment 2.aseprite": {
    "frame": { "x": 640, "y": 0, "w": 320, "h": 180 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "sourceSize": { "w": 320, "h": 180 },
    "duration": 100
   },
   "apartment 3.aseprite": {
    "frame": { "x": 960, "y": 0, "w": 320, "h": 180 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "sourceSize": { "w": 320, "h": 180 },
    "duration": 100
   },
   "apartment 4.aseprite": {
    "frame": { "x": 0, "y": 180, "w": 320, "h": 180 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "sourceSize": { "w": 320, "h": 180 },
    "duration": 100
   },
   "apartment 5.aseprite": {
    "frame": { "x": 320, "y": 180, "w": 320, "h": 180 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "sourceSize": { "w": 320, "h": 180 },
    "duration": 100
   },
   "apartment 6.aseprite": {
    "frame": { "x": 640, "y": 180, "w": 320, "h": 180 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "sourceSize": { "w": 320, "h": 180 },
    "duration": 100
   },
   "apartment 7.aseprite": {
    "frame": { "x": 960, "y": 180, "w": 320, "h": 180 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "sourceSize": { "w": 320, "h": 180 },
    "duration": 100
   },
   "apartment 8.aseprite": {
    "frame": { "x": 0, "y": 360, "w": 320, "h": 180 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "sourceSize": { "w": 320, "h": 180 },
    "duration": 100
   },
   "apartment 9.aseprite": {
    "frame": { "x": 320, "y": 360, "w": 320, "h": 180 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "sourceSize": { "w": 320, "h": 180 },
    "duration": 100
   },
   "apartment 10.aseprite": {
    "frame": { "x": 640, "y": 360, "w": 320, "h": 180 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 320, "h": 180 },
    "sourceSize": { "w": 320, "h": 180 },
    "duration": 100
   }
 },
 "meta": {
  "app": "https://www.aseprite.org/",
  "version": "1.3.18-beta1-x64",
  "image": "apartment.png",
  "format": "RGBA8888",
  "size": { "w": 1280, "h": 540 },
  "scale": "1",
  "frameTags": [
   { "name": "BG", "from": 1, "to": 1, "direction": "forward", "color": "#000000ff" },
   { "name": "Couch", "from": 2, "to": 2, "direction": "forward", "color": "#000000ff" },
   { "name": "Door", "from": 3, "to": 3, "direction": "forward", "color": "#000000ff" },
   { "name": "Door-open", "from": 4, "to": 4, "direction": "forward", "color": "#000000ff" },
   { "name": "Pillar", "from": 5, "to": 5, "direction": "forward", "color": "#000000ff" },
   { "name": "Fan", "from": 6, "to": 10, "direction": "forward", "color": "#000000ff" }
  ],
  "layers": [
   { "name": "Walls and Floor", "opacity": 255, "blendMode": "normal" },
   { "name": "Ceiling", "opacity": 255, "blendMode": "normal" },
   { "name": "Window", "opacity": 255, "blendMode": "normal" },
   { "name": "Couch", "opacity": 255, "blendMode": "normal" },
   { "name": "Door", "opacity": 255, "blendMode": "normal" },
   { "name": "Door Open", "opacity": 255, "blendMode": "normal" },
   { "name": "Pillar", "opacity": 255, "blendMode": "normal" },
   { "name": "Fan", "opacity": 255, "blendMode": "normal" },
   { "name": "Hank", "opacity": 255, "blendMode": "normal" }
  ],
  "slices": [
  ]
 }
}
</file>

<file path="src/game/assets/images/rooms/office/office.json">
{ "frames": {
   "office 0.aseprite": {
    "frame": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 1.aseprite": {
    "frame": { "x": 352, "y": 0, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 2.aseprite": {
    "frame": { "x": 704, "y": 0, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 3.aseprite": {
    "frame": { "x": 1056, "y": 0, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 4.aseprite": {
    "frame": { "x": 1408, "y": 0, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 5.aseprite": {
    "frame": { "x": 0, "y": 198, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 6.aseprite": {
    "frame": { "x": 352, "y": 198, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 7.aseprite": {
    "frame": { "x": 704, "y": 198, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 8.aseprite": {
    "frame": { "x": 1056, "y": 198, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 9.aseprite": {
    "frame": { "x": 1408, "y": 198, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 10.aseprite": {
    "frame": { "x": 0, "y": 396, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 11.aseprite": {
    "frame": { "x": 352, "y": 396, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 12.aseprite": {
    "frame": { "x": 704, "y": 396, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 13.aseprite": {
    "frame": { "x": 1056, "y": 396, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 14.aseprite": {
    "frame": { "x": 1408, "y": 396, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 15.aseprite": {
    "frame": { "x": 0, "y": 594, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   },
   "office 16.aseprite": {
    "frame": { "x": 352, "y": 594, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 150
   }
 },
 "meta": {
  "app": "https://www.aseprite.org/",
  "version": "1.3.18-beta1-x64",
  "image": "office.png",
  "format": "RGBA8888",
  "size": { "w": 1760, "h": 792 },
  "scale": "1",
  "frameTags": [
   { "name": "Backlight", "from": 1, "to": 1, "direction": "forward", "color": "#000000ff" },
   { "name": "Shadow", "from": 2, "to": 2, "direction": "forward", "color": "#000000ff" },
   { "name": "Background", "from": 3, "to": 3, "direction": "forward", "color": "#000000ff" },
   { "name": "Fan", "from": 4, "to": 8, "direction": "forward", "color": "#000000ff" },
   { "name": "Chair", "from": 9, "to": 9, "direction": "forward", "color": "#000000ff" },
   { "name": "Desk", "from": 10, "to": 10, "direction": "forward", "color": "#000000ff" },
   { "name": "DoorClosed", "from": 11, "to": 11, "direction": "forward", "color": "#000000ff" },
   { "name": "Coatrack", "from": 12, "to": 12, "direction": "forward", "color": "#000000ff" },
   { "name": "Jacket", "from": 13, "to": 13, "direction": "forward", "color": "#000000ff" },
   { "name": "Glasses", "from": 14, "to": 14, "direction": "forward", "color": "#000000ff" },
   { "name": "PhoneCutaway", "from": 15, "to": 15, "direction": "forward", "color": "#000000ff" },
   { "name": "CyberBuddy", "from": 16, "to": 16, "direction": "forward", "color": "#000000ff" }
  ],
  "layers": [
   { "name": "Room Background" },
   { "name": "Background", "group": "Room Background", "opacity": 255, "blendMode": "normal" },
   { "name": "shadow", "group": "Room Background", "opacity": 255, "blendMode": "normal" },
   { "name": "walls", "group": "Room Background", "opacity": 255, "blendMode": "normal" },
   { "name": "floor deets", "group": "Room Background", "opacity": 255, "blendMode": "normal" },
   { "name": "window", "group": "Room Background", "opacity": 255, "blendMode": "normal" },
   { "name": "window shade", "group": "Room Background", "opacity": 255, "blendMode": "normal" },
   { "name": "window see thru", "group": "Room Background", "opacity": 255, "blendMode": "normal" },
   { "name": "blinds", "group": "Room Background", "opacity": 255, "blendMode": "normal" },
   { "name": "Room Stuff" },
   { "name": "filing cabs", "group": "Room Stuff", "opacity": 255, "blendMode": "normal" },
   { "name": "plant", "group": "Room Stuff", "opacity": 255, "blendMode": "normal" },
   { "name": "door closed", "group": "Room Stuff", "opacity": 255, "blendMode": "normal" },
   { "name": "coatrack", "group": "Room Stuff", "opacity": 255, "blendMode": "normal" },
   { "name": "desk chair", "group": "Room Stuff", "opacity": 255, "blendMode": "normal" },
   { "name": "desk", "group": "Room Stuff", "opacity": 255, "blendMode": "normal" },
   { "name": "phone", "group": "Room Stuff", "opacity": 255, "blendMode": "normal" },
   { "name": "blades", "group": "Room Stuff", "opacity": 255, "blendMode": "normal" },
   { "name": "light", "group": "Room Stuff", "opacity": 255, "blendMode": "normal" },
   { "name": "Items" },
   { "name": "Glasses", "group": "Items", "opacity": 255, "blendMode": "normal" },
   { "name": "Jacket", "group": "Items", "opacity": 255, "blendMode": "normal" },
   { "name": "CyberBuddy", "group": "Items", "opacity": 255, "blendMode": "normal" },
   { "name": "frame", "opacity": 255, "blendMode": "normal" },
   { "name": "bottom stuff", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 1", "opacity": 255, "blendMode": "normal" }
  ],
  "slices": [
  ]
 }
}
</file>

<file path="src/game/constants.ts">
import { getGameSettings } from '../engine/ConfigManager';

export const SCENE_BOOT = 'Boot';
export const SCENE_ROOM = 'Room';

/** Internal canvas width from `src/game/game-config.json`. */
export function getInternalWidth(): number {
  return getGameSettings().resolution.width;
}

/** Internal canvas height from `src/game/game-config.json`. */
export function getInternalHeight(): number {
  return getGameSettings().resolution.height;
}

/** Default player character folder name under `src/game/characters/`. */
export function getStartingPlayerCharacterId(): string {
  return getGameSettings().startingPlayerCharacter;
}
</file>

<file path="src/game/guis/random-text/random-text.gui.json">
{
  "id": "random-text",
  "name": "random Text",
  "description": "",
  "visible": false,
  "display": {
    "aseprite": false
  },
  "controls": [
    {
      "type": "text",
      "id": "line",
      "x": 140,
      "y": 60,
      "text": "Even if a woodchuck could chuck wood and even if a woodchuck would chuck wood, should a woodchuck chuck wood?",
      "font": "lucasarts-scumm-solid",
      "fontSize": 8,
      "color": "#f5f5dc",
      "align": "center",
      "wordWrapWidth": 200
    }
  ]
}
</file>

<file path="src/game/guis/random-text/random-text.gui.ts">
import { registerGuiScript } from '@engine/scripting';

/**
 * GUI script for `random-text` — extend with `B.raw` or future GUI lifecycle / control hooks on `B`.
 */
registerGuiScript('random-text', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;
});
</file>

<file path="src/game/inventory/Broom/Broom.inventory.json">
{
  "id": "Broom",
  "name": "Broom",
  "description": "",
  "onVerb": {
    "look": true
  },
  "stackable": false,
  "animations": {},
  "display": {
    "aseprite": "shared"
  }
}
</file>

<file path="src/game/inventory/Broom/Broom.inventory.ts">
import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Broom', ({ B }) => {

  B.whenLookAt(() => {
    // TODO
  });
});
</file>

<file path="src/game/inventory/Ladder/Ladder.inventory.json">
{
  "id": "Ladder",
  "name": "Ladder",
  "description": "",
  "onVerb": {},
  "stackable": false,
  "animations": {},
  "display": {
    "aseprite": "shared"
  }
}
</file>

<file path="src/game/inventory/Lantern/Lantern.inventory.json">
{
  "id": "Lantern",
  "name": "Lantern",
  "description": "",
  "onVerb": {},
  "stackable": false,
  "animations": {},
  "display": {
    "aseprite": "shared"
  },
  "defaultAnimation": "Lantern-glowing"
}
</file>

<file path="src/game/inventoryAseprite.ts">
import type { InventoryItemData } from '../types/inventory.js';

/** Phaser texture key for the shared `images/inventory/inventory.{png,json}` sheet. */
export const sharedInventoryTextureKey = 'aseprite:inventory:shared';

export function usesSharedInventoryAseprite(data: InventoryItemData): boolean {
  return data.display.aseprite === 'shared';
}

export function usesPerItemInventoryAseprite(data: InventoryItemData): boolean {
  return data.display.aseprite === true;
}

export function getPerItemInventoryTextureKey(itemId: string): string {
  return `aseprite:inventory:${itemId}`;
}

/** PNG + JSON paths under `src/game/assets/` for per-item Aseprite export. */
export function getPerItemInventoryAsepritePaths(itemId: string): { png: string; json: string } {
  const base = `images/inventory/${itemId}/${itemId}`;
  return { png: `${base}.png`, json: `${base}.json` };
}

export function sharedInventoryAssetPaths(): { png: string; json: string } {
  return { png: 'images/inventory/inventory.png', json: 'images/inventory/inventory.json' };
}

/**
 * Phaser animation key for a frame tag on the item's sheet (`inventory:<tag>` when using the shared atlas).
 */
export function inventoryPhaserAnimationKeyForTag(data: InventoryItemData, tagName: string): string {
  if (usesSharedInventoryAseprite(data)) {
    return `inventory:${tagName}`;
  }
  return tagName;
}

/** Default clip for UI/cursor: `defaultAnimation`, else `id`. */
export function defaultInventoryAnimationKey(data: InventoryItemData): string {
  const base = data.defaultAnimation ?? data.id;
  return inventoryPhaserAnimationKeyForTag(data, base);
}
</file>

<file path="src/game/loadStartRoom.ts">
import { getGameSettings } from '../engine/ConfigManager';
import type { RoomsManifestData } from '../types/game';
import type { RoomData } from '../types/room';
import manifestJson from './rooms/rooms.manifest.json';

const roomJsonModules = import.meta.glob('./rooms/**/*.room.json', { eager: true }) as Record<
  string,
  { default: RoomData }
>;

/**
 * Resolves the start room from `game-config.json` (`startingRoomId`) when set, otherwise
 * `startRoomId` in `rooms.manifest.json`.
 */
export function loadStartRoomData(): RoomData {
  const manifest = manifestJson as RoomsManifestData;
  const startRoomId = getGameSettings().startingRoomId ?? manifest.startRoomId;
  const entry = manifest.rooms.find((r) => r.id === startRoomId);

  if (!entry) {
    throw new Error(`Start room '${startRoomId}' missing from rooms manifest.`);
  }

  const key = `./rooms/${entry.definition}`;
  const mod = roomJsonModules[key];

  if (!mod) {
    throw new Error(
      `Room JSON not found for manifest entry '${entry.definition}' (expected glob key '${key}'). Keys: ${Object.keys(roomJsonModules).join(', ')}`,
    );
  }

  return mod.default;
}
</file>

<file path="src/game/queueGuiFontsForBootLoader.ts">
import type * as Phaser from 'phaser';
import type { GameFontsManifest } from '../types/fonts';
import { collectFontIdsReferencedByGuiControls } from './loadGuiData';
import gameFontsManifest from './assets/fonts/fonts.json';
import { resolveGameAssetUrl, resolveGameAssetXmlUrl } from './resolveGameAssetUrl';

const manifest = gameFontsManifest as GameFontsManifest;

/** Queue `load.bitmapFont` for every font id used by GUI text controls (see `fonts/fonts.json`). */
export function queueGuiFontsForBootLoader(loader: Phaser.Loader.LoaderPlugin): void {
  for (const fontId of collectFontIdsReferencedByGuiControls()) {
    const def = manifest[fontId];
    if (!def) {
      console.error(
        `[Benne] GUI text references unknown font id "${fontId}" — add it to src/game/assets/fonts/fonts.json.`,
      );
      continue;
    }
    try {
      const tex = resolveGameAssetUrl(`fonts/${def.textureFile}`);
      const xml = resolveGameAssetXmlUrl(`fonts/${def.dataFile}`);
      loader.bitmapFont(fontId, tex, xml);
    } catch (e) {
      console.error(`[Benne] Failed to resolve bitmap font files for id "${fontId}":`, e);
    }
  }
}
</file>

<file path="src/game/registerInventoryDefinitions.ts">
import type { InventoryItemData } from '../types/inventory.js';
import { registerInventoryDefinition } from '../engine/inventory/inventoryDefinitionRegistry.js';

function rawJsonFromModule(mod: { default?: unknown } | Record<string, unknown>): unknown {
  if (mod && typeof mod === 'object' && 'default' in mod) {
    return (mod as { default?: unknown }).default;
  }
  return mod;
}

function isInventoryItemData(value: unknown): value is InventoryItemData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const o = value as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) {
    return false;
  }
  if (typeof o.name !== 'string') {
    return false;
  }
  if (typeof o.description !== 'string') {
    return false;
  }
  if (typeof o.stackable !== 'boolean') {
    return false;
  }
  if (o.defaultAnimation !== undefined && typeof o.defaultAnimation !== 'string') {
    return false;
  }
  if (o.onVerb !== undefined) {
    if (!o.onVerb || typeof o.onVerb !== 'object' || Array.isArray(o.onVerb)) {
      return false;
    }
    for (const v of Object.values(o.onVerb as Record<string, unknown>)) {
      if (v !== true) {
        return false;
      }
    }
  }
  if (o.animations !== undefined) {
    if (!o.animations || typeof o.animations !== 'object' || Array.isArray(o.animations)) {
      return false;
    }
    for (const clip of Object.values(o.animations as Record<string, unknown>)) {
      if (!clip || typeof clip !== 'object' || Array.isArray(clip)) {
        return false;
      }
      const c = clip as Record<string, unknown>;
      if (c.loop !== undefined && typeof c.loop !== 'boolean') {
        return false;
      }
      if (c.frameDuration !== undefined && typeof c.frameDuration !== 'number') {
        return false;
      }
    }
  }
  const d = o.display;
  if (!d || typeof d !== 'object' || Array.isArray(d)) {
    return false;
  }
  const disp = d as Record<string, unknown>;
  const a = disp.aseprite;
  if (a !== true && a !== 'shared') {
    return false;
  }
  return true;
}

/** Migrate legacy `display.tag` into `defaultAnimation` and drop `display.tag` from the registered object. */
function normalizeLegacyInventoryDisplayTag(data: InventoryItemData): void {
  const root = data as unknown as Record<string, unknown>;
  const display = root.display;
  if (!display || typeof display !== 'object' || Array.isArray(display)) {
    return;
  }
  const disp = display as Record<string, unknown>;
  const legacy = disp.tag;
  if (typeof legacy !== 'string') {
    return;
  }
  const trimmed = legacy.trim();
  if (trimmed.length === 0) {
    delete disp.tag;
    return;
  }
  const current = root.defaultAnimation;
  const currentEmpty =
    current === undefined || (typeof current === 'string' && current.trim().length === 0);
  if (currentEmpty) {
    root.defaultAnimation = trimmed;
  }
  delete disp.tag;
}

// Eager-loads ./inventory/**/*.inventory.json into the engine registry (before GameStateManager / boot).
export function registerInventoryDefinitionsFromGame(): void {
  const modules = import.meta.glob('./inventory/**/*.inventory.json', {
    eager: true,
  }) as Record<string, { default?: unknown } | Record<string, unknown>>;

  for (const [path, mod] of Object.entries(modules)) {
    const raw = rawJsonFromModule(mod);
    if (!isInventoryItemData(raw)) {
      console.error(`[Benne] Invalid inventory JSON shape at ${path}`);
      continue;
    }
    const m = path.match(/\.\/inventory\/([^/]+)\//);
    const folderId = m?.[1];
    if (folderId && folderId !== raw.id) {
      console.warn(
        `[Benne] Inventory folder "${folderId}" does not match JSON id "${raw.id}" (${path}) — definition still registered.`,
      );
    }
    normalizeLegacyInventoryDisplayTag(raw);
    registerInventoryDefinition(raw);
  }
}
</file>

<file path="src/types/gameState.ts">
/** Values stored in {@link SerializableBenneGameState.flags}. */
export type BenneGameStateFlagValue = boolean | number | string;

/** Serializable cross-room game state (v1). */
export interface SerializableBenneGameState {
  version: 1;
  flags: Record<string, BenneGameStateFlagValue>;
  variables: Record<string, unknown>;
  /** Item id → quantity (omitted or zero means not carried). */
  inventory: Record<string, number>;
}

export const GAME_STATE_FLAG_CHANGED_EVENT = 'gameState:flagChanged' as const;
export const GAME_STATE_VARIABLE_CHANGED_EVENT = 'gameState:variableChanged' as const;
export const GAME_STATE_INVENTORY_CHANGED_EVENT = 'gameState:inventoryChanged' as const;
export const GAME_STATE_REPLACED_EVENT = 'gameState:replaced' as const;

export interface GameStateFlagChangedPayload {
  key: string;
  previousValue?: BenneGameStateFlagValue;
  value?: BenneGameStateFlagValue;
}

export interface GameStateVariableChangedPayload {
  key: string;
  previousValue?: unknown;
  value?: unknown;
}

export interface GameStateInventoryChangedPayload {
  reason: 'add' | 'remove' | 'clear';
  itemId?: string;
  inventory: Record<string, number>;
}

export interface GameStateReplacedPayload {
  snapshot: SerializableBenneGameState;
}
</file>

<file path="vite.config.ts">
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const dir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Phaser publishes `browser` → UMD (`phaser.js`) and `module` → ESM (`phaser.esm.js`).
 * Vite can resolve the UMD file, which has no `default` export — force the ESM build.
 */
export default defineConfig({
  resolve: {
    alias: {
      phaser: path.join(dir, 'node_modules/phaser/dist/phaser.esm.js'),
      '@engine': path.join(dir, 'src/engine'),
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
</file>

<file path="src/editor/preview/characterEditorMain.ts">
import type { Game } from 'phaser';
import { getAsepriteAssetPaths, getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/characterAseprite';
import { pickCharacterPreviewIdleTag } from '../../game/characterPreviewIdleTag';
import { readAsepriteFrameTagNamesFromRawJson } from '../../game/loadAsepriteAtlasData';
import { normalizeAsepriteJsonForPhaser } from '../../game/normalizeAsepriteJson';
import type { CharacterData } from '../../types/character';
import {
  createCharacterPreviewPhaserGame,
  type CharacterPreviewGamePayload,
} from './createCharacterPreviewGame';
import { joinGameWebviewUri } from './previewUrls';

declare function acquireVsCodeApi(): { postMessage(data: unknown): void };

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
let game: Game | null = null;
let lastCharacterJsonUri = '';

try {
  vscodeApi = acquireVsCodeApi();
} catch {
  /* not inside a VS Code webview */
}

function setTopbar(html: string): void {
  const el = document.getElementById('benne-char-preview-topbar');
  if (el) {
    el.innerHTML = html;
  }
}

const BTN_PRIMARY =
  'background:#3d5a80;color:#e8ecff;border:1px solid #5a7aaa;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;font-family:system-ui,sans-serif;';
const BTN_IDLE =
  'background:#3a3a52;color:#e8ecff;border:1px solid #5a5a70;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;font-family:system-ui,sans-serif;';

function wireTopbar(characterJsonUri: string, game: Game | null): void {
  setTopbar(`
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid #2e2e44;background:#222230;">
      <button type="button" id="benne-char-save" style="${BTN_PRIMARY}">Save to JSON</button>
      <button type="button" id="benne-char-refresh" style="${BTN_IDLE}">Refresh</button>
      <span style="font:12px system-ui,sans-serif;color:#8892a8;">Wheel zoom · middle-drag pan · F fit</span>
    </div>
    <div style="font:11px system-ui,sans-serif;color:#8a92a8;padding:4px 12px 8px;background:#1e1e2a;">Drag labeled handles (Feet on-cel; Walk to / Talk may be off-sprite) and the magenta collider. Collider: 3+ points; double-click an edge to add a vertex; Delete removes a selected vertex. Fewer than three points on save removes the custom collider.</div>
  `);

  document.getElementById('benne-char-save')?.addEventListener('click', () => {
    const readGeometry = game?.registry.get('benneCharacterPreviewReadGeometry') as
      | (() => {
          feet: { x: number; y: number };
          walkToPoint: { x: number; y: number };
          talkPoint: { x: number; y: number };
          collider: { points: { x: number; y: number }[] } | null;
        })
      | undefined;
    if (!readGeometry || !vscodeApi) {
      return;
    }
    const geometry = readGeometry();
    vscodeApi.postMessage({
      type: 'benne/charPreview/saveCharacter',
      characterJsonUri,
      geometry,
    });
  });
  document.getElementById('benne-char-refresh')?.addEventListener('click', () => {
    vscodeApi?.postMessage({
      type: 'benne/charPreview/requestRefresh',
      characterJsonUri,
    });
  });
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function destroyPreviewGame(): void {
  if (game) {
    game.destroy(true);
    game = null;
  }
}

async function runLoadCharacter(msg: {
  character: CharacterData;
  characterId: string;
  gameSrcWebviewUri: string;
  characterJsonUri: string;
}): Promise<void> {
  lastCharacterJsonUri = msg.characterJsonUri;
  const root = document.getElementById('benne-char-preview-root');
  if (!root) {
    return;
  }
  root.innerHTML = '';
  destroyPreviewGame();

  if (!usesAsepriteDisplay(msg.character)) {
    setTopbar(
      `<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">Character preview needs <code>display.aseprite: true</code>.</div>`,
    );
    return;
  }

  const paths = getAsepriteAssetPaths(msg.characterId);
  const assetsBase = joinGameWebviewUri(msg.gameSrcWebviewUri, 'assets');
  const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
  const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);

  let raw: Record<string, unknown>;
  try {
    raw = await fetchJson(jsonUrl);
  } catch (e) {
    setTopbar(
      `<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">Could not load sheet JSON: ${e instanceof Error ? e.message : String(e)}</div>`,
    );
    return;
  }

  const tags = readAsepriteFrameTagNamesFromRawJson(raw);
  const idleTag = pickCharacterPreviewIdleTag(tags);
  if (!idleTag) {
    setTopbar(
      `<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">No Idle* animation tags on this sheet.</div>`,
    );
    return;
  }

  const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
  const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
  const atlasURL = URL.createObjectURL(blob);

  const inner = document.createElement('div');
  inner.style.cssText = 'position:relative;width:100%;height:100%;min-height:180px;';
  root.appendChild(inner);

  const payload: CharacterPreviewGamePayload = {
    textureKey: getAsepriteTextureKey(msg.characterId),
    textureURL: pngUrl,
    atlasURL,
    character: msg.character,
    idleTag,
    revokeObjectUrls: [atlasURL],
  };

  game = createCharacterPreviewPhaserGame(inner, payload);
  wireTopbar(msg.characterJsonUri, game);
}

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as { type?: string; ok?: boolean; message?: string };
  if (msg?.type === 'benne/charPreview/saveCharacterResult') {
    if (msg.ok === false && typeof msg.message === 'string') {
      console.warn('[Benne character preview]', msg.message);
    } else if (msg.ok === true && lastCharacterJsonUri.length > 0) {
      vscodeApi?.postMessage({
        type: 'benne/charPreview/requestRefresh',
        characterJsonUri: lastCharacterJsonUri,
      });
    }
    return;
  }
  if (msg?.type === 'benne/charPreview/loadCharacter') {
    const m = event.data as {
      type: string;
      character: CharacterData;
      characterId: string;
      gameSrcWebviewUri: string;
      characterJsonUri: string;
    };
    void runLoadCharacter(m);
    return;
  }
  if (msg?.type === 'benne/charPreview/clear') {
    destroyPreviewGame();
    setTopbar('');
    const root = document.getElementById('benne-char-preview-root');
    if (root) {
      root.innerHTML = '';
    }
  }
});

vscodeApi?.postMessage({ type: 'benne/charPreview/ready' });
</file>

<file path="src/editor/preview/createRoomPreviewGame.ts">
import * as Phaser from 'phaser';
import { applyBootAudioSettings } from '../../engine/applyAudioFromSettings';
import { getBenneRendererConfigFields } from '../../engine/gameConfig';
import { RoomScene } from '../../engine/scenes/RoomScene';
import { SCENE_ROOM } from '../../game/constants';
import type { PreviewManifest } from './buildPreviewManifest';
import type { RoomPolygonPatch } from './polygonPatchTypes';
import { BENNE_POLYGON_EDIT_SCENE, RoomPolygonEditScene } from './RoomPolygonEditScene';

export type RoomPreviewGameOptions = {
    roomJsonUri: string;
    onPolygonPatch: (patch: RoomPolygonPatch) => void;
    /**
     * Initial visibility of non-`dialog-text` GUI overlays. Forwarded to {@link RoomScene} via
     * the `benneRoomSceneGenericGuisVisible` registry key so authors see the stored "Show GUIs"
     * toolbar state without a first-frame flash.
     */
    initialShowGuis: boolean;
};

/**
 * Editor-specific Phaser config.
 *
 * Uses `Scale.RESIZE` so the canvas always fills the preview panel (camera management for
 * navigate-letterbox vs edit-full-panel is handled by `RoomScene.setEditorCameraMode`). This
 * differs from the shipped game (`gameConfig.ts`) which uses `Scale.FIT` with integer zoom —
 * that is the **only** intentional divergence; renderer/pixel-output fields come from the
 * shared helper so `BitmapText` rendering matches the runtime (Phaser 4 WebGL did not render
 * fixed-to-camera `BitmapText` reliably — see `.cursor/rules/benne-preview-rendering-parity.mdc`).
 */
function getEditorPhaserGameConfig(
    parent: HTMLElement,
): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
    return {
        ...getBenneRendererConfigFields(),
        parent,
        scale: {
            parent,
            mode: Phaser.Scale.RESIZE,
        },
    };
}

export function createRoomPreviewPhaserGame(
    parent: HTMLElement,
    manifest: PreviewManifest,
    options: RoomPreviewGameOptions,
): Phaser.Game {
    const manifestRef = manifest;

    class BennePreviewLoader extends Phaser.Scene {
        constructor() {
            super('BennePreviewLoader');
        }

        preload(): void {
            for (const L of manifestRef.loads) {
                if (L.kind === 'image') {
                    this.load.image(L.key, L.url);
                } else if (L.kind === 'aseprite') {
                    this.load.aseprite({
                        key: L.key,
                        textureURL: L.textureURL,
                        atlasURL: L.atlasURL,
                    });
                } else {
                    this.load.bitmapFont(L.key, L.textureURL, L.dataURL);
                }
            }
        }

        create(): void {
            applyBootAudioSettings(this);
            this.scene.start(SCENE_ROOM, manifestRef.startData);
            this.scene.launch(BENNE_POLYGON_EDIT_SCENE);
            for (const u of manifestRef.revokeObjectUrls) {
                URL.revokeObjectURL(u);
            }
        }
    }

    return new Phaser.Game({
        ...getEditorPhaserGameConfig(parent),
        callbacks: {
            preBoot: (game: Phaser.Game) => {
                game.registry.set('bennePreviewRoom', manifestRef.startData.room);
                game.registry.set('bennePreviewRoomJsonUri', options.roomJsonUri);
                game.registry.set('bennePreviewPostPatch', options.onPolygonPatch);
                /**
                 * Read by {@link RoomScene.create}; a boolean value overrides every non-`dialog-text`
                 * GUI overlay's initial visibility (preview "Show GUIs" toolbar toggle).
                 */
                game.registry.set('benneRoomSceneGenericGuisVisible', options.initialShowGuis);
            },
        },
        scene: [BennePreviewLoader, RoomScene, RoomPolygonEditScene],
    });
}
</file>

<file path="src/engine/InteractiveObject.ts">
import type { RoomHotspotData } from '../types/room';

/**
 * Runtime handle for a hotspot interaction target (backed by JSON definitions).
 */
export class InteractiveObject {
  readonly definition: RoomHotspotData;

  constructor(definition: RoomHotspotData) {
    this.definition = definition;
  }

  get id(): string {
    return this.definition.id;
  }
}
</file>

<file path="src/engine/pathfinding.ts">
import type { Point2, WalkablePolygon } from '../types/room';
import {
  clampWalkDestinationTowardClick,
  isPointInWalkableArea,
  pointInPolygon,
} from './walkable';

/**
 * 2D pathfinding for the walkable mesh.
 *
 * **Algorithm**: classical **visibility graph + A\***. This is the textbook shortest-path
 * approach for simple polygons with holes and is what most modern adventure-game engines
 * (Adventure Creator, Wintermute-family, PowerQuest) use for their polygon walk meshes.
 * The result is the **exact Euclidean shortest path** that hugs concave corners and bends
 * cleanly around hole rings — the classic LucasArts walk look.
 *
 * **Graph nodes** are
 *  - **reflex** outer-ring vertices (concave-from-inside corners) of each active polygon, and
 *  - **every** vertex of each active hole ring (holes poke into the walkable region, so every
 *    hole vertex is reflex as seen from the walkable side).
 *
 * Convex outer corners are omitted — shortest paths never bend around them.
 *
 * **Inward corner offset** — each node is nudged ~{@link CORNER_INWARD_OFFSET_PX} pixels along
 * the interior bisector (into the walkable region) so paths do not sit exactly on the pixel
 * that forms the corner. This gives characters a sub-pixel corner radius that matches the
 * classic LucasArts look and makes the segment-midpoint-in-walkable test robust against
 * on-boundary numerical edge cases.
 *
 * **Start / goal handling**
 *  - If the start point is already **outside** the walkable region (e.g. the character spawned
 *    on a non-walkable pixel), we skip pathfinding and return a direct line to the clamped
 *    goal — matches the engine's pre-pathfinding fallback behavior.
 *  - The goal is always clamped to the walkable union before pathfinding (reusing
 *    {@link clampWalkDestinationTowardClick}).
 *  - If start and goal lie in **disconnected** components of the walkable union, A\* returns no
 *    path and we fall back to a direct line to the clamped goal.
 *
 * **Complexity** — O((N+2)²) visibility tests per query, where N is the number of candidate
 * nodes (typically tens for hand-authored rooms). Each visibility test is O(E) across all
 * ring edges. Cheap in practice; called once per walk command, not per frame.
 */

/**
 * Inward offset applied to graph nodes so they sit just inside the walkable region rather
 * than exactly on the polygon boundary. Gives characters a sub-pixel corner radius and keeps
 * segment midpoint checks robust at vertices.
 */
const CORNER_INWARD_OFFSET_PX = 1;

/**
 * If `start` is reported outside the walkable region but within this distance of the walkable
 * boundary, treat it as boundary-rounding noise (the natural outcome of a previous pathfound
 * walk ending on an inward-offset corner node) and pathfind from the snapped-inside point.
 * Beyond this we assume the character is genuinely off-mesh (spawn / cutscene placement) and
 * fall back to the historical "glide straight to the clamped goal" behavior.
 *
 * Without this tolerance, the ray-cast `pointInPolygon` test can false-negative on boundary
 * pixels and `findWalkPath` would short-circuit to a direct line — straight through holes or
 * concavities — for every subsequent click after any pathfound walk.
 */
const OFF_MESH_SNAP_TOLERANCE_PX = 2;

/**
 * Perpendicular jitter used by {@link isSegmentInsideWalkable} to rescue interior samples
 * that land on a polygon boundary edge. Chosen < {@link CORNER_INWARD_OFFSET_PX} so the jitter
 * never reaches as far as a neighbouring node would sit, while still being wide enough that
 * `pointInPolygon`'s ray cast reliably classifies the jittered points (0.5 px is unambiguous
 * for integer-vertex polygons).
 */
const BOUNDARY_JITTER_PX = 0.5;

/** Tolerance for orientation tests (pixel-scale; coordinates are integer in authored JSON). */
const EPS = 1e-6;

interface GraphNode {
  readonly x: number;
  readonly y: number;
}

/**
 * Shortest path from `start` to `goal` through the walkable region as an ordered list of
 * waypoints (goal last). Does **not** include the start.
 *
 * - Returns `[goal]` when the straight line is entirely inside the walkable region.
 * - Returns a polyline `[corner₁, corner₂, …, goal]` when a path must bend around hole rings
 *   or concavities.
 * - Returns `[clampedGoal]` as a one-hop fallback when:
 *   - the start is outside the walkable region (spawn / cutscene placement), or
 *   - start and goal are in disconnected walkable components and A\* cannot reach the goal.
 * - Returns `[]` only when there is no usable polygon geometry at all.
 */
export function findWalkPath(
  start: Point2,
  goal: Point2,
  polygons: readonly WalkablePolygon[],
): Point2[] {
  const clamped = clampWalkDestinationTowardClick(start.x, start.y, goal.x, goal.y, polygons);
  if (!clamped) {
    return [];
  }

  // Treat "on the boundary" as "inside": pointInPolygon ray-casts are unreliable for points
  // exactly on an edge, so after a pathfound walk ends on (or within a pixel of) the mesh
  // boundary, a strict inside-check would bail out and short-circuit to a direct line — right
  // through any hole or concavity between start and goal. If start is only marginally off,
  // snap it inward and pathfind from there. Only genuinely off-mesh starts (spawn / cutscene
  // placement further from the mesh than `OFF_MESH_SNAP_TOLERANCE_PX`) fall back to the
  // historical straight-line-to-clamped-goal behavior.
  let effectiveStart = start;
  if (!isPointInWalkableArea(start.x, start.y, polygons)) {
    const snapped = clampWalkDestinationTowardClick(
      start.x,
      start.y,
      start.x,
      start.y,
      polygons,
    );
    if (!snapped) {
      return [clamped];
    }
    const off = Math.hypot(snapped.x - start.x, snapped.y - start.y);
    if (off > OFF_MESH_SNAP_TOLERANCE_PX) {
      return [clamped];
    }
    effectiveStart = snapped;
  }

  if (isSegmentInsideWalkable(effectiveStart, clamped, polygons)) {
    return [clamped];
  }

  const nodes = buildGraphNodes(polygons);
  const path = aStarPath(effectiveStart, clamped, nodes, polygons);
  if (path.length === 0) {
    return [clamped];
  }
  return path;
}

/**
 * True when the open segment between `a` and `b` lies entirely inside the walkable region
 * (inside some active outer ring, not crossing any active hole ring, and not cutting across
 * a concavity even when both endpoints are on the boundary).
 *
 * Uses interior-sample points (t = 0.25, 0.5, 0.75) plus a proper-intersection test against
 * every ring edge. Shared-endpoint touches and purely collinear overlaps are not treated as
 * crossings; the interior-sample test catches segments that would leave the mesh without
 * crossing an edge (e.g. vertex-to-vertex across a notch).
 */
export function isSegmentInsideWalkable(
  a: Point2,
  b: Point2,
  polygons: readonly WalkablePolygon[],
): boolean {
  // Interior samples. We use seven asymmetric points rather than three because the
  // proper-crossing test can be numerically fragile for segments that pass through (or very
  // near) a polygon vertex, and extra samples are the cheapest way to notice that the segment
  // actually dips out of the walkable region in a narrow concavity or crosses a small hole.
  //
  // Each sample is rescued by a small perpendicular jitter: if the sample lands exactly on a
  // boundary edge (where `pointInPolygon` ray casts are unreliable) we instead accept it if
  // either side of the segment is clearly inside walkable. Without this, segments running
  // **along** a polygon boundary — e.g. a character on the top edge of the walkable mesh
  // walking sideways to a goal clamped onto the same top edge — fail the sample test, which
  // forces A\* to route the walk via some other graph node (typically a hole-ring vertex
  // offset inward from the hole), making the character detour *away* from a perfectly valid
  // straight-line walk along the boundary. Segments that leave the mesh through a real
  // concavity or hole still fail because both perpendicular neighbours are also outside.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  let nx = 0;
  let ny = 0;
  if (len > EPS) {
    nx = -dy / len;
    ny = dx / len;
  }

  const samples = [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9];
  for (const t of samples) {
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    if (isPointInWalkableArea(px, py, polygons)) {
      continue;
    }
    if (
      isPointInWalkableArea(px + nx * BOUNDARY_JITTER_PX, py + ny * BOUNDARY_JITTER_PX, polygons) ||
      isPointInWalkableArea(px - nx * BOUNDARY_JITTER_PX, py - ny * BOUNDARY_JITTER_PX, polygons)
    ) {
      continue;
    }
    return false;
  }

  for (const poly of polygons) {
    if (poly.active === false || poly.points.length < 3) {
      continue;
    }
    if (ringHasProperCrossing(a, b, poly.points)) {
      return false;
    }
    for (const h of poly.holes ?? []) {
      if (h.active === false || h.points.length < 3) {
        continue;
      }
      if (ringHasProperCrossing(a, b, h.points)) {
        return false;
      }
    }
  }
  return true;
}

function ringHasProperCrossing(a: Point2, b: Point2, ring: readonly Point2[]): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const c = ring[i]!;
    const d = ring[(i + 1) % n]!;
    if (segmentsProperlyIntersect(a, b, c, d)) {
      return true;
    }
  }
  return false;
}

function cross2(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/**
 * True iff segments [A,B] and [C,D] cross each other strictly in their interiors. Touching at
 * a shared endpoint and collinear overlap both return false.
 */
function segmentsProperlyIntersect(a: Point2, b: Point2, c: Point2, d: Point2): boolean {
  const d1 = cross2(b.x - a.x, b.y - a.y, c.x - a.x, c.y - a.y);
  const d2 = cross2(b.x - a.x, b.y - a.y, d.x - a.x, d.y - a.y);
  const d3 = cross2(d.x - c.x, d.y - c.y, a.x - c.x, a.y - c.y);
  const d4 = cross2(d.x - c.x, d.y - c.y, b.x - c.x, b.y - c.y);
  return (
    ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
    ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))
  );
}

function normalize(x: number, y: number): { x: number; y: number } | null {
  const len = Math.hypot(x, y);
  if (len < EPS) {
    return null;
  }
  return { x: x / len, y: y / len };
}

/** Reflex test for an outer-ring vertex: triangle centroid (pulled toward the vertex) is
 * **outside** the ring iff the interior angle at the vertex is > 180° (concave as seen from
 * inside the polygon). Hole rings are excluded from this check because their contribution is
 * "subtract the hole", which does not flip an outer-ring vertex's convexity classification.
 */
function isReflexOuterVertex(prev: Point2, curr: Point2, next: Point2, ring: readonly Point2[]): boolean {
  const tx = (prev.x + curr.x + next.x) / 3;
  const ty = (prev.y + curr.y + next.y) / 3;
  const sx = curr.x + (tx - curr.x) * 0.25;
  const sy = curr.y + (ty - curr.y) * 0.25;
  return !pointInPolygon(sx, sy, ring);
}

/**
 * Interior-bisector direction at a ring vertex, oriented so that stepping along it lands
 * inside the walkable region. Returns `null` for degenerate vertices (zero-length incident
 * edge, or both bisector sides outside the walkable region — e.g. a pinched corner where the
 * offset would not fit).
 */
function inwardOffsetDirection(
  prev: Point2,
  curr: Point2,
  next: Point2,
  polygons: readonly WalkablePolygon[],
): { x: number; y: number } | null {
  const toPrev = normalize(prev.x - curr.x, prev.y - curr.y);
  const toNext = normalize(next.x - curr.x, next.y - curr.y);
  if (!toPrev || !toNext) {
    return null;
  }

  let bx = toPrev.x + toNext.x;
  let by = toPrev.y + toNext.y;
  let bisector = normalize(bx, by);
  if (!bisector) {
    // 180° vertex (prev, curr, next collinear): use the perpendicular to the incoming edge as
    // the candidate direction; the sidedness probe below picks the correct side.
    bisector = normalize(-toPrev.y, toPrev.x);
    if (!bisector) {
      return null;
    }
  }

  const probe = CORNER_INWARD_OFFSET_PX + 0.1;
  const plusIn = isPointInWalkableArea(
    curr.x + bisector.x * probe,
    curr.y + bisector.y * probe,
    polygons,
  );
  const minusIn = isPointInWalkableArea(
    curr.x - bisector.x * probe,
    curr.y - bisector.y * probe,
    polygons,
  );
  if (plusIn && !minusIn) {
    return bisector;
  }
  if (minusIn && !plusIn) {
    return { x: -bisector.x, y: -bisector.y };
  }
  return null;
}

function buildGraphNodes(polygons: readonly WalkablePolygon[]): GraphNode[] {
  const nodes: GraphNode[] = [];
  for (const poly of polygons) {
    if (poly.active === false || poly.points.length < 3) {
      continue;
    }
    collectRingNodes(poly.points, poly.points, /* onlyReflex */ true, polygons, nodes);
    for (const h of poly.holes ?? []) {
      if (h.active === false || h.points.length < 3) {
        continue;
      }
      collectRingNodes(h.points, poly.points, /* onlyReflex */ false, polygons, nodes);
    }
  }
  return nodes;
}

function collectRingNodes(
  ring: readonly Point2[],
  outerRingForReflex: readonly Point2[],
  onlyReflex: boolean,
  polygons: readonly WalkablePolygon[],
  out: GraphNode[],
): void {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n]!;
    const curr = ring[i]!;
    const next = ring[(i + 1) % n]!;
    if (onlyReflex && !isReflexOuterVertex(prev, curr, next, outerRingForReflex)) {
      continue;
    }
    const inward = inwardOffsetDirection(prev, curr, next, polygons);
    if (!inward) {
      continue;
    }
    out.push({
      x: curr.x + inward.x * CORNER_INWARD_OFFSET_PX,
      y: curr.y + inward.y * CORNER_INWARD_OFFSET_PX,
    });
  }
}

/**
 * A\* on the visibility graph of {start, goal, …nodes}. Edges exist between pairs of points
 * whose connecting segment is entirely inside the walkable region. Edge cost and heuristic
 * are Euclidean distance (admissible and consistent → optimal).
 */
function aStarPath(
  start: Point2,
  goal: Point2,
  nodes: readonly GraphNode[],
  polygons: readonly WalkablePolygon[],
): Point2[] {
  const N = nodes.length;
  const startIdx = N;
  const goalIdx = N + 1;
  const total = N + 2;

  const pos = (i: number): Point2 => {
    if (i === startIdx) return start;
    if (i === goalIdx) return goal;
    return nodes[i]!;
  };

  const adj: number[][] = Array.from({ length: total }, () => []);
  const edgeDist: number[][] = Array.from({ length: total }, () => []);

  for (let i = 0; i < total; i++) {
    for (let j = i + 1; j < total; j++) {
      const pi = pos(i);
      const pj = pos(j);
      if (!isSegmentInsideWalkable(pi, pj, polygons)) {
        continue;
      }
      const d = Math.hypot(pi.x - pj.x, pi.y - pj.y);
      adj[i]!.push(j);
      adj[j]!.push(i);
      edgeDist[i]!.push(d);
      edgeDist[j]!.push(d);
    }
  }

  const heuristic = (i: number): number => {
    const p = pos(i);
    return Math.hypot(p.x - goal.x, p.y - goal.y);
  };

  const gScore = new Array<number>(total).fill(Infinity);
  const fScore = new Array<number>(total).fill(Infinity);
  const cameFrom = new Array<number>(total).fill(-1);
  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(startIdx);

  // Linear-scan priority queue: graph size is tens of nodes, a real heap would be overkill.
  const open = new Set<number>();
  open.add(startIdx);

  while (open.size > 0) {
    let current = -1;
    let bestF = Infinity;
    for (const i of open) {
      if (fScore[i]! < bestF) {
        bestF = fScore[i]!;
        current = i;
      }
    }
    if (current === -1) {
      break;
    }
    if (current === goalIdx) {
      const out: Point2[] = [];
      let cur = current;
      while (cur !== startIdx) {
        const p = pos(cur);
        out.push({ x: p.x, y: p.y });
        const prev = cameFrom[cur]!;
        if (prev === -1) {
          return [];
        }
        cur = prev;
      }
      return out.reverse();
    }
    open.delete(current);

    const neighbors = adj[current]!;
    const dists = edgeDist[current]!;
    for (let k = 0; k < neighbors.length; k++) {
      const n = neighbors[k]!;
      const tentative = gScore[current]! + dists[k]!;
      if (tentative < gScore[n]!) {
        cameFrom[n] = current;
        gScore[n] = tentative;
        fScore[n] = tentative + heuristic(n);
        open.add(n);
      }
    }
  }

  return [];
}
</file>

<file path="src/engine/scripting/benneScriptGameStateApi.ts">
import type { BenneGameStateFlagValue } from '../../types/gameState.js';
import type { GameStateManager } from '../gameState/GameStateManager.js';

/** `B.state` — flags, variables, and snapshot persistence (see `GameStateManager`). */
export interface BenneScriptGameStateNamespace {
  setFlag(id: string, value: BenneGameStateFlagValue): void;
  getFlag(id: string): BenneGameStateFlagValue | undefined;
  hasFlag(id: string): boolean;
  clearFlag(id: string): void;
  setVariable(id: string, value: unknown): void;
  getVariable(id: string): unknown;
  hasVariable(id: string): boolean;
  clearVariable(id: string): void;
  saveToBrowser(slot?: number): void;
  loadFromBrowser(slot?: number): boolean;
  clearBrowserSave(slot?: number): void;
  exportJson(): string;
  importJson(json: string): void;
}

/** `B.inventory` — quantities per item id (see `GameStateManager`). */
export interface BenneScriptInventoryNamespace {
  add(id: string, quantity?: number): boolean;
  remove(id: string, quantity?: number): boolean;
  has(id: string): boolean;
  quantityOf(id: string): number;
  /** Legacy accessor for inventory entries; prefer `add`/`remove`/`has`/`quantityOf` for gameplay logic. */
  readonly items: ReadonlyArray<{ id: string; quantity: number }>;
  clearInventory(): void;
}

export function createBenneScriptGameStateNamespace(m: GameStateManager): BenneScriptGameStateNamespace {
  return {
    setFlag: (id, value) => m.setFlag(id, value),
    getFlag: (id) => m.getFlag(id),
    hasFlag: (id) => m.hasFlag(id),
    clearFlag: (id) => m.clearFlag(id),
    setVariable: (id, value) => m.setVariable(id, value),
    getVariable: (id) => m.getVariable(id),
    hasVariable: (id) => m.hasVariable(id),
    clearVariable: (id) => m.clearVariable(id),
    saveToBrowser: (slot) => m.saveToLocalStorage(slot),
    loadFromBrowser: (slot) => m.loadFromLocalStorage(slot),
    clearBrowserSave: (slot) => m.clearLocalStorageSave(slot),
    exportJson: () => m.exportSnapshotJson(),
    importJson: (json) => m.importSnapshotJson(json),
  };
}

export function createBenneScriptInventoryNamespace(m: GameStateManager): BenneScriptInventoryNamespace {
  return {
    add: (id, quantity) => m.addInventory(id, quantity),
    remove: (id, quantity) => m.removeFromInventory(id, quantity),
    has: (id) => m.hasInInventory(id),
    quantityOf: (id) => m.quantityOf(id),
    get items() {
      return m.getInventoryItems();
    },
    clearInventory: () => m.clearInventory(),
  };
}
</file>

<file path="src/engine/scripting/GuiBenneScript.ts">
import * as Phaser from 'phaser';
import {
  guiAllButtonsClickEventId,
  guiButtonClickEventId,
  type GuiAllButtonsClickPayload,
} from '../events/guiButtonEvents.js';
import {
  guiControlMouseEnterEventId,
  guiControlMouseLeaveEventId,
} from '../events/guiControlHoverEvents.js';
import { BenneScriptCore } from './BenneScriptCore.js';
import type { GuiRuntime } from './GuiRuntime.js';

/**
 * Bennescript facade for `*.gui.ts`: GUI-scoped channels (button clicks, pointer hover per control), `raw`, and `wait`.
 * Handlers run through the same interaction queue as room / character scripts.
 */
export class GuiBenneScript extends BenneScriptCore {
  private readonly guiId: string;
  private readonly onGuiBuiltHandlers: Array<(gui: GuiRuntime) => void> = [];
  /** While `onGuiBuilt` handlers run, supports {@link GuiBenneScript.scene}. */
  private activeGuiRuntime: GuiRuntime | null = null;

  constructor(events: Phaser.Events.EventEmitter, guiId: string) {
    super(events, () => null);
    this.guiId = guiId;
  }

  /**
   * The active room scene while an **`onGuiBuilt`** handler runs (e.g. **`B.scene.scale.width`** for full canvas width).
   * Not available at `registerGuiScript` top level — use **`gui.scene`** from the **`onGuiBuilt`** callback parameter if you prefer.
   */
  get scene(): Phaser.Scene {
    const rt = this.activeGuiRuntime;
    if (!rt) {
      throw new Error(
        `[Benne] B.scene ("${this.guiId}") is only available synchronously inside B.onGuiBuilt — use the gui argument's gui.scene, or move code into the callback.`,
      );
    }
    return rt.scene;
  }

  /**
   * Registers a callback invoked each time this GUI’s overlay is built in the room scene (fresh {@link GuiRuntime}
   * per load). Use for custom layout and tweens — keep work generic; engine stays data-driven.
   */
  onGuiBuilt(callback: (gui: GuiRuntime) => void): void {
    this.onGuiBuiltHandlers.push(callback);
  }

  /**
   * Queues async work on this GUI script’s interaction tail (same lazy factory semantics as {@link BenneScriptCore}).
   * Used by {@link GuiRuntime} / {@link ControlFacade} tweens.
   */
  queueInteraction(factory: () => Promise<unknown>): void {
    this.chain(factory);
  }

  /**
   * Called from the scene after {@link buildGuiOverlay}; runs all `onGuiBuilt` registrations for this overlay instance.
   */
  notifyGuiBuilt(gui: GuiRuntime): void {
    this.activeGuiRuntime = gui;
    try {
      for (const handler of this.onGuiBuiltHandlers) {
        try {
          handler(gui);
        } catch (err) {
          console.error(`[Benne] Error in onGuiBuilt handler for GUI "${this.guiId}":`, err);
        }
      }
    } finally {
      this.activeGuiRuntime = null;
    }
  }

  /**
   * When the player activates a specific `button` control (by `id` in `*.gui.json`), run `handler`.
   * Mirrors verb sugar (`whenLookAt`, …): one string id, scoped to this GUI file’s `registerGuiScript` id.
   */
  whenButtonClick(buttonId: string, handler: () => void): void {
    this.subscribe(guiButtonClickEventId(this.guiId, buttonId), () => {
      handler();
    });
  }

  /**
   * Runs when any `button` control in this GUI is activated; receives the control `id`.
   * Prefer {@link whenButtonClick} for normal wiring; use this for logging, shared fallbacks, etc.
   */
  whenAnyButtonClick(handler: (buttonId: string) => void): void {
    this.subscribe(guiAllButtonsClickEventId(this.guiId), (payload) => {
      const p = payload as GuiAllButtonsClickPayload | undefined;
      if (p && typeof p.buttonId === 'string') {
        handler(p.buttonId);
      }
    });
  }

  /**
   * Runs when the pointer enters the hit area of a GUI control with this **`id`**. Works for any authored
   * control that exposes a hit area: **`trigger`**, **`button`** (while enabled), **`image`**, **`inventoryPanel`**,
   * and **`text`** (bounded by its rendered size).
   */
  whenMouseEnter(controlId: string, handler: () => void): void {
    const id = controlId.trim();
    if (!id) {
      return;
    }
    this.subscribeImmediate(guiControlMouseEnterEventId(this.guiId, id), () => {
      handler();
    });
  }

  /**
   * Runs when the pointer leaves a GUI control’s hit area. Paired with {@link whenMouseEnter}; same control-id rules.
   */
  whenMouseLeave(controlId: string, handler: () => void): void {
    const id = controlId.trim();
    if (!id) {
      return;
    }
    this.subscribeImmediate(guiControlMouseLeaveEventId(this.guiId, id), () => {
      handler();
    });
  }
}
</file>

<file path="src/engine/scripting/registerRoomScript.ts">
import type { RoomScriptContext } from './types.js';

/** Global registry for new-style Bennescript room handlers */
const benneRoomScriptRegistrations: Array<(context: RoomScriptContext) => void> = [];

export function getBenneRoomScriptRegistrations(): ReadonlyArray<(context: RoomScriptContext) => void> {
  return benneRoomScriptRegistrations;
}

/**
 * Call at the top level of each `*.room.ts` to register Bennescript handlers.
 *
 * @param registerFn - Receives `{ B, events, roomId, roomScene, … }`. Use **`B`** for authoring; see the
 *   **module-level table** in `BenneScript.ts` for which string ids to pass to `whenLookAt`, `walkTo`, etc.
 */
export function registerRoomScript(registerFn: (context: RoomScriptContext) => void): void {
  benneRoomScriptRegistrations.push(registerFn);
}
</file>

<file path="src/engine/verbs/normalizeHandlers.ts">
import type { CharacterData } from '../../types/character';
import type { RoomPropInstance, RoomHotspotData } from '../../types/room';
import type { VerbHandlerMap } from './dispatchVerb';

function normalizeVerbSupportMap(raw: Record<string, boolean> | undefined): Record<string, boolean> {
  if (!raw) {
    return {};
  }
  const out: Record<string, boolean> = {};
  for (const [verbId, enabled] of Object.entries(raw)) {
    if (enabled === true) {
      out[verbId] = true;
    }
  }
  return out;
}

export function getPropVerbHandlers(prop: RoomPropInstance): VerbHandlerMap {
  return {
    onVerb: normalizeVerbSupportMap(prop.onVerb),
    onVerbFallback: prop.onVerbFallback === true,
  };
}

export function getHotspotVerbHandlers(hotspot: RoomHotspotData): VerbHandlerMap {
  return {
    onVerb: normalizeVerbSupportMap(hotspot.onVerb),
    onVerbFallback: hotspot.onVerbFallback === true,
  };
}

export function getCharacterVerbHandlers(character: CharacterData): VerbHandlerMap {
  return {
    onVerb: normalizeVerbSupportMap(character.onVerb),
    onVerbFallback: character.onVerbFallback === true,
  };
}
</file>

<file path="src/game/assets/fonts/fonts.json">
{
  "lucasarts-scumm-solid": {
    "textureFile": "lucasarts-scumm-solid_0.png",
    "dataFile": "lucasarts-scumm-solid.xml",
    "defaultLetterSpacing": 1
  },
  "lucasfont-alternate": {
    "textureFile": "lucasfont-alternate_0.png",
    "dataFile": "lucasfont-alternate.xml"
  }
}
</file>

<file path="src/game/guis/dialog-text/dialog-text.gui.ts">
import { registerGuiScript } from '@engine/scripting';

/**
 * GUI script for `dialog-text` — extend with `B.raw` or future GUI lifecycle / control hooks on `B`.
 */
registerGuiScript('dialog-text', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;
});
</file>

<file path="src/game/inventory/Lantern/Lantern.inventory.ts">
import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Lantern', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;
});
</file>

<file path="src/game/loadGuiData.ts">
import type { GuiData } from '../types/gui';

const guiJsonModules = import.meta.glob('./guis/**/*.gui.json', { eager: true }) as Record<
  string,
  { default: GuiData }
>;

export function getAllGuiData(): GuiData[] {
  return Object.values(guiJsonModules).map((m) => m.default);
}

export function getGuiDataById(id: string): GuiData | undefined {
  return getAllGuiData().find((g) => g.id === id);
}

/** Font manifest keys referenced by any GUI `controls` entry of type `text` or `button`. */
export function collectFontIdsReferencedByGuiControls(): string[] {
  const ids = new Set<string>();
  for (const gui of getAllGuiData()) {
    for (const c of gui.controls ?? []) {
      if (c.type === 'text' || c.type === 'button') {
        ids.add(c.font);
      }
    }
  }
  return [...ids];
}
</file>

<file path="src/game/rooms/apartment/apartment.room.ts">
import { registerRoomScript } from '@engine/scripting';

/**
 * Room script for `apartment` — keep handlers for this room here (PowerQuest-style).
 *
 * String ids must match your `apartment.room.json` (and character JSON where noted):
 * - `whenLookAt` / `whenUse` / `whenTalkTo` / `whenPickUp` / `whenPush` / `whenPull` / `whenOpen` / `whenClose`: work on props, hotspots, and characters — same string id, resolution order `props[]` → `hotspots[]` → `CharacterData.id` in this room.
 * - `whenVerb(verbId, targetId, …)`: any verb id from game config; same target resolution.
 * - `whenGive`: prop recipient only (for now).
 * - `B.prop('…')` / `onProp`: `props[].id` only.
 * - `B.character('…')`: `CharacterData.id` for a character in this room.
 * - `walkTo('…')`: unified target — prop id → hotspot id → character id → `points[].id`, or `{ x, y }` in room pixels.
 */
registerRoomScript(({ B }) => {
  // Delete this line when you add your first handler.
  void B;
});
</file>

<file path="src/main.ts">
import './style.css';
import { createBenneGame } from './engine/Game';
import { gameEvents } from './engine/events/EventBus';
import { wireBenneGlobalScripts } from './engine/scripting/wireBenneGlobalScripts';
import { registerGameContent } from './game/registerGameContent';

const parent = document.querySelector<HTMLElement>('#game-container');
if (!parent) {
  throw new Error('Missing #game-container');
}

registerGameContent();
const game = createBenneGame(parent);
wireBenneGlobalScripts(game, gameEvents);
</file>

<file path="src/types/fonts.ts">
/**
 * Bitmap font registry in `src/game/assets/fonts/fonts.json`.
 * Loader keys and GUI `text` control `font` use the same string as the object key.
 *
 * **Export checklist (BMFont / Bitmap Font Generator):** use `smooth=0` for pixel fonts; if glyphs look soft,
 * try `aa=0` in the exported XML where the tool allows; prefer **1px padding** on the atlas to limit neighbor bleed;
 * match in-game `fontSize` to the exported pixel size (BMFont `info size` magnitude).
 */
export interface GameBitmapFontDefinition {
  /** Image file under `src/game/assets/fonts/` (e.g. BMFont page PNG). */
  textureFile: string;
  /** BMFont `.xml` under `src/game/assets/fonts/`. */
  dataFile: string;
  /**
   * Default Phaser `BitmapText` letter spacing for this font when a GUI text control omits `letterSpacing`.
   * Use small integers (often 0 or 1) to correct tight `xadvance` from the exporter without affecting other fonts.
   */
  defaultLetterSpacing?: number;
}

export type GameFontDefinition = GameBitmapFontDefinition;

export type GameFontsManifest = Record<string, GameFontDefinition>;
</file>

<file path="src/types/inventory.ts">
export interface InventoryItemData {
  id: string;
  name: string;
  description: string;
  /** Supported interaction verbs for this item (`game-config.json` ids). */
  onVerb?: Record<string, boolean>;
  /** `false` = unique (0/1); `true` = supports quantity greater than 1. */
  stackable: boolean;
  /** Optional per-tag animation overrides for inventory sheets. */
  animations?: Record<
    string,
    {
      loop?: boolean;
      frameDuration?: number;
    }
  >;
  display: {
    aseprite: boolean | 'shared';
  };
  /**
   * Optional Aseprite frame tag for the default clip in UI/cursor (Phaser key is namespaced on the shared sheet).
   * Defaults to `id` when omitted.
   */
  defaultAnimation?: string;
  cursor?: {
    hotspot?: { x: number; y: number };
  };
}
</file>

<file path="src/editor/preview/buildPreviewManifest.ts">
import { getAsepriteAssetPaths, getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/characterAseprite';
import {
    getRoomAsepriteAssetPaths,
    getRoomAsepriteTextureKey,
} from '../../game/roomAseprite';
import {
    hasBundledCursorSheet,
    readAsepriteFrameTagNamesFromRawJson,
    warnIfAnimationConfigKeysMissingFromFrameTags,
} from '../../game/loadAsepriteAtlasData';
import { normalizeAsepriteJsonForPhaser } from '../../game/normalizeAsepriteJson';
import { joinGameWebviewUri } from './previewUrls';
import gameFontsManifest from '../../game/assets/fonts/fonts.json';
import { collectFontIdsReferencedByGuiControls, getAllGuiData } from '../../game/loadGuiData';
import {
    getAsepriteAssetPaths as getGuiAsepriteAssetPaths,
    getAsepriteTextureKey as getGuiAsepriteTextureKey,
    usesAsepriteDisplay as usesGuiAsepriteDisplay,
} from '../../game/guiAseprite';
import {
    getPerItemInventoryAsepritePaths,
    getPerItemInventoryTextureKey,
    sharedInventoryAssetPaths,
    sharedInventoryTextureKey,
    usesPerItemInventoryAseprite,
    usesSharedInventoryAseprite,
} from '../../game/inventoryAseprite';
import {
    getInventoryDefinition,
    getRegisteredInventoryDefinitionIds,
} from '../../engine/inventory/inventoryDefinitionRegistry';
import type { GameFontsManifest } from '../../types/fonts';
import type { GuiData, GuiInventoryPanelControl } from '../../types/gui';
import type { CharacterData } from '../../types/character';
import type { RoomCharacterInstance, RoomData, RoomPropInstance } from '../../types/room';
import type {
    RoomCharacterSpawn,
    RoomPropSpawn,
    RoomSceneStartData,
} from '../../engine/scenes/BootScene';
import { getGameSettings } from '../../engine/ConfigManager';
import { CURSOR_TEXTURE_KEY, getCursorAsepriteAssetPaths, isBenneGameCursorAsepriteEnabled } from '../../game/cursorAseprite';

export type PreviewManifest = {
    loads: PreviewLoadEntry[];
    startData: RoomSceneStartData;
    revokeObjectUrls: string[];
};

export type PreviewLoadEntry =
    | { kind: 'image'; key: string; url: string }
    | { kind: 'aseprite'; key: string; textureURL: string; atlasURL: string }
    | { kind: 'bitmapFont'; key: string; textureURL: string; dataURL: string };

async function fetchJson(url: string): Promise<Record<string, unknown>> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`GET ${url} → ${res.status}`);
    }
    return res.json() as Promise<Record<string, unknown>>;
}

function assertCharacterDisplay(data: CharacterData): void {
    if (usesAsepriteDisplay(data)) {
        return;
    }
    const img = data.display.defaultImage;
    if (!img || img.length === 0) {
        throw new Error(`Character '${data.id}': set display.aseprite true or display.defaultImage`);
    }
}

async function fetchCharacterData(gameRootUri: string, definitionRelativePath: string): Promise<CharacterData> {
    const normalized = definitionRelativePath.replace(/^\.?\/+/, '').replaceAll('\\', '/');
    const url = joinGameWebviewUri(gameRootUri, 'characters', normalized);
    const raw = await fetchJson(url);
    const data = raw as unknown as CharacterData;
    assertCharacterDisplay(data);
    return data;
}

/**
 * Build loader manifest + RoomScene payload using the same character/prop rules as {@link BootScene},
 * resolving assets via `fetch` against `gameRootWebviewUri` (webview URI for `src/game`).
 */
export async function buildPreviewManifest(
    room: RoomData,
    gameRootWebviewUri: string,
): Promise<PreviewManifest> {
    const revokeObjectUrls: string[] = [];
    const revokeLater = (url: string): string => {
        revokeObjectUrls.push(url);
        return url;
    };

    const assetsBase = joinGameWebviewUri(gameRootWebviewUri, 'assets');
    const loads: PreviewLoadEntry[] = [];

    const backgroundTextureKey = room.background?.image ? `bg:${room.id}` : null;
    if (room.background?.image && backgroundTextureKey) {
        loads.push({
            kind: 'image',
            key: backgroundTextureKey,
            url: joinGameWebviewUri(assetsBase, room.background.image),
        });
    }

    let sheetTagNames: readonly string[] = [];
    let roomPropsTextureKey: string | null = null;

    if (room.props?.length) {
        const paths = getRoomAsepriteAssetPaths(room.id);
        const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);
        const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
        const raw = await fetchJson(jsonUrl);
        sheetTagNames = readAsepriteFrameTagNamesFromRawJson(raw);

        if (sheetTagNames.length === 0) {
            console.warn(
                `[Benne preview] Room '${room.id}' lists props but sheet has no meta.frameTags — no props will load.`,
            );
        }

        const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
        const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
        const atlasURL = revokeLater(URL.createObjectURL(blob));
        roomPropsTextureKey = getRoomAsepriteTextureKey(room.id);
        loads.push({
            kind: 'aseprite',
            key: roomPropsTextureKey,
            textureURL: pngUrl,
            atlasURL,
        });
    }

    const sheetTagSet = new Set(sheetTagNames);
    const propsWithSheetTags: RoomPropInstance[] =
        room.props?.filter((p) => {
            if (sheetTagSet.has(p.tag)) {
                return true;
            }
            console.warn(
                `[Benne preview] Room '${room.id}' prop '${p.id}' tag '${p.tag}' not on sheet — skipped.`,
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

    const spawns: RoomCharacterSpawn[] = [];
    const loadedAsepriteCharacterIds = new Set<string>();

    for (const inst of room.characters ?? []) {
        await queueCharacterLoads(
            inst,
            spawns,
            loadedAsepriteCharacterIds,
            gameRootWebviewUri,
            assetsBase,
            loads,
            revokeLater,
        );
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

    // Always queue GUI assets so the "Show GUIs" toolbar toggle can flip them on without needing
    // a preview reload. Fonts / Aseprite loads are small; keeping load-on-toggle symmetric with
    // the shipped game (see `BootScene` which also queues all GUI assets) avoids editor drift.
    await queueGuiAndInventoryLoads(loads, assetsBase, revokeLater);
    await queueGameCursorLoad(loads, assetsBase, revokeLater);

    const startData: RoomSceneStartData = {
        room,
        backgroundTextureKey,
        characters: spawns,
        props: propSpawns,
        roomPropsTextureKey,
    };

    return { loads, startData, revokeObjectUrls };
}

/**
 * Mirrors the GUI / inventory font + Aseprite sheet loads that `BootScene` queues for the shipped
 * game, using fetch + object URLs so the webview can load them via Phaser's loader. Called once
 * per `buildPreviewManifest`; idempotent w.r.t. the caller (dedup happens by key inside the loader).
 */
async function queueGameCursorLoad(
    loads: PreviewLoadEntry[],
    assetsBase: string,
    revokeLater: (url: string) => string,
): Promise<void> {
    if (!isBenneGameCursorAsepriteEnabled(getGameSettings()) || !hasBundledCursorSheet()) {
        return;
    }
    try {
        const paths = getCursorAsepriteAssetPaths();
        const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);
        const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
        const raw = await fetchJson(jsonUrl);
        const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
        const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
        const atlasURL = revokeLater(URL.createObjectURL(blob));
        loads.push({
            kind: 'aseprite',
            key: CURSOR_TEXTURE_KEY,
            textureURL: pngUrl,
            atlasURL,
        });
    } catch (err) {
        console.warn('[Benne preview] Could not queue game cursor Aseprite:', err);
    }
}

async function queueGuiAndInventoryLoads(
    loads: PreviewLoadEntry[],
    assetsBase: string,
    revokeLater: (url: string) => string,
): Promise<void> {
    const guis = getAllGuiData();
    const fontsManifest = gameFontsManifest as GameFontsManifest;

    for (const fontId of collectFontIdsReferencedByGuiControls()) {
        const def = fontsManifest[fontId];
        if (!def) {
            console.warn(
                `[Benne preview] GUI text references unknown font id "${fontId}" — add it to src/game/assets/fonts/fonts.json.`,
            );
            continue;
        }
        loads.push({
            kind: 'bitmapFont',
            key: fontId,
            textureURL: joinGameWebviewUri(assetsBase, `fonts/${def.textureFile}`),
            dataURL: joinGameWebviewUri(assetsBase, `fonts/${def.dataFile}`),
        });
    }

    for (const gui of guis) {
        if (!usesGuiAsepriteDisplay(gui)) {
            continue;
        }
        try {
            const paths = getGuiAsepriteAssetPaths(gui.id);
            const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);
            const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
            const raw = await fetchJson(jsonUrl);
            const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
            const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
            const atlasURL = revokeLater(URL.createObjectURL(blob));
            loads.push({
                kind: 'aseprite',
                key: getGuiAsepriteTextureKey(gui.id),
                textureURL: pngUrl,
                atlasURL,
            });
        } catch (err) {
            console.warn(`[Benne preview] Could not queue GUI Aseprite for "${gui.id}":`, err);
        }
    }

    if (!guisHaveInventoryPanel(guis)) {
        return;
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
            try {
                const paths = sharedInventoryAssetPaths();
                const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);
                const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
                const raw = await fetchJson(jsonUrl);
                const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
                ensureSharedInventoryTagPrefixes(norm);
                const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
                const atlasURL = revokeLater(URL.createObjectURL(blob));
                loads.push({
                    kind: 'aseprite',
                    key: sharedInventoryTextureKey,
                    textureURL: pngUrl,
                    atlasURL,
                });
                queuedSharedInventory = true;
            } catch (err) {
                console.warn(
                    '[Benne preview] Could not queue shared inventory Aseprite; GUI inventory icons may show placeholders.',
                    err,
                );
            }
        } else if (usesPerItemInventoryAseprite(def)) {
            if (queuedPerItemInventoryIds.has(id)) {
                continue;
            }
            queuedPerItemInventoryIds.add(id);
            try {
                const paths = getPerItemInventoryAsepritePaths(id);
                const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);
                const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
                const raw = await fetchJson(jsonUrl);
                const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
                const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
                const atlasURL = revokeLater(URL.createObjectURL(blob));
                loads.push({
                    kind: 'aseprite',
                    key: getPerItemInventoryTextureKey(id),
                    textureURL: pngUrl,
                    atlasURL,
                });
            } catch (err) {
                console.warn(
                    `[Benne preview] Could not queue per-item inventory Aseprite for "${id}":`,
                    err,
                );
            }
        }
    }
}

function guisHaveInventoryPanel(guis: readonly GuiData[]): boolean {
    for (const gui of guis) {
        for (const c of gui.controls ?? []) {
            if ((c as GuiInventoryPanelControl).type === 'inventoryPanel') {
                return true;
            }
        }
    }
    return false;
}

/**
 * Shared inventory sheet uses unprefixed Aseprite tag names on disk, but the engine plays clips via
 * the `inventory:<tag>` Phaser animation key (see `inventoryPhaserAnimationKeyForTag`). Mirror the
 * normalization step in `guiEditorMain.ts` so `createFromAseprite` registers those prefixed keys.
 */
function ensureSharedInventoryTagPrefixes(normalized: Record<string, unknown>): void {
    const meta = normalized.meta;
    if (!meta || typeof meta !== 'object') {
        return;
    }
    const frameTags = (meta as { frameTags?: { name: string }[] }).frameTags;
    if (!Array.isArray(frameTags)) {
        return;
    }
    for (const tag of frameTags) {
        if (
            tag &&
            typeof tag.name === 'string' &&
            tag.name.length > 0 &&
            !tag.name.startsWith('inventory:')
        ) {
            tag.name = `inventory:${tag.name}`;
        }
    }
}

async function queueCharacterLoads(
    inst: RoomCharacterInstance,
    spawns: RoomCharacterSpawn[],
    loadedAsepriteCharacterIds: Set<string>,
    gameRootWebviewUri: string,
    assetsBase: string,
    loads: PreviewLoadEntry[],
    revokeLater: (u: string) => string,
): Promise<void> {
    const data = await fetchCharacterData(gameRootWebviewUri, inst.definition);

    if (usesAsepriteDisplay(data)) {
        const textureKey = getAsepriteTextureKey(data.id);
        if (!loadedAsepriteCharacterIds.has(data.id)) {
            const paths = getAsepriteAssetPaths(data.id);
            const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);
            const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
            const raw = await fetchJson(jsonUrl);
            const frameTags = readAsepriteFrameTagNamesFromRawJson(raw);
            warnIfAnimationConfigKeysMissingFromFrameTags(
                `Character '${data.id}'`,
                frameTags,
                data.animations as Record<string, unknown> | undefined,
            );
            const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
            const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
            const atlasURL = revokeLater(URL.createObjectURL(blob));
            loads.push({
                kind: 'aseprite',
                key: textureKey,
                textureURL: pngUrl,
                atlasURL,
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
    loads.push({
        kind: 'image',
        key: textureKey,
        url: joinGameWebviewUri(assetsBase, data.display.defaultImage!),
    });
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
</file>

<file path="src/editor/preview/createCharacterPreviewGame.ts">
import * as Phaser from 'phaser';
import { applyBootAudioSettings } from '../../engine/applyAudioFromSettings';
import {
  placeSpriteByFeet,
  resolveCharacterFeetLocal,
  type CharacterFeetLocal,
} from '../../engine/characterFeet';
import { getBenneRendererConfigFields } from '../../engine/gameConfig';
import type { CharacterData } from '../../types/character';
import type { Point2 } from '../../types/room';
import { PreviewPolygonOverlay } from './previewPolygonOverlay';

const BOOT = 'BenneCharacterPreviewBoot';
const PREVIEW = 'BenneCharacterPreview';

/** Padding around the sprite frame in world pixels (matches room editor “fit art” feel). */
const WORLD_PAD = 56;

/** Collider overlay editing (same CSS radii as `RoomPolygonEditScene`). */
const HANDLE_R_CSS = 6;
const AUX_HANDLE_R_CSS = 7;
const EDGE_HIT_CSS = 14;
const LINE_WIDTH_CSS = 2;
const MIN_COLLIDER_POINTS = 3;
const COL_COLLIDER = 0xff66cc;

const COL_FEET_AUX = '#ffee44';
const COL_WALK_TO_AUX = '#3db8e8';
const COL_TALK_AUX = '#e8a438';
const COL_AUX_STROKE = '#1a1a24';

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function distPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { d: number; t: number; ix: number; iy: number } {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  let t = ab2 > 0 ? (apx * abx + apy * aby) / ab2 : 0;
  t = Phaser.Math.Clamp(t, 0, 1);
  const ix = ax + t * abx;
  const iy = ay + t * aby;
  const d = Phaser.Math.Distance.Between(px, py, ix, iy);
  return { d, t, ix, iy };
}

function hitVertexCss(
  cx: number,
  cy: number,
  pts: Point2[],
  handleR: number,
  toCss: (p: Point2) => { x: number; y: number },
): number {
  let best = -1;
  let bestD = handleR + 1;
  for (let i = 0; i < pts.length; i++) {
    const p = toCss(pts[i]!);
    const d = Phaser.Math.Distance.Between(cx, cy, p.x, p.y);
    if (d <= handleR && d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Index `i` is edge from `pts[i]` to `pts[(i+1)%n]`. */
function hitEdgeCss(
  cx: number,
  cy: number,
  pts: Point2[],
  edgeHit: number,
  vertexClear: number,
  toCss: (p: Point2) => { x: number; y: number },
): number {
  const n = pts.length;
  let best = -1;
  let bestD = edgeHit + 1;
  for (let i = 0; i < n; i++) {
    const a = toCss(pts[i]!);
    const b = toCss(pts[(i + 1) % n]!);
    const { d, t } = distPointToSegment(cx, cy, a.x, a.y, b.x, b.y);
    if (d > edgeHit) {
      continue;
    }
    if (Phaser.Math.Distance.Between(cx, cy, a.x, a.y) < vertexClear) {
      continue;
    }
    if (Phaser.Math.Distance.Between(cx, cy, b.x, b.y) < vertexClear) {
      continue;
    }
    if (t <= 0.05 || t >= 0.95) {
      continue;
    }
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function insertPointOnEdgeLocal(pts: Point2[], edgeIdx: number, lx: number, ly: number): void {
  const a = pts[edgeIdx]!;
  const b = pts[(edgeIdx + 1) % pts.length]!;
  const { ix, iy } = distPointToSegment(lx, ly, a.x, a.y, b.x, b.y);
  pts.splice(edgeIdx + 1, 0, { x: ix, y: iy });
}

function hitAuxCss(
  cx: number,
  cy: number,
  pt: Point2,
  handleR: number,
  toCss: (p: Point2) => { x: number; y: number },
): boolean {
  const p = toCss(pt);
  return Phaser.Math.Distance.Between(cx, cy, p.x, p.y) <= handleR;
}

export type CharacterPreviewGamePayload = {
  textureKey: string;
  textureURL: string;
  atlasURL: string;
  character: CharacterData;
  idleTag: string;
  revokeObjectUrls: string[];
};

/**
 * Renderer fields come from the shared helper so the character preview matches the shipped game
 * and the other previews (see `.cursor/rules/benne-preview-rendering-parity.mdc`). Only the scale
 * mode intentionally differs — `Scale.RESIZE` lets the canvas fill the webview panel instead of
 * the runtime's integer-zoom `Scale.FIT`.
 */
function editorGameConfig(parent: HTMLElement): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
  return {
    ...getBenneRendererConfigFields(),
    parent,
    scale: {
      parent,
      mode: Phaser.Scale.RESIZE,
    },
  };
}

class BenneCharacterPreviewBoot extends Phaser.Scene {
  private readonly payload: CharacterPreviewGamePayload;

  constructor(payload: CharacterPreviewGamePayload) {
    super(BOOT);
    this.payload = payload;
  }

  preload(): void {
    this.load.aseprite({
      key: this.payload.textureKey,
      textureURL: this.payload.textureURL,
      atlasURL: this.payload.atlasURL,
    });
  }

  create(): void {
    applyBootAudioSettings(this);
    this.scene.start(PREVIEW, {
      textureKey: this.payload.textureKey,
      character: this.payload.character,
      idleTag: this.payload.idleTag,
    });
    for (const u of this.payload.revokeObjectUrls) {
      URL.revokeObjectURL(u);
    }
  }
}

class CharacterPreviewScene extends Phaser.Scene {
  private textureKey!: string;
  private character!: CharacterData;
  private idleTag!: string;
  private sprite!: Phaser.GameObjects.Sprite;
  private feetLocal!: CharacterFeetLocal;
  private walkLocal!: Point2;
  private talkLocal!: Point2;
  private worldW = 0;
  private worldH = 0;
  private isPanning = false;
  private panLastX = 0;
  private panLastY = 0;

  private overlay?: PreviewPolygonOverlay;
  /** Collider vertices in frame-local space (same as `feet` / character JSON). */
  private colliderLocal: Point2[] = [];
  private selectedVertexIndex: number | null = null;
  private selectedAux: 'feet' | 'walk' | 'talk' | null = null;
  private dragVertexIndex: number | null = null;
  private dragAux: 'feet' | 'walk' | 'talk' | null = null;
  private downOnVertex = false;
  private tapEdge: { t: number; edgeIdx: number } | null = null;
  private isOverlayPanning = false;
  private overlayPanLastX = 0;
  private overlayPanLastY = 0;

  private readonly onCanvasWheel = (e: WheelEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const cam = this.cameras.main;
    const worldPt = this.domPageToWorld(e.pageX, e.pageY);
    let delta = e.deltaY;
    if (e.deltaMode === 1) {
      delta *= 40;
    }
    if (e.deltaMode === 2) {
      delta *= 400;
    }
    const zoomFactor = 1 - Math.max(-0.3, Math.min(0.3, delta * 0.001));
    const newZoom = Math.max(0.15, Math.min(48, cam.zoom * zoomFactor));
    if (Math.abs(newZoom - cam.zoom) < 0.0001) {
      return;
    }
    this.game.scale.updateBounds();
    const screenX = this.game.scale.transformX(e.pageX);
    const screenY = this.game.scale.transformY(e.pageY);
    const originX = cam.width * cam.originX;
    const originY = cam.height * cam.originY;
    cam.setZoom(newZoom);
    cam.scrollX = worldPt.x - originX - (screenX - originX - cam.x) / newZoom;
    cam.scrollY = worldPt.y - originY - (screenY - originY - cam.y) / newZoom;
  };

  private readonly onCanvasPointerDown = (e: PointerEvent): void => {
    if (e.button !== 1) {
      return;
    }
    e.preventDefault();
    this.isPanning = true;
    this.panLastX = e.clientX;
    this.panLastY = e.clientY;
    this.game.canvas.style.cursor = 'grabbing';
    this.game.canvas.setPointerCapture(e.pointerId);
  };

  private readonly onCanvasPointerMove = (e: PointerEvent): void => {
    if (!this.isPanning) {
      return;
    }
    const cam = this.cameras.main;
    const dx = e.clientX - this.panLastX;
    const dy = e.clientY - this.panLastY;
    cam.scrollX -= dx / cam.zoom;
    cam.scrollY -= dy / cam.zoom;
    this.panLastX = e.clientX;
    this.panLastY = e.clientY;
  };

  private readonly onCanvasPointerUp = (e: PointerEvent): void => {
    if (e.button !== 1 || !this.isPanning) {
      return;
    }
    this.isPanning = false;
    this.game.canvas.style.cursor = '';
    try {
      this.game.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released */
    }
  };

  private readonly onWindowKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'f' && e.key !== 'F') {
      return;
    }
    const ae = document.activeElement;
    if (
      ae instanceof HTMLInputElement ||
      ae instanceof HTMLTextAreaElement ||
      ae instanceof HTMLSelectElement
    ) {
      return;
    }
    if (this.overlay?.canvas === ae) {
      return;
    }
    e.preventDefault();
    this.applyFitCamera();
  };

  private readonly onScaleResize = (): void => {
    this.refreshAuthoringWorldBounds();
    this.applyFitCamera();
  };

  constructor() {
    super(PREVIEW);
  }

  init(data: {
    textureKey: string;
    character: CharacterData;
    idleTag: string;
  }): void {
    this.textureKey = data.textureKey;
    this.character = data.character;
    this.idleTag = data.idleTag;
  }

  create(): void {
    const rawPts = this.character.collider?.points;
    this.colliderLocal =
      Array.isArray(rawPts) && rawPts.length > 0
        ? rawPts.map((p) => ({ x: p.x, y: p.y }))
        : [];

    this.sprite = this.add.sprite(0, 0, this.textureKey).setOrigin(0, 0);
    if (!this.anims.exists(this.idleTag)) {
      this.anims.createFromAseprite(this.textureKey);
    }
    this.sprite.play(this.idleTag);

    this.feetLocal = { ...resolveCharacterFeetLocal(this.character, this.sprite) };
    const wtp = this.character.walkToPoint;
    this.walkLocal = wtp ? { x: wtp.x, y: wtp.y } : { ...this.feetLocal };
    const ttp = this.character.talkPoint;
    this.talkLocal = ttp
      ? { x: ttp.x, y: ttp.y }
      : { x: this.feetLocal.x, y: this.feetLocal.y - 48 };

    const feetWx = WORLD_PAD + this.feetLocal.x;
    const feetWy = WORLD_PAD + this.feetLocal.y;
    placeSpriteByFeet(this.sprite, this.feetLocal, feetWx, feetWy);

    const mount = this.game.canvas.parentElement;
    if (mount) {
      this.overlay = new PreviewPolygonOverlay(this.game, mount);
      this.overlay.setPointerEventsEnabled(true);
      this.overlay.canvas.addEventListener('pointerdown', this.onOverlayPointerDown);
      this.overlay.canvas.addEventListener('pointermove', this.onOverlayPointerMove);
      this.overlay.canvas.addEventListener('pointerup', this.onOverlayPointerUp);
      this.overlay.canvas.addEventListener('pointercancel', this.onOverlayPointerUp);
      this.overlay.canvas.addEventListener('keydown', this.onOverlayKeyDown);
      this.overlay.canvas.addEventListener('wheel', this.onOverlayWheel, { passive: false });
    }

    this.syncGeometryRegistry();

    const cam = this.cameras.main;
    cam.setBackgroundColor(0x1a1a2e);
    this.refreshAuthoringWorldBounds();
    this.applyFitCamera();

    const canvas = this.game.canvas;
    canvas.addEventListener('wheel', this.onCanvasWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    canvas.addEventListener('pointermove', this.onCanvasPointerMove);
    canvas.addEventListener('pointerup', this.onCanvasPointerUp);
    canvas.addEventListener('pointercancel', this.onCanvasPointerUp);
    window.addEventListener('keydown', this.onWindowKeyDown);
    this.scale.on('resize', this.onScaleResize);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener('wheel', this.onCanvasWheel);
      canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
      canvas.removeEventListener('pointermove', this.onCanvasPointerMove);
      canvas.removeEventListener('pointerup', this.onCanvasPointerUp);
      canvas.removeEventListener('pointercancel', this.onCanvasPointerUp);
      window.removeEventListener('keydown', this.onWindowKeyDown);
      this.scale.off('resize', this.onScaleResize);
      if (this.overlay) {
        this.overlay.canvas.removeEventListener('pointerdown', this.onOverlayPointerDown);
        this.overlay.canvas.removeEventListener('pointermove', this.onOverlayPointerMove);
        this.overlay.canvas.removeEventListener('pointerup', this.onOverlayPointerUp);
        this.overlay.canvas.removeEventListener('pointercancel', this.onOverlayPointerUp);
        this.overlay.canvas.removeEventListener('keydown', this.onOverlayKeyDown);
        this.overlay.canvas.removeEventListener('wheel', this.onOverlayWheel);
        this.overlay.destroy();
        this.overlay = undefined;
      }
    });

    this.add
      .text(
        10,
        10,
        'Wheel = zoom · middle-drag = pan · F = fit · Feet (on cel) / Walk & Talk (may be off-sprite) · Magenta collider stays on cel (3+ pts, double-click edge to add vertex)',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: '#c8c8d8',
        },
      )
      .setScrollFactor(0)
      .setDepth(200);
  }

  private syncGeometryRegistry(): void {
    this.game.registry.set('benneCharacterPreviewReadGeometry', () => ({
      feet: { ...this.feetLocal },
      walkToPoint: { ...this.walkLocal },
      talkPoint: { ...this.talkLocal },
      collider: this.readColliderForSave(),
    }));
  }

  /** World-space AABB of sprite, feet/walk/talk handles, and collider (for camera bounds). */
  private computeContentAabbWorld(): { minX: number; minY: number; maxX: number; maxY: number } {
    const sx = this.sprite.x;
    const sy = this.sprite.y;
    const fw = this.sprite.frame.width;
    const fh = this.sprite.frame.height;
    let minX = sx;
    let minY = sy;
    let maxX = sx + fw;
    let maxY = sy + fh;
    const merge = (p: Point2): void => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    };
    const { feet, walk, talk } = this.feetWalkTalkWorld();
    merge(feet);
    merge(walk);
    merge(talk);
    for (const p of this.colliderWorldPoints()) {
      merge(p);
    }
    return { minX, minY, maxX, maxY };
  }

  /** Expand scroll bounds so off-sprite walk/talk handles remain visible and pannable. */
  private refreshAuthoringWorldBounds(): void {
    const cam = this.cameras.main;
    const { minX, minY, maxX, maxY } = this.computeContentAabbWorld();
    const pad = WORLD_PAD;
    const bx = minX - pad;
    const by = minY - pad;
    const bw = Math.max(1, maxX - minX + pad * 2);
    const bh = Math.max(1, maxY - minY + pad * 2);
    this.worldW = bw;
    this.worldH = bh;
    cam.setBounds(bx, by, bw, bh);
  }

  private feetWalkTalkWorld(): { feet: Point2; walk: Point2; talk: Point2 } {
    const sx = this.sprite.x;
    const sy = this.sprite.y;
    return {
      feet: { x: sx + this.feetLocal.x, y: sy + this.feetLocal.y },
      walk: { x: sx + this.walkLocal.x, y: sy + this.walkLocal.y },
      talk: { x: sx + this.talkLocal.x, y: sy + this.talkLocal.y },
    };
  }

  private tryPickAux(
    cx: number,
    cy: number,
    toCss: (p: Point2) => { x: number; y: number },
  ): 'feet' | 'walk' | 'talk' | null {
    const { feet, walk, talk } = this.feetWalkTalkWorld();
    if (hitAuxCss(cx, cy, feet, AUX_HANDLE_R_CSS, toCss)) {
      return 'feet';
    }
    if (hitAuxCss(cx, cy, walk, AUX_HANDLE_R_CSS, toCss)) {
      return 'walk';
    }
    if (hitAuxCss(cx, cy, talk, AUX_HANDLE_R_CSS, toCss)) {
      return 'talk';
    }
    return null;
  }

  private readColliderForSave(): { points: Point2[] } | null {
    if (this.colliderLocal.length < MIN_COLLIDER_POINTS) {
      return null;
    }
    const fw = this.sprite.frame.width;
    const fh = this.sprite.frame.height;
    const points = this.colliderLocal.map((p) => ({
      x: Math.round(Phaser.Math.Clamp(p.x, 0, fw)),
      y: Math.round(Phaser.Math.Clamp(p.y, 0, fh)),
    }));
    return { points };
  }

  private colliderWorldPoints(): Point2[] {
    const sx = this.sprite.x;
    const sy = this.sprite.y;
    return this.colliderLocal.map((p) => ({ x: sx + p.x, y: sy + p.y }));
  }

  /** Feet and collider vertices stay inside the cel (texture hit-test space). */
  private clampFeetOrColliderLocal(lx: number, ly: number): Point2 {
    const fw = this.sprite.frame.width;
    const fh = this.sprite.frame.height;
    return { x: Phaser.Math.Clamp(lx, 0, fw), y: Phaser.Math.Clamp(ly, 0, fh) };
  }

  /** Walk / talk may use frame-relative offsets outside the sprite rectangle. */
  private unclampedWalkTalkLocal(lx: number, ly: number): Point2 {
    return { x: Math.round(lx), y: Math.round(ly) };
  }

  update(): void {
    const ov = this.overlay;
    if (!ov) {
      return;
    }
    ov.syncLayout();
    this.refreshAuthoringWorldBounds();
    const cam = this.cameras.main;
    const worldPts = this.colliderWorldPoints();
    const { feet, walk, talk } = this.feetWalkTalkWorld();
    const labeledPoints = [
      {
        point: feet,
        label: 'Feet',
        fillStyle: COL_FEET_AUX,
        strokeStyle: COL_AUX_STROKE,
        selected: this.selectedAux === 'feet',
        radiusCss: AUX_HANDLE_R_CSS,
      },
      {
        point: walk,
        label: 'Walk to',
        fillStyle: COL_WALK_TO_AUX,
        strokeStyle: COL_AUX_STROKE,
        selected: this.selectedAux === 'walk',
        radiusCss: AUX_HANDLE_R_CSS,
      },
      {
        point: talk,
        label: 'Talk',
        fillStyle: COL_TALK_AUX,
        strokeStyle: COL_AUX_STROKE,
        selected: this.selectedAux === 'talk',
        radiusCss: AUX_HANDLE_R_CSS,
      },
    ];
    ov.clearAndDraw(
      {
        pts: worldPts,
        strokeStyle: hexToCss(COL_COLLIDER),
        handleFill: '#ffee44',
        handleStroke: '#1a1a24',
        selectedIndex: this.selectedVertexIndex,
        handleRadiusCss: HANDLE_R_CSS,
        lineWidthCss: LINE_WIDTH_CSS,
        labeledPoints,
      },
      cam,
    );
  }

  private pointerCss(e: PointerEvent): { cx: number; cy: number } {
    const rect = this.game.canvas.getBoundingClientRect();
    return { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
  }

  private readonly onOverlayWheel = (e: WheelEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const ov = this.overlay;
    if (!ov) {
      return;
    }
    const cam = this.cameras.main;
    const worldPt = ov.domToWorld(e.pageX, e.pageY, cam);
    let delta = e.deltaY;
    if (e.deltaMode === 1) {
      delta *= 40;
    }
    if (e.deltaMode === 2) {
      delta *= 400;
    }
    const zoomFactor = 1 - Math.max(-0.3, Math.min(0.3, delta * 0.001));
    const newZoom = Math.max(0.15, Math.min(48, cam.zoom * zoomFactor));
    if (Math.abs(newZoom - cam.zoom) < 0.0001) {
      return;
    }
    this.game.scale.updateBounds();
    const screenX = this.game.scale.transformX(e.pageX);
    const screenY = this.game.scale.transformY(e.pageY);
    const originX = cam.width * cam.originX;
    const originY = cam.height * cam.originY;
    cam.setZoom(newZoom);
    cam.scrollX = worldPt.x - originX - (screenX - originX - cam.x) / newZoom;
    cam.scrollY = worldPt.y - originY - (screenY - originY - cam.y) / newZoom;
  };

  private readonly onOverlayPointerDown = (e: PointerEvent): void => {
    const ov = this.overlay;
    if (!ov) {
      return;
    }

    if (e.button === 1) {
      e.preventDefault();
      this.isOverlayPanning = true;
      this.overlayPanLastX = e.clientX;
      this.overlayPanLastY = e.clientY;
      ov.canvas.setPointerCapture(e.pointerId);
      ov.canvas.style.cursor = 'grabbing';
      return;
    }

    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    ov.canvas.setPointerCapture(e.pointerId);
    ov.canvas.focus({ preventScroll: true });
    const { cx, cy } = this.pointerCss(e);
    const cam = this.cameras.main;
    const worldPts = this.colliderWorldPoints();
    const toCss = (p: Point2): { x: number; y: number } => ov.worldToCanvasCss(p, cam);
    const pts = this.colliderLocal;

    const aux = this.tryPickAux(cx, cy, toCss);
    if (aux) {
      this.dragAux = aux;
      this.selectedAux = aux;
      this.selectedVertexIndex = null;
      this.downOnVertex = false;
      this.dragVertexIndex = null;
      this.tapEdge = null;
      return;
    }

    if (pts.length < MIN_COLLIDER_POINTS) {
      const vi = pts.length > 0 ? hitVertexCss(cx, cy, worldPts, HANDLE_R_CSS, toCss) : -1;
      if (vi >= 0) {
        this.downOnVertex = true;
        this.dragVertexIndex = vi;
        this.selectedVertexIndex = vi;
        this.selectedAux = null;
        this.dragAux = null;
        return;
      }
      return;
    }

    const vi = hitVertexCss(cx, cy, worldPts, HANDLE_R_CSS, toCss);
    if (vi >= 0) {
      this.downOnVertex = true;
      this.dragVertexIndex = vi;
      this.selectedVertexIndex = vi;
      this.selectedAux = null;
      this.dragAux = null;
      return;
    }
    this.downOnVertex = false;
    this.dragVertexIndex = null;
  };

  private readonly onOverlayPointerMove = (e: PointerEvent): void => {
    const ov = this.overlay;
    if (!ov) {
      return;
    }

    if (this.isOverlayPanning) {
      const cam = this.cameras.main;
      const dx = e.clientX - this.overlayPanLastX;
      const dy = e.clientY - this.overlayPanLastY;
      cam.scrollX -= dx / cam.zoom;
      cam.scrollY -= dy / cam.zoom;
      this.overlayPanLastX = e.clientX;
      this.overlayPanLastY = e.clientY;
      return;
    }

    if (this.dragAux) {
      const cam = this.cameras.main;
      const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, cam);
      const lx = wx - this.sprite.x;
      const ly = wy - this.sprite.y;
      if (this.dragAux === 'feet') {
        this.feetLocal = this.clampFeetOrColliderLocal(lx, ly);
      } else if (this.dragAux === 'walk') {
        this.walkLocal = this.unclampedWalkTalkLocal(lx, ly);
      } else {
        this.talkLocal = this.unclampedWalkTalkLocal(lx, ly);
      }
      this.syncGeometryRegistry();
      return;
    }

    if (this.dragVertexIndex === null) {
      return;
    }
    const cam = this.cameras.main;
    const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, cam);
    const lx = wx - this.sprite.x;
    const ly = wy - this.sprite.y;
    const c = this.clampFeetOrColliderLocal(lx, ly);
    const i = this.dragVertexIndex;
    if (i >= 0 && i < this.colliderLocal.length) {
      this.colliderLocal[i] = c;
    }
    this.syncGeometryRegistry();
  };

  private readonly onOverlayPointerUp = (e: PointerEvent): void => {
    const ov = this.overlay;

    if (e.button === 1) {
      if (this.isOverlayPanning) {
        this.isOverlayPanning = false;
        if (ov) {
          ov.canvas.style.cursor = '';
          try {
            ov.canvas.releasePointerCapture(e.pointerId);
          } catch {
            /* */
          }
        }
      }
      return;
    }

    if (e.button === 0 && ov) {
      try {
        ov.canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    }

    if (!ov) {
      this.dragVertexIndex = null;
      this.downOnVertex = false;
      this.dragAux = null;
      return;
    }

    const cam = this.cameras.main;
    const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, cam);
    const lx = wx - this.sprite.x;
    const ly = wy - this.sprite.y;
    const { cx, cy } = this.pointerCss(e);
    const worldPts = this.colliderWorldPoints();
    const toCss = (p: Point2): { x: number; y: number } => ov.worldToCanvasCss(p, cam);
    const pts = this.colliderLocal;

    if (this.dragAux) {
      this.dragAux = null;
      this.tapEdge = null;
      return;
    }

    if (this.downOnVertex || this.dragVertexIndex !== null) {
      this.dragVertexIndex = null;
      this.downOnVertex = false;
      return;
    }

    if (pts.length < MIN_COLLIDER_POINTS && !this.downOnVertex && this.dragVertexIndex === null) {
      pts.push(this.clampFeetOrColliderLocal(lx, ly));
      this.tapEdge = null;
      this.syncGeometryRegistry();
      return;
    }

    if (pts.length >= MIN_COLLIDER_POINTS) {
      const vertexClear = HANDLE_R_CSS + 3;
      const edgeIdx = hitEdgeCss(cx, cy, worldPts, EDGE_HIT_CSS, vertexClear, toCss);
      if (edgeIdx >= 0) {
        const now = this.time.now;
        if (
          this.tapEdge &&
          this.tapEdge.edgeIdx === edgeIdx &&
          now - this.tapEdge.t < 450
        ) {
          const cl = this.clampFeetOrColliderLocal(lx, ly);
          insertPointOnEdgeLocal(pts, edgeIdx, cl.x, cl.y);
          this.tapEdge = null;
          this.syncGeometryRegistry();
        } else {
          this.tapEdge = { t: now, edgeIdx };
        }
      } else {
        this.tapEdge = null;
        this.selectedVertexIndex = null;
      }
    }
  };

  private readonly onOverlayKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      this.applyFitCamera();
      return;
    }
    if (e.key !== 'Delete' && e.key !== 'Backspace') {
      return;
    }
    const pts = this.colliderLocal;
    if (
      this.selectedVertexIndex === null ||
      pts.length <= MIN_COLLIDER_POINTS
    ) {
      return;
    }
    pts.splice(this.selectedVertexIndex, 1);
    this.selectedVertexIndex = null;
    this.syncGeometryRegistry();
    e.preventDefault();
    e.stopPropagation();
  };

  private domPageToWorld(pageX: number, pageY: number): { x: number; y: number } {
    this.game.scale.updateBounds();
    const px = this.game.scale.transformX(pageX);
    const py = this.game.scale.transformY(pageY);
    return this.cameras.main.getWorldPoint(px, py);
  }

  private applyFitCamera(): void {
    const cam = this.cameras.main;
    const panelW = this.scale.width;
    const panelH = this.scale.height;
    if (panelW <= 0 || panelH <= 0 || this.worldW <= 0 || this.worldH <= 0) {
      return;
    }
    const zoom = Math.min(panelW / this.worldW, panelH / this.worldH) * 0.92;
    cam.setZoom(zoom);
    cam.centerToBounds();
  }
}

export function createCharacterPreviewPhaserGame(
  parent: HTMLElement,
  payload: CharacterPreviewGamePayload,
): Phaser.Game {
  return new Phaser.Game({
    ...editorGameConfig(parent),
    scene: [new BenneCharacterPreviewBoot(payload), CharacterPreviewScene],
  });
}
</file>

<file path="src/editor/preview/guiEditorMain.ts">
import type { Game } from 'phaser';
import {
  collectFontLoadsForGui,
  guiHasImageControls,
  guiHasTextControls,
} from '../../game/collectFontLoadsForGui';
import gameFontsManifest from '../../game/assets/fonts/fonts.json';
import {
  getAsepriteAssetPaths,
  getAsepriteTextureKey,
  usesAsepriteDisplay,
} from '../../game/guiAseprite';
import {
  sharedInventoryAssetPaths,
  sharedInventoryTextureKey,
} from '../../game/inventoryAseprite';
import { normalizeAsepriteJsonForPhaser } from '../../game/normalizeAsepriteJson';
import type { GameFontsManifest } from '../../types/fonts';
import type { GameSettingsInitialGameState } from '../../types/game';
import type { GuiData, GuiInventoryPanelControl } from '../../types/gui';
import { createGuiPreviewPhaserGame, type GuiPreviewGamePayload } from './createGuiPreviewGame';
import { registerInventoryDefinitionsFromGame } from '../../game/registerInventoryDefinitions';
import { joinGameWebviewUri } from './previewUrls';

registerInventoryDefinitionsFromGame();

declare function acquireVsCodeApi(): { postMessage(data: unknown): void };

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
let game: Game | null = null;

try {
  vscodeApi = acquireVsCodeApi();
} catch {
  /* not inside a VS Code webview */
}

function destroyPreviewGame(): void {
  if (game) {
    game.destroy(true);
    game = null;
  }
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function guiHasInventoryPanel(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c): c is GuiInventoryPanelControl => c.type === 'inventoryPanel');
}

function ensureSharedInventoryTagPrefixes(normalized: Record<string, unknown>): void {
  const meta = normalized.meta;
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

function initialInventoryHasStartingItems(
  inventory: GameSettingsInitialGameState['inventory'] | undefined,
): boolean {
  if (inventory == null) {
    return false;
  }
  if (Array.isArray(inventory)) {
    return inventory.length > 0;
  }
  return Object.keys(inventory).length > 0;
}

async function runLoadGui(msg: {
  gui: GuiData;
  guiId: string;
  gameSrcWebviewUri: string;
  guiJsonUri: string;
}): Promise<void> {
  const root = document.getElementById('benne-gui-preview-root');
  if (!root) {
    return;
  }
  root.innerHTML = '';
  destroyPreviewGame();

  let internalWidth = 352;
  let internalHeight = 198;
  let previewInitialGameState: GameSettingsInitialGameState | undefined;
  try {
    const configUrl = joinGameWebviewUri(msg.gameSrcWebviewUri, 'game-config.json');
    const cfg = await fetchJson(configUrl);
    const res = cfg.resolution as { width?: unknown; height?: unknown } | undefined;
    if (res && typeof res.width === 'number' && typeof res.height === 'number') {
      internalWidth = res.width;
      internalHeight = res.height;
    }
    const init = cfg.initialGameState;
    if (init && typeof init === 'object' && !Array.isArray(init)) {
      previewInitialGameState = init as GameSettingsInitialGameState;
    }
  } catch {
    /* defaults */
  }

  const hasText = guiHasTextControls(msg.gui);
  const hasInventoryPanel = guiHasInventoryPanel(msg.gui);
  const hasImage = guiHasImageControls(msg.gui);
  const wantsAseprite = usesAsepriteDisplay(msg.gui);

  if (!hasText && !hasInventoryPanel && !wantsAseprite && !hasImage) {
    root.innerHTML = `<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">GUI preview needs <code>display.aseprite: true</code>, at least one <code>text</code>, <code>image</code>, or <code>inventoryPanel</code> control in <code>controls</code>.</div>`;
    return;
  }

  const assetsBase = joinGameWebviewUri(msg.gameSrcWebviewUri, 'assets');
  const manifest = gameFontsManifest as GameFontsManifest;
  const fontLoads = collectFontLoadsForGui(msg.gui, manifest, (rel) =>
    joinGameWebviewUri(assetsBase, rel),
  );

  let aseprite: GuiPreviewGamePayload['aseprite'] = null;
  const revokeObjectUrls: string[] = [];
  let asepriteError: string | null = null;

  if (wantsAseprite) {
    const paths = getAsepriteAssetPaths(msg.guiId);
    const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
    const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);

    try {
      const raw = await fetchJson(jsonUrl);
      const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
      const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
      const atlasURL = URL.createObjectURL(blob);
      revokeObjectUrls.push(atlasURL);
      aseprite = {
        textureKey: getAsepriteTextureKey(msg.guiId),
        textureURL: pngUrl,
        atlasURL,
      };
    } catch (e) {
      asepriteError = e instanceof Error ? e.message : String(e);
    }
  }

  if (!aseprite && !hasText && !hasInventoryPanel) {
    root.innerHTML = `<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">Could not load sheet: ${asepriteError ?? 'unknown error'}</div>`;
    return;
  }

  if (wantsAseprite && !aseprite && (hasText || hasInventoryPanel)) {
    console.warn('[BENNE GUI preview] Aseprite sheet unavailable; showing available controls only.', asepriteError);
  }

  let sharedInventoryAseprite: GuiPreviewGamePayload['sharedInventoryAseprite'] = null;
  if (
    hasInventoryPanel &&
    initialInventoryHasStartingItems(previewInitialGameState?.inventory)
  ) {
    try {
      const paths = sharedInventoryAssetPaths();
      const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
      const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);
      const raw = await fetchJson(jsonUrl);
      const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
      ensureSharedInventoryTagPrefixes(norm);
      const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
      const atlasURL = URL.createObjectURL(blob);
      revokeObjectUrls.push(atlasURL);
      sharedInventoryAseprite = {
        textureKey: sharedInventoryTextureKey,
        textureURL: pngUrl,
        atlasURL,
      };
    } catch (e) {
      console.warn(
        '[BENNE GUI preview] Could not load shared inventory sheet; inventory HUD icons may use placeholders.',
        e,
      );
    }
  }

  const inner = document.createElement('div');
  inner.style.cssText = 'position:relative;width:100%;height:100%;min-height:180px;';
  root.appendChild(inner);

  const payload: GuiPreviewGamePayload = {
    guiData: msg.gui,
    fontLoads,
    internalWidth,
    internalHeight,
    revokeObjectUrls,
    aseprite,
    previewInitialGameState,
    sharedInventoryAseprite,
  };

  game = createGuiPreviewPhaserGame(inner, payload);
}

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as { type?: string };
  if (msg?.type === 'benne/guiPreview/loadGui') {
    const m = event.data as {
      type: string;
      gui: GuiData;
      guiId: string;
      gameSrcWebviewUri: string;
      guiJsonUri: string;
    };
    void runLoadGui(m);
    return;
  }
  if (msg?.type === 'benne/guiPreview/clear') {
    destroyPreviewGame();
    const root = document.getElementById('benne-gui-preview-root');
    if (root) {
      root.innerHTML = '';
    }
  }
});

vscodeApi?.postMessage({ type: 'benne/guiPreview/ready' });
</file>

<file path="src/editor/preview/polygonEditBridge.ts">
export type EditToolbarMode =
    | 'navigate'
    | 'walkable'
    | 'propCollider'
    | 'hotspotPolygon'
    | 'regionPolygon'
    | 'roomPoint'
    | 'roomSize'
    | 'scrollBounds';

class PolygonEditBridgeImpl {
    mode: EditToolbarMode = 'navigate';
    walkablePolygonId = '';
    /** Empty string = edit outer ring of {@link walkablePolygonId}; otherwise hole id under that polygon. */
    walkableHoleId = '';
    propId = '';
    hotspotId = '';
    regionId = '';
    roomPointId = '';
    private readonly listeners = new Set<() => void>();

    subscribe(fn: () => void): () => void {
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    }

    private notify(): void {
        for (const f of this.listeners) {
            f();
        }
    }

    setMode(m: EditToolbarMode): void {
        this.mode = m;
        this.notify();
    }

    setWalkablePolygonId(id: string): void {
        this.walkablePolygonId = id;
        this.walkableHoleId = '';
        this.notify();
    }

    /** Outer ring when `holeId` is empty. */
    setWalkableEditTarget(polygonId: string, holeId: string): void {
        this.walkablePolygonId = polygonId;
        this.walkableHoleId = holeId;
        this.notify();
    }

    setPropId(id: string): void {
        this.propId = id;
        this.notify();
    }

    setHotspotId(id: string): void {
        this.hotspotId = id;
        this.notify();
    }

    setRegionId(id: string): void {
        this.regionId = id;
        this.notify();
    }

    setRoomPointId(id: string): void {
        this.roomPointId = id;
        this.notify();
    }

    isEditing(): boolean {
        return this.mode !== 'navigate';
    }
}

export const polygonEditBridge = new PolygonEditBridgeImpl();
</file>

<file path="src/engine/directionalCharacterAnimation.ts">
import * as Phaser from 'phaser';
import { playCharacterAnimation, type CharacterAnimSprite } from './characterAnimationPlayback';

/** Matches Aseprite frame-tag suffix convention (IdleL, WalkDR, …). */
export type CharacterFacing = 'L' | 'R' | 'U' | 'D' | 'UL' | 'UR' | 'DL' | 'DR';

const SQRT1_2 = Math.SQRT1_2;

/** Screen-space unit dirs (y+ down). */
const FACING_UNIT: Record<CharacterFacing, [number, number]> = {
  R: [1, 0],
  DR: [SQRT1_2, SQRT1_2],
  D: [0, 1],
  DL: [-SQRT1_2, SQRT1_2],
  L: [-1, 0],
  UL: [-SQRT1_2, -SQRT1_2],
  U: [0, -1],
  UR: [SQRT1_2, -SQRT1_2],
};

/** Radians from +x toward +y (clockwise from R through D). */
const FACING_ANGLE_RAD: Record<CharacterFacing, number> = {
  R: 0,
  DR: Math.PI / 4,
  D: Math.PI / 2,
  DL: (3 * Math.PI) / 4,
  L: Math.PI,
  UL: (-3 * Math.PI) / 4,
  U: -Math.PI / 2,
  UR: -Math.PI / 4,
};

/** Authoring / stable tie-break order (matches `CharacterFacingLetter`). */
const ALL_FACINGS: CharacterFacing[] = ['L', 'R', 'U', 'D', 'UL', 'UR', 'DL', 'DR'];

function angleDistRad(a: number, b: number): number {
  let d = Math.abs(a - b) % (2 * Math.PI);
  if (d > Math.PI) {
    d = 2 * Math.PI - d;
  }
  return d;
}

/** Horizontal mirror partner for flipX fallbacks; U/D have none. */
export function mirrorHorizontalFacing(dir: CharacterFacing): CharacterFacing | null {
  switch (dir) {
    case 'L':
      return 'R';
    case 'R':
      return 'L';
    case 'UL':
      return 'UR';
    case 'UR':
      return 'UL';
    case 'DL':
      return 'DR';
    case 'DR':
      return 'DL';
    default:
      return null;
  }
}

function facingFallbackOrder(requested: CharacterFacing): CharacterFacing[] {
  const ra = FACING_ANGLE_RAD[requested];
  return [...ALL_FACINGS].sort((a, b) => {
    const da = angleDistRad(FACING_ANGLE_RAD[a], ra);
    const db = angleDistRad(FACING_ANGLE_RAD[b], ra);
    if (Math.abs(da - db) < 1e-9) {
      return ALL_FACINGS.indexOf(a) - ALL_FACINGS.indexOf(b);
    }
    return da - db;
  });
}

/** 8-way facing from a world movement vector (y+ is down on screen). */
export function facingFromWorldDelta(dx: number, dy: number): CharacterFacing {
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) {
    return 'D';
  }
  const nx = dx / len;
  const ny = dy / len;
  let best: CharacterFacing = 'D';
  let bestDot = -Infinity;
  for (const dir of ALL_FACINGS) {
    const [vx, vy] = FACING_UNIT[dir];
    const dot = nx * vx + ny * vy;
    if (dot > bestDot + 1e-9) {
      bestDot = dot;
      best = dir;
    }
  }
  return best;
}

export interface DirectionalCharacterSprite extends CharacterAnimSprite {
  playDirectionalAnimation(baseName: string, direction: CharacterFacing): void;
}

/**
 * Picks the first existing `Idle*` tag in a sensible default order (cardinals, then diagonals).
 */
export function resolveInitialIdleFacing(sprite: Phaser.GameObjects.Sprite): CharacterFacing {
  const order: CharacterFacing[] = ['R', 'D', 'L', 'U', 'DR', 'DL', 'UR', 'UL'];
  for (const dir of order) {
    if (sprite.anims.exists(`Idle${dir}`)) {
      return dir;
    }
  }
  return 'D';
}

const VALID_SPAWN_FACING = new Set<string>(ALL_FACINGS);

/**
 * Uses room placement `initialFacing` when valid; otherwise same fallback as {@link resolveInitialIdleFacing}.
 */
export function resolveSpawnIdleFacing(
  sprite: Phaser.GameObjects.Sprite,
  initialFacing: string | undefined,
): CharacterFacing {
  if (initialFacing !== undefined && VALID_SPAWN_FACING.has(initialFacing)) {
    return initialFacing as CharacterFacing;
  }
  return resolveInitialIdleFacing(sprite);
}

/**
 * Plays `<baseName><facing>` (e.g. `IdleR`). If that tag is missing, tries the next closest facing (by angle),
 * then horizontal mirror (L/R, UL/UR, DL/DR) with `setFlipX` when the mirrored tag exists.
 */
export function playDirectionalAnimation(
  sprite: Phaser.GameObjects.Sprite,
  baseName: string,
  direction: CharacterFacing,
): void {
  const tryPlay = (key: string, flipX: boolean): boolean => {
    if (!sprite.anims.exists(key)) {
      return false;
    }
    const anim = sprite.anims.get(key);
    if (!anim || anim.frames.length === 0) {
      console.warn(`[Benne] Animation '${key}' has no frames (check Aseprite JSON / Phaser frame keys).`);
      return false;
    }
    sprite.setFlipX(flipX);
    playCharacterAnimation(sprite, key);
    sprite.setData('facing', direction);
    sprite.setData('facingBase', baseName);
    return true;
  };

  for (const d of facingFallbackOrder(direction)) {
    if (tryPlay(`${baseName}${d}`, false)) {
      return;
    }
    const m = mirrorHorizontalFacing(d);
    if (m !== null && tryPlay(`${baseName}${m}`, true)) {
      return;
    }
  }
}

/**
 * Attaches `playDirectionalAnimation` on the sprite. Call after {@link setupCharacterAsepritePlayback}
 * so `playCharacterAnimation` is available.
 */
export function attachDirectionalAnimationApi(sprite: Phaser.GameObjects.Sprite): DirectionalCharacterSprite {
  const extended = sprite as DirectionalCharacterSprite;
  extended.playDirectionalAnimation = (baseName: string, direction: CharacterFacing): void => {
    playDirectionalAnimation(extended, baseName, direction);
  };
  return extended;
}
</file>

<file path="src/engine/gameState/GameStateManager.ts">
import * as Phaser from 'phaser';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry.js';
import type {
  BenneGameStateFlagValue,
  GameStateFlagChangedPayload,
  GameStateInventoryChangedPayload,
  GameStateReplacedPayload,
  GameStateVariableChangedPayload,
  SerializableBenneGameState,
} from '../../types/gameState.js';
import {
  GAME_STATE_FLAG_CHANGED_EVENT,
  GAME_STATE_INVENTORY_CHANGED_EVENT,
  GAME_STATE_REPLACED_EVENT,
  GAME_STATE_VARIABLE_CHANGED_EVENT,
} from '../../types/gameState.js';

export type GameStateInitialSlice = Partial<
  Pick<SerializableBenneGameState, 'flags' | 'variables' | 'inventory'>
>;

/** Accepts v1 map, legacy string[], or empty. */
export function normalizeSerializedInventory(raw: unknown): Record<string, number> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (k.length === 0) {
        continue;
      }
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) {
        continue;
      }
      const q = Math.floor(n);
      if (q > 0) {
        out[k] = q;
      }
    }
    return out;
  }
  if (Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const id of raw) {
      if (typeof id === 'string' && id.length > 0) {
        out[id] = (out[id] ?? 0) + 1;
      }
    }
    return out;
  }
  return {};
}

function cloneInventory(inv: Record<string, number>): Record<string, number> {
  return { ...inv };
}

function cloneSnapshot(state: SerializableBenneGameState): SerializableBenneGameState {
  return {
    version: 1,
    flags: { ...state.flags },
    variables: { ...state.variables },
    inventory: cloneInventory(state.inventory),
  };
}

function localStorageKey(slot: number): string {
  return `benne-save-${slot}`;
}

/**
 * Cross-room persistent state (flags, variables, inventory). Emits on the bus passed at construct time.
 */
export class GameStateManager {
  private readonly events: Phaser.Events.EventEmitter;
  private state: SerializableBenneGameState;

  constructor(events: Phaser.Events.EventEmitter, initial?: GameStateInitialSlice) {
    this.events = events;
    this.state = {
      version: 1,
      flags: initial?.flags != null ? { ...initial.flags } : {},
      variables: initial?.variables != null ? { ...initial.variables } : {},
      inventory: normalizeSerializedInventory(initial?.inventory),
    };
  }

  getSnapshot(): SerializableBenneGameState {
    return cloneSnapshot(this.state);
  }

  /**
   * Replaces in-memory state. Emits only {@link GAME_STATE_REPLACED_EVENT}.
   */
  applySnapshot(snapshot: SerializableBenneGameState): void {
    if (snapshot.version !== 1) {
      console.error(`[Benne] GameStateManager.applySnapshot: unsupported version ${snapshot.version}`);
      return;
    }
    this.state = {
      version: 1,
      flags: { ...snapshot.flags },
      variables: { ...snapshot.variables },
      inventory: normalizeSerializedInventory(snapshot.inventory),
    };
    const payload: GameStateReplacedPayload = { snapshot: this.getSnapshot() };
    this.events.emit(GAME_STATE_REPLACED_EVENT, payload);
  }

  exportSnapshotJson(): string {
    return JSON.stringify(this.getSnapshot());
  }

  importSnapshotJson(json: string): void {
    try {
      const parsed = JSON.parse(json) as SerializableBenneGameState & { inventory?: unknown };
      if (parsed && typeof parsed === 'object') {
        parsed.inventory = normalizeSerializedInventory(parsed.inventory);
      }
      this.applySnapshot(parsed as SerializableBenneGameState);
    } catch (err) {
      console.error('[Benne] GameStateManager.importSnapshotJson failed:', err);
    }
  }

  setFlag(key: string, value: BenneGameStateFlagValue): void {
    const previousValue = this.state.flags[key];
    this.state.flags[key] = value;
    const payload: GameStateFlagChangedPayload = { key, previousValue, value };
    this.events.emit(GAME_STATE_FLAG_CHANGED_EVENT, payload);
  }

  getFlag(key: string): BenneGameStateFlagValue | undefined {
    return this.state.flags[key];
  }

  hasFlag(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.state.flags, key);
  }

  clearFlag(key: string): void {
    if (!this.hasFlag(key)) {
      return;
    }
    const previousValue = this.state.flags[key];
    delete this.state.flags[key];
    const payload: GameStateFlagChangedPayload = { key, previousValue, value: undefined };
    this.events.emit(GAME_STATE_FLAG_CHANGED_EVENT, payload);
  }

  setVariable(key: string, value: unknown): void {
    const previousValue = this.state.variables[key];
    this.state.variables[key] = value;
    const payload: GameStateVariableChangedPayload = { key, previousValue, value };
    this.events.emit(GAME_STATE_VARIABLE_CHANGED_EVENT, payload);
  }

  getVariable(key: string): unknown {
    return this.state.variables[key];
  }

  hasVariable(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.state.variables, key);
  }

  clearVariable(key: string): void {
    if (!this.hasVariable(key)) {
      return;
    }
    const previousValue = this.state.variables[key];
    delete this.state.variables[key];
    const payload: GameStateVariableChangedPayload = { key, previousValue, value: undefined };
    this.events.emit(GAME_STATE_VARIABLE_CHANGED_EVENT, payload);
  }

  private emitInventory(reason: 'add' | 'remove' | 'clear', itemId?: string): void {
    const payload: GameStateInventoryChangedPayload = {
      reason,
      itemId,
      inventory: cloneInventory(this.state.inventory),
    };
    this.events.emit(GAME_STATE_INVENTORY_CHANGED_EVENT, payload);
  }

  /**
   * Adds inventory entries. Non-stackable definitions cap at quantity 1. Unknown ids default to non-stackable.
   */
  addInventory(itemId: string, quantity = 1): boolean {
    if (itemId.length === 0) {
      return false;
    }
    const q = Math.max(1, Math.floor(quantity));
    const def = getInventoryDefinition(itemId);
    const stackable = def?.stackable ?? false;
    const current = this.state.inventory[itemId] ?? 0;

    if (!stackable) {
      if (current >= 1) {
        return false;
      }
      this.state.inventory[itemId] = 1;
      this.emitInventory('add', itemId);
      return true;
    }

    this.state.inventory[itemId] = current + q;
    this.emitInventory('add', itemId);
    return true;
  }

  hasInInventory(itemId: string): boolean {
    return (this.state.inventory[itemId] ?? 0) > 0;
  }

  quantityOf(itemId: string): number {
    return this.state.inventory[itemId] ?? 0;
  }

  /**
   * Removes quantity (default 1). Non-stackable inventory entries are fully removed when present.
   */
  removeFromInventory(itemId: string, quantity = 1): boolean {
    if (itemId.length === 0) {
      return false;
    }
    const current = this.state.inventory[itemId] ?? 0;
    if (current <= 0) {
      return false;
    }
    const def = getInventoryDefinition(itemId);
    const stackable = def?.stackable ?? false;
    if (!stackable) {
      delete this.state.inventory[itemId];
      this.emitInventory('remove', itemId);
      return true;
    }
    const q = Math.max(1, Math.floor(quantity));
    const next = current - q;
    if (next <= 0) {
      delete this.state.inventory[itemId];
    } else {
      this.state.inventory[itemId] = next;
    }
    this.emitInventory('remove', itemId);
    return true;
  }

  clearInventory(): void {
    if (Object.keys(this.state.inventory).length === 0) {
      return;
    }
    this.state.inventory = {};
    this.emitInventory('clear');
  }

  /**
   * Returns inventory entries in **insertion order** (the order in which ids were first
   * added to state). `game-config.json`'s `initialGameState.inventory` array seeds the map
   * in that order, and subsequent `addInventory` calls append new ids to the end, so the
   * `inventoryPanel` GUI control renders items in the order the game author specified.
   */
  getInventoryItems(): ReadonlyArray<{ id: string; quantity: number }> {
    return Object.entries(this.state.inventory)
      .filter(([, q]) => q > 0)
      .map(([id, quantity]) => ({ id, quantity }));
  }

  saveToLocalStorage(slot = 0): void {
    try {
      localStorage.setItem(localStorageKey(slot), this.exportSnapshotJson());
    } catch (err) {
      console.error('[Benne] GameStateManager.saveToLocalStorage failed:', err);
    }
  }

  loadFromLocalStorage(slot = 0): boolean {
    try {
      const raw = localStorage.getItem(localStorageKey(slot));
      if (raw == null || raw.length === 0) {
        return false;
      }
      this.importSnapshotJson(raw);
      return true;
    } catch (err) {
      console.error('[Benne] GameStateManager.loadFromLocalStorage failed:', err);
      return false;
    }
  }

  clearLocalStorageSave(slot = 0): void {
    try {
      localStorage.removeItem(localStorageKey(slot));
    } catch (err) {
      console.error('[Benne] GameStateManager.clearLocalStorageSave failed:', err);
    }
  }
}
</file>

<file path="src/engine/verbs/dispatchVerb.ts">
import { getGameSettings } from '../ConfigManager';
import type { EventBus } from '../events/EventBus';
import type { VerbInteractTarget, VerbUnhandledPayload } from '../events/verbInteractionEvents';
import {
  VERB_GLOBAL_FALLBACK_EVENT,
  VERB_UNHANDLED_EVENT,
  characterVerbEventId,
  characterVerbFallbackEventId,
  globalVerbHandlerEventId,
  roomObjectVerbEventId,
  roomObjectVerbFallbackEventId,
} from '../events/verbInteractionEvents';

export type VerbHandlerMap = {
  onVerb: Record<string, boolean>;
  onVerbFallback: boolean;
};

function listenerCount(bus: EventBus, event: string): number {
  return bus.listeners(event).length;
}

function buildEmitPayload(target: VerbInteractTarget, verbId: string): Record<string, unknown> {
  switch (target.type) {
    case 'prop':
      return {
        propId: target.propId,
        roomId: target.roomId,
        tag: target.tag,
        description: target.description,
        verbId,
        ...(target.walkToPoint !== undefined ? { walkToPoint: target.walkToPoint } : {}),
        ...(target.lookAtPoint !== undefined ? { lookAtPoint: target.lookAtPoint } : {}),
      };
    case 'hotspot':
      return {
        hotspotId: target.hotspotId,
        roomId: target.roomId,
        description: target.description,
        verbId,
      };
    case 'character':
      return {
        characterId: target.characterId,
        instanceId: target.instanceId,
        roomId: target.roomId,
        description: target.description,
        verbId,
        ...(target.walkToPoint !== undefined ? { walkToPoint: target.walkToPoint } : {}),
        ...(target.talkPoint !== undefined ? { talkPoint: target.talkPoint } : {}),
      };
    default:
      return { verbId };
  }
}

/**
 * Dispatch order: object `onVerb[verbId]` → `onVerbFallback` → `verb:global:<verbId>` →
 * `verb:global:fallback` → `verb:unhandled` (+ dev `console.warn`).
 */
export function dispatchVerbInteraction(
  bus: EventBus,
  verbId: string,
  handlers: VerbHandlerMap,
  target: VerbInteractTarget,
): void {
  const settings = getGameSettings();
  const payload = buildEmitPayload(target, verbId);

  const supportsVerb = handlers.onVerb[verbId] === true;
  if (supportsVerb) {
    if (target.type === 'character') {
      const roomScoped = roomObjectVerbEventId(target, verbId);
      if (listenerCount(bus, roomScoped) > 0) {
        bus.emit(roomScoped, payload);
        return;
      }
      const globalCharacter = characterVerbEventId(target.characterId, verbId);
      if (listenerCount(bus, globalCharacter) > 0) {
        bus.emit(globalCharacter, payload);
        return;
      }
      bus.emit(roomScoped, payload);
      return;
    }
    bus.emit(roomObjectVerbEventId(target, verbId), payload);
    return;
  }

  if (handlers.onVerbFallback) {
    if (target.type === 'character') {
      const roomScopedFallback = roomObjectVerbFallbackEventId(target);
      if (listenerCount(bus, roomScopedFallback) > 0) {
        bus.emit(roomScopedFallback, { ...payload, verbFallback: true });
        return;
      }
      const globalCharacterFallback = characterVerbFallbackEventId(target.characterId);
      if (listenerCount(bus, globalCharacterFallback) > 0) {
        bus.emit(globalCharacterFallback, { ...payload, verbFallback: true });
        return;
      }
      bus.emit(roomScopedFallback, { ...payload, verbFallback: true });
      return;
    }
    bus.emit(roomObjectVerbFallbackEventId(target), { ...payload, verbFallback: true });
    return;
  }

  const globalVerb = globalVerbHandlerEventId(verbId);
  if (listenerCount(bus, globalVerb) > 0) {
    bus.emit(globalVerb, payload);
    return;
  }

  if (listenerCount(bus, VERB_GLOBAL_FALLBACK_EVENT) > 0) {
    bus.emit(VERB_GLOBAL_FALLBACK_EVENT, payload);
    return;
  }

  const fallbackLine = settings.defaultFallbackLine ?? "That doesn't work.";
  const unhandled: VerbUnhandledPayload = {
    verbId,
    target,
    fallbackLine,
  };
  bus.emit(VERB_UNHANDLED_EVENT, unhandled);

  if (import.meta.env.DEV) {
    console.warn(
      `[Benne] Unhandled verb "${verbId}" on ${target.type} (no object/global handler). Message: "${fallbackLine}"`,
      target,
    );
  }
}
</file>

<file path="src/game/characters/hank/hank.character.json">
{
  "id": "hank",
  "name": "Hank",
  "description": "",
  "walkSpeed": 88,
  "walkToPoint": {
    "x": -10,
    "y": 64
  },
  "talkPoint": {
    "x": 18,
    "y": 1
  },
  "clickable": false,
  "display": {
    "aseprite": true
  },
  "animations": {
    "IdleL": {
      "loop": true
    },
    "IdleD": {
      "loop": true
    },
    "IdleU": {
      "loop": true
    },
    "WalkL": {
      "loop": true
    },
    "WalkD": {
      "loop": true
    },
    "WalkU": {
      "loop": true
    },
    "TalkL": {
      "loop": true
    },
    "TalkD": {
      "loop": true
    },
    "TalkU": {
      "loop": true
    }
  },
  "feet": {
    "x": 18,
    "y": 61
  },
  "collider": {
    "points": [
      {
        "x": 8,
        "y": 64
      },
      {
        "x": 5,
        "y": 21
      },
      {
        "x": 10,
        "y": 3
      },
      {
        "x": 18,
        "y": 1
      },
      {
        "x": 26,
        "y": 3
      },
      {
        "x": 30,
        "y": 21
      },
      {
        "x": 29,
        "y": 64
      }
    ]
  },
  "onVerb": {
    "look": true,
    "use": true
  }
}
</file>

<file path="src/game/characters/henry/henry.character.ts">
import { registerCharacterScript } from '@engine/scripting';

/**
 * Character script for `henry` — Bennescript on this character’s global verb channel (room-scoped handlers win first).
 */
registerCharacterScript('henry', ({ B }) => {
  B.whenLookAt(() => {
    // TODO
  });
});
</file>

<file path="src/game/guis/dialog-text/dialog-text.gui.json">
{
  "id": "dialog-text",
  "name": "Dialog Text",
  "description": "",
  "visible": false,
  "display": {
    "aseprite": false
  },
  "controls": [
    {
      "type": "text",
      "id": "line",
      "x": 176,
      "y": 120,
      "text": "Even if a woodchuck could chuck wood and even if a woodchuck would chuck wood, should a woodchuck chuck wood?",
      "font": "lucasarts-scumm-solid",
      "fontSize": 8,
      "color": "#f5f5dc",
      "align": "center",
      "wordWrapWidth": 200
    }
  ]
}
</file>

<file path="src/game/inventory/Ladder/Ladder.inventory.ts">
import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Ladder', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;
});
</file>

<file path="src/game/resolveGameAssetUrl.ts">
/**
 * Resolves paths from room JSON (`images/...` under `src/game/assets/`) to Vite-built URLs.
 */
const imageUrls = import.meta.glob('./assets/**/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const jsonUrls = import.meta.glob('./assets/**/*.json', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const xmlUrls = import.meta.glob('./assets/**/*.xml', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function normalizeAssetPath(relativePath: string): string {
  return relativePath.replace(/^\.?\/+/, '').replaceAll('\\', '/');
}

export function resolveGameAssetUrl(relativePath: string): string {
  const normalized = normalizeAssetPath(relativePath);
  const key = `./assets/${normalized}`;
  const url = imageUrls[key];

  if (!url) {
    throw new Error(
      `Missing game asset '${relativePath}' (expected src/game/assets/${normalized}). Available: ${Object.keys(imageUrls).sort().join(', ')}`,
    );
  }

  return url;
}

/** Aseprite JSON exports and other data JSON under `src/game/assets/`. */
export function resolveGameAssetJsonUrl(relativePath: string): string {
  const normalized = normalizeAssetPath(relativePath);
  const key = `./assets/${normalized}`;
  const url = jsonUrls[key];

  if (!url) {
    throw new Error(
      `Missing JSON asset '${relativePath}' (expected src/game/assets/${normalized}). Available: ${Object.keys(jsonUrls).sort().join(', ')}`,
    );
  }

  return url;
}

/** BMFont XML and other `.xml` under `src/game/assets/` (paths like `fonts/MyFont.xml`). */
export function resolveGameAssetXmlUrl(relativePath: string): string {
  const normalized = normalizeAssetPath(relativePath);
  const key = `./assets/${normalized}`;
  const url = xmlUrls[key];

  if (!url) {
    throw new Error(
      `Missing XML asset '${relativePath}' (expected src/game/assets/${normalized}). Available: ${Object.keys(xmlUrls).sort().join(', ')}`,
    );
  }

  return url;
}
</file>

<file path="package.json">
{
  "name": "benne",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "build:room-preview": "tsc && vite build --config vite.room-preview.config.ts",
    "build:character-preview": "tsc && vite build --config vite.character-preview.config.ts",
    "build:gui-preview": "tsc && vite build --config vite.gui-preview.config.ts",
    "build:inventory-preview": "tsc && vite build --config vite.inventory-preview.config.ts",
    "preview": "vite preview"
  },
  "devDependencies": {
    "typescript": "~5.9.3",
    "vite": "^8.0.1"
  },
  "dependencies": {
    "phaser": "4.0.0-rc.7"
  }
}
</file>

<file path="src/editor/preview/polygonPatchTypes.ts">
export type Point2 = { x: number; y: number };

/** Serialized to the VS Code extension as Option A patch payloads. */
export type RoomPolygonPatch =
    | { kind: 'walkable'; polygonId: string; points: Point2[]; holeId?: string }
    | {
          kind: 'propCollider';
          propId: string;
          points: Point2[];
          walkToPoint: Point2;
          lookAtPoint: Point2;
      }
    | {
          kind: 'hotspotPolygon';
          hotspotId: string;
          points: Point2[];
          walkToPoint: Point2;
          lookAtPoint: Point2;
      }
    | { kind: 'regionPolygon'; regionId: string; points: Point2[] }
    | { kind: 'roomPoint'; pointId: string; x: number; y: number }
    | { kind: 'roomSize'; width: number; height: number }
    | { kind: 'scrollBounds'; x: number; y: number; width: number; height: number };
</file>

<file path="src/engine/events/verbInteractionEvents.ts">
import type { Point2 } from '../../types/room';

/** Emitted when no object handler, object fallback, or global handler consumes the verb. */
export const VERB_UNHANDLED_EVENT = 'verb:unhandled';

/** Ultimate global fallback after `verb:global:<verbId>`. */
export const VERB_GLOBAL_FALLBACK_EVENT = 'verb:global:fallback';

const VERB_GLOBAL_PREFIX = 'verb:global:';
const VERB_ROOM_PREFIX = 'verb:room:';
const VERB_CHARACTER_PREFIX = 'verb:character:';

/** `verb:global:<verbId>` — register here for default handling of a verb on any target. */
export function globalVerbHandlerEventId(verbId: string): string {
  return `${VERB_GLOBAL_PREFIX}${verbId}`;
}

function roomTargetTypeAndId(target: VerbInteractTarget): { targetType: string; targetId: string } {
  switch (target.type) {
    case 'prop':
      return { targetType: 'prop', targetId: target.propId };
    case 'hotspot':
      return { targetType: 'hotspot', targetId: target.hotspotId };
    case 'character':
      return { targetType: 'character', targetId: target.characterId };
  }
}

/** `verb:room:<roomId>:<targetType>:<targetId>:<verbId>` */
export function roomObjectVerbEventId(target: VerbInteractTarget, verbId: string): string {
  const x = roomTargetTypeAndId(target);
  return `${VERB_ROOM_PREFIX}${target.roomId}:${x.targetType}:${x.targetId}:${verbId}`;
}

/** `verb:room:<roomId>:<targetType>:<targetId>:fallback` */
export function roomObjectVerbFallbackEventId(target: VerbInteractTarget): string {
  const x = roomTargetTypeAndId(target);
  return `${VERB_ROOM_PREFIX}${target.roomId}:${x.targetType}:${x.targetId}:fallback`;
}

export function roomPropVerbEventId(roomId: string, propId: string, verbId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:prop:${propId}:${verbId}`;
}

export function roomHotspotVerbEventId(roomId: string, hotspotId: string, verbId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:hotspot:${hotspotId}:${verbId}`;
}

export function roomCharacterVerbEventId(roomId: string, characterId: string, verbId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:character:${characterId}:${verbId}`;
}

export function roomPropVerbFallbackEventId(roomId: string, propId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:prop:${propId}:fallback`;
}

export function roomHotspotVerbFallbackEventId(roomId: string, hotspotId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:hotspot:${hotspotId}:fallback`;
}

export function roomCharacterVerbFallbackEventId(roomId: string, characterId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:character:${characterId}:fallback`;
}

/** `verb:character:<characterId>:<verbId>` */
export function characterVerbEventId(characterId: string, verbId: string): string {
  return `${VERB_CHARACTER_PREFIX}${characterId}:${verbId}`;
}

/** `verb:character:<characterId>:fallback` */
export function characterVerbFallbackEventId(characterId: string): string {
  return `${VERB_CHARACTER_PREFIX}${characterId}:fallback`;
}

export type VerbInteractTarget =
  | {
      type: 'prop';
      propId: string;
      tag: string;
      roomId: string;
      description?: string;
      /** Optional hints from room JSON for script-driven walk/face (not applied by the engine on click). */
      walkToPoint?: Point2;
      lookAtPoint?: Point2;
    }
  | { type: 'hotspot'; hotspotId: string; roomId: string; description?: string }
  | {
      type: 'character';
      characterId: string;
      instanceId: string;
      roomId: string;
      description?: string;
      /** World / room pixel stand hint when `CharacterData.walkToPoint` is set (sprite origin + offset). */
      walkToPoint?: Point2;
      /** World / room pixel look-at hint when `CharacterData.talkPoint` is set (sprite origin + offset). */
      talkPoint?: Point2;
    };

/**
 * Payload for {@link VERB_GLOBAL_FALLBACK_EVENT} and {@link globalVerbHandlerEventId} emissions
 * (flat object from `dispatchVerb`; which optional ids are set depends on target type).
 */
export type VerbGlobalFallbackPayload = {
  verbId: string;
  roomId: string;
  description?: string;
  propId?: string;
  tag?: string;
  hotspotId?: string;
  characterId?: string;
  instanceId?: string;
  walkToPoint?: Point2;
  lookAtPoint?: Point2;
  talkPoint?: Point2;
  verbFallback?: boolean;
};

export type VerbUnhandledPayload = {
  verbId: string;
  target: VerbInteractTarget;
  fallbackLine: string;
};
</file>

<file path="src/engine/Game.ts">
import * as Phaser from 'phaser';
import { getGameSettings } from './ConfigManager.js';
import { gameEvents } from './events/EventBus.js';
import { GameStateManager, normalizeSerializedInventory } from './gameState/GameStateManager.js';
import { BENNE_GAME_STATE_REGISTRY_KEY } from './gameState/registryKey.js';
import { getBennePhaserGameConfigBase } from './gameConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { RoomScene } from './scenes/RoomScene.js';

/**
 * Full `Phaser.Types.Core.GameConfig` for the shipped runtime (scenes + shared renderer / scale
 * settings). Kept here — not in `gameConfig.ts` — so the scene imports stay out of the editor
 * preview bundles (see the `gameConfig.ts` module comment).
 */
function createGameConfig(parent: HTMLElement | string): Phaser.Types.Core.GameConfig {
  return {
    ...getBennePhaserGameConfigBase(parent),
    scene: [BootScene, RoomScene],
  };
}

/**
 * Creates the root {@link Phaser.Game} instance (Benne engine entry).
 * Resolution and scale mode come from `src/game/game-config.json` via {@link createGameConfig}.
 * Registers {@link GameStateManager} on `game.registry` for cross-room state.
 */
export function createBenneGame(parent: HTMLElement | string): Phaser.Game {
  const game = new Phaser.Game(createGameConfig(parent));
  const rawInit = getGameSettings().initialGameState;
  const initial =
    rawInit != null
      ? {
          flags: rawInit.flags,
          variables: rawInit.variables,
          inventory:
            rawInit.inventory !== undefined ? normalizeSerializedInventory(rawInit.inventory) : undefined,
        }
      : undefined;
  const gameState = new GameStateManager(gameEvents, initial);
  game.registry.set(BENNE_GAME_STATE_REGISTRY_KEY, gameState);
  return game;
}
</file>

<file path="src/engine/gameConfig.ts">
import * as Phaser from 'phaser';
import { getGameSettings } from './ConfigManager';

/**
 * Renderer / pixel-output fields that **must** stay identical between the shipped game and every
 * VS Code webview preview (room, GUI, character). Phaser 4's WebGL path renders `BitmapText` with
 * unreliable glyph output (wrapped dialogue looked uneven; in the room preview, fixed-to-camera
 * `BitmapText` lines produced no pixels at all even with `visible: true` and non-zero bounds), so
 * we standardise on `Phaser.CANVAS` + `roundPixels: true` across the whole editor surface.
 *
 * **Keep this module side-effect free** — previews import `getBenneRendererConfigFields` from
 * here, and if this file pulls in `BootScene` / `RoomScene` at the top level, Vite's eager
 * `import.meta.glob` calls in the shipped-game boot path (e.g. `resolveGameAssetUrl.ts`) would
 * copy every room / character / inventory PNG into all three preview bundles. Scene imports live
 * in `Game.ts` instead, where they're only pulled in by the shipped runtime entry.
 *
 * Keep this helper — not ad-hoc literals inside each preview entry point — as the single source of
 * truth (see `.cursor/rules/benne-preview-rendering-parity.mdc`).
 */
export function getBenneRendererConfigFields(): Pick<
  Phaser.Types.Core.GameConfig,
  'type' | 'backgroundColor' | 'pixelArt' | 'roundPixels' | 'antialias' | 'render'
> {
  return {
    type: Phaser.CANVAS,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    render: {
      powerPreference: 'high-performance',
    },
  };
}

/** Shared Phaser settings (resolution, scale, render) — scenes are added per entrypoint. */
export function getBennePhaserGameConfigBase(
  parent: HTMLElement | string,
): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
  const { width, height } = getGameSettings().resolution;

  return {
    ...getBenneRendererConfigFields(),
    parent,
    width,
    height,
    scale: {
      parent,
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width,
      height,
      zoom: Phaser.Scale.MAX_ZOOM,
      autoRound: true,
    },
  };
}
</file>

<file path="src/engine/walkable.ts">
import type { WalkablePolygon } from '../types/room';

/**
 * Ray-casting point-in-polygon test. Vertices are in room/world space (game pixels).
 */
export function pointInPolygon(
  px: number,
  py: number,
  vertices: readonly { x: number; y: number }[],
): boolean {
  if (vertices.length < 3) {
    return false;
  }

  let inside = false;
  for (let i = 0, len = vertices.length, j = len - 1; i < len; j = i++) {
    const vi = vertices[i]!;
    const vj = vertices[j]!;
    const yi = vi.y;
    const yj = vj.y;
    if ((yi > py) !== (yj > py)) {
      const xIntersect = ((vj.x - vi.x) * (py - yi)) / (yj - yi) + vi.x;
      if (px < xIntersect) {
        inside = !inside;
      }
    }
  }
  return inside;
}

function isActive(active: boolean | undefined): boolean {
  return active !== false;
}

/**
 * True when the point lies in the polygon’s outer ring and not inside any **active** hole.
 * Inactive polygons and inactive holes are ignored for subtraction.
 */
export function isPointInWalkablePolygon(
  x: number,
  y: number,
  poly: WalkablePolygon,
): boolean {
  if (!isActive(poly.active)) {
    return false;
  }
  if (!pointInPolygon(x, y, poly.points)) {
    return false;
  }
  for (const h of poly.holes ?? []) {
    if (!isActive(h.active) || h.points.length < 3) {
      continue;
    }
    if (pointInPolygon(x, y, h.points)) {
      return false;
    }
  }
  return true;
}

export function isPointInWalkableArea(
  x: number,
  y: number,
  polygons: readonly WalkablePolygon[],
): boolean {
  for (const poly of polygons) {
    if (isPointInWalkablePolygon(x, y, poly)) {
      return true;
    }
  }
  return false;
}

/** Closest point on segment AB to P (clamped). If A and B coincide, returns A. */
function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { x: number; y: number } {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq < 1e-18) {
    return { x: ax, y: ay };
  }
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + abx * t, y: ay + aby * t };
}

function distSq(px: number, py: number, qx: number, qy: number): number {
  const dx = px - qx;
  const dy = py - qy;
  return dx * dx + dy * dy;
}

/** Closest point on the closed polygon boundary (edges only). */
function closestPointOnPolygonBoundary(
  px: number,
  py: number,
  vertices: readonly { x: number; y: number }[],
): { x: number; y: number } | null {
  if (vertices.length < 3) {
    return null;
  }
  let bestX = 0;
  let bestY = 0;
  let bestD = Infinity;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % n]!;
    const q = closestPointOnSegment(px, py, a.x, a.y, b.x, b.y);
    const d = distSq(px, py, q.x, q.y);
    if (d < bestD) {
      bestD = d;
      bestX = q.x;
      bestY = q.y;
    }
  }
  return { x: bestX, y: bestY };
}

/**
 * Closest point in a filled simple polygon (interior ∪ boundary) to P.
 * If P is inside, returns P; otherwise the closest point lies on an edge.
 */
function closestPointInFilledPolygon(
  px: number,
  py: number,
  vertices: readonly { x: number; y: number }[],
): { x: number; y: number } | null {
  if (vertices.length < 3) {
    return null;
  }

  if (pointInPolygon(px, py, vertices)) {
    return { x: px, y: py };
  }

  return closestPointOnPolygonBoundary(px, py, vertices);
}

/**
 * Closest point in one walkable polygon’s outer ring minus active holes.
 */
function closestPointInWalkablePolygonRegion(
  px: number,
  py: number,
  poly: WalkablePolygon,
): { x: number; y: number } | null {
  if (!isActive(poly.active) || poly.points.length < 3) {
    return null;
  }

  if (isPointInWalkablePolygon(px, py, poly)) {
    return { x: px, y: py };
  }

  const inOuter = pointInPolygon(px, py, poly.points);

  if (inOuter) {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const h of poly.holes ?? []) {
      if (!isActive(h.active) || h.points.length < 3) {
        continue;
      }
      if (!pointInPolygon(px, py, h.points)) {
        continue;
      }
      const b = closestPointOnPolygonBoundary(px, py, h.points);
      if (!b) {
        continue;
      }
      const d = distSq(px, py, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (best) {
      return best;
    }
    return closestPointOnPolygonBoundary(px, py, poly.points);
  }

  return closestPointInFilledPolygon(px, py, poly.points);
}

/**
 * Closest point in the union of walkable polygons to P.
 * Picks the best candidate per polygon, then the smallest distance.
 *
 * **Limitation:** For overlapping polygons, the true closest point in the union can differ
 * from “best per polygon then min” in pathological overlaps; disjoint regions (typical rooms)
 * behave correctly.
 */
function closestPointInWalkableUnion(
  px: number,
  py: number,
  polygons: readonly WalkablePolygon[],
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const poly of polygons) {
    const c = closestPointInWalkablePolygonRegion(px, py, poly);
    if (!c) {
      continue;
    }
    const d = distSq(px, py, c.x, c.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/**
 * Resolves a walk target from a screen click in a forgiving, “classic adventure” way.
 *
 * **Intent (where the player wants to go on the floor mesh):**
 * - If the click lies inside any walkable polygon, the target is the click.
 * - Otherwise the target is the **closest point in the walkable union** to the click
 *   (per polygon: inside → click; outside → closest point on edges; then pick the nearest).
 *
 * **Starting position:**
 * - If the character is **inside** walkable, that intent point is the tween destination (always
 *   on or inside the mesh).
 * - If the character is **outside** walkable (e.g. spawn or cutscene placement), they still get
 *   the same intent target and may move in a straight line across non-walkable space until they
 *   reach the floor; once inside, later clicks keep using this mesh-aware resolution.
 *
 * `playerX` / `playerY` are the player’s **feet** in room space (see `CharacterData.feet`); kept for
 * a stable call signature — the current resolver ignores them but callers pass feet for future rules.
 *
 * @returns `null` only if there is no usable polygon geometry (e.g. all regions have fewer than
 *          three vertices).
 */
export function clampWalkDestinationTowardClick(
  playerX: number,
  playerY: number,
  clickX: number,
  clickY: number,
  polygons: readonly WalkablePolygon[],
): { x: number; y: number } | null {
  void playerX;
  void playerY;

  if (isPointInWalkableArea(clickX, clickY, polygons)) {
    return { x: clickX, y: clickY };
  }

  return closestPointInWalkableUnion(clickX, clickY, polygons);
}
</file>

<file path="src/game/characters/hank/hank.character.ts">
import { registerCharacterScript } from '@engine/scripting';

/**
 * Character script for `hank` — Bennescript on this character’s global verb channel (room-scoped handlers win first).
 */
registerCharacterScript('hank', ({ B }) => {
  B.whenLookAt(() => {
    // TODO
  });

  B.whenUse(() => {
    // TODO
  });
});
</file>

<file path="src/editor/preview/previewPolygonOverlay.ts">
import type { Cameras, Game } from 'phaser';
import type { Point2 } from '../../types/room';

/** Axis-aligned rect in world / game resolution space (same as room JSON). */
export type PreviewOverlayWorldRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type PreviewOverlayFilledUnderlay = {
  rects: ReadonlyArray<PreviewOverlayWorldRect>;
  fillStyle: string;
  /** Multiplier applied with {@link CanvasRenderingContext2D.globalAlpha} while filling. */
  fillAlpha: number;
};

export type PreviewOverlayRectCornerLabel = {
  rect: PreviewOverlayWorldRect;
  text: string;
};

export type PreviewStrokeRectOverlayExtras = {
  filledUnderlays?: ReadonlyArray<PreviewOverlayFilledUnderlay>;
  rectCornerLabels?: ReadonlyArray<PreviewOverlayRectCornerLabel>;
};

/** High-DPI 2D canvas aligned to the Phaser game canvas for editor chrome. */
export class PreviewPolygonOverlay {
    readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly ro: ResizeObserver;
    private readonly syncLayoutBound: () => void;
    private readonly game: Game;

    constructor(game: Game, mountEl: HTMLElement) {
        this.game = game;
        const canvas = document.createElement('canvas');
        canvas.className = 'benne-editor-polygon-overlay';
        canvas.style.position = 'absolute';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '10';
        canvas.style.touchAction = 'none';
        canvas.style.outline = 'none';
        /** So Delete/Backspace reach the overlay after pointer interaction (Phaser keyboard targets the game canvas below). */
        canvas.tabIndex = 0;
        canvas.setAttribute('aria-hidden', 'true');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('PreviewPolygonOverlay: 2d context unavailable');
        }
        this.canvas = canvas;
        this.ctx = ctx;
        mountEl.appendChild(canvas);

        this.syncLayoutBound = (): void => {
            this.syncLayout();
        };
        this.ro = new ResizeObserver(this.syncLayoutBound);
        this.ro.observe(mountEl);
        this.game.scale.on('resize', this.syncLayoutBound);
        this.syncLayout();
    }

    destroy(): void {
        this.ro.disconnect();
        this.game.scale.off('resize', this.syncLayoutBound);
        this.canvas.remove();
    }

    setPointerEventsEnabled(on: boolean): void {
        this.canvas.style.pointerEvents = on ? 'auto' : 'none';
    }

    syncLayout(): void {
        const c = this.game.canvas;
        if (!c?.parentElement) {
            return;
        }
        this.canvas.style.left = `${c.offsetLeft}px`;
        this.canvas.style.top = `${c.offsetTop}px`;
        const cssW = c.clientWidth;
        const cssH = c.clientHeight;
        this.canvas.style.width = `${cssW}px`;
        this.canvas.style.height = `${cssH}px`;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const bw = Math.max(1, Math.round(cssW * dpr));
        const bh = Math.max(1, Math.round(cssH * dpr));
        if (this.canvas.width !== bw || this.canvas.height !== bh) {
            this.canvas.width = bw;
            this.canvas.height = bh;
        }
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** Map pointer `pageX` / `pageY` to world coordinates (same space as room JSON). */
    domToWorld(
        pageX: number,
        pageY: number,
        cam: Cameras.Scene2D.Camera,
    ): { x: number; y: number } {
        this.game.scale.updateBounds();
        const px = this.game.scale.transformX(pageX);
        const py = this.game.scale.transformY(pageY);
        return cam.getWorldPoint(px, py);
    }

    /**
     * World point → overlay/CSS pixel offset relative to game canvas top-left.
     *
     * Mirrors the transform Phaser 4's `Camera.preRender` applies:
     *   screen = zoom * (world − scroll − origin) + origin + cam.offset
     *
     * Phaser 4 cameras default to `originX = originY = 0.5` (zoom from the viewport
     * centre), so the simple `(world − scroll) * zoom` formula is only correct when
     * zoom = 1. When the editor zooms out to show a large room, the origin correction
     * `origin * (1 − zoom)` is essential to keep handles aligned with the Phaser
     * render output.
     */
    worldToCanvasCss(p: Point2, cam: Cameras.Scene2D.Camera): { x: number; y: number } {
        const sx = this.game.scale.displayScale.x;
        const sy = this.game.scale.displayScale.y;
        const originX = cam.width * cam.originX;
        const originY = cam.height * cam.originY;
        const screenX = cam.zoomX * (p.x - cam.scrollX - originX) + originX + cam.x;
        const screenY = cam.zoomY * (p.y - cam.scrollY - originY) + originY + cam.y;
        return {
            x: screenX / sx,
            y: screenY / sy,
        };
    }

    clearAndDraw(state: {
        pts: Point2[];
        strokeStyle: string;
        handleFill: string;
        handleStroke: string;
        selectedIndex: number | null;
        handleRadiusCss: number;
        lineWidthCss: number;
        /** Prop editor: walk / look markers drawn above the collider. */
        labeledPoints?: {
            point: Point2;
            label: string;
            fillStyle: string;
            strokeStyle: string;
            selected: boolean;
            radiusCss: number;
        }[];
    }, cam: Cameras.Scene2D.Camera): void {
        const c = this.game.canvas;
        const cssW = c.clientWidth;
        const cssH = c.clientHeight;
        this.ctx.clearRect(0, 0, cssW, cssH);
        const { pts } = state;
        const extras = state.labeledPoints;
        if (pts.length === 0 && (!extras || extras.length === 0)) {
            return;
        }

        if (pts.length >= 2) {
            this.ctx.strokeStyle = state.strokeStyle;
            this.ctx.lineWidth = state.lineWidthCss;
            this.ctx.lineJoin = 'round';
            this.ctx.lineCap = 'round';
            this.ctx.globalAlpha = 0.95;
            this.ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
                const q = this.worldToCanvasCss(pts[i]!, cam);
                if (i === 0) {
                    this.ctx.moveTo(q.x, q.y);
                } else {
                    this.ctx.lineTo(q.x, q.y);
                }
            }
            if (pts.length >= 3) {
                this.ctx.closePath();
            }
            this.ctx.stroke();
        }

        for (let i = 0; i < pts.length; i++) {
            const q = this.worldToCanvasCss(pts[i]!, cam);
            const sel = i === state.selectedIndex;
            const r = sel ? state.handleRadiusCss + 2 : state.handleRadiusCss;
            this.ctx.beginPath();
            this.ctx.fillStyle = sel ? '#ffffff' : state.handleFill;
            this.ctx.strokeStyle = state.handleStroke;
            this.ctx.lineWidth = 1;
            this.ctx.globalAlpha = 0.95;
            this.ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 0.5;
            this.ctx.stroke();
        }

        if (extras && extras.length > 0) {
            this.ctx.font = '600 11px system-ui, -apple-system, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            for (const lp of extras) {
                const q = this.worldToCanvasCss(lp.point, cam);
                const r = lp.selected ? lp.radiusCss + 2 : lp.radiusCss;
                this.ctx.beginPath();
                this.ctx.fillStyle = lp.selected ? '#ffffff' : lp.fillStyle;
                this.ctx.strokeStyle = lp.strokeStyle;
                this.ctx.lineWidth = 1;
                this.ctx.globalAlpha = 0.95;
                this.ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.globalAlpha = 0.55;
                this.ctx.stroke();
                this.ctx.globalAlpha = 1;
                const ty = q.y - r - 5;
                this.ctx.lineWidth = 3;
                this.ctx.strokeStyle = 'rgba(0,0,0,0.82)';
                this.ctx.strokeText(lp.label, q.x, ty);
                this.ctx.fillStyle = '#f2f6ff';
                this.ctx.fillText(lp.label, q.x, ty);
            }
        }
        this.ctx.globalAlpha = 1;
    }

    /**
     * Clear the overlay and draw an interactive rectangle with 8 resize handles.
     *
     * Handles are numbered clockwise from the top-left corner:
     * ```
     * 0 ─ 1 ─ 2
     * │       │
     * 7       3
     * │       │
     * 6 ─ 5 ─ 4
     * ```
     * `lockedHandles` — indices whose handles are drawn dimmed and cannot be interacted with
     * (used for `roomSize` where the top-left origin is always 0,0).
     */
    clearAndDrawRect(state: {
        rect: { left: number; top: number; right: number; bottom: number };
        strokeStyle: string;
        fillStyle: string;
        handleFill: string;
        handleStroke: string;
        selectedHandleIndex: number | null;
        lockedHandles: ReadonlySet<number>;
        handleRadiusCss: number;
        lineWidthCss: number;
    }, cam: Cameras.Scene2D.Camera): void {
        const c = this.game.canvas;
        const cssW = c.clientWidth;
        const cssH = c.clientHeight;
        this.ctx.clearRect(0, 0, cssW, cssH);

        const { rect } = state;
        const tl = this.worldToCanvasCss({ x: rect.left, y: rect.top }, cam);
        const br = this.worldToCanvasCss({ x: rect.right, y: rect.bottom }, cam);
        const rw = br.x - tl.x;
        const rh = br.y - tl.y;

        // Semi-transparent fill
        this.ctx.fillStyle = state.fillStyle;
        this.ctx.globalAlpha = 0.12;
        this.ctx.fillRect(tl.x, tl.y, rw, rh);

        // Border stroke
        this.ctx.strokeStyle = state.strokeStyle;
        this.ctx.lineWidth = state.lineWidthCss;
        this.ctx.lineJoin = 'round';
        this.ctx.globalAlpha = 0.9;
        this.ctx.strokeRect(tl.x, tl.y, rw, rh);

        // 8 handle positions in world space → CSS
        const midX = (rect.left + rect.right) / 2;
        const midY = (rect.top + rect.bottom) / 2;
        const worldHandles: { x: number; y: number }[] = [
            { x: rect.left,  y: rect.top    },  // 0 top-left
            { x: midX,       y: rect.top    },  // 1 top-mid
            { x: rect.right, y: rect.top    },  // 2 top-right
            { x: rect.right, y: midY        },  // 3 mid-right
            { x: rect.right, y: rect.bottom },  // 4 bottom-right
            { x: midX,       y: rect.bottom },  // 5 bottom-mid
            { x: rect.left,  y: rect.bottom },  // 6 bottom-left
            { x: rect.left,  y: midY        },  // 7 mid-left
        ];

        for (let i = 0; i < 8; i++) {
            const q = this.worldToCanvasCss(worldHandles[i]!, cam);
            const sel = i === state.selectedHandleIndex;
            const locked = state.lockedHandles.has(i);
            const r = sel ? state.handleRadiusCss + 2 : state.handleRadiusCss;

            this.ctx.beginPath();
            this.ctx.fillStyle = sel ? '#ffffff' : locked ? '#888888' : state.handleFill;
            this.ctx.strokeStyle = state.handleStroke;
            this.ctx.lineWidth = 1;
            this.ctx.globalAlpha = locked ? 0.35 : 0.95;
            this.ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = locked ? 0.2 : 0.5;
            this.ctx.stroke();
        }

        this.ctx.globalAlpha = 1;
    }

    /**
     * Stroke-only axis-aligned rects in world space — same stroke path as {@link clearAndDrawRect}
     * border (no fill, no resize handles). Used e.g. for GUI `inventoryPanel` slot frames in the editor.
     */
    clearAndDrawStrokeRects(
        rects: ReadonlyArray<{ left: number; top: number; right: number; bottom: number }>,
        cam: Cameras.Scene2D.Camera,
        style: { strokeStyle: string; lineWidthCss: number },
        extras?: PreviewStrokeRectOverlayExtras,
    ): void {
        this.clearAndDrawStrokeRectGroups(
            [{ rects, strokeStyle: style.strokeStyle, lineWidthCss: style.lineWidthCss }],
            cam,
            extras,
        );
    }

    /**
     * Multiple stroke batches (clears once, then draws each group with its own style/width).
     */
    clearAndDrawStrokeRectGroups(
        groups: ReadonlyArray<{
            rects: ReadonlyArray<{ left: number; top: number; right: number; bottom: number }>;
            strokeStyle: string;
            lineWidthCss: number;
        }>,
        cam: Cameras.Scene2D.Camera,
        extras?: PreviewStrokeRectOverlayExtras,
    ): void {
        const c = this.game.canvas;
        const cssW = c.clientWidth;
        const cssH = c.clientHeight;
        this.ctx.clearRect(0, 0, cssW, cssH);

        if (extras?.filledUnderlays) {
            for (const u of extras.filledUnderlays) {
                if (u.rects.length === 0) {
                    continue;
                }
                this.ctx.fillStyle = u.fillStyle;
                this.ctx.globalAlpha = u.fillAlpha;
                for (const rect of u.rects) {
                    const tl = this.worldToCanvasCss({ x: rect.left, y: rect.top }, cam);
                    const br = this.worldToCanvasCss({ x: rect.right, y: rect.bottom }, cam);
                    const rw = br.x - tl.x;
                    const rh = br.y - tl.y;
                    this.ctx.fillRect(tl.x, tl.y, rw, rh);
                }
            }
            this.ctx.globalAlpha = 1;
        }

        for (const g of groups) {
            if (g.rects.length === 0) {
                continue;
            }
            this.ctx.strokeStyle = g.strokeStyle;
            this.ctx.lineWidth = g.lineWidthCss;
            this.ctx.lineJoin = 'round';
            this.ctx.globalAlpha = 0.9;
            for (const rect of g.rects) {
                const tl = this.worldToCanvasCss({ x: rect.left, y: rect.top }, cam);
                const br = this.worldToCanvasCss({ x: rect.right, y: rect.bottom }, cam);
                const rw = br.x - tl.x;
                const rh = br.y - tl.y;
                this.ctx.strokeRect(tl.x, tl.y, rw, rh);
            }
        }

        const labels = extras?.rectCornerLabels;
        if (labels && labels.length > 0) {
            this.ctx.font = '600 10px system-ui, -apple-system, sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';
            for (const lb of labels) {
                const { rect } = lb;
                const corner = this.worldToCanvasCss({ x: rect.left, y: rect.top }, cam);
                const x = corner.x + 3;
                const y = corner.y + 3;
                this.ctx.lineWidth = 3;
                this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.78)';
                this.ctx.globalAlpha = 1;
                this.ctx.strokeText(lb.text, x, y);
                this.ctx.fillStyle = '#fff5fb';
                this.ctx.fillText(lb.text, x, y);
            }
        }

        this.ctx.globalAlpha = 1;
    }
}
</file>

<file path="src/engine/events/propInteractionEvents.ts">
import type { Point2 } from '../../types/room';

/**
 * Payload for prop interaction events (verb-enabled props in room JSON).
 * Handlers subscribe to canonical scoped event ids from `verbInteractionEvents.ts`.
 */
export type RoomPropInteractPayload = {
  propId: string;
  roomId: string;
  /** Aseprite tag / animation name for this prop instance. */
  tag: string;
  description?: string;
  /** Optional room JSON hints for script-driven movement/facing toward this prop. */
  walkToPoint?: Point2;
  lookAtPoint?: Point2;
  /** Which verb was used (`game-config.json` `verbs[].id`). */
  verbId: string;
  /** True when this run used the prop’s `onVerbFallback` handler. */
  verbFallback?: boolean;
};

/**
 * Payload for hotspot interaction events (verb-enabled `RoomHotspotData`).
 */
export type RoomHotspotInteractPayload = {
  hotspotId: string;
  roomId: string;
  description?: string;
  verbId: string;
  verbFallback?: boolean;
};

/**
 * Payload for character interaction events (verb-enabled `CharacterData`).
 */
export type CharacterVerbInteractPayload = {
  characterId: string;
  instanceId: string;
  roomId: string;
  description?: string;
  verbId: string;
  verbFallback?: boolean;
  /** World coordinates when character JSON defines `walkToPoint` (frame offset applied at click time). */
  walkToPoint?: Point2;
  /** World coordinates when character JSON defines `talkPoint` (frame offset applied at click time). */
  talkPoint?: Point2;
};
</file>

<file path="src/engine/scripting/types.ts">
import type * as Phaser from 'phaser';
import type { RoomScene } from '../scenes/RoomScene.js';
import type { BenneScript } from './BenneScript.js';
import type { CharacterBenneScript } from './CharacterBenneScript.js';
import type { InventoryBenneScript } from './InventoryBenneScript.js';
import type { GlobalBenneScript } from './GlobalBenneScript.js';
import type { GuiBenneScript } from './GuiBenneScript.js';

export interface RoomScriptContext {
  /**
   * Main authoring facade (`whenLookAt`, `B.player.walkTo`, …).
   * String ids for verb sugar (prop → hotspot → character), `walkTo`, and prop-only helpers are documented in the **module comment** at the top of `BenneScript.ts`.
   */
  readonly B: BenneScript;

  /** Raw access (advanced use only) */
  readonly events: Phaser.Events.EventEmitter;
  readonly roomId: string;
  readonly roomScene: RoomScene;

  // Convenience re-exports so you can write `onProp` directly inside the callback
  onProp: BenneScript['onProp'];
  whenLookAt: BenneScript['whenLookAt'];
  whenUse: BenneScript['whenUse'];
  whenPickUp: BenneScript['whenPickUp'];
  whenGive: BenneScript['whenGive'];
  whenPush: BenneScript['whenPush'];
  whenPull: BenneScript['whenPull'];
  whenOpen: BenneScript['whenOpen'];
  whenClose: BenneScript['whenClose'];
  whenVerb: BenneScript['whenVerb'];
  whenTalkTo: BenneScript['whenTalkTo'];
}

/** Context passed to each `registerCharacterScript` callback when that character is spawned in the active room. */
export interface CharacterScriptContext {
  /** Self-only verb sugar (`whenLookAt(() => …)`); uses `characterVerbEventId` only. */
  readonly B: CharacterBenneScript;
  readonly events: Phaser.Events.EventEmitter;
  readonly characterId: string;
  readonly roomId: string;
  readonly roomScene: RoomScene;
}

/** Context passed to each `registerInventoryScript` callback when a room is active. */
export interface InventoryScriptContext {
  /** Item-scoped verb sugar (`whenLookAt(() => …)`); subscribes to room + global inventory verb ids. */
  readonly B: InventoryBenneScript;
  readonly events: Phaser.Events.EventEmitter;
  readonly itemId: string;
  readonly roomId: string;
  readonly roomScene: RoomScene;
}

/** Passed to each `registerGlobalScript` callback from {@link import('./wireBenneGlobalScripts.js').wireBenneGlobalScripts}. */
export interface GlobalScriptContext {
  readonly B: GlobalBenneScript;
  readonly events: Phaser.Events.EventEmitter;
  readonly game: Phaser.Game;
}

/** Passed to each `registerGuiScript` callback when content is registered. */
export interface GuiScriptContext {
  readonly B: GuiBenneScript;
  readonly events: Phaser.Events.EventEmitter;
  readonly guiId: string;
}
</file>

<file path="src/game/collectFontLoadsForGui.ts">
import type { GameFontsManifest } from '../types/fonts';
import type { GuiData } from '../types/gui';

export type GuiFontLoadRequest = { fontId: string; textureUrl: string; dataUrl: string };

/**
 * Bitmap font files to load for one GUI's `text` controls (deduped by font id).
 * `resolveAssetUrl` maps paths under `src/game/assets/` to a fetchable URL.
 */
export function collectFontLoadsForGui(
  gui: GuiData,
  manifest: GameFontsManifest,
  resolveAssetUrl: (pathUnderAssets: string) => string,
): GuiFontLoadRequest[] {
  const out: GuiFontLoadRequest[] = [];
  const seen = new Set<string>();
  for (const c of gui.controls ?? []) {
    if (c.type !== 'text' && c.type !== 'button') {
      continue;
    }
    if (seen.has(c.font)) {
      continue;
    }
    seen.add(c.font);
    const def = manifest[c.font];
    if (!def) {
      console.warn(`[BENNE GUI preview] Unknown font id "${c.font}" — add it to assets/fonts/fonts.json.`);
      continue;
    }
    try {
      out.push({
        fontId: c.font,
        textureUrl: resolveAssetUrl(`fonts/${def.textureFile}`),
        dataUrl: resolveAssetUrl(`fonts/${def.dataFile}`),
      });
    } catch (e) {
      console.warn(`[BENNE GUI preview] Could not resolve font files for "${c.font}":`, e);
    }
  }
  return out;
}

export function guiHasTextControls(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c) => c.type === 'text');
}

export function guiHasImageControls(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c) => c.type === 'image');
}

export function guiHasButtonControls(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c) => c.type === 'button');
}

export function guiHasTriggerControls(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c) => c.type === 'trigger');
}
</file>

<file path="src/game/globalScript.ts">
import { registerGlobalScript } from '@engine/scripting';
import type { VerbGlobalFallbackPayload, VerbUnhandledPayload } from '@engine/events/verbInteractionEvents';

/**
 * Handlers for events that are not tied to a single room (inventory, UI, global flags, verbs, etc.).
 *
 * Verb fallback chain (engine): object scoped handler (room/character channels) → object fallback →
 * `verb:global:<id>` → `verb:global:fallback` → `verb:unhandled`.
 */
registerGlobalScript(({ B }) => {
  B.whenGlobalFallback((payload: VerbGlobalFallbackPayload) => {
    if (payload.verbId === 'use') {
      console.log("I can't use that.");
    } else if (payload.verbId === 'look') {
      console.log('It looks like nothing.');
    }
  });

  B.whenVerbUnhandled((p: VerbUnhandledPayload) => {
    if (import.meta.env.DEV) {
      console.info(`[Benne] verb:unhandled → "${p.fallbackLine}"`, p.target);
    }
  });
});
</file>

<file path="src/game/guis/inventoryBar/inventoryBar.gui.ts">
import { registerGuiScript } from '@engine/scripting';

registerGuiScript('inventoryBar', ({ B }) => {
  B.onGuiBuilt((gui) => {
    const root = gui.root;

    B.whenMouseEnter('hoverZone', () => {
      root.tweenTo({ y: 0 }, 300, 'Sine.easeOut');
    });

    B.whenMouseLeave('hideZone', () => {
      root.tweenTo({ y: -33 }, 250, 'Sine.easeIn');
    });
  });

  B.whenButtonClick('back', () => {
    console.log('Back button clicked');
  });

  B.whenButtonClick('Fwd', () => {
    console.log('Forward button clicked');
  });
});
</file>

<file path="src/game/loadAsepriteAtlasData.ts">
import { normalizeAsepriteJsonForPhaser } from './normalizeAsepriteJson';

const characterJsonModules = import.meta.glob('./assets/images/characters/**/*.json', {
  eager: true,
}) as Record<string, { default?: Record<string, unknown> } | Record<string, unknown>>;

const roomJsonModules = import.meta.glob('./assets/images/rooms/**/*.json', {
  eager: true,
}) as Record<string, { default?: Record<string, unknown> } | Record<string, unknown>>;

/** Aseprite sheets for collectibles / inventory UI: `images/inventory/<id>/<id>.json` + `.png` (same layout as characters). */
const inventoryJsonModules = import.meta.glob('./assets/images/inventory/**/*.json', {
  eager: true,
}) as Record<string, { default?: Record<string, unknown> } | Record<string, unknown>>;

/** GUI overlay sheets: `images/guis/<id>/<id>.json` + `.png`. */
const guiJsonModules = import.meta.glob('./assets/images/guis/**/*.json', {
  eager: true,
}) as Record<string, { default?: Record<string, unknown> } | Record<string, unknown>>;

const CURSOR_JSON_KEY = './assets/images/cursor/cursor.json';

const cursorJsonModules = import.meta.glob('./assets/images/cursor/cursor.json', {
  eager: true,
}) as Record<string, { default?: Record<string, unknown> } | Record<string, unknown>>;

const SHARED_INVENTORY_JSON_KEY = './assets/images/inventory/inventory.json';

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
      return `./assets/images/characters/${id}/${id}.json`;
    case 'room':
      return `./assets/images/rooms/${id}/${id}.json`;
    case 'inventory':
      return `./assets/images/inventory/${id}/${id}.json`;
    case 'gui':
      return `./assets/images/guis/${id}/${id}.json`;
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

/**
 * Loads bundled Aseprite JSON for `images/rooms/<roomId>/<roomId>.json` (same normalization as characters).
 */
export function getNormalizedRoomAsepriteAtlasData(roomId: string): Record<string, unknown> {
  return normalizeAsepriteJsonForPhaser(getBundledAsepriteRawJson('room', roomId)) as Record<string, unknown>;
}

/**
 * Loads bundled Aseprite JSON for `images/inventory/<id>/<id>.json` (same normalization as characters).
 */
export function getNormalizedInventoryAsepriteAtlasData(inventoryId: string): Record<string, unknown> {
  return normalizeAsepriteJsonForPhaser(getBundledAsepriteRawJson('inventory', inventoryId)) as Record<string, unknown>;
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

/**
 * Loads bundled Aseprite JSON for `images/guis/<id>/<id>.json` (same normalization as characters).
 */
export function getNormalizedGuiAsepriteAtlasData(guiId: string): Record<string, unknown> {
  return normalizeAsepriteJsonForPhaser(getBundledAsepriteRawJson('gui', guiId)) as Record<string, unknown>;
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

export function getNormalizedCursorAsepriteAtlasData(): Record<string, unknown> {
  return normalizeAsepriteJsonForPhaser(getBundledCursorAsepriteRawJson()) as Record<string, unknown>;
}

/** Frame-tag names on the bundled cursor sheet (`images/cursor/cursor.json`). */
export function getCursorAsepriteFrameTagNames(): readonly string[] {
  return readAsepriteFrameTagNamesFromRawJson(getBundledCursorAsepriteRawJson());
}
</file>

<file path="src/game/rooms/apartment/apartment.room.json">
{
  "id": "apartment",
  "name": "Apartment",
  "size": {
    "width": 320,
    "height": 180
  },
  "scrollBounds": {
    "x": 0,
    "y": 0,
    "width": 320,
    "height": 180
  },
  "walkable": {
    "polygons": [
      {
        "id": "walk-1",
        "active": true,
        "points": [
          {
            "x": 50,
            "y": 131
          },
          {
            "x": 10,
            "y": 171
          },
          {
            "x": 39,
            "y": 171
          },
          {
            "x": 69,
            "y": 144
          },
          {
            "x": 104,
            "y": 144
          },
          {
            "x": 116,
            "y": 159
          },
          {
            "x": 83,
            "y": 161
          },
          {
            "x": 84,
            "y": 151
          },
          {
            "x": 71,
            "y": 152
          },
          {
            "x": 70,
            "y": 171
          },
          {
            "x": 304,
            "y": 167
          },
          {
            "x": 258,
            "y": 120
          },
          {
            "x": 137,
            "y": 121
          },
          {
            "x": 123,
            "y": 131
          }
        ],
        "holes": [
          {
            "id": "hole-1",
            "active": true,
            "points": [
              {
                "x": 151,
                "y": 151
              },
              {
                "x": 159,
                "y": 160
              },
              {
                "x": 197,
                "y": 160
              },
              {
                "x": 206,
                "y": 152
              },
              {
                "x": 198,
                "y": 140
              },
              {
                "x": 158,
                "y": 140
              }
            ]
          }
        ]
      }
    ]
  },
  "hotspots": [],
  "points": [],
  "regions": [],
  "props": [
    {
      "id": "BG",
      "tag": "BG",
      "animations": {
        "BG": {}
      },
      "zIndex": 0,
      "visible": true,
      "alpha": 1
    },
    {
      "id": "Fan",
      "tag": "Fan",
      "animations": {
        "Fan": {
          "loop": true
        }
      },
      "zIndex": 1,
      "visible": true,
      "alpha": 1
    },
    {
      "id": "Couch",
      "tag": "Couch",
      "animations": {
        "Couch": {}
      },
      "zIndex": 2,
      "visible": true,
      "alpha": 1,
      "clickable": true,
      "collider": {
        "points": [
          {
            "x": 56,
            "y": 98
          },
          {
            "x": 58,
            "y": 85
          },
          {
            "x": 70,
            "y": 83
          },
          {
            "x": 122,
            "y": 82
          },
          {
            "x": 131,
            "y": 87
          },
          {
            "x": 130,
            "y": 99
          },
          {
            "x": 134,
            "y": 102
          },
          {
            "x": 135,
            "y": 121
          },
          {
            "x": 128,
            "y": 128
          },
          {
            "x": 50,
            "y": 129
          },
          {
            "x": 44,
            "y": 109
          }
        ]
      },
      "walkToPoint": {
        "x": 101,
        "y": 133
      },
      "lookAtPoint": {
        "x": 88,
        "y": 126
      }
    },
    {
      "id": "Door",
      "tag": "Door",
      "animations": {
        "Door": {},
        "Door-open": {}
      },
      "zIndex": 3,
      "visible": true,
      "alpha": 1,
      "clickable": true,
      "collider": {
        "points": [
          {
            "x": 271,
            "y": 63
          },
          {
            "x": 293,
            "y": 72
          },
          {
            "x": 291,
            "y": 143
          },
          {
            "x": 270,
            "y": 126
          }
        ]
      },
      "walkToPoint": {
        "x": 268,
        "y": 133
      },
      "lookAtPoint": {
        "x": 279,
        "y": 129
      }
    },
    {
      "id": "Pillar",
      "tag": "Pillar",
      "animations": {
        "Pillar": {}
      },
      "zIndex": 4,
      "visible": true,
      "alpha": 1,
      "clickable": true,
      "collider": {
        "points": [
          {
            "x": 155,
            "y": 102
          },
          {
            "x": 155,
            "y": 151
          },
          {
            "x": 167,
            "y": 159
          },
          {
            "x": 195,
            "y": 158
          },
          {
            "x": 203,
            "y": 151
          },
          {
            "x": 203,
            "y": 100
          },
          {
            "x": 190,
            "y": 94
          },
          {
            "x": 164,
            "y": 95
          }
        ]
      },
      "walkToPoint": {
        "x": 145,
        "y": 154
      },
      "lookAtPoint": {
        "x": 178,
        "y": 154
      }
    }
  ],
  "characters": [
    {
      "instanceId": "hank-1",
      "definition": "hank/hank.character.json",
      "x": 176,
      "y": 99,
      "initialFacing": "L",
      "initialAnimation": "Idle",
      "visible": true,
      "zIndex": 0
    }
  ]
}
</file>

<file path="src/game/rooms/rooms.manifest.json">
{
  "startRoomId": "office",
  "rooms": [
    {
      "id": "apartment",
      "definition": "apartment/apartment.room.json"
    },
    {
      "id": "bathroom",
      "definition": "bathroom/bathroom.room.json"
    },
    {
      "id": "diningRoom",
      "definition": "diningRoom/diningRoom.room.json"
    },
    {
      "id": "garage",
      "definition": "garage/garage.room.json"
    },
    {
      "id": "office",
      "definition": "office/office.room.json"
    },
    {
      "id": "outside",
      "definition": "outside/outside.room.json"
    },
    {
      "id": "outsideOffice",
      "definition": "outsideOffice/outsideOffice.room.json"
    }
  ]
}
</file>

<file path="src/editor/preview/RoomPolygonEditScene.ts">
import * as Phaser from 'phaser';
import { getInternalHeight, getInternalWidth, SCENE_ROOM } from '../../game/constants';
import type { RoomScene } from '../../engine/scenes/RoomScene';
import type {
    Point2,
    RoomData,
    RoomHotspotData,
    RoomPointData,
    RoomPropInstance,
    RoomRegionData,
} from '../../types/room';
import { polygonEditBridge } from './polygonEditBridge';
import { PreviewPolygonOverlay } from './previewPolygonOverlay';
import type { RoomPolygonPatch } from './polygonPatchTypes';

export const BENNE_POLYGON_EDIT_SCENE = 'BennePolygonEdit';

/** Handle hit radius in CSS pixels (overlay is high-DPI; this stays comfortable on screen). */
const HANDLE_R_CSS = 6;
/** Walk / look markers: slightly larger for picking. */
const AUX_HANDLE_R_CSS = 7;
const EDGE_HIT_CSS = 14;
const LINE_WIDTH_CSS = 2;
const MIN_POINTS = 3;

const COL_WALK = 0x44eedd;
/** Walkable hole ring (distinct from outer mesh). */
const COL_WALK_HOLE = 0xffaa66;
const COL_PROP = 0xff66cc;
const COL_HOTSPOT = 0xff9944;
const COL_REGION = 0x66dd88;
const COL_HANDLE = '#ffee44';
const COL_HANDLE_STROKE = '#000000';
const COL_WALK_TO = '#3db8e8';
const COL_LOOK_AT = '#e8a438';
const COL_AUX_STROKE = '#1a1a24';

function hexToCss(hex: number): string {
    return `#${hex.toString(16).padStart(6, '0')}`;
}

function distPointToSegment(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
): { d: number; t: number; ix: number; iy: number } {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const ab2 = abx * abx + aby * aby;
    let t = ab2 > 0 ? (apx * abx + apy * aby) / ab2 : 0;
    t = Phaser.Math.Clamp(t, 0, 1);
    const ix = ax + t * abx;
    const iy = ay + t * aby;
    const d = Phaser.Math.Distance.Between(px, py, ix, iy);
    return { d, t, ix, iy };
}

function hitVertexCss(
    cx: number,
    cy: number,
    pts: Point2[],
    handleR: number,
    toCss: (p: Point2) => { x: number; y: number },
): number {
    let best = -1;
    let bestD = handleR + 1;
    for (let i = 0; i < pts.length; i++) {
        const p = toCss(pts[i]!);
        const d = Phaser.Math.Distance.Between(cx, cy, p.x, p.y);
        if (d <= handleR && d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
}

function hitAuxCss(
    cx: number,
    cy: number,
    pt: Point2,
    handleR: number,
    toCss: (p: Point2) => { x: number; y: number },
): boolean {
    const p = toCss(pt);
    return Phaser.Math.Distance.Between(cx, cy, p.x, p.y) <= handleR;
}

/** Index `i` is edge from `pts[i]` to `pts[(i+1)%n]`. */
function hitEdgeCss(
    cx: number,
    cy: number,
    pts: Point2[],
    edgeHit: number,
    vertexClear: number,
    toCss: (p: Point2) => { x: number; y: number },
): number {
    const n = pts.length;
    let best = -1;
    let bestD = edgeHit + 1;
    for (let i = 0; i < n; i++) {
        const a = toCss(pts[i]!);
        const b = toCss(pts[(i + 1) % n]!);
        const { d, t } = distPointToSegment(cx, cy, a.x, a.y, b.x, b.y);
        if (d > edgeHit) {
            continue;
        }
        if (Phaser.Math.Distance.Between(cx, cy, a.x, a.y) < vertexClear) {
            continue;
        }
        if (Phaser.Math.Distance.Between(cx, cy, b.x, b.y) < vertexClear) {
            continue;
        }
        if (t <= 0.05 || t >= 0.95) {
            continue;
        }
        if (d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
}

function insertPointOnEdge(pts: Point2[], edgeIdx: number, wx: number, wy: number): void {
    const a = pts[edgeIdx];
    const b = pts[(edgeIdx + 1) % pts.length];
    const { ix, iy } = distPointToSegment(wx, wy, a.x, a.y, b.x, b.y);
    pts.splice(edgeIdx + 1, 0, { x: ix, y: iy });
}

function defaultStandPointForProp(prop: RoomPropInstance): Point2 {
    const c = prop.collider?.points;
    if (c && c.length > 0) {
        return centroidFromPoints(c);
    }
    const x = prop.x ?? 0;
    const y = prop.y ?? 0;
    return { x, y };
}

function centroidFromPoints(c: Point2[]): Point2 {
    let sx = 0;
    let sy = 0;
    for (const p of c) {
        sx += p.x;
        sy += p.y;
    }
    return { x: Math.round(sx / c.length), y: Math.round(sy / c.length) };
}

export class RoomPolygonEditScene extends Phaser.Scene {
    private room!: RoomData;
    private postPatch!: (p: RoomPolygonPatch) => void;

    /** Cached reference to the sibling RoomScene (set in create, cleared on shutdown). */
    private roomScene: RoomScene | null = null;

    private overlay?: PreviewPolygonOverlay;

    // ── Pan state (middle-mouse drag) ────────────────────────────────────────
    private isPanning = false;
    private panLastX = 0;
    private panLastY = 0;

    // ── Rect edit state (roomSize / scrollBounds modes) ──────────────────────
    /** Which of the 8 handles is currently being dragged (-1 = none). */
    private dragRectHandle = -1;
    /** Which handle is visually selected/highlighted. */
    private selectedRectHandle = -1;

    private dragVertexIndex: number | null = null;
    private selectedVertexIndex: number | null = null;
    private downOnVertex = false;

    private dragAux: 'walk' | 'look' | null = null;
    private selectedAux: 'walk' | 'look' | null = null;

    private tapEdge: { t: number; edgeIdx: number } | null = null;

    private unsubBridge!: () => void;
    private readonly onSaveBound = (): void => {
        this.saveActivePolygon();
    };

    constructor() {
        super(BENNE_POLYGON_EDIT_SCENE);
    }

    create(): void {
        this.room = this.game.registry.get('bennePreviewRoom') as RoomData;
        this.postPatch = this.game.registry.get('bennePreviewPostPatch') as (p: RoomPolygonPatch) => void;

        if (!this.room || typeof this.postPatch !== 'function') {
            return;
        }

        this.roomScene = (this.scene?.manager?.getScene(SCENE_ROOM) as RoomScene | null) ?? null;

        const mount = this.game.canvas.parentElement;
        if (!mount) {
            return;
        }
        this.overlay = new PreviewPolygonOverlay(this.game, mount);
        this.overlay.canvas.addEventListener('pointerdown', this.onOverlayPointerDown);
        this.overlay.canvas.addEventListener('pointermove', this.onOverlayPointerMove);
        this.overlay.canvas.addEventListener('pointerup', this.onOverlayPointerUp);
        this.overlay.canvas.addEventListener('pointercancel', this.onOverlayPointerUp);
        this.overlay.canvas.addEventListener('keydown', this.onOverlayKeyDown);
        this.overlay.canvas.addEventListener('wheel', this.onOverlayWheel, { passive: false });

        this.unsubBridge = polygonEditBridge.subscribe(() => {
            /* During game.destroy(), manager may be null; toolbar wiring notifies before the next game boots. */
            if (!this.scene?.manager) {
                return;
            }
            this.syncRoomInput();
            this.syncEditorCameraMode();
            this.selectedVertexIndex = null;
            this.selectedAux = null;
            this.dragAux = null;
            this.tapEdge = null;
            this.dragRectHandle = -1;
            this.selectedRectHandle = -1;
        });
        this.syncRoomInput();
        this.syncEditorCameraMode();

        window.addEventListener('benne-save-polygon', this.onSaveBound);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.shutdownScene();
        });
    }

    /**
     * Returns the active camera from RoomScene for coordinate transforms.
     * Falls back to this scene's own camera when RoomScene isn't available.
     */
    private getRoomCamera(): Phaser.Cameras.Scene2D.Camera {
        return this.roomScene?.cameras.main ?? this.cameras.main;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Rect editing helpers (roomSize / scrollBounds)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns the current edit rectangle for the active mode in world space,
     * or null if the mode is not a rect mode.
     */
    private getRectFromRoom(): { left: number; top: number; right: number; bottom: number } | null {
        const vW = getInternalWidth();
        const vH = getInternalHeight();
        if (polygonEditBridge.mode === 'roomSize') {
            const w = this.room.size?.width ?? vW;
            const h = this.room.size?.height ?? vH;
            return { left: 0, top: 0, right: w, bottom: h };
        }
        if (polygonEditBridge.mode === 'scrollBounds') {
            const roomW = this.room.size?.width ?? vW;
            const roomH = this.room.size?.height ?? vH;
            const sb = this.room.scrollBounds;
            const x = sb?.x ?? 0;
            const y = sb?.y ?? 0;
            const bw = sb?.width ?? roomW;
            const bh = sb?.height ?? roomH;
            return { left: x, top: y, right: x + bw, bottom: y + bh };
        }
        return null;
    }

    /** 8 handle world positions for a rect (clockwise from top-left). */
    private static rectHandlePositions(
        r: { left: number; top: number; right: number; bottom: number },
    ): { x: number; y: number }[] {
        const mx = (r.left + r.right) / 2;
        const my = (r.top + r.bottom) / 2;
        return [
            { x: r.left,  y: r.top    },  // 0 top-left
            { x: mx,      y: r.top    },  // 1 top-mid
            { x: r.right, y: r.top    },  // 2 top-right
            { x: r.right, y: my       },  // 3 mid-right
            { x: r.right, y: r.bottom },  // 4 bottom-right
            { x: mx,      y: r.bottom },  // 5 bottom-mid
            { x: r.left,  y: r.bottom },  // 6 bottom-left
            { x: r.left,  y: my       },  // 7 mid-left
        ];
    }

    /**
     * Returns which handles are locked (cannot be dragged) for the current mode.
     * For `roomSize` the top-left origin is fixed at (0,0), so any handle that
     * would move left or top is locked.
     */
    private static lockedHandlesForMode(mode: string): ReadonlySet<number> {
        if (mode === 'roomSize') {
            // Handles that affect left (0,6,7) or top (0,1,2) — union = 0,1,2,6,7
            return new Set([0, 1, 2, 6, 7]);
        }
        return new Set<number>();
    }

    /** Hit-test CSS pointer coords against handle circles; returns handle index or -1. */
    private hitRectHandle(
        cx: number,
        cy: number,
        handles: { x: number; y: number }[],
        radiusCss: number,
        toCss: (p: { x: number; y: number }) => { x: number; y: number },
        locked: ReadonlySet<number>,
    ): number {
        let best = -1;
        let bestD = radiusCss + 1;
        for (let i = 0; i < handles.length; i++) {
            if (locked.has(i)) continue;
            const q = toCss(handles[i]!);
            const d = Phaser.Math.Distance.Between(cx, cy, q.x, q.y);
            if (d <= radiusCss && d < bestD) {
                bestD = d;
                best = i;
            }
        }
        return best;
    }

    /**
     * Apply a drag of handle `idx` to (wx, wy) in world space.
     * Directly mutates `room.size` or `room.scrollBounds`.
     */
    private applyRectHandleDrag(idx: number, wx: number, wy: number): void {
        const vW = getInternalWidth();
        const vH = getInternalHeight();

        if (polygonEditBridge.mode === 'roomSize') {
            if (!this.room.size) {
                this.room.size = { width: vW, height: vH };
            }
            const affectsRight  = idx === 2 || idx === 3 || idx === 4;
            const affectsBottom = idx === 4 || idx === 5 || idx === 6;
            if (affectsRight)  this.room.size.width  = Math.max(1, wx);
            if (affectsBottom) this.room.size.height = Math.max(1, wy);
            return;
        }

        if (polygonEditBridge.mode === 'scrollBounds') {
            const roomW = this.room.size?.width ?? vW;
            const roomH = this.room.size?.height ?? vH;
            if (!this.room.scrollBounds) {
                this.room.scrollBounds = { x: 0, y: 0, width: roomW, height: roomH };
            }
            const sb = this.room.scrollBounds;
            const curRight  = sb.x + sb.width;
            const curBottom = sb.y + sb.height;

            const affectsLeft   = idx === 0 || idx === 6 || idx === 7;
            const affectsTop    = idx === 0 || idx === 1 || idx === 2;
            const affectsRight  = idx === 2 || idx === 3 || idx === 4;
            const affectsBottom = idx === 4 || idx === 5 || idx === 6;

            let left   = sb.x;
            let top    = sb.y;
            let right  = curRight;
            let bottom = curBottom;

            if (affectsLeft)   left   = Math.min(wx, right - 1);
            if (affectsTop)    top    = Math.min(wy, bottom - 1);
            if (affectsRight)  right  = Math.max(wx, left + 1);
            if (affectsBottom) bottom = Math.max(wy, top + 1);

            sb.x = left;
            sb.y = top;
            sb.width  = right - left;
            sb.height = bottom - top;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Tells RoomScene to switch between game-play camera (navigate) and full-room
     * editor view (any edit mode). Only has an effect when the room is larger than the viewport.
     */
    private syncEditorCameraMode(): void {
        if (!this.roomScene || typeof this.roomScene.setEditorCameraMode !== 'function') {
            return;
        }
        this.roomScene.setEditorCameraMode(
            polygonEditBridge.mode === 'navigate' ? 'navigate' : 'edit',
        );
    }

    update(): void {
        if (!this.overlay) {
            return;
        }
        this.overlay.syncLayout();
        const roomCam = this.getRoomCamera();

        if (!polygonEditBridge.isEditing()) {
            this.overlay.clearAndDraw({
                pts: [],
                strokeStyle: '#000000',
                handleFill: COL_HANDLE,
                handleStroke: COL_HANDLE_STROKE,
                selectedIndex: null,
                handleRadiusCss: HANDLE_R_CSS,
                lineWidthCss: LINE_WIDTH_CSS,
            }, roomCam);
            return;
        }

        // ── Rect modes ────────────────────────────────────────────────────────
        if (polygonEditBridge.mode === 'roomSize' || polygonEditBridge.mode === 'scrollBounds') {
            const rect = this.getRectFromRoom();
            const isRoomSize = polygonEditBridge.mode === 'roomSize';
            const strokeStyle = isRoomSize ? '#22ddff' : '#ff9944';
            if (rect) {
                this.overlay.clearAndDrawRect({
                    rect,
                    strokeStyle,
                    fillStyle: strokeStyle,
                    handleFill: COL_HANDLE,
                    handleStroke: COL_HANDLE_STROKE,
                    selectedHandleIndex: this.selectedRectHandle,
                    lockedHandles: RoomPolygonEditScene.lockedHandlesForMode(polygonEditBridge.mode),
                    handleRadiusCss: HANDLE_R_CSS,
                    lineWidthCss: LINE_WIDTH_CSS,
                }, roomCam);
            } else {
                this.overlay.clearAndDraw({
                    pts: [],
                    strokeStyle: '#000000',
                    handleFill: COL_HANDLE,
                    handleStroke: COL_HANDLE_STROKE,
                    selectedIndex: null,
                    handleRadiusCss: HANDLE_R_CSS,
                    lineWidthCss: LINE_WIDTH_CSS,
                }, roomCam);
            }
            return;
        }

        const auxEd = this.getPolygonAuxEditor();
        if (auxEd) {
            auxEd.ensure();
            const labeledPoints = [
                {
                    point: auxEd.walk,
                    label: 'Walk to',
                    fillStyle: COL_WALK_TO,
                    strokeStyle: COL_AUX_STROKE,
                    selected: this.selectedAux === 'walk',
                    radiusCss: AUX_HANDLE_R_CSS,
                },
                {
                    point: auxEd.look,
                    label: 'Look at',
                    fillStyle: COL_LOOK_AT,
                    strokeStyle: COL_AUX_STROKE,
                    selected: this.selectedAux === 'look',
                    radiusCss: AUX_HANDLE_R_CSS,
                },
            ];
            this.overlay.clearAndDraw({
                pts: auxEd.pts,
                strokeStyle: hexToCss(auxEd.strokeHex),
                handleFill: COL_HANDLE,
                handleStroke: COL_HANDLE_STROKE,
                selectedIndex: this.selectedVertexIndex,
                handleRadiusCss: HANDLE_R_CSS,
                lineWidthCss: LINE_WIDTH_CSS,
                labeledPoints,
            }, roomCam);
            return;
        }

        if (polygonEditBridge.mode === 'regionPolygon') {
            const pts = this.getActivePoints();
            if (!pts || pts.length === 0) {
                this.overlay.clearAndDraw({
                    pts: [],
                    strokeStyle: '#000000',
                    handleFill: COL_HANDLE,
                    handleStroke: COL_HANDLE_STROKE,
                    selectedIndex: null,
                    handleRadiusCss: HANDLE_R_CSS,
                    lineWidthCss: LINE_WIDTH_CSS,
                }, roomCam);
                return;
            }
            this.overlay.clearAndDraw({
                pts,
                strokeStyle: hexToCss(COL_REGION),
                handleFill: COL_HANDLE,
                handleStroke: COL_HANDLE_STROKE,
                selectedIndex: this.selectedVertexIndex,
                handleRadiusCss: HANDLE_R_CSS,
                lineWidthCss: LINE_WIDTH_CSS,
            }, roomCam);
            return;
        }

        if (polygonEditBridge.mode === 'roomPoint') {
            const p = this.getActiveRoomPoint();
            const pts = p ? [{ x: p.x, y: p.y }] : [];
            this.overlay.clearAndDraw({
                pts,
                strokeStyle: COL_WALK_TO,
                handleFill: COL_HANDLE,
                handleStroke: COL_HANDLE_STROKE,
                selectedIndex: this.selectedVertexIndex,
                handleRadiusCss: HANDLE_R_CSS + 1,
                lineWidthCss: LINE_WIDTH_CSS,
            }, roomCam);
            return;
        }

        const pts = this.getActivePoints();
        if (!pts || pts.length === 0) {
            this.overlay.clearAndDraw({
                pts: [],
                strokeStyle: '#000000',
                handleFill: COL_HANDLE,
                handleStroke: COL_HANDLE_STROKE,
                selectedIndex: null,
                handleRadiusCss: HANDLE_R_CSS,
                lineWidthCss: LINE_WIDTH_CSS,
            }, roomCam);
            return;
        }

        const strokeHex =
            polygonEditBridge.mode === 'walkable'
                ? polygonEditBridge.walkableHoleId
                    ? COL_WALK_HOLE
                    : COL_WALK
                : COL_PROP;

        this.overlay.clearAndDraw({
            pts,
            strokeStyle: hexToCss(strokeHex),
            handleFill: COL_HANDLE,
            handleStroke: COL_HANDLE_STROKE,
            selectedIndex: this.selectedVertexIndex,
            handleRadiusCss: HANDLE_R_CSS,
            lineWidthCss: LINE_WIDTH_CSS,
        }, roomCam);
    }

    private shutdownScene(): void {
        this.overlay?.canvas.removeEventListener('pointerdown', this.onOverlayPointerDown);
        this.overlay?.canvas.removeEventListener('pointermove', this.onOverlayPointerMove);
        this.overlay?.canvas.removeEventListener('pointerup', this.onOverlayPointerUp);
        this.overlay?.canvas.removeEventListener('pointercancel', this.onOverlayPointerUp);
        this.overlay?.canvas.removeEventListener('keydown', this.onOverlayKeyDown);
        this.overlay?.canvas.removeEventListener('wheel', this.onOverlayWheel);
        window.removeEventListener('benne-save-polygon', this.onSaveBound);
        this.unsubBridge?.();
        this.overlay?.destroy();
        const roomSc = this.scene?.manager?.getScene(SCENE_ROOM);
        if (roomSc) {
            roomSc.input.enabled = true;
        }
        this.roomScene = null;
    }

    private getActiveProp(): RoomPropInstance | null {
        if (polygonEditBridge.mode !== 'propCollider') {
            return null;
        }
        const id = polygonEditBridge.propId;
        const p = this.room.props?.find((x) => x.id === id);
        if (!p || p.clickable !== true) {
            return null;
        }
        return p;
    }

    private ensurePropWalkLook(prop: RoomPropInstance): void {
        if (!prop.collider) {
            prop.collider = { points: [] };
        }
        if (!prop.collider.points) {
            prop.collider.points = [];
        }
        const base = defaultStandPointForProp(prop);
        if (!prop.walkToPoint) {
            prop.walkToPoint = { x: base.x, y: base.y };
        }
        if (!prop.lookAtPoint) {
            prop.lookAtPoint = { x: base.x + 12, y: base.y };
        }
    }

    private getActiveHotspot(): RoomHotspotData | null {
        if (polygonEditBridge.mode !== 'hotspotPolygon') {
            return null;
        }
        const id = polygonEditBridge.hotspotId;
        const h = this.room.hotspots?.find((x) => x.id === id);
        return h ?? null;
    }

    private ensureHotspotWalkLook(h: RoomHotspotData): void {
        const roomW = this.room.size?.width ?? getInternalWidth();
        const roomH = this.room.size?.height ?? getInternalHeight();
        if (!h.points || h.points.length < MIN_POINTS) {
            const cx = Math.round(roomW / 2);
            const cy = Math.round(roomH / 2);
            const s = 24;
            h.points = [
                { x: cx - s, y: cy - s },
                { x: cx + s, y: cy - s },
                { x: cx + s, y: cy + s },
                { x: cx - s, y: cy + s },
            ];
        }
        const base = centroidFromPoints(h.points);
        if (!h.walkToPoint) {
            h.walkToPoint = { x: base.x, y: base.y };
        }
        if (!h.lookAtPoint) {
            h.lookAtPoint = { x: base.x + 12, y: base.y };
        }
    }

    private getPolygonAuxEditor():
        | {
              strokeHex: number;
              pts: Point2[];
              walk: Point2;
              look: Point2;
              ensure: () => void;
          }
        | null {
        if (polygonEditBridge.mode === 'propCollider') {
            const prop = this.getActiveProp();
            if (!prop) {
                return null;
            }
            this.ensurePropWalkLook(prop);
            return {
                strokeHex: COL_PROP,
                pts: prop.collider!.points!,
                walk: prop.walkToPoint!,
                look: prop.lookAtPoint!,
                ensure: () => this.ensurePropWalkLook(prop),
            };
        }
        if (polygonEditBridge.mode === 'hotspotPolygon') {
            const h = this.getActiveHotspot();
            if (!h) {
                return null;
            }
            this.ensureHotspotWalkLook(h);
            return {
                strokeHex: COL_HOTSPOT,
                pts: h.points!,
                walk: h.walkToPoint!,
                look: h.lookAtPoint!,
                ensure: () => this.ensureHotspotWalkLook(h),
            };
        }
        return null;
    }

    private getActiveRegion(): RoomRegionData | null {
        if (polygonEditBridge.mode !== 'regionPolygon') {
            return null;
        }
        const r = this.room.regions?.find((x) => x.id === polygonEditBridge.regionId);
        return r ?? null;
    }

    private getActiveRoomPoint(): RoomPointData | null {
        if (polygonEditBridge.mode !== 'roomPoint') {
            return null;
        }
        const p = this.room.points?.find((x) => x.id === polygonEditBridge.roomPointId);
        return p ?? null;
    }

    private getActivePoints(): Point2[] | null {
        if (polygonEditBridge.mode === 'walkable') {
            const id = polygonEditBridge.walkablePolygonId;
            const poly = this.room.walkable.polygons.find((p) => p.id === id);
            if (!poly) {
                return null;
            }
            const hid = polygonEditBridge.walkableHoleId;
            if (!hid) {
                return poly.points ?? null;
            }
            const hole = poly.holes?.find((h) => h.id === hid);
            if (!hole) {
                return null;
            }
            if (!hole.points) {
                hole.points = [];
            }
            return hole.points;
        }
        if (polygonEditBridge.mode === 'propCollider') {
            const prop = this.getActiveProp();
            if (!prop) {
                return null;
            }
            this.ensurePropWalkLook(prop);
            return prop.collider!.points!;
        }
        if (polygonEditBridge.mode === 'hotspotPolygon') {
            const h = this.getActiveHotspot();
            if (!h) {
                return null;
            }
            this.ensureHotspotWalkLook(h);
            return h.points!;
        }
        if (polygonEditBridge.mode === 'regionPolygon') {
            const r = this.getActiveRegion();
            if (!r) {
                return null;
            }
            if (!r.points) {
                r.points = [];
            }
            return r.points;
        }
        return null;
    }

    private syncRoomInput(): void {
        const mgr = this.scene?.manager;
        if (!mgr) {
            return;
        }
        const roomSc = mgr.getScene(SCENE_ROOM);
        const editing = polygonEditBridge.isEditing();
        if (roomSc) {
            roomSc.input.enabled = !editing;
        }
        this.input.enabled = editing;
        this.overlay?.setPointerEventsEnabled(editing);
    }

    private saveActivePolygon(): void {
        if (!polygonEditBridge.isEditing()) {
            return;
        }
        if (polygonEditBridge.mode === 'propCollider') {
            const prop = this.getActiveProp();
            if (!prop) {
                return;
            }
            this.ensurePropWalkLook(prop);
            const pts = prop.collider!.points!;
            if (pts.length < MIN_POINTS) {
                return;
            }
            const copy = pts.map((p) => ({ x: p.x, y: p.y }));
            this.postPatch({
                kind: 'propCollider',
                propId: polygonEditBridge.propId,
                points: copy,
                walkToPoint: { x: prop.walkToPoint!.x, y: prop.walkToPoint!.y },
                lookAtPoint: { x: prop.lookAtPoint!.x, y: prop.lookAtPoint!.y },
            });
            return;
        }
        if (polygonEditBridge.mode === 'hotspotPolygon') {
            const h = this.getActiveHotspot();
            if (!h) {
                return;
            }
            this.ensureHotspotWalkLook(h);
            const pts = h.points!;
            if (pts.length < MIN_POINTS) {
                return;
            }
            const copy = pts.map((p) => ({ x: p.x, y: p.y }));
            this.postPatch({
                kind: 'hotspotPolygon',
                hotspotId: polygonEditBridge.hotspotId,
                points: copy,
                walkToPoint: { x: h.walkToPoint!.x, y: h.walkToPoint!.y },
                lookAtPoint: { x: h.lookAtPoint!.x, y: h.lookAtPoint!.y },
            });
            return;
        }
        if (polygonEditBridge.mode === 'regionPolygon') {
            const pts = this.getActivePoints();
            if (!pts || pts.length < MIN_POINTS) {
                return;
            }
            const copy = pts.map((p) => ({ x: p.x, y: p.y }));
            this.postPatch({
                kind: 'regionPolygon',
                regionId: polygonEditBridge.regionId,
                points: copy,
            });
            return;
        }
        if (polygonEditBridge.mode === 'roomPoint') {
            const p = this.getActiveRoomPoint();
            if (!p) {
                return;
            }
            this.postPatch({
                kind: 'roomPoint',
                pointId: polygonEditBridge.roomPointId,
                x: p.x,
                y: p.y,
            });
            return;
        }
        if (polygonEditBridge.mode === 'roomSize') {
            const vW = getInternalWidth();
            const vH = getInternalHeight();
            const w = Math.max(1, Math.round(this.room.size?.width ?? vW));
            const h = Math.max(1, Math.round(this.room.size?.height ?? vH));
            this.postPatch({ kind: 'roomSize', width: w, height: h });
            return;
        }
        if (polygonEditBridge.mode === 'scrollBounds') {
            const vW = getInternalWidth();
            const vH = getInternalHeight();
            const roomW = this.room.size?.width ?? vW;
            const roomH = this.room.size?.height ?? vH;
            const sb = this.room.scrollBounds;
            this.postPatch({
                kind: 'scrollBounds',
                x: Math.round(sb?.x ?? 0),
                y: Math.round(sb?.y ?? 0),
                width: Math.max(1, Math.round(sb?.width ?? roomW)),
                height: Math.max(1, Math.round(sb?.height ?? roomH)),
            });
            return;
        }
        const pts = this.getActivePoints();
        if (!pts || pts.length < MIN_POINTS) {
            return;
        }
        const copy = pts.map((p) => ({ x: p.x, y: p.y }));
        if (polygonEditBridge.mode === 'walkable') {
            const hid = polygonEditBridge.walkableHoleId;
            this.postPatch({
                kind: 'walkable',
                polygonId: polygonEditBridge.walkablePolygonId,
                ...(hid ? { holeId: hid } : {}),
                points: copy,
            });
        }
    }

    /**
     * Mouse-wheel zoom centred on the cursor.
     *
     * Uses the Phaser 4 camera's world-to-screen formula (which includes the viewport
     * origin) to keep the world point under the cursor fixed after the zoom change.
     *
     *   newScrollX = worldX − originX − (screenX − originX − cam.x) / newZoom
     *
     * Press **F** to reset zoom to the initial fit view at any time.
     */
    private readonly onOverlayWheel = (e: WheelEvent): void => {
        if (!polygonEditBridge.isEditing()) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();

        const ov = this.overlay;
        if (!ov) {
            return;
        }
        const roomCam = this.getRoomCamera();

        // World point currently under the cursor — must be captured before changing zoom.
        const worldPt = ov.domToWorld(e.pageX, e.pageY, roomCam);

        // Normalise scroll delta across devices (mouse wheel sends large values; trackpad small).
        let delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 40;   // line → pixel approx
        if (e.deltaMode === 2) delta *= 400;  // page → pixel approx

        const zoomFactor = 1 - Math.max(-0.3, Math.min(0.3, delta * 0.001));
        const newZoom = Math.max(0.05, Math.min(20, roomCam.zoom * zoomFactor));
        if (Math.abs(newZoom - roomCam.zoom) < 0.0001) {
            return;
        }

        // Cursor position in Phaser internal screen pixels (= CSS px with Scale.RESIZE).
        this.game.scale.updateBounds();
        const screenX = this.game.scale.transformX(e.pageX);
        const screenY = this.game.scale.transformY(e.pageY);

        const originX = roomCam.width * roomCam.originX;
        const originY = roomCam.height * roomCam.originY;

        roomCam.setZoom(newZoom);
        // Adjust scroll so the world point stays under the cursor.
        roomCam.scrollX = worldPt.x - originX - (screenX - originX - roomCam.x) / newZoom;
        roomCam.scrollY = worldPt.y - originY - (screenY - originY - roomCam.y) / newZoom;
    };

    private pointerCss(e: PointerEvent): { cx: number; cy: number } {
        const rect = this.game.canvas.getBoundingClientRect();
        return { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
    }

    private tryPickWalkLook(
        cx: number,
        cy: number,
        walkToPoint: Point2,
        lookAtPoint: Point2,
        toCss: (p: Point2) => { x: number; y: number },
    ): boolean {
        if (hitAuxCss(cx, cy, walkToPoint, AUX_HANDLE_R_CSS, toCss)) {
            this.dragAux = 'walk';
            this.selectedAux = 'walk';
            this.selectedVertexIndex = null;
            this.downOnVertex = false;
            this.dragVertexIndex = null;
            return true;
        }
        if (hitAuxCss(cx, cy, lookAtPoint, AUX_HANDLE_R_CSS, toCss)) {
            this.dragAux = 'look';
            this.selectedAux = 'look';
            this.selectedVertexIndex = null;
            this.downOnVertex = false;
            this.dragVertexIndex = null;
            return true;
        }
        return false;
    }

    private readonly onOverlayPointerDown = (e: PointerEvent): void => {
        const ov = this.overlay;
        if (!ov || !polygonEditBridge.isEditing()) {
            return;
        }

        // Middle mouse — start camera pan.
        if (e.button === 1) {
            e.preventDefault();
            this.isPanning = true;
            this.panLastX = e.clientX;
            this.panLastY = e.clientY;
            ov.canvas.setPointerCapture(e.pointerId);
            ov.canvas.style.cursor = 'grabbing';
            return;
        }

        if (e.button !== 0) {
            return;
        }
        e.preventDefault();
        ov.canvas.setPointerCapture(e.pointerId);
        ov.canvas.focus({ preventScroll: true });
        const { cx, cy } = this.pointerCss(e);
        const roomCam = this.getRoomCamera();
        const toCss = (p: Point2): { x: number; y: number } => ov.worldToCanvasCss(p, roomCam);

        if (polygonEditBridge.mode === 'roomPoint') {
            const p = this.getActiveRoomPoint();
            const pts = p ? [{ x: p.x, y: p.y }] : [];
            if (pts.length === 0) {
                return;
            }
            const vi = hitVertexCss(cx, cy, pts, HANDLE_R_CSS + 1, toCss);
            if (vi >= 0) {
                this.downOnVertex = true;
                this.dragVertexIndex = vi;
                this.selectedVertexIndex = vi;
            }
            return;
        }

        // ── Rect handle hit test ──────────────────────────────────────────────
        if (polygonEditBridge.mode === 'roomSize' || polygonEditBridge.mode === 'scrollBounds') {
            const rect = this.getRectFromRoom();
            if (rect) {
                const handles = RoomPolygonEditScene.rectHandlePositions(rect);
                const locked = RoomPolygonEditScene.lockedHandlesForMode(polygonEditBridge.mode);
                const hit = this.hitRectHandle(cx, cy, handles, HANDLE_R_CSS + 2, toCss, locked);
                this.dragRectHandle = hit;
                this.selectedRectHandle = hit;
            }
            return;
        }

        const auxEd = this.getPolygonAuxEditor();
        if (auxEd) {
            auxEd.ensure();
            const pts = auxEd.pts;

            if (
                pts.length >= MIN_POINTS &&
                this.tryPickWalkLook(cx, cy, auxEd.walk, auxEd.look, toCss)
            ) {
                return;
            }

            if (pts.length < MIN_POINTS) {
                const vi = pts.length > 0 ? hitVertexCss(cx, cy, pts, HANDLE_R_CSS, toCss) : -1;
                if (vi >= 0) {
                    this.downOnVertex = true;
                    this.dragVertexIndex = vi;
                    this.selectedVertexIndex = vi;
                    this.dragAux = null;
                    this.selectedAux = null;
                    return;
                }
                if (this.tryPickWalkLook(cx, cy, auxEd.walk, auxEd.look, toCss)) {
                    return;
                }
                return;
            }

            const vi = hitVertexCss(cx, cy, pts, HANDLE_R_CSS, toCss);
            if (vi >= 0) {
                this.downOnVertex = true;
                this.dragVertexIndex = vi;
                this.selectedVertexIndex = vi;
                this.dragAux = null;
                this.selectedAux = null;
                return;
            }
            this.downOnVertex = false;
            this.dragVertexIndex = null;
            return;
        }

        const pts = this.getActivePoints();
        if (!pts) {
            return;
        }

        if (pts.length < MIN_POINTS) {
            const vi = pts.length > 0 ? hitVertexCss(cx, cy, pts, HANDLE_R_CSS, toCss) : -1;
            if (vi >= 0) {
                this.downOnVertex = true;
                this.dragVertexIndex = vi;
                this.selectedVertexIndex = vi;
            }
            return;
        }

        const vi = hitVertexCss(cx, cy, pts, HANDLE_R_CSS, toCss);
        if (vi >= 0) {
            this.downOnVertex = true;
            this.dragVertexIndex = vi;
            this.selectedVertexIndex = vi;
            return;
        }
        this.downOnVertex = false;
        this.dragVertexIndex = null;
    };

    private readonly onOverlayPointerMove = (e: PointerEvent): void => {
        const ov = this.overlay;
        if (!ov) {
            return;
        }

        // Middle-mouse pan.
        if (this.isPanning) {
            const roomCam = this.getRoomCamera();
            const dx = e.clientX - this.panLastX;
            const dy = e.clientY - this.panLastY;
            // Moving mouse right pans camera left (world shifts right on screen): scrollX -= dx/zoom.
            roomCam.scrollX -= dx / roomCam.zoom;
            roomCam.scrollY -= dy / roomCam.zoom;
            this.panLastX = e.clientX;
            this.panLastY = e.clientY;
            return;
        }

        const roomCam = this.getRoomCamera();
        const roomW = this.room.size?.width ?? getInternalWidth();
        const roomH = this.room.size?.height ?? getInternalHeight();

        // ── Rect handle drag ─────────────────────────────────────────────────
        if (this.dragRectHandle >= 0 &&
            (polygonEditBridge.mode === 'roomSize' || polygonEditBridge.mode === 'scrollBounds')) {
            const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, roomCam);
            this.applyRectHandleDrag(this.dragRectHandle, wx, wy);
            return;
        }

        if (this.dragAux === 'walk' || this.dragAux === 'look') {
            const auxEd = this.getPolygonAuxEditor();
            if (!auxEd) {
                return;
            }
            const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, roomCam);
            const cx = Phaser.Math.Clamp(wx, 0, roomW);
            const cy = Phaser.Math.Clamp(wy, 0, roomH);
            if (this.dragAux === 'walk') {
                auxEd.walk.x = cx;
                auxEd.walk.y = cy;
            } else {
                auxEd.look.x = cx;
                auxEd.look.y = cy;
            }
            return;
        }
        if (this.dragVertexIndex === null) {
            return;
        }
        if (polygonEditBridge.mode === 'roomPoint') {
            const p = this.getActiveRoomPoint();
            if (!p || this.dragVertexIndex !== 0) {
                return;
            }
            const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, roomCam);
            p.x = Phaser.Math.Clamp(wx, 0, roomW);
            p.y = Phaser.Math.Clamp(wy, 0, roomH);
            return;
        }
        const pts = this.getActivePoints();
        if (!pts || this.dragVertexIndex >= pts.length) {
            return;
        }
        const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, roomCam);
        pts[this.dragVertexIndex].x = Phaser.Math.Clamp(wx, 0, roomW);
        pts[this.dragVertexIndex].y = Phaser.Math.Clamp(wy, 0, roomH);
    };

    private readonly onOverlayPointerUp = (e: PointerEvent): void => {
        const ov = this.overlay;

        // Stop middle-mouse pan.
        if (e.button === 1) {
            if (this.isPanning) {
                this.isPanning = false;
                if (ov) {
                    ov.canvas.style.cursor = '';
                    try { ov.canvas.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
                }
            }
            return;
        }

        if (e.button === 0 && ov) {
            try {
                ov.canvas.releasePointerCapture(e.pointerId);
            } catch {
                /* not captured */
            }
        }
        if (!polygonEditBridge.isEditing() || !ov) {
            this.dragVertexIndex = null;
            this.downOnVertex = false;
            this.dragAux = null;
            return;
        }

        if (this.dragAux) {
            this.dragAux = null;
            this.downOnVertex = false;
            this.dragVertexIndex = null;
            return;
        }

        // ── Rect drag end ─────────────────────────────────────────────────────
        if (this.dragRectHandle >= 0) {
            this.dragRectHandle = -1;
            return;
        }
        if (polygonEditBridge.mode === 'roomSize' || polygonEditBridge.mode === 'scrollBounds') {
            // Click in rect area with no handle hit — deselect.
            this.selectedRectHandle = -1;
            return;
        }

        const pts = this.getActivePoints();
        const roomCam = this.getRoomCamera();
        const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, roomCam);
        const { cx, cy } = this.pointerCss(e);
        const toCss = (p: Point2): { x: number; y: number } => ov.worldToCanvasCss(p, roomCam);
        const roomW = this.room.size?.width ?? getInternalWidth();
        const roomH = this.room.size?.height ?? getInternalHeight();

        if (this.downOnVertex || this.dragVertexIndex !== null) {
            this.dragVertexIndex = null;
            this.downOnVertex = false;
            return;
        }

        if (polygonEditBridge.mode === 'roomPoint') {
            this.tapEdge = null;
            return;
        }

        if (polygonEditBridge.mode === 'walkable') {
            if (
                e.button === 0 &&
                pts &&
                pts.length < MIN_POINTS &&
                !this.downOnVertex &&
                this.dragVertexIndex === null
            ) {
                pts.push({
                    x: Phaser.Math.Clamp(wx, 0, roomW),
                    y: Phaser.Math.Clamp(wy, 0, roomH),
                });
                this.tapEdge = null;
                return;
            }

            if (e.button === 0 && pts && pts.length >= MIN_POINTS) {
                const vertexClear = HANDLE_R_CSS + 3;
                const edgeIdx = hitEdgeCss(cx, cy, pts, EDGE_HIT_CSS, vertexClear, toCss);
                if (edgeIdx >= 0) {
                    const now = this.time.now;
                    if (
                        this.tapEdge &&
                        this.tapEdge.edgeIdx === edgeIdx &&
                        now - this.tapEdge.t < 450
                    ) {
                        insertPointOnEdge(pts, edgeIdx, wx, wy);
                        this.tapEdge = null;
                    } else {
                        this.tapEdge = { t: now, edgeIdx };
                    }
                } else {
                    this.tapEdge = null;
                    this.selectedVertexIndex = null;
                }
            }
            return;
        }

        /* prop collider, hotspot polygon, or region polygon */
        if (
            e.button === 0 &&
            pts &&
            pts.length < MIN_POINTS &&
            !this.downOnVertex &&
            this.dragVertexIndex === null
        ) {
            pts.push({
                x: Phaser.Math.Clamp(wx, 0, roomW),
                y: Phaser.Math.Clamp(wy, 0, roomH),
            });
            this.tapEdge = null;
            return;
        }

        if (
            e.button === 0 &&
            pts &&
            pts.length >= MIN_POINTS &&
            (polygonEditBridge.mode === 'propCollider' ||
                polygonEditBridge.mode === 'hotspotPolygon' ||
                polygonEditBridge.mode === 'regionPolygon')
        ) {
            const vertexClear = HANDLE_R_CSS + 3;
            const edgeIdx = hitEdgeCss(cx, cy, pts, EDGE_HIT_CSS, vertexClear, toCss);
            if (edgeIdx >= 0) {
                const now = this.time.now;
                if (
                    this.tapEdge &&
                    this.tapEdge.edgeIdx === edgeIdx &&
                    now - this.tapEdge.t < 450
                ) {
                    insertPointOnEdge(pts, edgeIdx, wx, wy);
                    this.tapEdge = null;
                } else {
                    this.tapEdge = { t: now, edgeIdx };
                }
            } else {
                this.tapEdge = null;
                this.selectedVertexIndex = null;
                this.selectedAux = null;
            }
        }
    };

    /**
     * Delete/Backspace: handled on the overlay canvas (focus set on pointerdown) because Phaser’s
     * keyboard plugin does not reliably receive keys when the DOM overlay sits above the game canvas.
     */
    private readonly onOverlayKeyDown = (e: KeyboardEvent): void => {
        if (!polygonEditBridge.isEditing()) {
            return;
        }
        // F key: reset camera to fit-room zoom.
        if (e.key === 'f' || e.key === 'F') {
            this.syncEditorCameraMode();
            e.preventDefault();
            return;
        }
        if (e.key !== 'Delete' && e.key !== 'Backspace') {
            return;
        }
        if (this.applyDeleteSelectedVertex()) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    /** Returns true if a vertex was removed. */
    private applyDeleteSelectedVertex(): boolean {
        if (polygonEditBridge.mode === 'roomPoint') {
            return false;
        }
        const pts = this.getActivePoints();
        if (
            !pts ||
            this.selectedVertexIndex === null ||
            pts.length <= MIN_POINTS
        ) {
            return false;
        }
        pts.splice(this.selectedVertexIndex, 1);
        this.selectedVertexIndex = null;
        return true;
    }
}
</file>

<file path="src/engine/ConfigManager.ts">
import { CURSOR_HOTSPOT_PRESETS, isValidGameSettingsCursorHotspot } from '../game/cursorAseprite';
import type { GameSettings, GameSettingsDialog } from '../types/game';
import rawSettings from '../game/game-config.json';

const DIALOG_DEFAULTS: GameSettingsDialog = {
  clickToSkip: false,
  showText: true,
  defaultTalkOffset: { x: 0, y: 0 },
  minDurationMs: 800,
  msPerCharacter: 35,
  maxDurationMs: 4500,
  durationMultiplier: 1.0,
};

function mergeDialogSettings(data: GameSettings): GameSettingsDialog {
  const d = data.dialog;
  if (!d) {
    return { ...DIALOG_DEFAULTS };
  }
  const off = d.defaultTalkOffset;
  return {
    clickToSkip: d.clickToSkip ?? DIALOG_DEFAULTS.clickToSkip,
    showText: d.showText ?? DIALOG_DEFAULTS.showText,
    defaultTalkOffset:
      off != null && typeof off === 'object' && Number.isFinite(off.x) && Number.isFinite(off.y)
        ? { x: off.x, y: off.y }
        : { ...DIALOG_DEFAULTS.defaultTalkOffset },
    minDurationMs: d.minDurationMs ?? DIALOG_DEFAULTS.minDurationMs,
    msPerCharacter: d.msPerCharacter ?? DIALOG_DEFAULTS.msPerCharacter,
    maxDurationMs: d.maxDurationMs ?? DIALOG_DEFAULTS.maxDurationMs,
    durationMultiplier: d.durationMultiplier ?? DIALOG_DEFAULTS.durationMultiplier,
  };
}

function assertDialogSettings(data: GameSettings): void {
  const d = data.dialog;
  if (d === undefined) {
    return;
  }
  if (typeof d !== 'object' || d === null) {
    throw new Error('game-config dialog must be an object when present');
  }
  if (d.clickToSkip !== undefined && typeof d.clickToSkip !== 'boolean') {
    throw new Error('game-config dialog.clickToSkip must be a boolean when present');
  }
  if (d.showText !== undefined && typeof d.showText !== 'boolean') {
    throw new Error('game-config dialog.showText must be a boolean when present');
  }
  const off = d.defaultTalkOffset;
  if (off !== undefined) {
    if (typeof off !== 'object' || off === null) {
      throw new Error('game-config dialog.defaultTalkOffset must be an object when present');
    }
    if (!Number.isFinite(off.x) || !Number.isFinite(off.y)) {
      throw new Error('game-config dialog.defaultTalkOffset.x and .y must be finite numbers when present');
    }
  }
  for (const key of ['minDurationMs', 'msPerCharacter', 'maxDurationMs', 'durationMultiplier'] as const) {
    const v = d[key];
    if (v !== undefined && !Number.isFinite(v)) {
      throw new Error(`game-config dialog.${key} must be a finite number when present`);
    }
  }
  const merged = mergeDialogSettings(data);
  if (merged.minDurationMs < 0 || merged.maxDurationMs < 0 || merged.msPerCharacter < 0 || merged.durationMultiplier <= 0) {
    throw new Error(
      'game-config dialog: minDurationMs, maxDurationMs, and msPerCharacter must be >= 0; durationMultiplier must be > 0',
    );
  }
  if (merged.minDurationMs > merged.maxDurationMs) {
    throw new Error('game-config dialog.minDurationMs must be <= maxDurationMs');
  }
}

function collectEffectiveVerbIds(data: GameSettings): Set<string> {
  const ids = new Set<string>();
  if (data.verbs !== undefined && data.verbs.length > 0) {
    for (const v of data.verbs) {
      ids.add(v.id);
    }
    return ids;
  }
  ids.add('look');
  ids.add('use');
  return ids;
}

function assertVerbSettings(data: GameSettings): void {
  if (data.verbs !== undefined) {
    if (!Array.isArray(data.verbs)) {
      throw new Error('game-config verbs must be an array when present');
    }
    const seen = new Set<string>();
    for (const v of data.verbs) {
      if (typeof v !== 'object' || v === null) {
        throw new Error('game-config each verbs entry must be an object');
      }
      if (typeof v.id !== 'string' || v.id.length === 0) {
        throw new Error('game-config each verbs[].id must be a non-empty string');
      }
      if (seen.has(v.id)) {
        throw new Error(`game-config duplicate verb id: ${v.id}`);
      }
      seen.add(v.id);
      if (v.label !== undefined && typeof v.label !== 'string') {
        throw new Error(`game-config verbs["${v.id}"].label must be a string when present`);
      }
    }
  }

  const effectiveIds = collectEffectiveVerbIds(data);
  const ip = data.inputProfile;
  if (ip !== undefined) {
    if (typeof ip !== 'object' || ip === null) {
      throw new Error('game-config inputProfile must be an object when present');
    }
    if (ip.kind !== 'twoVerb') {
      throw new Error('game-config inputProfile.kind must be "twoVerb" (other profiles are not implemented yet)');
    }
    if (typeof ip.primaryButtonVerb !== 'string' || ip.primaryButtonVerb.length === 0) {
      throw new Error('game-config inputProfile.primaryButtonVerb must be a non-empty string');
    }
    if (typeof ip.secondaryButtonVerb !== 'string' || ip.secondaryButtonVerb.length === 0) {
      throw new Error('game-config inputProfile.secondaryButtonVerb must be a non-empty string');
    }
    if (!effectiveIds.has(ip.primaryButtonVerb)) {
      throw new Error(
        `game-config inputProfile.primaryButtonVerb "${ip.primaryButtonVerb}" must be listed in verbs (or use default look/use when verbs is omitted)`,
      );
    }
    if (!effectiveIds.has(ip.secondaryButtonVerb)) {
      throw new Error(
        `game-config inputProfile.secondaryButtonVerb "${ip.secondaryButtonVerb}" must be listed in verbs (or use default look/use when verbs is omitted)`,
      );
    }
  }

  if (data.defaultFallbackLine !== undefined && typeof data.defaultFallbackLine !== 'string') {
    throw new Error('game-config defaultFallbackLine must be a string when present');
  }
}

function assertInitialGameState(data: GameSettings): void {
  const init = data.initialGameState;
  if (init === undefined) {
    return;
  }
  if (typeof init !== 'object' || init === null || Array.isArray(init)) {
    throw new Error('game-config initialGameState must be an object when present');
  }
  if (init.flags !== undefined) {
    if (typeof init.flags !== 'object' || init.flags === null || Array.isArray(init.flags)) {
      throw new Error('game-config initialGameState.flags must be a plain object when present');
    }
    for (const [k, v] of Object.entries(init.flags)) {
      if (k.length === 0) {
        throw new Error('game-config initialGameState.flags keys must be non-empty strings');
      }
      const ok = typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string';
      if (!ok) {
        throw new Error(
          `game-config initialGameState.flags["${k}"] must be a boolean, number, or string when present`,
        );
      }
    }
  }
  if (init.variables !== undefined) {
    if (typeof init.variables !== 'object' || init.variables === null || Array.isArray(init.variables)) {
      throw new Error('game-config initialGameState.variables must be a plain object when present');
    }
  }
  if (init.inventory !== undefined) {
    if (Array.isArray(init.inventory)) {
      const seen = new Set<string>();
      for (const item of init.inventory) {
        if (typeof item !== 'string' || item.length === 0) {
          throw new Error('game-config initialGameState.inventory entries must be non-empty strings');
        }
        if (seen.has(item)) {
          console.warn(
            `[Benne] game-config initialGameState.inventory: duplicate "${item}" — quantities merge at runtime`,
          );
        }
        seen.add(item);
      }
    } else if (typeof init.inventory === 'object' && init.inventory !== null && !Array.isArray(init.inventory)) {
      for (const [k, v] of Object.entries(init.inventory as Record<string, unknown>)) {
        if (k.length === 0) {
          throw new Error('game-config initialGameState.inventory keys must be non-empty strings');
        }
        const n = typeof v === 'number' ? v : Number(v);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error(
            `game-config initialGameState.inventory["${k}"] must be a non-negative finite number when present`,
          );
        }
      }
    } else {
      throw new Error(
        'game-config initialGameState.inventory must be a string[] id list or Record<string, number> when present',
      );
    }
  }
}

function assertGameSettings(data: GameSettings): void {
  const { width, height } = data.resolution;
  if (!Number.isFinite(width) || width < 1 || !Number.isFinite(height) || height < 1) {
    throw new Error(`Invalid game-config resolution: ${width} x ${height}`);
  }
  const { masterVolume, sfxVolume, musicVolume, dialogueVolume } = data.audio;
  for (const [key, v] of Object.entries({
    masterVolume,
    sfxVolume,
    musicVolume,
    dialogueVolume,
  })) {
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      throw new Error(`Invalid game-config audio.${key}: ${v} (expected 0.0–1.0)`);
    }
  }
  if (typeof data.startingPlayerCharacter !== 'string' || data.startingPlayerCharacter.length === 0) {
    throw new Error('game-config startingPlayerCharacter must be a non-empty string');
  }
  if (data.debug !== undefined) {
    const d = data.debug;
    if (typeof d !== 'object' || d === null) {
      throw new Error('game-config debug must be an object when present');
    }
    for (const key of ['showWalkable', 'showPropOutlines', 'showGuiOutlines'] as const) {
      const v = d[key];
      if (v !== undefined && typeof v !== 'boolean') {
        throw new Error(`game-config debug.${key} must be a boolean when present`);
      }
    }
  }
  assertInitialGameState(data);
  assertVerbSettings(data);
  assertDialogSettings(data);
  assertCursorSettings(data);
}

function assertCursorSettings(data: GameSettings): void {
  const c = data.cursor;
  if (c === undefined) {
    return;
  }
  if (typeof c !== 'object' || c === null || Array.isArray(c)) {
    throw new Error('game-config cursor must be an object when present');
  }
  if (typeof c.idleAnimation !== 'string' || c.idleAnimation.trim().length === 0) {
    throw new Error('game-config cursor.idleAnimation must be a non-empty string when cursor is set');
  }
  if (typeof c.activeAnimation !== 'string' || c.activeAnimation.trim().length === 0) {
    throw new Error('game-config cursor.activeAnimation must be a non-empty string when cursor is set');
  }
  const anims = c.animations;
  if (anims !== undefined) {
    if (typeof anims !== 'object' || anims === null || Array.isArray(anims)) {
      throw new Error('game-config cursor.animations must be a plain object when present');
    }
    for (const [tag, clip] of Object.entries(anims)) {
      if (typeof tag !== 'string' || tag.length === 0) {
        throw new Error('game-config cursor.animations keys must be non-empty strings');
      }
      if (typeof clip !== 'object' || clip === null || Array.isArray(clip)) {
        throw new Error(`game-config cursor.animations["${tag}"] must be an object when present`);
      }
      const rec = clip as Record<string, unknown>;
      if (rec.loop !== undefined && typeof rec.loop !== 'boolean') {
        throw new Error(`game-config cursor.animations["${tag}"].loop must be a boolean when present`);
      }
      if (rec.frameDuration !== undefined && !Number.isFinite(rec.frameDuration)) {
        throw new Error(`game-config cursor.animations["${tag}"].frameDuration must be a finite number when present`);
      }
    }
  }
  const hs = c.hotspot;
  if (hs !== undefined) {
    if (typeof hs !== 'string' || !isValidGameSettingsCursorHotspot(hs)) {
      throw new Error(
        `game-config cursor.hotspot must be one of: ${CURSOR_HOTSPOT_PRESETS.join(', ')}`,
      );
    }
    if (hs === 'custom') {
      const p = c.hotspotPixel;
      if (p === undefined || typeof p !== 'object' || p === null || Array.isArray(p)) {
        throw new Error('game-config cursor.hotspotPixel { x, y } is required when cursor.hotspot is "custom"');
      }
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        throw new Error('game-config cursor.hotspotPixel.x and .y must be finite numbers when hotspot is "custom"');
      }
    }
  } else if (c.hotspotPixel !== undefined) {
    console.warn('[Benne] game-config cursor.hotspotPixel is ignored unless cursor.hotspot is "custom"');
  }
  const disp = c.display;
  if (disp !== undefined) {
    if (typeof disp !== 'object' || disp === null || Array.isArray(disp)) {
      throw new Error('game-config cursor.display must be an object when present');
    }
    if (disp.aseprite !== undefined && typeof disp.aseprite !== 'boolean') {
      throw new Error('game-config cursor.display.aseprite must be a boolean when present');
    }
  }
}

const settings = rawSettings as GameSettings;
assertGameSettings(settings);

/**
 * Synchronous access to `src/game/game-config.json` (bundled by Vite at build time).
 */
export function getGameSettings(): GameSettings {
  return settings;
}

/** Merged `dialog` values from `game-config.json` (defaults apply when the block or fields are omitted). */
export function getDialogSettings(): GameSettingsDialog {
  return mergeDialogSettings(settings);
}

/** How long a `.say()` line should stay on screen from {@link getDialogSettings} timing rules. */
export function computeDialogLineDurationMs(line: string): number {
  const dialog = mergeDialogSettings(settings);
  const n = Array.from(line).length;
  const scaled = n * dialog.msPerCharacter * dialog.durationMultiplier;
  const clamped = Math.min(dialog.maxDurationMs, Math.max(dialog.minDurationMs, scaled));
  return Math.round(clamped);
}
</file>

<file path="src/engine/scenes/BootScene.ts">
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
</file>

<file path="src/engine/scripting/index.ts">
export {
  BenneScript,
  type BenneScriptCharacterFacade,
  type BenneScriptPlayerFacade,
  type BenneScriptPropFacade,
  type BlockingWithNow,
} from './BenneScript.js';
export type { GivePropInteractPayload } from './benneScriptPayloads.js';
export * from './RoomScriptContext.js';
export * from './types.js';
export { registerRoomScript, getBenneRoomScriptRegistrations } from './registerRoomScript.js';
export {
  registerCharacterScript,
  getBenneCharacterScriptRegistrations,
} from './registerCharacterScript.js';
export { CharacterBenneScript } from './CharacterBenneScript.js';
export {
  registerInventoryScript,
  getBenneInventoryScriptRegistrations,
} from './registerInventoryScript.js';
export { InventoryBenneScript } from './InventoryBenneScript.js';
export { registerGlobalScript, getBenneGlobalScriptRegistrations } from './registerGlobalScript.js';
export { wireBenneGlobalScripts } from './wireBenneGlobalScripts.js';
export { GlobalBenneScript } from './GlobalBenneScript.js';
export { registerGuiScript, getBenneGuiScriptRegistrations, getGuiBenneScript } from './registerGuiScript.js';
export { GuiBenneScript } from './GuiBenneScript.js';
export {
  GuiRuntime,
  ControlFacade,
  type GuiRuntimeOptions,
  type ControlTweenProps,
} from './GuiRuntime.js';
export {
  guiAllButtonsClickEventId,
  guiButtonClickEventId,
  type GuiAllButtonsClickPayload,
} from '../events/guiButtonEvents.js';
export {
  guiControlMouseEnterEventId,
  guiControlMouseLeaveEventId,
} from '../events/guiControlHoverEvents.js';
export type { BenneScriptGameStateNamespace, BenneScriptInventoryNamespace } from './benneScriptGameStateApi.js';
</file>

<file path="src/game/registerGameContent.ts">
import { gameEvents } from '../engine/events/EventBus';
import { GuiBenneScript } from '../engine/scripting/GuiBenneScript';
import { getBenneCharacterScriptRegistrations } from '../engine/scripting/registerCharacterScript';
import {
  getBenneGuiScriptRegistrations,
  registerGuiBenneScriptInstance,
} from '../engine/scripting/registerGuiScript';
import { getBenneInventoryScriptRegistrations } from '../engine/scripting/registerInventoryScript';
import { getBenneRoomScriptRegistrations } from '../engine/scripting/registerRoomScript';
import type { GuiScriptContext } from '../engine/scripting/types';
import { registerInventoryDefinitionsFromGame } from './registerInventoryDefinitions';

const LEGACY_REGISTER_EXPORTS = [
  'registerRoomScript',
  'registerCharacterScript',
  'registerGuiScript',
  'registerGlobalScript',
  'registerInventoryScript',
] as const;

function warnLegacyRegisterExports(path: string, mod: Record<string, unknown>): void {
  if (!import.meta.env.DEV) {
    return;
  }
  for (const key of LEGACY_REGISTER_EXPORTS) {
    if (typeof mod[key] === 'function') {
      console.error(
        `[Benne] ${path} exports legacy "${String(key)}". Use side-effect registration from @engine/scripting instead.`,
      );
    }
  }
}

/**
 * Eager-loads all game script modules (side-effect `register*` calls only) and wires GUI registrations.
 * Room and character scripts run from {@link import('../engine/scenes/RoomScene.js').RoomScene}; global scripts
 * run from {@link import('../engine/scripting/wireBenneGlobalScripts.js').wireBenneGlobalScripts} after the Phaser game exists.
 */
export function registerGameContent(): void {
  registerInventoryDefinitionsFromGame();

  const roomModules = import.meta.glob('./rooms/**/*.room.ts', { eager: true });
  for (const [path, mod] of Object.entries(roomModules)) {
    warnLegacyRegisterExports(path, mod as Record<string, unknown>);
  }

  const characterModules = import.meta.glob('./characters/**/*.character.ts', { eager: true });
  for (const [path, mod] of Object.entries(characterModules)) {
    warnLegacyRegisterExports(path, mod as Record<string, unknown>);
  }

  const guiModules = import.meta.glob('./guis/**/*.gui.ts', { eager: true });
  for (const [path, mod] of Object.entries(guiModules)) {
    warnLegacyRegisterExports(path, mod as Record<string, unknown>);
  }

  const inventoryModules = import.meta.glob('./inventory/**/*.inventory.ts', { eager: true });
  for (const [path, mod] of Object.entries(inventoryModules)) {
    warnLegacyRegisterExports(path, mod as Record<string, unknown>);
  }

  const globalModules = import.meta.glob('./globalScript.ts', { eager: true });
  for (const [path, mod] of Object.entries(globalModules)) {
    warnLegacyRegisterExports(path, mod as Record<string, unknown>);
  }

  (window as unknown as { __benneRoomScripts?: unknown }).__benneRoomScripts =
    getBenneRoomScriptRegistrations();
  (window as unknown as { __benneCharacterScripts?: unknown }).__benneCharacterScripts =
    getBenneCharacterScriptRegistrations();
  (window as unknown as { __benneInventoryScripts?: unknown }).__benneInventoryScripts =
    getBenneInventoryScriptRegistrations();

  for (const { guiId, registerFn } of getBenneGuiScriptRegistrations()) {
    const B = new GuiBenneScript(gameEvents, guiId);
    registerGuiBenneScriptInstance(guiId, B);
    const ctx: GuiScriptContext = { B, events: gameEvents, guiId };
    try {
      registerFn(ctx);
    } catch (err) {
      console.error(`[Benne] Error in GUI script for "${guiId}":`, err);
    }
  }
}
</file>

<file path="src/editor/preview/roomEditorMain.ts">
import type { Game } from 'phaser';
import type { RoomScene } from '../../engine/scenes/RoomScene';
import type { RoomData } from '../../types/room';
import { SCENE_ROOM } from '../../game/constants';
import { buildPreviewManifest } from './buildPreviewManifest';
import { createRoomPreviewPhaserGame } from './createRoomPreviewGame';
import { guiVisibilityBridge } from './guiVisibilityBridge';
import { polygonEditBridge } from './polygonEditBridge';
import type { RoomPolygonPatch } from './polygonPatchTypes';
import { registerInventoryDefinitionsFromGame } from '../../game/registerInventoryDefinitions';

// Mirror the GUI preview bundle: populate the engine's inventory registry so the room preview can
// queue `inventoryPanel` Aseprite sheets and honour `stackable` semantics for any Bennescript code
// that happens to run during preview.
registerInventoryDefinitionsFromGame();

declare function acquireVsCodeApi(): {
    postMessage(data: unknown): void;
    getState<T = unknown>(): T | undefined;
    setState<T = unknown>(state: T): void;
};

type PreviewWebviewState = {
    showGuis?: boolean;
};

const MIN_POLY_POINTS = 3;

type WalkableSelectTarget = { polygonId: string; holeId: string | null };

function encodeWalkableSelectValue(t: WalkableSelectTarget): string {
    return JSON.stringify({ p: t.polygonId, h: t.holeId });
}

function decodeWalkableSelectValue(s: string): WalkableSelectTarget | null {
    try {
        const o = JSON.parse(s) as { p?: unknown; h?: unknown };
        if (typeof o.p !== 'string') {
            return null;
        }
        const h =
            o.h === null || o.h === undefined ? null : typeof o.h === 'string' ? o.h : null;
        return { polygonId: o.p, holeId: h };
    } catch {
        return null;
    }
}

let game: Game | null = null;
let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
let currentRoomJsonUri = '';
/** Latest room from the host; used for `toolbarUi` updates without reloading Phaser. */
let lastLoadedRoom: RoomData | null = null;

type PreviewToolbarPayload =
    | { previewFocus: 'room' }
    | { previewFocus: 'prop'; propColliderId: string }
    | { previewFocus: 'hotspot'; hotspotId: string }
    | { previewFocus: 'region'; regionId: string }
    | { previewFocus: 'roomPoint'; roomPointId: string };

function parsePreviewToolbarPayload(msg: {
    previewFocus?: string;
    propColliderId?: string;
    hotspotId?: string;
    regionId?: string;
    roomPointId?: string;
}): PreviewToolbarPayload {
    if (
        msg.previewFocus === 'prop' &&
        typeof msg.propColliderId === 'string' &&
        msg.propColliderId.length > 0
    ) {
        return { previewFocus: 'prop', propColliderId: msg.propColliderId };
    }
    if (
        msg.previewFocus === 'hotspot' &&
        typeof msg.hotspotId === 'string' &&
        msg.hotspotId.length > 0
    ) {
        return { previewFocus: 'hotspot', hotspotId: msg.hotspotId };
    }
    if (
        msg.previewFocus === 'region' &&
        typeof msg.regionId === 'string' &&
        msg.regionId.length > 0
    ) {
        return { previewFocus: 'region', regionId: msg.regionId };
    }
    if (
        msg.previewFocus === 'roomPoint' &&
        typeof msg.roomPointId === 'string' &&
        msg.roomPointId.length > 0
    ) {
        return { previewFocus: 'roomPoint', roomPointId: msg.roomPointId };
    }
    return { previewFocus: 'room' };
}

function propColliderLabel(room: RoomData, propId: string): string {
    const p = room.props?.find((x) => x.id === propId);
    if (!p) {
        return propId;
    }
    return p.tag ? `${p.tag} (${propId})` : propId;
}

function hotspotToolbarLabel(room: RoomData, hotspotId: string): string {
    const h = room.hotspots?.find((x) => x.id === hotspotId);
    if (!h) {
        return hotspotId;
    }
    if (h.description && h.description.trim()) {
        return `${h.description.trim()} (${hotspotId})`;
    }
    return hotspotId;
}


/** Collider authoring is only for interactive props (matches runtime expectations). */
function isPropColliderEditable(room: RoomData, propId: string): boolean {
    const p = room.props?.find((x) => x.id === propId);
    return p?.clickable === true;
}

/** Bumps on each `loadRoom` so stale `buildPreviewManifest` completions (e.g. double save) cannot create a game after a newer load cleared the DOM. */
let loadRoomGeneration = 0;

try {
    vscodeApi = acquireVsCodeApi();
} catch {
    /* not inside a VS Code webview */
}

/**
 * Rehydrate the "Show GUIs" toggle from webview state (`vscode.getState()`) on first load. Default
 * off: polygon / walkable authoring usually wants a clean view, and authors opt in per the confirmed
 * UX (`docs/architecture.md` room preview spec).
 */
(function loadPersistedGuiVisibility(): void {
    try {
        const s = vscodeApi?.getState<PreviewWebviewState>();
        if (s && typeof s.showGuis === 'boolean') {
            guiVisibilityBridge.setVisible(s.showGuis);
        }
    } catch {
        /* ignore — first ever load or unavailable state */
    }
})();

function persistWebviewState(): void {
    try {
        vscodeApi?.setState<PreviewWebviewState>({ showGuis: guiVisibilityBridge.visible });
    } catch {
        /* ignore */
    }
}

function wireShowGuisToggle(): void {
    const input = document.getElementById('benne-show-guis-toggle') as HTMLInputElement | null;
    if (!input || input.dataset.benneShowGuisWired === '1') {
        return;
    }
    input.dataset.benneShowGuisWired = '1';
    input.checked = guiVisibilityBridge.visible;
    input.addEventListener('change', () => {
        const next = !!input.checked;
        guiVisibilityBridge.setVisible(next);
        persistWebviewState();
        applyGuiVisibilityToRunningScene(next);
    });
    // Keep the checkbox in sync when other code flips the bridge (e.g. future programmatic toggles).
    guiVisibilityBridge.subscribe((visible) => {
        if (input.checked !== visible) {
            input.checked = visible;
        }
    });
}

function applyGuiVisibilityToRunningScene(visible: boolean): void {
    if (!game) {
        return;
    }
    const scene = game.scene.getScene(SCENE_ROOM) as RoomScene | undefined;
    if (!scene || !scene.scene.isActive()) {
        return;
    }
    scene.setGenericGuisVisible(visible);
}

function setStatus(text: string): void {
    const el = document.getElementById('benne-polygon-status');
    if (el) {
        el.textContent = text;
    }
}

/**
 * Phaser queues `destroy` for a later step. We must not mount a new `Phaser.Game` on the same parent
 * until teardown has had time to run. Listening for `game.events` "destroy" is unreliable in VS Code
 * webviews when `requestAnimationFrame` is throttled, so we use a short timer instead.
 */
async function destroyPreviewGameAsync(): Promise<void> {
    if (!game) {
        return;
    }
    const g = game;
    game = null;
    try {
        g.destroy(true);
    } catch {
        /* canvas may already be detached */
    }
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 150);
    });
}

function clearToolbar(): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (bar) {
        bar.innerHTML = '';
    }
    polygonEditBridge.setMode('navigate');
    polygonEditBridge.setPropId('');
    polygonEditBridge.setHotspotId('');
    polygonEditBridge.setRegionId('');
    polygonEditBridge.setRoomPointId('');
    polygonEditBridge.setWalkableEditTarget('', '');
}

function buildRoomToolbarHtml(): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <div style="display:inline-flex;align-items:center;gap:6px;">
        <label for="benne-edit-mode">Mode</label>
        <select id="benne-edit-mode" style="background:#2a2a3e;color:#eee;border:1px solid #4a4a60;padding:2px 6px;">
          <option value="navigate">Navigate</option>
          <option value="walkable">Edit walkable</option>
          <option value="roomSize">Room Size</option>
          <option value="scrollBounds">Scroll Bounds</option>
        </select>
      </div>
      <div id="benne-walkable-row" hidden style="align-items:center;gap:6px;display:inline-flex;">
        <label for="benne-walkable-id">Walkable/Holes</label>
        <select id="benne-walkable-id" style="background:#2a2a3e;color:#eee;border:1px solid #4a4a60;padding:2px 6px;max-width:280px;"></select>
      </div>
      <button type="button" id="benne-save-polygon" hidden style="background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">New polygon: click ${MIN_POLY_POINTS} times to place vertices. Then double-click an edge to add more. Delete removes the selected vertex (min ${MIN_POLY_POINTS} points).</div>
  `;
}

function buildPropTreeToolbarHtml(propLabel: string): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <span style="opacity:0.95;">Prop — <strong style="color:#e8ecff;">${escapeHtml(propLabel)}</strong> (collider, walk, look)</span>
      <button type="button" id="benne-save-polygon" style="background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">Collider (magenta), cyan <strong>Walk to</strong>, amber <strong>Look at</strong>. New collider: click ${MIN_POLY_POINTS} times, then double-click edges. Delete removes a selected collider vertex only.</div>
  `;
}

function buildHotspotToolbarHtml(label: string): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <span style="opacity:0.95;">Hotspot — <strong style="color:#e8ecff;">${escapeHtml(label)}</strong> (polygon, walk, look)</span>
      <button type="button" id="benne-save-polygon" style="background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">Orange polygon, cyan <strong>Walk to</strong>, amber <strong>Look at</strong>. Place ${MIN_POLY_POINTS}+ vertices like prop colliders; double-click an edge to add a vertex.</div>
  `;
}

function buildRegionToolbarHtml(regionId: string): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <span style="opacity:0.95;">Region — <strong style="color:#e8ecff;">${escapeHtml(regionId)}</strong></span>
      <button type="button" id="benne-save-polygon" style="background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">Green polygon. New shape: click ${MIN_POLY_POINTS} times, then double-click edges to add vertices. Delete removes a selected vertex (min ${MIN_POLY_POINTS}).</div>
  `;
}

function buildRoomPointToolbarHtml(pointId: string): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <span style="opacity:0.95;">Point — <strong style="color:#e8ecff;">${escapeHtml(pointId)}</strong></span>
      <button type="button" id="benne-save-polygon" style="background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">Drag the handle to move this point. Save writes integer <code style="background:#2a2a3e;padding:1px 4px;border-radius:3px;">x</code> / <code style="background:#2a2a3e;padding:1px 4px;border-radius:3px;">y</code> to JSON.</div>
  `;
}

function buildPropTreeNonClickableToolbarHtml(propLabel: string): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <span style="opacity:0.95;"><strong style="color:#e8ecff;">${escapeHtml(propLabel)}</strong> — not clickable</span>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">Collider editing is only available when <code style="background:#2a2a3e;padding:1px 4px;border-radius:3px;">"clickable": true</code> is set on this prop in the room JSON.</div>
  `;
}

/**
 * Ensure `walkable.polygons` and arrays exist so toolbar wiring and Phaser never throw on partial JSON
 * (e.g. unsaved edits) or odd structured-clone payloads from the host.
 */
function normalizeRoomForPreview(raw: unknown): RoomData {
    const r =
        raw && typeof raw === 'object' ? ({ ...(raw as Record<string, unknown>) } as Record<string, unknown>) : {};
    const id = typeof r.id === 'string' && r.id.length > 0 ? r.id : 'room';
    const name = typeof r.name === 'string' && r.name.length > 0 ? r.name : id;
    let polygons: RoomData['walkable']['polygons'] = [];
    const w = r.walkable;
    if (w && typeof w === 'object') {
        const polys = (w as { polygons?: unknown }).polygons;
        if (Array.isArray(polys)) {
            polygons = polys as RoomData['walkable']['polygons'];
        }
    }
    r.id = id;
    r.name = name;
    r.walkable = { polygons };
    r.hotspots = Array.isArray(r.hotspots) ? r.hotspots : [];
    r.points = Array.isArray(r.points) ? r.points : [];
    r.regions = Array.isArray(r.regions) ? r.regions : [];
    r.props = Array.isArray(r.props) ? r.props : [];
    r.characters = Array.isArray(r.characters) ? r.characters : [];
    return r as unknown as RoomData;
}

function wireRoomToolbar(room: RoomData): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildRoomToolbarHtml();

    const modeSel = document.getElementById('benne-edit-mode') as HTMLSelectElement;
    const walkRow = document.getElementById('benne-walkable-row')!;
    const walkSel = document.getElementById('benne-walkable-id') as HTMLSelectElement;
    const saveBtn = document.getElementById('benne-save-polygon') as HTMLButtonElement;

    polygonEditBridge.setPropId('');
    polygonEditBridge.setHotspotId('');
    polygonEditBridge.setRegionId('');
    polygonEditBridge.setRoomPointId('');
    walkSel.innerHTML = '';
    const polygons = room.walkable?.polygons;
    const safePolygons = Array.isArray(polygons) ? polygons : [];
    for (const p of safePolygons) {
        const optOuter = document.createElement('option');
        optOuter.value = encodeWalkableSelectValue({ polygonId: p.id, holeId: null });
        optOuter.textContent = `${p.id} (walkable)`;
        walkSel.appendChild(optOuter);
        for (const h of p.holes ?? []) {
            const optHole = document.createElement('option');
            optHole.value = encodeWalkableSelectValue({ polygonId: p.id, holeId: h.id });
            optHole.textContent = `${p.id} › ${h.id} (hole)`;
            walkSel.appendChild(optHole);
        }
    }
    if (walkSel.options.length > 0) {
        const d = decodeWalkableSelectValue(walkSel.value);
        if (d) {
            polygonEditBridge.setWalkableEditTarget(d.polygonId, d.holeId ?? '');
        }
    } else {
        polygonEditBridge.setWalkableEditTarget('', '');
    }

    const syncModeUI = (): void => {
        const m = modeSel.value as 'navigate' | 'walkable' | 'roomSize' | 'scrollBounds';
        polygonEditBridge.setMode(m);
        walkRow.hidden = m !== 'walkable';
        saveBtn.hidden = m === 'navigate';

        const hint = document.getElementById('benne-toolbar-hint');
        if (hint) {
            if (m === 'roomSize') {
                hint.textContent = 'Drag the cyan handles to resize the room art canvas. The origin (top-left) is always 0,0. Press F to fit view. Save writes to room JSON.';
            } else if (m === 'scrollBounds') {
                hint.textContent = 'Drag the orange handles to set the camera scroll bounds — the area within which the camera pans. Press F to fit view. Save writes to room JSON.';
            } else if (m === 'walkable') {
                hint.textContent = `New polygon: click ${MIN_POLY_POINTS} times to place vertices. Then double-click an edge to add more. Delete removes the selected vertex (min ${MIN_POLY_POINTS} points).`;
            } else {
                hint.textContent = '';
            }
        }
    };

    modeSel.value = 'navigate';
    polygonEditBridge.setMode('navigate');
    syncModeUI();

    modeSel.addEventListener('change', () => {
        setStatus('');
        syncModeUI();
    });
    walkSel.addEventListener('change', () => {
        const d = decodeWalkableSelectValue(walkSel.value);
        if (d) {
            polygonEditBridge.setWalkableEditTarget(d.polygonId, d.holeId ?? '');
        }
        setStatus('');
    });
    saveBtn.addEventListener('click', () => {
        setStatus('Saving…');
        window.dispatchEvent(new Event('benne-save-polygon'));
    });
}

function wirePropTreeToolbarNonClickable(room: RoomData, propColliderId: string): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildPropTreeNonClickableToolbarHtml(propColliderLabel(room, propColliderId));
    polygonEditBridge.setWalkableEditTarget('', '');
    polygonEditBridge.setPropId('');
    polygonEditBridge.setHotspotId('');
    polygonEditBridge.setRegionId('');
    polygonEditBridge.setRoomPointId('');
    polygonEditBridge.setMode('navigate');
}

function wireHotspotToolbar(room: RoomData, hotspotId: string): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildHotspotToolbarHtml(hotspotToolbarLabel(room, hotspotId));
    const saveBtn = document.getElementById('benne-save-polygon') as HTMLButtonElement;
    polygonEditBridge.setWalkableEditTarget('', '');
    polygonEditBridge.setPropId('');
    polygonEditBridge.setRegionId('');
    polygonEditBridge.setRoomPointId('');
    polygonEditBridge.setHotspotId(hotspotId);
    polygonEditBridge.setMode('hotspotPolygon');
    saveBtn.addEventListener('click', () => {
        setStatus('Saving…');
        window.dispatchEvent(new Event('benne-save-polygon'));
    });
}

function wireRegionToolbar(_room: RoomData, regionId: string): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildRegionToolbarHtml(regionId);
    const saveBtn = document.getElementById('benne-save-polygon') as HTMLButtonElement;
    polygonEditBridge.setWalkableEditTarget('', '');
    polygonEditBridge.setPropId('');
    polygonEditBridge.setHotspotId('');
    polygonEditBridge.setRoomPointId('');
    polygonEditBridge.setRegionId(regionId);
    polygonEditBridge.setMode('regionPolygon');
    saveBtn.addEventListener('click', () => {
        setStatus('Saving…');
        window.dispatchEvent(new Event('benne-save-polygon'));
    });
}

function wireRoomPointToolbar(_room: RoomData, roomPointId: string): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildRoomPointToolbarHtml(roomPointId);
    const saveBtn = document.getElementById('benne-save-polygon') as HTMLButtonElement;
    polygonEditBridge.setWalkableEditTarget('', '');
    polygonEditBridge.setPropId('');
    polygonEditBridge.setHotspotId('');
    polygonEditBridge.setRegionId('');
    polygonEditBridge.setRoomPointId(roomPointId);
    polygonEditBridge.setMode('roomPoint');
    saveBtn.addEventListener('click', () => {
        setStatus('Saving…');
        window.dispatchEvent(new Event('benne-save-polygon'));
    });
}

function wirePropTreeToolbar(room: RoomData, propColliderId: string): void {
    if (!isPropColliderEditable(room, propColliderId)) {
        wirePropTreeToolbarNonClickable(room, propColliderId);
        return;
    }
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildPropTreeToolbarHtml(propColliderLabel(room, propColliderId));

    const saveBtn = document.getElementById('benne-save-polygon') as HTMLButtonElement;
    polygonEditBridge.setWalkableEditTarget('', '');
    polygonEditBridge.setHotspotId('');
    polygonEditBridge.setRegionId('');
    polygonEditBridge.setRoomPointId('');
    polygonEditBridge.setPropId(propColliderId);
    polygonEditBridge.setMode('propCollider');

    saveBtn.addEventListener('click', () => {
        setStatus('Saving…');
        window.dispatchEvent(new Event('benne-save-polygon'));
    });
}

function wireToolbarFromPreviewState(room: RoomData, preview: PreviewToolbarPayload): void {
    if (preview.previewFocus === 'prop') {
        wirePropTreeToolbar(room, preview.propColliderId);
    } else if (preview.previewFocus === 'hotspot') {
        wireHotspotToolbar(room, preview.hotspotId);
    } else if (preview.previewFocus === 'region') {
        wireRegionToolbar(room, preview.regionId);
    } else if (preview.previewFocus === 'roomPoint') {
        wireRoomPointToolbar(room, preview.roomPointId);
    } else {
        wireRoomToolbar(room);
    }
}

/** Sync Phaser registry room after disk save (integer-rounded points); avoids full game rebuild. */
function applyAppliedPatchToPreviewRoom(patch: RoomPolygonPatch): void {
    if (!game) {
        return;
    }
    const room = game.registry.get('bennePreviewRoom') as RoomData | undefined;
    if (!room) {
        return;
    }
    if (patch.kind === 'roomPoint') {
        const p = room.points?.find((x) => x.id === patch.pointId);
        if (p) {
            p.x = patch.x;
            p.y = patch.y;
        }
        return;
    }
    if (patch.kind === 'roomSize') {
        room.size = { width: patch.width, height: patch.height };
        // Re-sync camera so the edit-mode zoom adjusts to the new room dimensions.
        polygonEditBridge.setMode(polygonEditBridge.mode);
        return;
    }
    if (patch.kind === 'scrollBounds') {
        room.scrollBounds = { x: patch.x, y: patch.y, width: patch.width, height: patch.height };
        // Re-sync camera so the scroll bounds update takes effect.
        polygonEditBridge.setMode(polygonEditBridge.mode);
        return;
    }
    if (patch.kind === 'walkable') {
        const src = patch.points;
        const poly = room.walkable.polygons.find((p) => p.id === patch.polygonId);
        if (!poly) {
            return;
        }
        if (patch.holeId) {
            let hole = poly.holes?.find((h) => h.id === patch.holeId);
            if (!hole) {
                if (!poly.holes) {
                    poly.holes = [];
                }
                hole = { id: patch.holeId, active: true, points: [] };
                poly.holes.push(hole);
            }
            if (!hole.points) {
                hole.points = [];
            }
            const dest = hole.points;
            if (dest.length === src.length) {
                for (let i = 0; i < src.length; i++) {
                    dest[i].x = src[i].x;
                    dest[i].y = src[i].y;
                }
            } else {
                hole.points = src.map((pt) => ({ x: pt.x, y: pt.y }));
            }
            return;
        }
        if (poly.points.length === src.length) {
            for (let i = 0; i < src.length; i++) {
                poly.points[i].x = src[i].x;
                poly.points[i].y = src[i].y;
            }
        } else {
            poly.points = src.map((pt) => ({ x: pt.x, y: pt.y }));
        }
        return;
    }
    if (patch.kind === 'regionPolygon') {
        const src = patch.points;
        const reg = room.regions?.find((r) => r.id === patch.regionId);
        if (!reg) {
            return;
        }
        if (reg.points.length === src.length) {
            for (let i = 0; i < src.length; i++) {
                reg.points[i].x = src[i].x;
                reg.points[i].y = src[i].y;
            }
        } else {
            reg.points = src.map((pt) => ({ x: pt.x, y: pt.y }));
        }
        return;
    }
    if (patch.kind === 'hotspotPolygon') {
        const src = patch.points;
        const hs = room.hotspots?.find((h) => h.id === patch.hotspotId);
        if (!hs) {
            return;
        }
        if (!hs.points) {
            hs.points = [];
        }
        const dest = hs.points;
        if (dest.length === src.length) {
            for (let i = 0; i < src.length; i++) {
                dest[i].x = src[i].x;
                dest[i].y = src[i].y;
            }
        } else {
            hs.points = src.map((pt) => ({ x: pt.x, y: pt.y }));
        }
        hs.walkToPoint = { x: patch.walkToPoint.x, y: patch.walkToPoint.y };
        hs.lookAtPoint = { x: patch.lookAtPoint.x, y: patch.lookAtPoint.y };
        return;
    }
    const src = patch.points;
    const prop = room.props?.find((p) => p.id === patch.propId);
    if (!prop) {
        return;
    }
    if (!prop.collider) {
        prop.collider = { points: [] };
    }
    const dest = prop.collider.points;
    if (dest.length === src.length) {
        for (let i = 0; i < src.length; i++) {
            dest[i].x = src[i].x;
            dest[i].y = src[i].y;
        }
    } else {
        prop.collider.points = src.map((pt) => ({ x: pt.x, y: pt.y }));
    }
    prop.walkToPoint = { x: patch.walkToPoint.x, y: patch.walkToPoint.y };
    prop.lookAtPoint = { x: patch.lookAtPoint.x, y: patch.lookAtPoint.y };
}

function showError(text: string): void {
    const root = document.getElementById('benne-preview-root');
    if (root) {
        root.innerHTML = `<p style="color:#f88;padding:12px;font-family:system-ui,sans-serif;font-size:13px;">${escapeHtml(
            text,
        )}</p>`;
    }
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function resetToPlaceholder(): Promise<void> {
    lastLoadedRoom = null;
    clearToolbar();
    await destroyPreviewGameAsync();
    const root = document.getElementById('benne-preview-root');
    if (root) {
        root.innerHTML =
            '<p style="color:#8892a6;padding:12px;font-family:system-ui,sans-serif;font-size:12px;">Select a room or prop to preview</p>';
    }
    currentRoomJsonUri = '';
}

/**
 * Serialize `clear` / `error` / `loadRoom` so they never overlap. A fire-and-forget `clear` could
 * otherwise finish after a concurrent `loadRoom` and wipe the canvas (e.g. after Refresh).
 */
let previewLifecycleChain: Promise<void> = Promise.resolve();

function enqueuePreviewLifecycle(work: () => Promise<void>): void {
    previewLifecycleChain = previewLifecycleChain
        .then(() => work())
        .catch((e) => {
            console.error('[Benne preview] lifecycle', e);
        });
}

type HostPreviewMessage = {
    type?: string;
    room?: RoomData;
    gameSrcWebviewUri?: string;
    roomJsonUri?: string;
    message?: string;
    ok?: boolean;
    appliedPatch?: RoomPolygonPatch;
    previewFocus?: string;
    propColliderId?: string;
    hotspotId?: string;
    regionId?: string;
    roomPointId?: string;
};

async function runPreviewError(msg: HostPreviewMessage): Promise<void> {
    lastLoadedRoom = null;
    await destroyPreviewGameAsync();
    const root = document.getElementById('benne-preview-root');
    if (root) {
        root.innerHTML = '';
    }
    clearToolbar();
    showError(msg.message ?? 'Preview error');
}

async function runLoadRoom(msg: HostPreviewMessage): Promise<void> {
    if (!document.getElementById('benne-preview-root')?.parentElement) {
        return;
    }

    if (!msg.room || !msg.gameSrcWebviewUri) {
        showError('Missing room data or game root URI.');
        return;
    }

    if (typeof msg.roomJsonUri !== 'string' || msg.roomJsonUri.length === 0) {
        showError('Missing roomJsonUri (save to disk requires it).');
        return;
    }

    const gen = ++loadRoomGeneration;
    await destroyPreviewGameAsync();
    if (gen !== loadRoomGeneration) {
        return;
    }

    const root = document.getElementById('benne-preview-root');
    if (!root) {
        showError('Preview container missing.');
        return;
    }
    root.innerHTML = '';
    const stack = document.createElement('div');
    stack.style.cssText = 'position:relative;width:100%;height:100%;min-height:0';
    const phaserMount = document.createElement('div');
    phaserMount.style.cssText = 'width:100%;height:100%';
    stack.appendChild(phaserMount);
    root.appendChild(stack);

    let room: RoomData;
    try {
        room = normalizeRoomForPreview(msg.room);
    } catch (e) {
        showError(e instanceof Error ? e.message : String(e));
        return;
    }
    currentRoomJsonUri = msg.roomJsonUri;
    lastLoadedRoom = room;

    try {
        wireToolbarFromPreviewState(room, parsePreviewToolbarPayload(msg));
    } catch (e) {
        showError(
            `Preview toolbar: ${e instanceof Error ? e.message : String(e)}`,
        );
        return;
    }

    try {
        const manifest = await buildPreviewManifest(room, msg.gameSrcWebviewUri);
        const onPolygonPatch = (patch: RoomPolygonPatch): void => {
            vscodeApi?.postMessage({
                type: 'benne/preview/polygonPatch',
                roomJsonUri: currentRoomJsonUri,
                patch,
            });
        };
        game = createRoomPreviewPhaserGame(phaserMount, manifest, {
            roomJsonUri: currentRoomJsonUri,
            onPolygonPatch,
            initialShowGuis: guiVisibilityBridge.visible,
        });
        vscodeApi?.postMessage({ type: 'benne/preview/roomLoadComplete', roomJsonUri: currentRoomJsonUri });
    } catch (e) {
        showError(e instanceof Error ? e.message : String(e));
    }
}

window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as HostPreviewMessage;

    if (msg?.type === 'benne/preview/polygonPatchResult') {
        if (msg.ok && msg.appliedPatch) {
            applyAppliedPatchToPreviewRoom(msg.appliedPatch);
        }
        setStatus(msg.ok ? 'Saved.' : `Error: ${msg.message ?? ''}`);
        return;
    }

    if (msg?.type === 'benne/preview/toolbarUi') {
        if (!lastLoadedRoom) {
            return;
        }
        wireToolbarFromPreviewState(lastLoadedRoom, parsePreviewToolbarPayload(msg));
        return;
    }

    if (msg?.type === 'benne/preview/inspectorFocus') {
        if (!lastLoadedRoom) {
            return;
        }
        wireToolbarFromPreviewState(lastLoadedRoom, parsePreviewToolbarPayload(msg));
        return;
    }

    if (msg?.type === 'benne/preview/clear') {
        enqueuePreviewLifecycle(async () => {
            await resetToPlaceholder();
        });
        return;
    }

    if (msg?.type === 'benne/preview/error') {
        enqueuePreviewLifecycle(async () => {
            await runPreviewError(msg);
        });
        return;
    }

    if (msg?.type === 'benne/preview/loadRoom') {
        enqueuePreviewLifecycle(async () => {
            await runLoadRoom(msg);
        });
        return;
    }
});

function wireRefreshPreviewButton(): void {
    const btn = document.getElementById('benne-refresh-preview');
    if (!btn || btn.dataset.benneRefreshWired === '1') {
        return;
    }
    btn.dataset.benneRefreshWired = '1';
    btn.addEventListener('click', () => {
        vscodeApi?.postMessage({
            type: 'benne/preview/requestRefresh',
            roomJsonUri: currentRoomJsonUri,
        });
    });
}

wireRefreshPreviewButton();
wireShowGuisToggle();
vscodeApi?.postMessage({ type: 'benne/preview/ready' });
</file>

<file path="src/game/characters/henry/henry.character.json">
{
  "id": "henry",
  "name": "Henry",
  "description": "",
  "walkSpeed": 88,
  "clickable": true,
  "display": {
    "aseprite": true
  },
  "animations": {
    "IdleDR": {
      "loop": true
    },
    "IdleDL": {
      "loop": true
    },
    "IdleL": {
      "loop": true
    },
    "IdleU": {
      "loop": true
    },
    "WalkDR": {
      "loop": true
    },
    "WalkDL": {
      "loop": true
    },
    "WalkL": {
      "loop": true
    },
    "WalkU": {
      "loop": true
    },
    "GrabL": {
      "loop": true
    },
    "GrabU": {
      "loop": true
    },
    "TalkDR": {
      "loop": true
    },
    "TalkDL": {
      "loop": true
    },
    "TalkL": {
      "loop": true
    },
    "TalkU": {
      "loop": true
    },
    "IdleD": {
      "loop": true
    },
    "WalkD": {
      "loop": true
    },
    "TalkD": {
      "loop": true
    }
  },
  "feet": {
    "x": 18,
    "y": 64
  },
  "walkToPoint": {
    "x": -11,
    "y": 61
  },
  "talkPoint": {
    "x": 17,
    "y": 0
  },
  "onVerb": {
    "look": true,
    "use": true
  },
  "collider": {
    "points": [
      {
        "x": 6,
        "y": 2
      },
      {
        "x": 17,
        "y": 0
      },
      {
        "x": 30,
        "y": 2
      },
      {
        "x": 31,
        "y": 63
      },
      {
        "x": 5,
        "y": 63
      }
    ]
  }
}
</file>

<file path="src/editor/preview/createGuiPreviewGame.ts">
import * as Phaser from 'phaser';
import { applyBootAudioSettings } from '../../engine/applyAudioFromSettings';
import { getBenneRendererConfigFields } from '../../engine/gameConfig';
import { buildGuiOverlay, GUI_TEXT_OVERLAY_DEPTH } from '../../engine/gui/buildGuiOverlay';
import {
  GameStateManager,
  normalizeSerializedInventory,
} from '../../engine/gameState/GameStateManager';
import { BENNE_GAME_STATE_REGISTRY_KEY } from '../../engine/gameState/registryKey';
import {
  guiHasButtonControls,
  guiHasImageControls,
  guiHasTextControls,
  guiHasTriggerControls,
  type GuiFontLoadRequest,
} from '../../game/collectFontLoadsForGui';
import type { GuiButtonControl, GuiData, GuiInventoryPanelControl } from '../../types/gui';
import type { GameSettingsInitialGameState } from '../../types/game';
import { resolveGameStateManager } from '../../engine/gameState/resolveGameStateManager';
import {
  PreviewPolygonOverlay,
  type PreviewStrokeRectOverlayExtras,
} from './previewPolygonOverlay';

const BOOT = 'BenneGuiPreviewBoot';
const PREVIEW = 'BenneGuiPreview';

export type GuiPreviewAsepritePayload = {
  textureKey: string;
  textureURL: string;
  atlasURL: string;
};

export type GuiPreviewGamePayload = {
  guiData: GuiData;
  fontLoads: GuiFontLoadRequest[];
  internalWidth: number;
  internalHeight: number;
  revokeObjectUrls: string[];
  /** When set, loads and plays the Aseprite sheet; otherwise text-only preview. */
  aseprite: GuiPreviewAsepritePayload | null;
  /**
   * Same slice as `game-config.json` `initialGameState` — used so GUI inventory panels match runtime starting inventory.
   */
  previewInitialGameState?: GameSettingsInitialGameState;
  /**
   * When set, preloads the shared inventory sheet (`images/inventory/inventory.{png,json}`) for `inventoryPanel` icons.
   */
  sharedInventoryAseprite?: {
    textureKey: string;
    textureURL: string;
    atlasURL: string;
  } | null;
};

function editorGameConfig(
  parent: HTMLElement,
  width: number,
  height: number,
): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
  return {
    /** Renderer fields come from `getBenneRendererConfigFields` (`gameConfig.ts`) — keeps every
     * BENNE surface on the same Phaser renderer (see `benne-preview-rendering-parity.mdc`). */
    ...getBenneRendererConfigFields(),
    parent,
    width,
    height,
    /** GUI preview uses a solid black backdrop instead of the editor chrome colour so control
     * outlines and BitmapText read clearly at 1× zoom before `Scale.MAX_ZOOM`. */
    backgroundColor: '#000000',
    scale: {
      parent,
      mode: Phaser.Scale.FIT,
      width,
      height,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      /** Match runtime (`gameConfig.ts`): largest integer zoom that fits — avoids bilinear stretch blur. */
      zoom: Phaser.Scale.MAX_ZOOM,
      autoRound: true,
    },
  };
}

class BenneGuiPreviewBoot extends Phaser.Scene {
  private readonly payload: GuiPreviewGamePayload;

  constructor(payload: GuiPreviewGamePayload) {
    super(BOOT);
    this.payload = payload;
  }

  preload(): void {
    for (const f of this.payload.fontLoads) {
      this.load.bitmapFont(f.fontId, f.textureUrl, f.dataUrl);
    }
    const a = this.payload.aseprite;
    if (a) {
      this.load.aseprite({
        key: a.textureKey,
        textureURL: a.textureURL,
        atlasURL: a.atlasURL,
      });
    }
    const inv = this.payload.sharedInventoryAseprite;
    if (inv) {
      this.load.aseprite({
        key: inv.textureKey,
        textureURL: inv.textureURL,
        atlasURL: inv.atlasURL,
      });
    }
  }

  create(): void {
    applyBootAudioSettings(this);
    const rawInit = this.payload.previewInitialGameState;
    const initial =
      rawInit != null
        ? {
            flags: rawInit.flags,
            variables: rawInit.variables,
            inventory:
              rawInit.inventory !== undefined ? normalizeSerializedInventory(rawInit.inventory) : undefined,
          }
        : undefined;
    const gameState = new GameStateManager(this.game.events, initial);
    this.game.registry.set(BENNE_GAME_STATE_REGISTRY_KEY, gameState);
    this.scene.start(PREVIEW, this.payload);
    for (const u of this.payload.revokeObjectUrls) {
      URL.revokeObjectURL(u);
    }
  }
}

const PREVIEW_RESOLUTION_LABEL_DEPTH = 100;
/** Above Aseprite sprite so authored text is readable in the editor. */
const PREVIEW_GUI_TEXT_DEPTH = Math.max(GUI_TEXT_OVERLAY_DEPTH, PREVIEW_RESOLUTION_LABEL_DEPTH + 1);

/** Same as `RoomPolygonEditScene` `LINE_WIDTH_CSS` — room preview polygon overlay stroke. */
const PREVIEW_OVERLAY_LINE_WIDTH_CSS = 2;
/** Same stroke as inventory slot outlines in this preview (`RoomPolygonEditScene`-style overlay). */
const GUI_PREVIEW_CONTROL_OUTLINE_STROKE = '#7dd3fc';
/** Semi-transparent pink fill for `trigger` hit zones in the editor GUI preview (runtime triggers are not drawn). */
const GUI_PREVIEW_TRIGGER_ZONE_FILL = 'rgba(255, 105, 180, 0.3)';

function guiHasInventoryPanel(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c): c is GuiInventoryPanelControl => c.type === 'inventoryPanel');
}

function buttonControlWorldRect(c: GuiButtonControl): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const w = c.width;
  const h = c.height;
  const left = Math.round(c.x);
  const top = Math.round(c.y);
  return { left, top, right: left + w, bottom: top + h };
}

function collectButtonControlWorldRects(gui: GuiData): Array<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}> {
  const rects: Array<{ left: number; top: number; right: number; bottom: number }> = [];
  for (const c of gui.controls ?? []) {
    if (c.type === 'button') {
      rects.push(buttonControlWorldRect(c));
    }
  }
  return rects;
}

function collectTriggerPreviewOverlayEntries(gui: GuiData): Array<{
  left: number;
  top: number;
  right: number;
  bottom: number;
  label: string;
}> {
  const out: Array<{
    left: number;
    top: number;
    right: number;
    bottom: number;
    label: string;
  }> = [];
  for (const c of gui.controls ?? []) {
    if (c.type !== 'trigger') {
      continue;
    }
    const id = c.id?.trim() ?? '';
    if (!id || c.width <= 0 || c.height <= 0) {
      continue;
    }
    const left = Math.round(c.x);
    const top = Math.round(c.y);
    const w = c.width;
    const h = c.height;
    out.push({
      left,
      top,
      right: left + w,
      bottom: top + h,
      label: `${left}, ${top} · ${w}×${h}`,
    });
  }
  return out;
}

function collectInventoryPanelSlotWorldRects(gui: GuiData, inventoryItemCount: number): Array<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}> {
  const rects: Array<{ left: number; top: number; right: number; bottom: number }> = [];
  for (const c of gui.controls ?? []) {
    if (c.type !== 'inventoryPanel') {
      continue;
    }
    const spacingX = c.spacingX ?? 0;
    const spacingY = c.spacingY ?? 0;
    const px = Math.round(c.x);
    const py = Math.round(c.y);
    for (let row = 0; row < c.rows; row += 1) {
      for (let col = 0; col < c.cols; col += 1) {
        const slotIndex = row * c.cols + col;
        if (slotIndex >= inventoryItemCount && !c.showEmptySlots) {
          continue;
        }
        const slotX = col * (c.slotWidth + spacingX);
        const slotY = row * (c.slotHeight + spacingY);
        const left = px + slotX;
        const top = py + slotY;
        rects.push({ left, top, right: left + c.slotWidth, bottom: top + c.slotHeight });
      }
    }
  }
  return rects;
}

function collectBitmapTextControlWorldRects(scene: Phaser.Scene): Array<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}> {
  const rects: Array<{ left: number; top: number; right: number; bottom: number }> = [];
  for (const obj of scene.children.list) {
    if (obj instanceof Phaser.GameObjects.BitmapText) {
      const gr = obj.getBounds();
      if (gr.width > 0 && gr.height > 0) {
        rects.push({ left: gr.x, top: gr.y, right: gr.x + gr.width, bottom: gr.y + gr.height });
      }
    }
  }
  return rects;
}

class GuiPreviewScene extends Phaser.Scene {
  private payload!: GuiPreviewGamePayload;
  private guiOutlineOverlay?: PreviewPolygonOverlay;
  /** Redraw outlines when the webview panel resizes (Phaser `scale.resize` alone may not fire). */
  private guiOutlineLayoutObserver?: ResizeObserver;
  private readonly refreshGuiOutlineBound = (): void => {
    this.refreshGuiOutlineOverlay();
  };

  constructor() {
    super(PREVIEW);
  }

  init(data: GuiPreviewGamePayload): void {
    this.payload = data;
  }

  create(): void {
    const { internalWidth, internalHeight, guiData } = this.payload;
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x000000);

    buildGuiOverlay(this, guiData, {
      depth: PREVIEW_GUI_TEXT_DEPTH,
      startVisible: true,
      emptyTextPlaceholder: 'Lorem ipsum dolor sit amet.',
    });

    this.add
      .text(8, 6, `${internalWidth}×${internalHeight} · game resolution`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#9aa3b8',
      })
      .setScrollFactor(0)
      .setDepth(PREVIEW_RESOLUTION_LABEL_DEPTH);

    const mount = this.game.canvas.parentElement;
    if (
      mount &&
      (guiHasInventoryPanel(guiData) ||
        guiHasTextControls(guiData) ||
        guiHasImageControls(guiData) ||
        guiHasButtonControls(guiData) ||
        guiHasTriggerControls(guiData))
    ) {
      this.guiOutlineOverlay = new PreviewPolygonOverlay(this.game, mount);
      this.guiOutlineOverlay.setPointerEventsEnabled(false);
      this.scale.on('resize', this.refreshGuiOutlineBound);
      this.guiOutlineLayoutObserver = new ResizeObserver(this.refreshGuiOutlineBound);
      this.guiOutlineLayoutObserver.observe(mount);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.refreshGuiOutlineBound);
      this.guiOutlineLayoutObserver?.disconnect();
      this.guiOutlineLayoutObserver = undefined;
      this.guiOutlineOverlay?.destroy();
      this.guiOutlineOverlay = undefined;
    });
  }

  /**
   * Match `RoomPolygonEditScene.update`: sync overlay layout then redraw each frame so strokes stay
   * aligned with the Phaser canvas (FIT / camera / DPR) the same way room collider outlines do.
   */
  update(): void {
    this.refreshGuiOutlineOverlay();
  }

  private refreshGuiOutlineOverlay(): void {
    const ov = this.guiOutlineOverlay;
    if (!ov) {
      return;
    }
    ov.syncLayout();
    let count = 0;
    try {
      count = resolveGameStateManager(this.game).getInventoryItems().length;
    } catch {
      count = 0;
    }
    const inventoryRects = collectInventoryPanelSlotWorldRects(this.payload.guiData, count);
    const textRects = guiHasTextControls(this.payload.guiData)
      ? collectBitmapTextControlWorldRects(this)
      : [];
    const buttonRects = guiHasButtonControls(this.payload.guiData)
      ? collectButtonControlWorldRects(this.payload.guiData)
      : [];
    const outlineRects = inventoryRects.concat(textRects).concat(buttonRects);
    const triggerEntries = collectTriggerPreviewOverlayEntries(this.payload.guiData);
    const triggerExtras: PreviewStrokeRectOverlayExtras | undefined =
      triggerEntries.length > 0
        ? {
            filledUnderlays: [
              {
                rects: triggerEntries,
                fillStyle: GUI_PREVIEW_TRIGGER_ZONE_FILL,
                fillAlpha: 1,
              },
            ],
            rectCornerLabels: triggerEntries.map((e) => ({
              rect: { left: e.left, top: e.top, right: e.right, bottom: e.bottom },
              text: e.label,
            })),
          }
        : undefined;
    ov.clearAndDrawStrokeRects(outlineRects, this.cameras.main, {
      strokeStyle: GUI_PREVIEW_CONTROL_OUTLINE_STROKE,
      lineWidthCss: PREVIEW_OVERLAY_LINE_WIDTH_CSS,
    }, triggerExtras);
  }
}

export function createGuiPreviewPhaserGame(
  parent: HTMLElement,
  payload: GuiPreviewGamePayload,
): Phaser.Game {
  return new Phaser.Game({
    ...editorGameConfig(parent, payload.internalWidth, payload.internalHeight),
    scene: [new BenneGuiPreviewBoot(payload), GuiPreviewScene],
  });
}
</file>

<file path="src/types/game.ts">
import type { CharacterAnimationsConfig } from './character';
import type { BenneGameStateFlagValue } from './gameState';

export interface RoomManifestEntry {
  id: string;
  definition: string;
}

export interface RoomsManifestData {
  startRoomId: string;
  rooms: RoomManifestEntry[];
}

/** Optional starting slice for {@link import('../engine/gameState/GameStateManager.js').GameStateManager}. */
export interface GameSettingsInitialGameState {
  flags?: Record<string, BenneGameStateFlagValue>;
  variables?: Record<string, unknown>;
  /**
   * Starting inventory: either unique id list (legacy; each becomes quantity 1) or id → quantity map.
   */
  inventory?: string[] | Record<string, number>;
}

/** Loaded from `src/game/game-config.json` (authoritative game bootstrap settings). */
export interface GameSettingsResolution {
  width: number;
  height: number;
}

export interface GameSettingsAudio {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  dialogueVolume: number;
}

export interface GameSettingsDebug {
  /** When true, stroke walkable polygons in the room scene (distinct color from prop colliders). */
  showWalkable?: boolean;
  /** When true, stroke prop `collider` polygons for props that define one. */
  showPropOutlines?: boolean;
  /** When true, stroke each slot rectangle in GUI `inventoryPanel` controls (no default slot fills). */
  showGuiOutlines?: boolean;
}

/** Optional `game-config.json` `dialog` block; see {@link getDialogSettings} for merged defaults. */
export interface GameSettingsDialog {
  /**
   * Default for timed Bennescript `.say` / `.say.now` lines when the call omits **`clickToSkip`** in the options object.
   * When true, a **left**-click ends the line early (same cleanup as the timer). Per-line overrides:
   * `say('…', { clickToSkip: false })` always disables skip; `say('…', { clickToSkip: true })` always enables skip even
   * when this global flag is false.
   */
  clickToSkip: boolean;
  /** When false, `.say()` timing still runs but no dialog-text GUI (reserved for future spoken-only lines). */
  showText: boolean;
  /** Extra offset in **game canvas pixels** (same space as GUI `controls[].x` / `y`) applied after projecting the character `talkPoint`. */
  defaultTalkOffset: { x: number; y: number };
  minDurationMs: number;
  msPerCharacter: number;
  maxDurationMs: number;
  durationMultiplier: number;
}

/** One verb the game exposes (ids power `onVerb`, `inputProfile`, and global handler events). */
export interface GameVerbDefinition {
  /** Stable id used in room JSON (`onVerb`), `inputProfile`, and scripts. */
  id: string;
  /** Optional label for future in-game verb UIs. */
  label?: string;
}

/**
 * Map primary / secondary mouse buttons to verb ids (classic “2 verb” adventures).
 * Primary is usually the left button, secondary the right (see `RoomScene` + Phaser pointer).
 */
export interface VerbInputProfileTwoVerb {
  kind: 'twoVerb';
  /** Verb for the primary (typically left) mouse button. */
  primaryButtonVerb: string;
  /** Verb for the secondary (typically right) mouse button. */
  secondaryButtonVerb: string;
}

/** How input selects the verb before an interaction is resolved (extensible for 9-verb UI later). */
export type VerbInputProfile = VerbInputProfileTwoVerb;

/**
 * Central game configuration (not Phaser’s `GameConfig`).
 * Add optional fields here as the engine grows (language, shaders, accessibility, etc.).
 */
export interface GameSettings {
  resolution: GameSettingsResolution;
  /** Folder name under `src/game/characters/` for the default player character. */
  startingPlayerCharacter: string;
  /**
   * Which room id to load first. When set, overrides `startRoomId` in `rooms.manifest.json`.
   * When omitted, the manifest value is used.
   */
  startingRoomId?: string;
  audio: GameSettingsAudio;
  /** Editor / QA toggles (polygon overlays, etc.). */
  debug?: GameSettingsDebug;
  /**
   * Declared verbs for this game. When omitted, the engine assumes `look` and `use` (see architecture).
   */
  verbs?: GameVerbDefinition[];
  /**
   * How pointer input maps to a verb before dispatch. When omitted, defaults to left → `look`, right → `use`
   * (unless `verbs` overrides ids and you must set an explicit `inputProfile`).
   */
  inputProfile?: VerbInputProfile;
  /**
   * Suggested line when no handler handles the verb; emitted on the `verb:unhandled` bus event.
   */
  defaultFallbackLine?: string;
  /** In-game dialog line timing and `dialog-text` GUI placement (see `getDialogSettings()`). */
  dialog?: Partial<GameSettingsDialog>;
  /** Starting flags, variables, and inventory merged at game creation (see `GameStateManager`). */
  initialGameState?: GameSettingsInitialGameState;
  /**
   * Optional custom pointer art from `src/game/assets/images/cursor/cursor.png` + `cursor.json`
   * (Aseprite export). Uses the same `animations` / clip keys pattern as `*.character.json`.
   */
  cursor?: GameSettingsCursor;
}

/** `game-config.json` `cursor.display` block (Aseprite sheet only for now). */
export interface GameSettingsCursorDisplay {
  /** When true, load the bundled `images/cursor/cursor` Aseprite sheet. */
  aseprite?: boolean;
}

/**
 * Where the logical pointer tip sits on the cursor art (Phaser `setOrigin` fractions, except
 * **`custom`**, which uses {@link GameSettingsCursor.hotspotPixel} from the sprite top-left).
 */
export type GameSettingsCursorHotspot =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'custom';

/**
 * `game-config.json` `cursor` block — same shape as `*.character.json` clip tuning: keys in
 * {@link GameSettingsCursor.animations} are Aseprite frame tag names; {@link GameSettingsCursor.idleAnimation} /
 * {@link GameSettingsCursor.activeAnimation} pick which tags drive the two pointer states.
 */
export interface GameSettingsCursor {
  /** Aseprite tag (Phaser animation key) when the pointer is not over a clickable target. */
  idleAnimation: string;
  /** Aseprite tag when the pointer is over a prop, hotspot, clickable character, or GUI button. */
  activeAnimation: string;
  /** Optional per-tag `loop` / `frameDuration` / `events` (same as character `animations`). */
  animations?: CharacterAnimationsConfig;
  /**
   * Which point on the cursor sprite tracks the hardware pointer. Defaults to **`top-left`**
   * (Phaser origin `0,0`). Use **`custom`** with {@link GameSettingsCursor.hotspotPixel}.
   */
  hotspot?: GameSettingsCursorHotspot;
  /**
   * Pixel offset from the sprite’s **top-left** to the pointer hotspot (logical click position).
   * Required when {@link GameSettingsCursor.hotspot} is **`custom`** (ignored for named presets).
   */
  hotspotPixel?: { x: number; y: number };
  display?: GameSettingsCursorDisplay;
}
</file>

<file path="src/game/guis/inventoryBar/inventoryBar.gui.json">
{
  "id": "inventoryBar",
  "name": "Inventory Bar",
  "description": "Main inventory bar displayed on screen",
  "visible": true,
  "y": -33,
  "display": {
    "aseprite": true
  },
  "fixedControls": [
    "hoverZone",
    "hideZone"
  ],
  "controls": [
    {
      "type": "inventoryPanel",
      "id": "mainInv",
      "x": 10,
      "y": 2,
      "zIndex": 175,
      "visible": true,
      "rows": 1,
      "cols": 6,
      "slotWidth": 38,
      "slotHeight": 30,
      "spacingX": 2,
      "spacingY": 2,
      "scrollDirection": "horizontal",
      "backButton": "back",
      "forwardButton": "Fwd",
      "itemScale": 1,
      "showEmptySlots": true,
      "backgroundTag": "",
      "backgroundAnchor": "screen"
    },
    {
      "type": "button",
      "id": "back",
      "x": 2,
      "y": 10,
      "width": 6,
      "height": 13,
      "visible": true,
      "text": "",
      "font": "lucasarts-scumm-solid",
      "fontSize": 8,
      "textColor": "#ffffff",
      "textAlign": "center",
      "textOffsetX": 0,
      "textOffsetY": 0,
      "backgroundTag": "BackBtn",
      "zIndex": 200,
      "backgroundAnchor": "screen"
    },
    {
      "type": "button",
      "id": "Fwd",
      "x": 250,
      "y": 10,
      "width": 6,
      "height": 13,
      "visible": true,
      "backgroundAnchor": "screen",
      "text": "",
      "font": "lucasarts-scumm-solid",
      "fontSize": 8,
      "textColor": "#ffffff",
      "textAlign": "center",
      "textOffsetX": 0,
      "textOffsetY": 0,
      "backgroundTag": "FwBtn",
      "zIndex": 300
    },
    {
      "type": "image",
      "id": "imageTest",
      "visible": true,
      "x": 0,
      "y": 0,
      "zIndex": 150,
      "tag": "InvBG"
    },
    {
      "type": "trigger",
      "id": "hoverZone",
      "x": 0,
      "y": 0,
      "width": 50,
      "height": 10,
      "visible": true
    },
    {
      "type": "trigger",
      "id": "hideZone",
      "x": 0,
      "y": 0,
      "width": 258,
      "height": 34,
      "visible": true
    }
  ]
}
</file>

<file path="src/types/character.ts">
import type { Point2 } from './room';

/**
 * Frame-synced marker from character JSON (footsteps, SFX hooks, dialogue beats, etc.).
 */
export interface CharacterAnimationFrameEvent {
  /** 0-based index within the Aseprite tag / Phaser animation sequence. */
  frame: number;
  type: string;
  data?: unknown;
}

/**
 * Per-tag animation policy (keys match Aseprite frame tag names, e.g. `WalkL`, `IdleD`).
 */
export interface CharacterAnimationClipConfig {
  /** When true, repeat forever (`repeat: -1` in Phaser). When false or omitted, play once. */
  loop?: boolean;
  /**
   * Milliseconds each frame is shown (uniform for this tag). Applied to every frame in the clip.
   * When omitted, keeps per-frame durations from the Aseprite export.
   */
  frameDuration?: number;
  events?: CharacterAnimationFrameEvent[];
  // Future: pingPong?: boolean; reverse?: boolean;
}

export type CharacterAnimationsConfig = Record<string, CharacterAnimationClipConfig>;

/** Facing suffix on directional clips (`IdleL`, `WalkDR`, …). */
export type CharacterFacingLetter = 'L' | 'R' | 'U' | 'D' | 'UL' | 'UR' | 'DL' | 'DR';

/**
 * Character template loaded from `src/game/characters/` as `*.character.json` files.
 */
export interface CharacterDisplayData {
  /**
   * Static portrait / NPC image under `src/game/assets/`.
   * Required when `aseprite` is not true.
   */
  defaultImage?: string;
  /**
   * When true, loads `images/characters/<characterId>/<characterId>.png` and `.json` (Aseprite sheet export).
   */
  aseprite?: boolean;
}

export interface CharacterData {
  id: string;
  name: string;
  description: string;
  /**
   * Ground contact in **texture / frame pixel space**: from the top-left of each cel to the feet
   * (Y increases downward). When omitted, the engine uses the bottom-centre of the current frame.
   */
  feet?: { x: number; y: number };
  /**
   * Click hit area in **texture / frame pixel space** (same origin as `feet`). When omitted and the
   * character is clickable, the full sprite rectangle is used. Requires at least three vertices.
   */
  collider?: { points: { x: number; y: number }[] };
  /**
   * Optional stand position in **texture / frame pixel space** (same origin as `feet`).
   * World stand = sprite position + this offset. Used when scripts call `walkTo('<this id>')` targeting
   * this character, or when resolving another walker’s target to this character — same idea as prop `walkToPoint`.
   */
  walkToPoint?: Point2;
  /**
   * Optional “face / dialogue” point in **texture / frame pixel space** (same origin as `feet`).
   * World position = sprite position + offset. Verb payloads expose this as **world** `talkPoint`
   * for scripts (similar role to prop `lookAtPoint` in room space).
   */
  talkPoint?: Point2;
  /** Game pixels per second when walking (used when movement is implemented). */
  walkSpeed: number;
  clickable: boolean;
  display: CharacterDisplayData;
  /** Optional per Aseprite-tag playback (keys must match `meta.frameTags` on `images/characters/<id>/<id>.json`). */
  animations?: CharacterAnimationsConfig;
  /** Supported verbs for this character definition (keys match `game-config.json` `verbs[].id`). */
  onVerb?: Record<string, boolean>;
  /** Enables character fallback dispatch when no supported verb matches. */
  onVerbFallback?: boolean;
}
</file>

<file path="src/engine/scripting/BenneScript.ts">
import * as Phaser from 'phaser';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import { getStartingPlayerCharacterId } from '../../game/constants.js';
import type {
  CharacterVerbInteractPayload,
  RoomHotspotInteractPayload,
  RoomPropInteractPayload,
} from '../events/propInteractionEvents.js';
import type { GivePropInteractPayload } from './benneScriptPayloads.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import {
  characterVerbEventId,
  roomCharacterVerbEventId,
  roomHotspotVerbEventId,
  roomPropVerbEventId,
} from '../events/verbInteractionEvents.js';
import {
  playDirectionalAnimation,
  type DirectionalCharacterSprite,
} from '../directionalCharacterAnimation.js';
import type {
  BenneScriptCharacterFacade,
  BenneScriptPlayerFacade,
  BenneScriptPropFacade,
} from './benneScriptFacades.js';
import {
  BenneScriptCore,
  withNow,
  type BenneScriptSayLineOptions,
} from './BenneScriptCore.js';
import {
  createBenneScriptGameStateNamespace,
  createBenneScriptInventoryNamespace,
  type BenneScriptGameStateNamespace,
  type BenneScriptInventoryNamespace,
} from './benneScriptGameStateApi.js';

export type {
  BenneScriptCharacterFacade,
  BenneScriptPlayerFacade,
  BenneScriptPropFacade,
} from './benneScriptFacades.js';
export type { BenneScriptSayArgs, BenneScriptSayLineOptions, BlockingWithNow } from './BenneScriptCore.js';
export { withNow } from './BenneScriptCore.js';

/**
 * # Bennescript — valid string ids for this room
 *
 * Use ids that match **this room’s** `*.room.json` and placed characters, so handlers and movement resolve correctly.
 *
 * | Kind | Where it comes from |
 * |------|---------------------|
 * | **`whenLookAt`**, **`whenUse`**, **`whenTalkTo`**, **`whenPickUp`**, **`whenPush`**, **`whenPull`**, **`whenOpen`**, **`whenClose`**, **`whenVerb`** | One **`targetId`** per room: **prop** (`props[].id`) → **hotspot** (`hotspots[].id`) → **character** (`CharacterData.id` spawned here, including the player). Optional **`(p: any)`** payload — shape depends on which kind matched; see **`registerVerbForTarget`**. Character verb payloads may include **world** **`walkToPoint`** / **`talkPoint`** when authored in **`*.character.json`**. |
 * | **`whenGive`** | **`targetId`** is the receiving **prop** only (`props[].id`; inventory **`itemId`** is separate). |
 * | **`onProp`**, **`B.prop(id)`** | **`props[].id`** only (explicit prop wiring). |
 * | **`walkTo` / `walkTo.now`** on **`B.player`** or **`B.character('…')`** | **Unified target string** (first match): **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** → **`points[].id`**, or **`{ x, y }`** in **room pixels**. **`walkTo`** queues; **`walkTo.now`** and **`face.now`**, **`playAnimation.now`**, **`B.wait.now`** can run without blocking the queue. **`say.now`** also skips the queue but still uses the same per-line room input lock as **`say`**. |
 * | **`playAnimation(tag)`** | Aseprite **frame tag** on the character sheet (e.g. `'Idle'`, `'WalkL'`). |
 * | **`face(direction)`** | One of **`CharacterFacingLetter`**: `'L' \| 'R' \| 'U' \| 'D' \| 'UL' \| 'UR' \| 'DL' \| 'DR'`. |
 * | **`B.character(id)`** | **`CharacterData.id`** for a character **placed in this room**. |
 * | **`say` / `say.now`** on **`B.player`** or **`B.character('…')`** | Timed **`dialog-text`** line from **`game-config.json`** **`dialog`** (duration, **`clickToSkip`**, …). Speaker plays **`Talk*`** then **`Idle*`** (Aseprite tags, current **`facing`**). Optional second argument **`{ clickToSkip: false }`** forces no advance-on-click for that line; **`{ clickToSkip: true }`** forces skippable even when global **`dialog.clickToSkip`** is **`false`**. |
 *
 * Aliased sugar (**`whenLookAt`**, **`whenUse`**, …) maps to **`game-config.json`** verb ids via **`VERB_ALIAS_CANDIDATES`** in `BenneScriptCore`. **`whenVerb`** uses an exact verb id.
 */

/**
 * High-level API passed as **`B`** in the `registerRoomScript` callback. Chains async steps (walk, delays) in order; use **`await`** only if you expose promises yourself.
 *
 * @see The module comment above for which string ids to use with each method.
 */
export class BenneScript extends BenneScriptCore {
  private static unresolvedTargetVerbWarnings = new Set<string>();

  private roomId: string;
  private roomScene: RoomScene;

  /** Cross-room flags and variables (see `GameStateManager`). */
  readonly state: BenneScriptGameStateNamespace;
  /** Item quantities; survives room loads (see `GameStateManager`). */
  readonly inventory: BenneScriptInventoryNamespace;

  constructor(events: Phaser.Events.EventEmitter, roomId: string, roomScene: RoomScene) {
    super(events, () => roomScene.time);
    this.roomId = roomId;
    this.roomScene = roomScene;
    const manager = resolveGameStateManager(roomScene.game);
    this.state = createBenneScriptGameStateNamespace(manager);
    this.inventory = createBenneScriptInventoryNamespace(manager);
  }

  /**
   * Subscribe to a **prop** verb event for this room (**prop id only**). Prefer **`when*`** / **`whenVerb`** for prop → hotspot → character resolution.
   *
   * @param propId - **`props[].id`** in this room’s `.room.json`.
   * @param verbId - Verb id from **`game-config.json`** `verbs[]` (must match **`onVerb`** on the prop).
   * @param handler - Receives {@link RoomPropInteractPayload} when the handler accepts a parameter.
   *
   * @example
   * B.onProp('desk', 'look', () => console.log('looked'));
   * B.onProp('desk', 'use', (p) => console.log(p.propId));
   */
  onProp(
    propId: string,
    verbId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    const eventId = roomPropVerbEventId(this.roomId, propId, verbId);
    this.subscribe(eventId, (payload) => {
      const p = payload as RoomPropInteractPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: RoomPropInteractPayload) => void)(p);
      }
    });
  }

  /**
   * Subscribe to a **hotspot** verb event for this room (hotspot id only). Prefer **`when*`** / **`whenVerb`** for automatic resolution.
   */
  private onHotspot(
    hotspotId: string,
    verbId: string,
    handler: ((payload: RoomHotspotInteractPayload) => void) | (() => void),
  ): void {
    const eventId = roomHotspotVerbEventId(this.roomId, hotspotId, verbId);
    this.subscribe(eventId, (payload) => {
      const p = payload as RoomHotspotInteractPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: RoomHotspotInteractPayload) => void)(p);
      }
    });
  }

  /**
   * Subscribes to **both** room-scoped and character-global verb events for a **character** target.
   * Used only when {@link registerVerbForTarget} resolves **`targetId`** to a spawned character — not for props or hotspots.
   *
   * Handlers use **`(p: any)`** for the same reason as {@link registerVerbForTarget}.
   */
  private subscribeCharacterVerb(
    characterId: string,
    verbId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    const inner = (payload: unknown) => {
      const p = payload as CharacterVerbInteractPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: any) => void)(p);
      }
    };
    this.subscribe(roomCharacterVerbEventId(this.roomId, characterId, verbId), inner);
    this.subscribe(characterVerbEventId(characterId, verbId), inner);
  }

  /**
   * Registers **`handler`** for **`verbId`** on **`targetId`** by resolving the target in order:
   *
   * 1. **Prop** — if `props[]` has this id: single room event via {@link onProp}.
   * 2. **Hotspot** — else if `hotspots[]` has this id: single room event via {@link onHotspot}.
   * 3. **Character** — else if a character with this **definition id** is spawned in the room: {@link subscribeCharacterVerb}
   *    (room + character-global events, matching **`dispatchVerbInteraction`** for characters).
   *
   * If nothing matches, calls {@link warnNoVerbTarget} once per (`roomId`, `targetId`, `verbId`).
   *
   * Handlers use **`(p: any)`** so one API can cover prop, hotspot, and character payloads without a public exported union;
   * use **`onProp`** or types from **`propInteractionEvents`** when you want strict typing.
   */
  private registerVerbForTarget(
    verbId: string,
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    if (this.roomScene.getRoomPropInstance(targetId)) {
      this.onProp(
        targetId,
        verbId,
        handler as ((payload: RoomPropInteractPayload) => void) | (() => void),
      );
      return;
    }
    if (this.roomScene.getRoomHotspotInstance(targetId)) {
      this.onHotspot(
        targetId,
        verbId,
        handler as ((payload: RoomHotspotInteractPayload) => void) | (() => void),
      );
      return;
    }
    if (this.roomScene.getCharacterSprite(targetId)) {
      this.subscribeCharacterVerb(targetId, verbId, handler);
      return;
    }
    this.warnNoVerbTarget(targetId, verbId);
  }

  private warnNoVerbTarget(targetId: string, verbId: string): void {
    const key = `${this.roomId}:${targetId}:${verbId}`;
    if (BenneScript.unresolvedTargetVerbWarnings.has(key)) {
      return;
    }
    BenneScript.unresolvedTargetVerbWarnings.add(key);
    console.warn(
      `[Benne] No prop, hotspot, or character found with id '${targetId}' for verb '${verbId}' in room '${this.roomId}'. Handler was not registered.`,
    );
  }

  /** Like {@link onProp} but passes a transformed payload (e.g. {@link whenGive}). */
  private onPropMapped<P>(
    propId: string,
    verbId: string,
    handler: ((payload: P) => void) | (() => void),
    map: (base: RoomPropInteractPayload) => P,
  ): void {
    const eventId = roomPropVerbEventId(this.roomId, propId, verbId);
    this.subscribe(eventId, (payload) => {
      const base = payload as RoomPropInteractPayload;
      const p = map(base);
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: P) => void)(p);
      }
    });
  }

  whenLookAt(targetId: string, handler: () => void): void;
  whenLookAt(targetId: string, handler: (p: any) => void): void;
  whenLookAt(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('look'), targetId, handler);
  }

  whenUse(targetId: string, handler: () => void): void;
  whenUse(targetId: string, handler: (p: any) => void): void;
  whenUse(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('use'), targetId, handler);
  }

  whenPickUp(targetId: string, handler: () => void): void;
  whenPickUp(targetId: string, handler: (p: any) => void): void;
  whenPickUp(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('pickUp'), targetId, handler);
  }

  whenGive(itemId: string, targetId: string, handler: () => void): void;
  whenGive(itemId: string, targetId: string, handler: (payload: GivePropInteractPayload) => void): void;
  whenGive(
    itemId: string,
    targetId: string,
    handler: ((payload: GivePropInteractPayload) => void) | (() => void),
  ): void {
    const verbId = this.resolveVerbId('give');
    this.onPropMapped(targetId, verbId, handler, (base) => ({ ...base, itemId }));
  }

  whenPush(targetId: string, handler: () => void): void;
  whenPush(targetId: string, handler: (p: any) => void): void;
  whenPush(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('push'), targetId, handler);
  }

  whenPull(targetId: string, handler: () => void): void;
  whenPull(targetId: string, handler: (p: any) => void): void;
  whenPull(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('pull'), targetId, handler);
  }

  whenOpen(targetId: string, handler: () => void): void;
  whenOpen(targetId: string, handler: (p: any) => void): void;
  whenOpen(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('open'), targetId, handler);
  }

  whenClose(targetId: string, handler: () => void): void;
  whenClose(targetId: string, handler: (p: any) => void): void;
  whenClose(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('close'), targetId, handler);
  }

  whenVerb(verbId: string, targetId: string, handler: () => void): void;
  whenVerb(verbId: string, targetId: string, handler: (p: any) => void): void;
  whenVerb(
    verbId: string,
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(verbId, targetId, handler);
  }

  whenTalkTo(targetId: string, handler: () => void): void;
  whenTalkTo(targetId: string, handler: (p: any) => void): void;
  whenTalkTo(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('talkTo'), targetId, handler);
  }

  prop(propId: string): BenneScriptPropFacade {
    const scene = this.roomScene;
    return {
      hide: () => {
        scene.setPropScriptVisible(propId, false);
      },
      show: () => {
        scene.setPropScriptVisible(propId, true);
      },
      get visible() {
        return scene.getPropScriptVisible(propId);
      },
      set visible(v: boolean) {
        scene.setPropScriptVisible(propId, v);
      },
      get description() {
        return scene.getPropScriptDescription(propId);
      },
      set description(v: string) {
        scene.setPropScriptDescription(propId, v);
      },
    };
  }

  private makeCharacterFacade(definitionId: string): BenneScriptCharacterFacade {
    const scene = this.roomScene;

    const runCharacterPlayAnimation = (tag: string): void => {
      const sprite = scene.getCharacterSprite(definitionId);
      if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
        if (scene.anims.exists(tag)) {
          sprite.play(tag);
        } else {
          console.warn(`[Benne] Unknown animation tag "${tag}" for character "${definitionId}"`);
        }
      }
    };

    const runCharacterFace = (direction: CharacterFacingLetter): void => {
      const sprite = scene.getCharacterSprite(definitionId) as DirectionalCharacterSprite | undefined;
      if (sprite?.anims) {
        playDirectionalAnimation(sprite, 'Idle', direction);
      }
    };

    const logCharacterSay = (line: string): void => {
      console.log(`[Character ${definitionId}] ${line}`);
    };

    return {
      walkTo: withNow(
        (target: Point2 | string) => {
          this.chain(() => scene.walkCharacterTo(definitionId, target));
        },
        (target: Point2 | string) => {
          void scene.walkCharacterTo(definitionId, target);
        },
      ),
      playAnimation: withNow(
        (tag: string) => {
          this.chain(() => {
            runCharacterPlayAnimation(tag);
            return Promise.resolve();
          });
        },
        runCharacterPlayAnimation,
      ),
      say: withNow(
        (line: string, options?: BenneScriptSayLineOptions) => {
          logCharacterSay(line);
          this.queueSayDialogWithInputLock(scene, line, definitionId, true, options);
        },
        (line: string, options?: BenneScriptSayLineOptions) => {
          logCharacterSay(line);
          this.queueSayDialogWithInputLock(scene, line, definitionId, false, options);
        },
      ),
      face: withNow(
        (direction: CharacterFacingLetter) => {
          this.chain(() => {
            runCharacterFace(direction);
            return Promise.resolve();
          });
        },
        runCharacterFace,
      ),
    };
  }

  character(definitionId: string): BenneScriptCharacterFacade {
    return this.makeCharacterFacade(definitionId);
  }

  get player(): BenneScriptPlayerFacade {
    const scene = this.roomScene;

    const runPlayerPlayAnimation = (tag: string): void => {
      const pl = scene.player;
      if (pl?.anims) {
        if (scene.anims.exists(tag)) {
          pl.play(tag);
        } else {
          console.warn(`[Benne] Unknown animation tag "${tag}" for player`);
        }
      }
    };

    const runPlayerFace = (direction: CharacterFacingLetter): void => {
      const pl = scene.player;
      if (pl) {
        playDirectionalAnimation(pl, 'Idle', direction);
      }
    };

    const logPlayerSay = (line: string): void => {
      console.log(`[Player] ${line}`);
    };

    return {
      walkTo: withNow(
        (target: Point2 | string) => {
          this.chain(() => scene.walkPlayerTo(target));
        },
        (target: Point2 | string) => {
          void scene.walkPlayerTo(target);
        },
      ),
      playAnimation: withNow(
        (tag: string) => {
          this.chain(() => {
            runPlayerPlayAnimation(tag);
            return Promise.resolve();
          });
        },
        runPlayerPlayAnimation,
      ),
      say: withNow(
        (line: string, options?: BenneScriptSayLineOptions) => {
          logPlayerSay(line);
          this.queueSayDialogWithInputLock(scene, line, getStartingPlayerCharacterId(), true, options);
        },
        (line: string, options?: BenneScriptSayLineOptions) => {
          logPlayerSay(line);
          this.queueSayDialogWithInputLock(scene, line, getStartingPlayerCharacterId(), false, options);
        },
      ),
      face: withNow(
        (direction: CharacterFacingLetter) => {
          this.chain(() => {
            runPlayerFace(direction);
            return Promise.resolve();
          });
        },
        runPlayerFace,
      ),
    };
  }

  cutscene(callback: () => void): void {
    callback();
  }
}
</file>

<file path="src/types/gui.ts">
/**
 * GUI overlay definition from `src/game/guis/<id>/<id>.gui.json`.
 * Runtime composes optional `controls` in `RoomScene` (screen-space overlays); see `buildGuiOverlay` in `src/engine/gui/`.
 * Control **`id`** values (where present) are the keys used by **`GuiRuntime.getControl`** from `*.gui.ts` behaviors.
 */
export interface GuiDisplayData {
  /**
   * When true, loads `images/guis/<guiId>/<guiId>.png` and `.json` (Aseprite sheet export).
   */
  aseprite?: boolean;
}

export type GuiTextAlign = 'left' | 'center' | 'right';

/** How a GUI-sheet sprite is aligned to its control (or to the screen for full-frame art). */
export type GuiSpriteAnchor = 'top-left' | 'center' | 'screen';

/** Optional named animation clip on the GUI sheet (Aseprite tag / timeline). */
export interface GuiSpriteAnimationClip {
  loop?: boolean;
}

/** Map of clip name → options; same optional shape for `image` and `button` controls. */
export type GuiSpriteAnimationsMap = Record<string, GuiSpriteAnimationClip>;

export interface GuiTextControl {
  type: 'text';
  /** Prefer `line` for dialogue body; otherwise the first text control is the primary line. */
  id?: string;
  x: number;
  y: number;
  /** Draw order within the GUI overlay: added to the overlay’s base depth. */
  zIndex?: number;
  /** When set, overrides {@link GuiData.visible} for this line only. */
  visible?: boolean;
  text?: string;
  /** Key in `src/game/assets/fonts/fonts.json` (bitmap font). */
  font: string;
  fontSize: number;
  color: string;
  align?: GuiTextAlign;
  /** When set, enables word wrap at this width in screen pixels. */
  wordWrapWidth?: number;
  /**
   * Extra horizontal gap between glyphs (Phaser `BitmapText` letter spacing).
   * When omitted, `defaultLetterSpacing` for this control's `font` in `src/game/assets/fonts/fonts.json` is used, else 0.
   */
  letterSpacing?: number;
}

/**
 * Inventory panel control that displays a scrollable grid of the player's inventory.
 * Populated automatically from GameStateManager inventory on gameState:inventoryChanged.
 */
/** When set with {@link GuiInventoryPanelControl.backButton} and {@link GuiInventoryPanelControl.forwardButton}, arrow buttons scroll the panel. */
export type GuiInventoryPanelScrollDirection = 'horizontal' | 'vertical';

export interface GuiInventoryPanelControl {
  type: 'inventoryPanel';
  /** Optional ID for Bennescript targeting, e.g. B.whenInventorySlotClick('mainInv', ...) */
  id?: string;
  x: number;
  y: number;
  /** Draw order within the GUI overlay: added to the overlay’s base depth (not an absolute scene depth). */
  zIndex?: number;
  /** Whether this control is initially visible */
  visible?: boolean;

  /**
   * Scroll paging: `horizontal` advances one slot per forward click; `vertical` advances one row (`cols` slots).
   * Ignored unless both {@link GuiInventoryPanelControl.backButton} and {@link GuiInventoryPanelControl.forwardButton}
   * match existing `button` control `id`s in this GUI.
   */
  scrollDirection?: GuiInventoryPanelScrollDirection;
  /** `button` control `id` in this GUI — scrolls the view backward along {@link GuiInventoryPanelControl.scrollDirection}. */
  backButton?: string;
  /** `button` control `id` in this GUI — scrolls the view forward along {@link GuiInventoryPanelControl.scrollDirection}. */
  forwardButton?: string;

  /** Grid layout */
  rows: number;
  cols: number;
  slotWidth: number;
  slotHeight: number;
  spacingX?: number;
  spacingY?: number;

  /** Visual tuning */
  itemScale?: number; // default 1.0
  showEmptySlots?: boolean; // show fixed grid with empty backgrounds when true
  backgroundTag?: string; // optional Aseprite tag for full panel backdrop
  /** Placement for {@link backgroundTag}; default `top-left`. */
  backgroundAnchor?: GuiSpriteAnchor;
  slotBackgroundTag?: string; // optional per-slot background frame
  slotBackgroundAnchor?: GuiSpriteAnchor;
  highlightTag?: string; // optional hover/selected overlay tag
  highlightAnchor?: GuiSpriteAnchor;
}

/**
 * Static or animated art from the GUI Aseprite sheet when the GUI root {@link GuiData.display}
 * has `aseprite: true` (same sheet as buttons / inventory panel on that GUI).
 */
export interface GuiImageControl {
  type: 'image';
  id?: string;
  x: number;
  y: number;
  zIndex?: number;
  visible?: boolean;
  /** Reserved for future clipping / 9-slice; does not affect `screen` background placement. */
  width?: number;
  height?: number;
  /** Aseprite frame tag on the GUI sheet; omit or empty to show nothing. */
  tag?: string;
  /**
   * Placement for {@link tag}; default `top-left`. Same vocabulary as
   * {@link GuiInventoryPanelControl.backgroundAnchor}.
   */
  backgroundAnchor?: GuiSpriteAnchor;
  /** Optional extra clips from the GUI sheet (Aseprite tags). */
  animations?: GuiSpriteAnimationsMap;
}

/** Per-interaction sheet tags; values are Aseprite tag names on this GUI’s sheet. */
export interface GuiButtonStates {
  hover?: string;
  pressed?: string;
  disabled?: string;
}

/**
 * Text + sheet-backed hit target. Uses the GUI’s Aseprite export when `display.aseprite` is true.
 * `x` and `y` are the **top-left** of the hit box (`width` × `height`); the label is laid out inside that box.
 * {@link backgroundAnchor} only affects where the **background** sheet sprite is drawn, not where the bounds sit
 * (same idea as {@link GuiInventoryPanelControl.backgroundAnchor}).
 */
export interface GuiButtonControl {
  type: 'button';
  /** Unique within this GUI (Inspector, Bennescript `whenButtonClick`, future compositor). */
  id: string;
  x: number;
  y: number;
  zIndex?: number;
  visible?: boolean;
  /** Hit-testing width in screen pixels; also used to position the label within the hit box. */
  width: number;
  /** Hit-testing height in screen pixels; also used to position the label within the hit box. */
  height: number;
  /**
   * How the **background** sheet sprite is pinned relative to the hit box (`x`,`y`,`width`,`height`).
   * Does not move the hit box: `top-left` pins art to the box’s top-left, `center` to its center, `screen` to canvas (0,0) like full-frame HUD art.
   */
  backgroundAnchor?: GuiSpriteAnchor;
  text: string;
  /** Key in `src/game/assets/fonts/fonts.json` (bitmap font). */
  font: string;
  fontSize: number;
  textColor: string;
  textAlign?: GuiTextAlign;
  /** Fine-tune label position in pixels (default 0). */
  textOffsetX?: number;
  textOffsetY?: number;
  /** Default visual tag on the GUI sheet. */
  backgroundTag: string;
  /** Hover / pressed / disabled sheet tags. */
  states?: GuiButtonStates;
  animations?: GuiSpriteAnimationsMap;
  /**
   * When false, the button ignores input; default true when omitted.
   * (Runtime compositor will map this to visuals + hit testing.)
   */
  enabled?: boolean;
}

/**
 * Invisible, rectangular hit zone with a stable **`id`**: pure behavior surface for
 * **`B.whenMouseEnter` / `B.whenMouseLeave`** in `*.gui.ts`. Never drawn (no art, no text).
 * Layout-only properties; no **`zIndex`** — triggers sit above all other controls in this GUI’s overlay
 * so they reliably catch pointer events even over inventory icons and button art.
 */
export interface GuiTriggerControl {
  type: 'trigger';
  /** Required — used by **`B.whenMouseEnter('id', …)`** and Inspector tree. */
  id: string;
  /** Optional human label for the Inspector / editor tree. */
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * When **`false`**, the trigger is inert (no pointer events emit, no cursor change).
   * Default (omitted / `true`) is active.
   */
  active?: boolean;
  /** Hide the trigger at load without deleting it. Pointer events are suppressed while hidden. */
  visible?: boolean;
}

export type GuiControl =
  | GuiTextControl
  | GuiInventoryPanelControl
  | GuiImageControl
  | GuiButtonControl
  | GuiTriggerControl;

export interface GuiData {
  id: string;
  name: string;
  description?: string;
  /**
   * Initial screen-space **x** offset of the packed **`gui.root`** container at build time.
   * Controls parented under the root (every control **not** in **`fixedControls`**) are rendered at this
   * offset plus their authored control **`x`**. Fixed controls are unaffected. Omitted = 0.
   * Runtime tweens via **`gui.root.tweenTo({ x: … })`** still work; this is just the initial value.
   */
  x?: number;
  /**
   * Initial screen-space **y** offset of the packed **`gui.root`** container at build time.
   * Typically used to park a HUD offscreen (e.g. **`y: -34`** for a dropdown bar) so a **`tweenTo({ y: 0 })`**
   * in **`onGuiBuilt`** reveals it. See **`x`** for layering semantics; fixed controls are unaffected.
   */
  y?: number;
  /**
   * Control **`id`** values (from **`controls[]`**) that stay **outside** the packed **`gui.root`**
   * container at runtime, so **`gui.root.tweenTo`** / whole-overlay moves do not affect them.
   * Omitted ids and unknown strings are ignored. Controls without an **`id`** cannot be listed here.
   */
  fixedControls?: string[];
  /**
   * When **`false`**, the overlay starts hidden at room load; when **`true`**, it starts visible.
   * (`RoomScene` builds every GUI under `src/game/guis/` except the engine-driven **`dialog-text`** overlay,
   * which is shown via `setDialogTextOverlay` regardless of this flag at boot.)
   * Per-control `visible` can still override for individual controls.
   */
  visible: boolean;
  display: GuiDisplayData;
  controls?: GuiControl[];
}
</file>

<file path="src/types/room.ts">
import type { CharacterFacingLetter, CharacterAnimationsConfig } from './character';

export interface Point2 {
  x: number;
  y: number;
}

/** Inner ring subtracted from a walkable polygon when `active` is not false. */
export interface WalkableHole {
  id: string;
  /** When false, this ring does not cut a hole (ignored for walk tests and debug). Omitted = active. */
  active?: boolean;
  points: Point2[];
}

export interface WalkablePolygon {
  id: string;
  /** When false, this polygon is ignored for walking and debug overlays. Omitted = active. */
  active?: boolean;
  points: Point2[];
  /** Optional holes (each an inner closed ring). Inactive holes are ignored. */
  holes?: WalkableHole[];
}

/**
 * Clickable room hotspot: closed polygon in room pixels (same space as walkable meshes).
 * The engine requires at least three vertices in `points` for hit-testing.
 */
export interface RoomHotspotData {
  id: string;
  /** When false, ignored for interaction. Omitted = active. */
  active?: boolean;
  description?: string;
  /** Draw / hit stacking vs other hotspots (higher tested later, tends to sit on top). */
  zIndex?: number;
  /** Polygon hit area in room pixels (at least three vertices). */
  points: Point2[];
  /** Where the player walks when this hotspot is used (optional; editor + future walk-to flow). */
  walkToPoint?: Point2;
  /** Facing target after walking (optional; pairs with `walkToPoint`). */
  lookAtPoint?: Point2;
  /** Supported verbs for this hotspot (keys match `game-config.json` `verbs[].id`). */
  onVerb?: Record<string, boolean>;
  /** Enables object-level fallback dispatch when no supported verb matches. */
  onVerbFallback?: boolean;
}

/** Named marker in room space (spawns, triggers, script anchors). */
export interface RoomPointData {
  id: string;
  x: number;
  y: number;
}

/** Non-walkable logical area (puzzle bounds, triggers) as a closed polygon in room space. */
export interface RoomRegionData {
  id: string;
  /** When false, ignored by tooling/runtime that respects regions. Omitted = active. */
  active?: boolean;
  points: Point2[];
}

export interface RoomCharacterInstance {
  /** Unique id for this placement in the room (Phaser texture key suffix). */
  instanceId: string;
  /** Path relative to `src/game/characters/` (e.g. `clerk/clerk.character.json`). */
  definition: string;
  x: number;
  y: number;
  /** Facing for the first directional animation (e.g. `Idle` + `L` -> `IdleL`). */
  initialFacing?: CharacterFacingLetter;
  /** Base name before direction suffix; default `Idle`. */
  initialAnimation?: string;
  /** When false, sprite is hidden and not interactive. Default true. */
  visible?: boolean;
  /** Added to the engine character layer base depth; higher draws in front of lower. */
  zIndex?: number;
}

/** Clickable / hit-test region for a room prop, in room pixel space (same as walkable polygons). */
export interface RoomPropCollider {
  points: Point2[];
}

/**
 * One placed prop in a room: Aseprite tag on this room's sheet (`images/rooms/<roomId>/`), draw order, and interaction.
 */
export interface RoomPropInstance {
  id: string;
  /**
   * Aseprite frame-tag name for this prop. Must appear in `meta.frameTags` on the room sheet
   * (see `getAsepriteFrameTagNames('room', roomId)`); cels with no tag are not props.
   */
  tag: string;
  /**
   * Optional extra root for `<root>-*` clip families on the room sheet (editor / import tooling).
   * When set (non-empty), tags matching `defaultAnimation` or `defaultAnimation-*` are grouped with this prop
   * alongside tags matching `id` / `id-*`. Omitted when `id` alone is the Aseprite prefix root.
   */
  defaultAnimation?: string;
  /** Sprite position in room pixels (default top-left 0,0 for full-room composite frames). */
  x?: number;
  y?: number;
  /** Draw order: higher values render in front of lower values. */
  zIndex?: number;
  /** When true, the prop may receive clicks; the engine dispatches verb scripts immediately (no auto walk/face). */
  clickable?: boolean;
  visible?: boolean;
  /** 0–1; default 1. */
  alpha?: number;
  /**
   * Optional stand position for script-driven movement (not used by the engine for clicks).
   * Game scripts may read this from payloads / room data when implementing walk-to-object behavior.
   */
  walkToPoint?: Point2;
  /**
   * Optional facing target for script-driven facing (not used by the engine for clicks).
   */
  lookAtPoint?: Point2;
  description?: string;
  /** Hit area in room space; required when `clickable` is true. */
  collider?: RoomPropCollider;
  /** Supported verbs for this prop (keys match `game-config.json` `verbs[].id`). */
  onVerb?: Record<string, boolean>;
  /** Enables object-level fallback dispatch when no supported verb matches (before global handlers). */
  onVerbFallback?: boolean;
  /** Per-tag playback (loop, frameDuration); keys match Aseprite tags on this room's sheet. */
  animations?: CharacterAnimationsConfig;
  /**
   * Parallax multiplier vs camera view. Each frame:
   * `sprite position = parallaxDepth * (x,y) + (1 - parallaxDepth) * (worldView.x, worldView.y)`.
   * - `0` — moves fully with the camera (world position tracks scroll origin)
   * - `0–1` — distant; moves slower than the camera
   * - `1` — no parallax (default if omitted); stays at authored `(x, y)`
   * - `>1` — foreground; moves faster than the camera
   */
  parallaxDepth?: number;
}

export interface RoomData {
  id: string;
  name: string;
  /**
   * Optional static backdrop under props. When omitted, only props (and game backgroundColor) show.
   */
  background?: {
    /** Path under `src/game/assets/` (e.g. `images/backgrounds/office.png`). Resolved by Vite at build time. */
    image: string;
  };
  /**
   * Explicit room dimensions in pixels. When omitted the room is assumed to be the same size as the
   * game viewport (e.g. 352x198). Set this when the background or prop sheet is wider or taller than
   * the game resolution so the camera can scroll.
   */
  size?: { width: number; height: number };
  /**
   * Camera scroll bounds in room pixel space. Restricts how far the camera can pan within the room.
   * When omitted the camera is bounded by the full room `size`.
   * Equivalent to "scroll bounds" in PowerQuest: the character can walk beyond scroll bounds but the
   * camera stops panning before reaching the room edge.
   */
  scrollBounds?: { x: number; y: number; width: number; height: number };
  walkable: {
    polygons: WalkablePolygon[];
  };
  hotspots: RoomHotspotData[];
  /** Named points in room space (optional; used by editor and future systems). */
  points?: RoomPointData[];
  /** Closed polygons for regions (optional; editor + future gameplay). */
  regions?: RoomRegionData[];
  /**
   * Layered Aseprite props from `images/rooms/<id>/<id>.png` + `.json` (one sheet per room).
   */
  props?: RoomPropInstance[];
  /** NPCs / props that use a character definition. */
  characters?: RoomCharacterInstance[];
}
</file>

<file path="src/engine/gui/buildGuiOverlay.ts">
/**
 * Composes GUI `BitmapText` overlays. The shipped game uses the **Canvas** renderer (`gameConfig.ts`) so glyphs
 * respect `roundPixels`; Phaser’s **WebGL** `BitmapText` path does not round per character — avoid switching the
 * main game to WebGL without revisiting dialogue crispness.
 */
import * as Phaser from 'phaser';
import gameFontsManifest from '../../game/assets/fonts/fonts.json';
import { isBenneGameCursorAsepriteEnabled } from '../../game/cursorAseprite';
import { getGameSettings } from '../ConfigManager';
import { getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/guiAseprite';
import {
  getPerItemInventoryTextureKey,
  inventoryPhaserAnimationKeyForTag,
  sharedInventoryTextureKey,
  usesPerItemInventoryAseprite,
  usesSharedInventoryAseprite,
} from '../../game/inventoryAseprite';
import type { GameBitmapFontDefinition, GameFontsManifest } from '../../types/fonts';
import { gameEvents } from '../events/EventBus';
import { guiAllButtonsClickEventId, guiButtonClickEventId, type GuiAllButtonsClickPayload } from '../events/guiButtonEvents';
import {
  guiControlMouseEnterEventId,
  guiControlMouseLeaveEventId,
} from '../events/guiControlHoverEvents';
import type {
  GuiButtonControl,
  GuiControl,
  GuiData,
  GuiImageControl,
  GuiInventoryPanelControl,
  GuiSpriteAnchor,
  GuiTextAlign,
  GuiTextControl,
  GuiTriggerControl,
} from '../../types/gui';
import type { InventoryItemData } from '../../types/inventory';
import {
  GAME_STATE_INVENTORY_CHANGED_EVENT,
  GAME_STATE_REPLACED_EVENT,
} from '../../types/gameState.js';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager';
import { GuiRuntime } from '../scripting/GuiRuntime.js';

/** Slot stroke for `game-config.json` `debug.showGuiOutlines` (distinct from walkable / prop debug colors). */
const DEBUG_GUI_INVENTORY_SLOT_STROKE = 0x66ccff;

const manifest = gameFontsManifest as GameFontsManifest;

/** Renders above room characters (`CHARACTER_SCENE_DEPTH` is 10_000). */
export const GUI_TEXT_OVERLAY_DEPTH = 25_000;

/**
 * Base depth increment between stacked GUI overlays in the room (must match `RoomScene` stack math).
 * One stride must fit every authored `zIndex` / panel depth within a single overlay.
 */
export const GUI_OVERLAY_DEPTH_STRIDE = 10_000;

export interface GuiOverlayHandle {
  /** Updates the dialogue line control (`id: line`) if present, else the first text control. */
  setPrimaryText(text: string): void;
  /**
   * Places the **bottom-center** of the primary line (after word wrap) at `(x, y)` in game-canvas space,
   * then rounds. Restores authored origin/position via {@link resetPrimaryScreenPosition}.
   */
  setPrimaryScreenPositionBottomCenter(x: number, y: number): void;
  /** Restores the primary line to its authored GUI position and display origin. */
  resetPrimaryScreenPosition(): void;
  setControlText(id: string, text: string): void;
  setVisible(visible: boolean): void;
  /** Extra horizontal gap between glyphs (Phaser `BitmapText` letter spacing). */
  setLetterSpacing(spacing: number): void;
  /**
   * Top-level scene object(s) for this overlay. After packing, the **movable** authored controls live under
   * one screen-fixed **`Container`** (`gui.root` in **`GuiRuntime`**). Any control **`id`** listed in
   * **`GuiData.fixedControls`** is kept as an additional top-level object (not parented under that container)
   * so root-level tweens do not move it; those objects are included here after the container. Phaser renders
   * packed children through the parent; camera `ignore()` follows the same rule for every entry. Runtime-only
   * behavior objects may append when a **`GuiRuntime`** exists. Used by **`RoomScene`** to route GUI through a
   * dedicated UI camera with `origin=(0,0)` in the editor preview so `scrollFactor=0` placement survives
   * non-unit camera zoom (Phaser 4's origin-aware zoom math otherwise pushes screen-fixed overlays far off
   * the viewport when `camera.zoom ≠ 1`).
   */
  readonly gameObjects: readonly Phaser.GameObjects.GameObject[];
  destroy(): void;
}

/**
 * Result of {@link buildGuiOverlay}: the overlay handle plus an optional {@link GuiRuntime} factory for `*.gui.ts` behaviors.
 */
export interface BuiltGuiOverlay {
  handle: GuiOverlayHandle;
  /**
   * Creates a {@link GuiRuntime} for this overlay (control facades, triggers). Call once per room load.
   * Disposal is chained into {@link GuiOverlayHandle.destroy}.
   */
  createGuiRuntime(queueInteraction: (factory: () => Promise<unknown>) => void): GuiRuntime;
}

function originFromAlign(align: GuiTextAlign | undefined): { x: number; y: number } {
  switch (align) {
    case 'center':
      return { x: 0.5, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

function hexStringToTint(hex: string): number {
  try {
    return Phaser.Display.Color.HexStringToColor(hex).color;
  } catch {
    return 0xffffff;
  }
}

/**
 * Phaser WebGL `BitmapText` uses unrounded per-glyph positions from `GetBitmapTextSize`; center/right alignment
 * often adds half-pixel offsets. For wrapped text, using an **even** max width makes longest-line metrics more
 * often land on whole pixels (debug: compare `align: left` vs `center` on the same string).
 */
function evenWordWrapWidth(width: number): number {
  const w = Math.floor(width);
  if (w < 2) {
    return 0;
  }
  return w % 2 === 0 ? w : w - 1;
}

function bitmapTextLineAlign(align: GuiTextAlign | undefined): number {
  switch (align) {
    case 'center':
      return 1;
    case 'right':
      return 2;
    default:
      return 0;
  }
}

/**
 * BMFont XML often uses a negative `info size` (e.g. -8). Phaser scales with `fontSize / fontData.size`; if signs
 * disagree, scale becomes negative and flips/mirrors glyphs. Match the sign of `fontData.size`.
 */
function effectiveBitmapFontRenderSize(scene: Phaser.Scene, fontKey: string, fontSize: number): number {
  const entry = scene.cache.bitmapFont.get(fontKey) as { data?: { size?: number } } | null;
  const dataSize = entry?.data?.size;
  if (dataSize == null || dataSize === 0) {
    return fontSize;
  }
  return dataSize < 0 ? -Math.abs(fontSize) : Math.abs(fontSize);
}

const ASEPRITE_ANIMS_FROM_ATLAS_REGISTRY_PREFIX = '__benneAsepriteAnims:';

/**
 * Registers Aseprite frame-tag clips on the scene animation manager (matches GUI / inventory preview boot).
 * Safe to call repeatedly; runs {@link Phaser.Animations.AnimationManager#createFromAseprite} at most once per
 * texture key per {@link Phaser.Game}.
 */
function ensureAsepriteAnimationsFromAtlas(scene: Phaser.Scene, textureKey: string): void {
  if (!scene.textures.exists(textureKey)) {
    return;
  }
  const flagKey = `${ASEPRITE_ANIMS_FROM_ATLAS_REGISTRY_PREFIX}${textureKey}`;
  if (scene.game.registry.get(flagKey)) {
    return;
  }
  scene.anims.createFromAseprite(textureKey);
  scene.game.registry.set(flagKey, true);
}

function guiSpriteAnchorOrDefault(a: GuiSpriteAnchor | undefined): GuiSpriteAnchor {
  return a ?? 'top-left';
}

/**
 * Applies a GUI Aseprite **tag** (animation or named frame) to `sprite`.
 * Returns **`false`** when the tag does not exist on the sheet — callers must **`destroy`** the sprite so the
 * atlas’s default frame (often an untagged first cel) never appears on screen.
 */
function stopSpriteAnimationIfPlaying(sprite: Phaser.GameObjects.Sprite): void {
  if (sprite.anims?.isPlaying) {
    sprite.anims.stop();
  }
}

/** Stops any playing clip before applying a tag so static frames and clips can switch cleanly. */
function reapplyGuiSheetTag(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  textureKey: string,
  tag: string,
): boolean {
  stopSpriteAnimationIfPlaying(sprite);
  return tryApplyGuiSheetTag(scene, sprite, textureKey, tag);
}

function tryApplyGuiSheetTag(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  textureKey: string,
  tag: string,
): boolean {
  const t = tag.trim();
  if (!t || !scene.textures.exists(textureKey)) {
    return false;
  }
  ensureAsepriteAnimationsFromAtlas(scene, textureKey);
  if (scene.anims.exists(t)) {
    sprite.play(t);
    return true;
  }
  try {
    const tex = scene.textures.get(textureKey);
    const names = tex.getFrameNames(false);
    if (!names.includes(t)) {
      return false;
    }
    sprite.setFrame(t);
    return true;
  } catch {
    return false;
  }
}

/**
 * Positions a GUI-sheet sprite for `top-left`, `center`, or `screen` anchor.
 * `screen`: top-left of the game canvas / internal resolution — ignores `x`/`y` for placement (full-frame HUD art).
 */
function applyGuiSpriteAnchor(
  sprite: Phaser.GameObjects.Sprite,
  anchor: GuiSpriteAnchor,
  x: number,
  y: number,
): void {
  switch (anchor) {
    case 'center':
      sprite.setOrigin(0.5, 0.5);
      sprite.setPosition(Math.round(x), Math.round(y));
      break;
    case 'screen':
      sprite.setOrigin(0, 0);
      /** Absolute screen / canvas coordinates; control `x`/`y` are ignored for draw position. */
      sprite.setPosition(0, 0);
      break;
    default:
      sprite.setOrigin(0, 0);
      sprite.setPosition(Math.round(x), Math.round(y));
  }
}

/**
 * Places the button’s sheet sprite using `anchor` **within the button’s logical bounds** (same idea as
 * {@link GuiInventoryPanelControl.backgroundAnchor} for the panel backdrop: `x`/`y` + `width`/`height` define the
 * control; anchor only affects where the art is pinned).
 */
function placeGuiButtonBackgroundSprite(
  sprite: Phaser.GameObjects.Sprite,
  anchor: GuiSpriteAnchor,
  px: number,
  py: number,
  w: number,
  h: number,
): void {
  switch (anchor) {
    case 'center':
      applyGuiSpriteAnchor(sprite, 'center', px + w / 2, py + h / 2);
      break;
    case 'screen':
      /** Full-canvas art; `x`/`y`/`width`/`height` still define the hit box only. */
      applyGuiSpriteAnchor(sprite, 'screen', px, py);
      break;
    default:
      applyGuiSpriteAnchor(sprite, 'top-left', px, py);
      break;
  }
}

interface BuiltGuiButton {
  /** Invisible hit box (`width` × `height`); carries pointer handlers. */
  readonly hitTarget: Phaser.GameObjects.Container;
  readonly background: Phaser.GameObjects.Sprite | null;
  readonly label: Phaser.GameObjects.BitmapText | null;
  readonly enabled: boolean;
  readonly width: number;
  readonly height: number;
}

/** Depth bias for the **debug outline** of trigger rectangles within their overlay (layout visualisation only). */
const GUI_TRIGGER_DEBUG_DEPTH_BIAS = 5_000;

/**
 * Builds the visual placeholder for a `trigger` control. The rectangle is **never interactive** — input is
 * routed through a scene-level `pointermove` observer (see `installGuiTriggerPointerObserver`). Keeping it as a
 * normal scene object lets packing, camera routing, and `setVisible` keep working uniformly across controls.
 * Local hit rect is **`(0, 0, width, height)`** from the top-left so authored `x` / `y` matches other controls.
 */
function buildGuiTriggerZone(
  scene: Phaser.Scene,
  c: GuiTriggerControl,
  baseDepth: number,
  startVisible: boolean,
): Phaser.GameObjects.Rectangle | null {
  const w = c.width;
  const h = c.height;
  if (w <= 0 || h <= 0) {
    return null;
  }
  const id = c.id?.trim() ?? '';
  if (!id) {
    return null;
  }
  const px = Math.round(c.x);
  const py = Math.round(c.y);
  const overlayVisible = startVisible && c.visible !== false;
  const showGuiDebug = getGameSettings().debug?.showGuiOutlines === true;

  /**
   * Debug mode fills a translucent rect and strokes its border; in shipping mode the rect is invisible but
   * still participates in display-list packing and camera ignore routing like any other control.
   */
  const rect = scene.add.rectangle(px + w / 2, py + h / 2, w, h, 0x88ff88, showGuiDebug ? 0.18 : 0);
  rect.setScrollFactor(0, 0);
  rect.setDepth(baseDepth + GUI_TRIGGER_DEBUG_DEPTH_BIAS);
  rect.setVisible(overlayVisible);
  if (showGuiDebug) {
    rect.setStrokeStyle(1, 0x88ff88, 0.9);
  }
  return rect;
}

/**
 * Minimum positional / visibility fields read by {@link installGuiControlPointerHoverObserver}. Declared as a
 * structural type (not an interface extending `GameObject`) so it accepts the overlap shared by `Sprite`,
 * `Container`, `BitmapText`, and `Rectangle` without fighting Phaser 4's strict typings.
 */
type GuiHoverObservableGameObject = Phaser.GameObjects.GameObject & {
  visible: boolean;
  setVisible(value: boolean): unknown;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  displayWidth?: number;
  displayHeight?: number;
  parentContainer?: Phaser.GameObjects.Container | null;
  getBounds?: () => Phaser.Geom.Rectangle;
};

/**
 * Computes the current **screen-space** bounds of a `scrollFactor: 0` GUI control. Prefers `getBounds()` because
 * it handles arbitrary transforms / packed children (e.g. `inventoryPanel` containers); falls back to a centered
 * rect for plain `Rectangle` game objects (whose `getBounds()` is sometimes 0-sized on Phaser 4 when the Shape
 * has no stroke). `pointer.x` / `pointer.y` are already in screen space, and `scrollFactor: 0` keeps world ==
 * screen for these objects, so no camera math is needed in the non-editor runtime path.
 */
function computeGuiControlWorldRect(
  target: GuiHoverObservableGameObject,
): { left: number; top: number; right: number; bottom: number } | null {
  if (typeof target.getBounds === 'function') {
    const b = target.getBounds();
    if (b.width > 0 && b.height > 0) {
      return { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height };
    }
  }
  const w = target.displayWidth ?? target.width ?? 0;
  const h = target.displayHeight ?? target.height ?? 0;
  if (!(w > 0 && h > 0)) {
    return null;
  }
  const parent = target.parentContainer ?? null;
  const ox = parent ? parent.x : 0;
  const oy = parent ? parent.y : 0;
  const cx = (target.x ?? 0) + ox;
  const cy = (target.y ?? 0) + oy;
  /** Rectangle game objects are centered on `(x, y)`; other objects rarely hit this fallback. */
  const halfW = w / 2;
  const halfH = h / 2;
  return { left: cx - halfW, top: cy - halfH, right: cx + halfW, bottom: cy + halfH };
}

/**
 * Scene-level pointer observer that emits `guiControlMouseEnter/LeaveEventId` on rect-containment transitions
 * for a GUI control, **without** calling `setInteractive`. Used for `trigger` controls and for non-button
 * controls (`image`, `inventoryPanel`, `text`) so hover events work uniformly while the room beneath keeps
 * receiving prop / hotspot / character clicks. Gated by live `visible` state (the control's own plus its
 * `parentContainer`'s) so a parked / hidden overlay never spurious-fires. Hooks `setVisible` so hiding the
 * control flushes a synthetic leave. Returns a disposer that detaches the listener and — if currently inside —
 * emits a final leave.
 */
function installGuiControlPointerHoverObserver(
  scene: Phaser.Scene,
  gui: GuiData,
  controlId: string,
  target: GuiHoverObservableGameObject,
  options?: { active?: boolean },
): () => void {
  const id = controlId.trim();
  if (!id) {
    return () => {};
  }
  if (options?.active === false) {
    return () => {};
  }
  let inside = false;

  const isEffectivelyVisible = (): boolean => {
    if (!target.visible) {
      return false;
    }
    const parent = target.parentContainer ?? null;
    if (parent && !parent.visible) {
      return false;
    }
    return true;
  };

  const emitLeaveIfInside = (): void => {
    if (!inside) {
      return;
    }
    inside = false;
    gameEvents.emit(guiControlMouseLeaveEventId(gui.id, id));
  };

  const onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!isEffectivelyVisible()) {
      emitLeaveIfInside();
      return;
    }
    const rect = computeGuiControlWorldRect(target);
    if (!rect) {
      emitLeaveIfInside();
      return;
    }
    const inRect =
      pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
    if (inRect && !inside) {
      inside = true;
      gameEvents.emit(guiControlMouseEnterEventId(gui.id, id));
    } else if (!inRect && inside) {
      emitLeaveIfInside();
    }
  };

  scene.input.on(Phaser.Input.Events.POINTER_MOVE, onPointerMove);

  /** Hook `setVisible` so hiding the control (or its overlay) flushes a leave synchronously. */
  const originalSetVisible = target.setVisible.bind(target);
  target.setVisible = (v: boolean) => {
    const prev = target.visible;
    const result = originalSetVisible(v);
    if (prev && !v) {
      emitLeaveIfInside();
    }
    return result;
  };

  return () => {
    scene.input.off(Phaser.Input.Events.POINTER_MOVE, onPointerMove);
    emitLeaveIfInside();
    target.setVisible = originalSetVisible;
  };
}

/**
 * Installs pointer **mouseenter / mouseleave** forwarding on `target` so `B.whenMouseEnter(controlId, …)` /
 * `whenMouseLeave(controlId, …)` observe it. Safe for objects that are already interactive (e.g. buttons);
 * for non-interactive ones the caller must call `setInteractive` beforehand (triggers, inventory panels, images, text).
 * Returns a disposer that detaches listeners.
 */
function wireGuiControlHoverEvents(
  gui: GuiData,
  controlId: string,
  target: Phaser.GameObjects.GameObject,
): () => void {
  const id = controlId.trim();
  if (!id) {
    return () => {};
  }
  const onOver = (): void => {
    gameEvents.emit(guiControlMouseEnterEventId(gui.id, id));
  };
  const onOut = (): void => {
    gameEvents.emit(guiControlMouseLeaveEventId(gui.id, id));
  };
  target.on('pointerover', onOver);
  target.on('pointerout', onOut);
  return () => {
    target.off('pointerover', onOver);
    target.off('pointerout', onOut);
  };
}

function applyGuiButtonInteractivity(
  container: Phaser.GameObjects.Container,
  width: number,
  height: number,
  enabled: boolean,
): void {
  const g = new Phaser.Geom.Rectangle(0, 0, width, height);
  container.setInteractive(g, Phaser.Geom.Rectangle.Contains);
  if (container.input) {
    /** `true` uses the hand cursor over the hit area (Phaser `InteractiveObject.cursor`). */
    const showOsHand = enabled && !isBenneGameCursorAsepriteEnabled(getGameSettings());
    container.input.cursor = showOsHand;
  }
}

function buildGuiButton(
  scene: Phaser.Scene,
  gui: GuiData,
  c: GuiButtonControl,
  baseDepth: number,
  startVisible: boolean,
  /** Runs after a successful click passes guards, before {@link gameEvents} button emits. */
  onBeforeEmit?: () => void,
): BuiltGuiButton | null {
  const w = c.width;
  const h = c.height;
  if (w <= 0 || h <= 0) {
    return null;
  }

  const z = c.zIndex ?? 0;
  const d = baseDepth + z;
  const overlayVisible = startVisible && c.visible !== false;
  const bgAnchor = guiSpriteAnchorOrDefault(c.backgroundAnchor);
  const px = Math.round(c.x);
  const py = Math.round(c.y);

  const hitTarget = scene.add.container(px, py);
  hitTarget.setScrollFactor(0, 0);
  /** Above label so the hit box receives input over the bitmap text. */
  hitTarget.setDepth(d + 2);
  hitTarget.setVisible(overlayVisible);
  hitTarget.setData('benneGuiButton', true);

  const guiTextureKey = getAsepriteTextureKey(gui.id);
  const defaultBgTag = c.backgroundTag.trim();
  let bg: Phaser.GameObjects.Sprite | null = null;

  if (usesAsepriteDisplay(gui) && defaultBgTag && scene.textures.exists(guiTextureKey)) {
    const sprite = scene.add.sprite(0, 0, guiTextureKey);
    sprite.setVisible(false);
    sprite.setScrollFactor(0, 0);
    sprite.setDepth(d);
    if (!tryApplyGuiSheetTag(scene, sprite, guiTextureKey, defaultBgTag)) {
      sprite.destroy();
    } else {
      sprite.setVisible(overlayVisible);
      placeGuiButtonBackgroundSprite(sprite, bgAnchor, px, py, w, h);
      bg = sprite;
    }
  }

  let label: Phaser.GameObjects.BitmapText | null = null;
  const fontEntry = manifest[c.font] as GameBitmapFontDefinition | undefined;
  if (fontEntry && scene.cache.bitmapFont.exists(c.font)) {
    const align = c.textAlign ?? 'center';
    const ox = c.textOffsetX ?? 0;
    const oy = c.textOffsetY ?? 0;
    const pad = 4;
    const bx = hitTarget.x;
    const by = hitTarget.y;
    const labelX = bx + (align === 'left' ? pad + ox : align === 'right' ? w - pad + ox : w / 2 + ox);
    const labelY = by + h / 2 + oy;
    const lineAlign = bitmapTextLineAlign(align);
    const renderSize = effectiveBitmapFontRenderSize(scene, c.font, c.fontSize);
    const bt = scene.add.bitmapText(labelX, labelY, c.font, c.text ?? '', renderSize, lineAlign);
    bt.setOrigin(align === 'left' ? 0 : align === 'right' ? 1 : 0.5, 0.5);
    bt.clearTint();
    bt.setTint(hexStringToTint(c.textColor));
    const letterSpacing = fontEntry.defaultLetterSpacing ?? 0;
    if (letterSpacing !== 0) {
      bt.setLetterSpacing(letterSpacing);
    }
    bt.setScrollFactor(0, 0);
    bt.setDepth(d + 1);
    bt.setVisible(overlayVisible);
    label = bt;
  } else if (c.font.trim().length > 0) {
    console.warn(`[Benne] GUI button "${c.id}": unknown or unloaded font "${c.font}".`);
  }

  if (!bg && !label) {
    hitTarget.destroy();
    return null;
  }

  const enabled = c.enabled !== false;
  if (!enabled) {
    hitTarget.setAlpha(0.45);
    bg?.setAlpha(0.45);
    label?.setAlpha(0.45);
    const dTag = c.states?.disabled?.trim();
    if (bg && dTag) {
      reapplyGuiSheetTag(scene, bg, guiTextureKey, dTag);
    }
  }

  if (overlayVisible && enabled) {
    applyGuiButtonInteractivity(hitTarget, w, h, enabled);
  }

  const hoverTag = c.states?.hover?.trim();
  const pressedTag = c.states?.pressed?.trim();
  const disabledTag = c.states?.disabled?.trim();

  if (bg && enabled && (hoverTag || pressedTag || disabledTag)) {
    const textureKey = guiTextureKey;
    const restoreDefault = (): void => {
      if (!bg) {
        return;
      }
      reapplyGuiSheetTag(scene, bg, textureKey, defaultBgTag);
    };

    hitTarget.on('pointerover', () => {
      if (!enabled || !bg) {
        return;
      }
      if (hoverTag && !reapplyGuiSheetTag(scene, bg, textureKey, hoverTag)) {
        restoreDefault();
      }
    });
    hitTarget.on('pointerout', () => {
      if (!bg) {
        return;
      }
      restoreDefault();
    });
    hitTarget.on('pointerdown', () => {
      if (!enabled || !bg) {
        return;
      }
      if (pressedTag && !reapplyGuiSheetTag(scene, bg, textureKey, pressedTag)) {
        restoreDefault();
      }
    });
    hitTarget.on('pointerup', () => {
      if (!enabled || !bg) {
        return;
      }
      restoreDefault();
    });
  }

  hitTarget.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    if (!enabled || !hitTarget.visible || !pointer.leftButtonReleased()) {
      return;
    }
    onBeforeEmit?.();
    gameEvents.emit(guiButtonClickEventId(gui.id, c.id));
    gameEvents.emit(guiAllButtonsClickEventId(gui.id), { buttonId: c.id } satisfies GuiAllButtonsClickPayload);
  });

  return { hitTarget, background: bg, label, enabled, width: w, height: h };
}

function addGuiBitmapLine(
  scene: Phaser.Scene,
  c: GuiTextControl,
  initial: string,
  depth: number,
  visible: boolean,
): Phaser.GameObjects.BitmapText | null {
  const fontEntry = manifest[c.font] as GameBitmapFontDefinition | undefined;
  if (!fontEntry) {
    console.warn(`[Benne] Unknown GUI font id "${c.font}" — add it to src/game/assets/fonts/fonts.json.`);
    return null;
  }

  if (!scene.cache.bitmapFont.exists(c.font)) {
    console.warn(`[Benne] Bitmap font "${c.font}" is not in the cache (preload order?).`);
    return null;
  }

  const o = originFromAlign(c.align);
  const x = Math.round(c.x);
  const y = Math.round(c.y);
  const lineAlign = bitmapTextLineAlign(c.align);
  const renderSize = effectiveBitmapFontRenderSize(scene, c.font, c.fontSize);
  const bt = scene.add.bitmapText(x, y, c.font, initial, renderSize, lineAlign);
  bt.setOrigin(o.x, o.y);
  bt.clearTint();
  bt.setTint(hexStringToTint(c.color));
  if (c.wordWrapWidth != null && c.wordWrapWidth > 0) {
    const maxW = evenWordWrapWidth(c.wordWrapWidth);
    if (maxW > 0) {
      bt.setMaxWidth(maxW);
    }
  }
  const letterSpacing = c.letterSpacing ?? fontEntry.defaultLetterSpacing ?? 0;
  if (letterSpacing !== 0) {
    bt.setLetterSpacing(letterSpacing);
  }
  bt.setScrollFactor(0, 0);
  bt.setDepth(depth);
  bt.setVisible(visible);
  return bt;
}

function addGuiImageSprite(
  scene: Phaser.Scene,
  gui: GuiData,
  c: GuiImageControl,
  depth: number,
  startVisible: boolean,
  extraSprites: Phaser.GameObjects.Sprite[],
  controlsById: Map<string, Phaser.GameObjects.GameObject>,
): Phaser.GameObjects.Sprite | null {
  if (!usesAsepriteDisplay(gui)) {
    return null;
  }
  const legacyDisplay = (c as GuiImageControl & { display?: { tag?: string; backgroundAnchor?: GuiSpriteAnchor } })
    .display;
  const tag = (c.tag ?? legacyDisplay?.tag)?.trim() ?? '';
  if (!tag) {
    return null;
  }
  const guiTextureKey = getAsepriteTextureKey(gui.id);
  if (!scene.textures.exists(guiTextureKey)) {
    return null;
  }
  const anchor = guiSpriteAnchorOrDefault(c.backgroundAnchor ?? legacyDisplay?.backgroundAnchor);
  const sprite = scene.add.sprite(0, 0, guiTextureKey);
  sprite.setVisible(false);
  sprite.setScrollFactor(0, 0);
  sprite.setDepth(depth + (c.zIndex ?? 0));
  const vis = startVisible && c.visible !== false;
  if (!tryApplyGuiSheetTag(scene, sprite, guiTextureKey, tag)) {
    sprite.destroy();
    return null;
  }
  sprite.setVisible(vis);
  if (anchor === 'screen') {
    applyGuiSpriteAnchor(sprite, anchor, c.x, c.y);
    extraSprites.push(sprite);
  } else {
    applyGuiSpriteAnchor(sprite, anchor, c.x, c.y);
    extraSprites.push(sprite);
  }
  const cid = c.id?.trim();
  if (cid) {
    controlsById.set(cid, sprite);
  }
  return sprite;
}

function collectGuiButtonIds(controls: readonly GuiControl[] | undefined): Set<string> {
  const ids = new Set<string>();
  for (const c of controls ?? []) {
    if (c.type === 'button') {
      const id = c.id.trim();
      if (id.length > 0) {
        ids.add(id);
      }
    }
  }
  return ids;
}

function inventoryPanelScrollConfigured(c: GuiInventoryPanelControl, buttonIds: Set<string>): boolean {
  if (c.scrollDirection !== 'horizontal' && c.scrollDirection !== 'vertical') {
    return false;
  }
  const back = c.backButton?.trim() ?? '';
  const fwd = c.forwardButton?.trim() ?? '';
  if (back.length === 0 || fwd.length === 0) {
    return false;
  }
  return buttonIds.has(back) && buttonIds.has(fwd);
}

function appendPreEmitForButtonId(map: Map<string, Array<() => void>>, buttonId: string, fn: () => void): void {
  const id = buttonId.trim();
  if (id.length === 0) {
    return;
  }
  const list = map.get(id);
  if (list) {
    list.push(fn);
  } else {
    map.set(id, [fn]);
  }
}

function addInventorySlotSheetSprite(
  scene: Phaser.Scene,
  guiTextureKey: string,
  tagRaw: string | undefined,
  anchorRaw: GuiSpriteAnchor | undefined,
  slotCx: number,
  slotCy: number,
  slotContainer: Phaser.GameObjects.Container,
): void {
  const tag = tagRaw?.trim() ?? '';
  if (!tag || !scene.textures.exists(guiTextureKey)) {
    return;
  }
  const anchor = guiSpriteAnchorOrDefault(anchorRaw);
  const sprite = scene.add.sprite(0, 0, guiTextureKey);
  sprite.setVisible(false);
  if (!tryApplyGuiSheetTag(scene, sprite, guiTextureKey, tag)) {
    sprite.destroy();
    return;
  }
  sprite.setVisible(true);
  /** Inside a slot container, `screen` is treated like top-left at the slot origin (full-slot art). */
  if (anchor === 'center') {
    applyGuiSpriteAnchor(sprite, anchor, slotCx, slotCy);
  } else {
    applyGuiSpriteAnchor(sprite, 'top-left', 0, 0);
  }
  slotContainer.add(sprite);
}

/**
 * Rebuilds all children of `panel` (backdrop + slot rows) for the current inventory slice starting at
 * `scrollState.offset` (row-major: slot `(r,c)` shows item index `offset + r * cols + c`).
 */
function fillInventoryPanelContent(
  panel: Phaser.GameObjects.Container,
  scene: Phaser.Scene,
  gui: GuiData,
  c: GuiInventoryPanelControl,
  scrollState: { offset: number },
  startVisible: boolean,
): void {
  panel.removeAll(true);

  const px = Math.round(c.x);
  const py = Math.round(c.y);

  const panelVisible = startVisible && c.visible !== false;
  panel.setVisible(panelVisible);

  const spacingX = c.spacingX ?? 0;
  const spacingY = c.spacingY ?? 0;
  const guiTextureKey = getAsepriteTextureKey(gui.id);
  const wantsGuiSheet = usesAsepriteDisplay(gui) && scene.textures.exists(guiTextureKey);

  const panelW = c.cols * c.slotWidth + Math.max(0, c.cols - 1) * spacingX;
  const panelH = c.rows * c.slotHeight + Math.max(0, c.rows - 1) * spacingY;

  let inventoryItems: ReadonlyArray<{ id: string; quantity: number }> = [];
  try {
    const gameState = resolveGameStateManager(scene.game);
    inventoryItems = gameState.getInventoryItems();
  } catch {
    /* e.g. GUI preview without GameStateManager on game.registry */
  }

  const capacity = Math.max(0, c.rows * c.cols);
  const n = inventoryItems.length;
  const baseMaxOffset = Math.max(0, n - capacity);
  /**
   * With `showEmptySlots`, allow scrolling until the **first slot** can show the first index of the
   * last row of items in row-major order (`floor((n-1)/cols)*cols`). That yields trailing empty slots
   * when the last row is short (e.g. 9 items, 6 cols → offset up to 6 shows three items + three empties).
   * For `rows === 1`, `n - cols` equals `n - capacity`, so the old `n - cols` extension never helped;
   * this formula covers single-row and multi-row grids.
   */
  let maxOffset = baseMaxOffset;
  if (c.showEmptySlots && capacity > 0 && n > 0 && c.cols > 0) {
    const lastRowFirstIndex = Math.floor((n - 1) / c.cols) * c.cols;
    maxOffset = Math.max(maxOffset, lastRowFirstIndex);
  }
  scrollState.offset = Math.max(0, Math.min(maxOffset, scrollState.offset));

  const bgTag = c.backgroundTag?.trim() ?? '';
  if (bgTag && wantsGuiSheet) {
    const bgAnchor = guiSpriteAnchorOrDefault(c.backgroundAnchor);
    const backdrop = scene.add.sprite(0, 0, guiTextureKey);
    backdrop.setVisible(false);
    backdrop.setScrollFactor(0, 0);
    if (!tryApplyGuiSheetTag(scene, backdrop, guiTextureKey, bgTag)) {
      backdrop.destroy();
    } else {
      backdrop.setVisible(true);
      if (bgAnchor === 'screen') {
        /** World (0,0) while staying parented so `panel.setVisible` still toggles the backdrop. */
        backdrop.setOrigin(0, 0);
        backdrop.setPosition(-px, -py);
      } else if (bgAnchor === 'center') {
        applyGuiSpriteAnchor(backdrop, bgAnchor, panelW / 2, panelH / 2);
      } else {
        applyGuiSpriteAnchor(backdrop, 'top-left', 0, 0);
      }
      panel.add(backdrop);
    }
  }

  const showGuiSlotOutlines = getGameSettings().debug?.showGuiOutlines === true;
  const slotCx = c.slotWidth / 2;
  const slotCy = c.slotHeight / 2;

  for (let row = 0; row < c.rows; row += 1) {
    for (let col = 0; col < c.cols; col += 1) {
      const invIndex = scrollState.offset + row * c.cols + col;
      if (invIndex >= inventoryItems.length && !c.showEmptySlots) {
        continue;
      }

      const slotX = col * (c.slotWidth + spacingX);
      const slotY = row * (c.slotHeight + spacingY);
      const slotContainer = scene.add.container(slotX, slotY);

      if (wantsGuiSheet) {
        addInventorySlotSheetSprite(
          scene,
          guiTextureKey,
          c.slotBackgroundTag,
          c.slotBackgroundAnchor,
          slotCx,
          slotCy,
          slotContainer,
        );
      }

      if (showGuiSlotOutlines) {
        const slotOutline = scene.add.graphics();
        slotOutline.lineStyle(1, DEBUG_GUI_INVENTORY_SLOT_STROKE, 1);
        slotOutline.strokeRect(0.5, 0.5, c.slotWidth - 1, c.slotHeight - 1);
        slotContainer.add(slotOutline);
      }

      if (invIndex < inventoryItems.length) {
        const entry = inventoryItems[invIndex]!;
        const defRaw = getInventoryDefinition(entry.id);
        const def = defRaw as InventoryItemData | undefined;
        const iconTag = def?.defaultAnimation ?? entry.id;

        let iconAdded = false;
        if (usesAsepriteDisplay(gui) && iconTag) {
          const guiKey = getAsepriteTextureKey(gui.id);
          if (scene.textures.exists(guiKey)) {
            const iconSprite = scene.add.sprite(slotCx, slotCy, guiKey).setScale(c.itemScale ?? 1).setOrigin(0.5, 0.5);
            iconSprite.setVisible(false);
            if (tryApplyGuiSheetTag(scene, iconSprite, guiKey, iconTag)) {
              iconSprite.setVisible(true);
              slotContainer.add(iconSprite);
              iconAdded = true;
            } else {
              iconSprite.destroy();
            }
          }
        }

        if (
          !iconAdded &&
          def &&
          (usesSharedInventoryAseprite(def) || usesPerItemInventoryAseprite(def))
        ) {
          const texKey = usesSharedInventoryAseprite(def)
            ? sharedInventoryTextureKey
            : getPerItemInventoryTextureKey(entry.id);
          const animKey = inventoryPhaserAnimationKeyForTag(def, iconTag);
          if (scene.textures.exists(texKey)) {
            ensureAsepriteAnimationsFromAtlas(scene, texKey);
            const playKey = scene.anims.exists(animKey)
              ? animKey
              : usesSharedInventoryAseprite(def) && scene.anims.exists(iconTag)
                ? iconTag
                : null;
            if (playKey) {
              const iconSprite = scene
                .add.sprite(slotCx, slotCy, texKey)
                .setScale(c.itemScale ?? 1)
                .setOrigin(0.5, 0.5);
              iconSprite.play(playKey);
              slotContainer.add(iconSprite);
              iconAdded = true;
            }
          }
        }

        if (!iconAdded) {
          const label = scene.add
            .text(slotCx, slotCy, entry.id.slice(0, 6), {
              fontSize: '10px',
              color: '#e0e0e0',
            })
            .setOrigin(0.5, 0.5);
          slotContainer.add(label);
        }
      }

      if (wantsGuiSheet) {
        addInventorySlotSheetSprite(
          scene,
          guiTextureKey,
          c.highlightTag,
          c.highlightAnchor,
          slotCx,
          slotCy,
          slotContainer,
        );
      }

      panel.add(slotContainer);
    }
  }
}

export interface BuildGuiOverlayOptions {
  depth?: number;
  /** When true, text starts visible (e.g. VS Code GUI preview). Default false for in-game overlays. */
  startVisible?: boolean;
  /** Shown when a control's `text` is missing or whitespace-only; omit to use empty string. */
  emptyTextPlaceholder?: string;
}

/**
 * Builds screen-space GUI controls from `gui.controls` (`text`, `inventoryPanel`, `image`, `button`).
 * Starts hidden unless `startVisible`. Font ids resolve via `fonts/fonts.json` (`load.bitmapFont` keys).
 */
export function buildGuiOverlay(
  scene: Phaser.Scene,
  gui: GuiData,
  options?: BuildGuiOverlayOptions,
): BuiltGuiOverlay | null {
  const depth = options?.depth ?? GUI_TEXT_OVERLAY_DEPTH;
  const startVisible = options?.startVisible ?? false;
  const placeholder = options?.emptyTextPlaceholder;
  const allLines: Phaser.GameObjects.BitmapText[] = [];
  const inventoryPanels: Phaser.GameObjects.Container[] = [];
  const guiButtons: BuiltGuiButton[] = [];
  const triggerZones: Phaser.GameObjects.Rectangle[] = [];
  const linesById = new Map<string, Phaser.GameObjects.BitmapText>();
  const controlsById = new Map<string, Phaser.GameObjects.GameObject>();
  const extraSprites: Phaser.GameObjects.Sprite[] = [];
  const overlayDisposers: Array<() => void> = [];
  const runtimeExtraGameObjects: Phaser.GameObjects.GameObject[] = [];
  let disposeGuiRuntime: (() => void) | null = null;

  type DepthGameObject = Phaser.GameObjects.GameObject & {
    depth: number;
    setDepth(value: number): Phaser.GameObjects.GameObject;
  };
  const fixedControlIds = new Set(
    (gui.fixedControls ?? [])
      .map((id) => String(id).trim())
      .filter((id) => id.length > 0),
  );
  const isGuiFixedControlId = (raw: string | undefined): boolean => {
    const id = raw?.trim() ?? '';
    return id.length > 0 && fixedControlIds.has(id);
  };
  const movablePackedParts: DepthGameObject[] = [];
  const fixedPackedGameObjects: Phaser.GameObjects.GameObject[] = [];

  if (usesAsepriteDisplay(gui)) {
    const guiKey = getAsepriteTextureKey(gui.id);
    if (scene.textures.exists(guiKey)) {
      ensureAsepriteAnimationsFromAtlas(scene, guiKey);
    }
  }

  const controls = gui.controls ?? [];
  const buttonIds = collectGuiButtonIds(controls);
  type InvScrollState = { offset: number; refresh: () => void };
  const invScrollStateByControlIndex = new Map<number, InvScrollState>();
  const buttonPreEmitById = new Map<string, Array<() => void>>();

  for (let i = 0; i < controls.length; i += 1) {
    const c = controls[i]!;
    if (c.type !== 'inventoryPanel' || !inventoryPanelScrollConfigured(c, buttonIds)) {
      continue;
    }
    const st: InvScrollState = { offset: 0, refresh: () => {} };
    invScrollStateByControlIndex.set(i, st);
    const step = c.scrollDirection === 'horizontal' ? 1 : c.cols;
    appendPreEmitForButtonId(buttonPreEmitById, c.forwardButton!, () => {
      st.offset += step;
      st.refresh();
    });
    appendPreEmitForButtonId(buttonPreEmitById, c.backButton!, () => {
      st.offset -= step;
      st.refresh();
    });
  }

  for (let i = 0; i < controls.length; i += 1) {
    const c = controls[i]!;
    if (c.type === 'inventoryPanel') {
      const px = Math.round(c.x);
      const py = Math.round(c.y);
      const panel = scene.add.container(px, py);
      panel.setScrollFactor(0, 0);
      panel.setDepth(depth + (c.zIndex ?? 0));
      const scrollSt = invScrollStateByControlIndex.get(i);
      if (scrollSt) {
        scrollSt.refresh = () => fillInventoryPanelContent(panel, scene, gui, c, scrollSt, startVisible);
        const onGameStateInventory = (): void => {
          scrollSt.refresh();
        };
        gameEvents.on(GAME_STATE_INVENTORY_CHANGED_EVENT, onGameStateInventory);
        gameEvents.on(GAME_STATE_REPLACED_EVENT, onGameStateInventory);
        overlayDisposers.push(() => {
          gameEvents.off(GAME_STATE_INVENTORY_CHANGED_EVENT, onGameStateInventory);
          gameEvents.off(GAME_STATE_REPLACED_EVENT, onGameStateInventory);
        });
        scrollSt.refresh();
      } else {
        fillInventoryPanelContent(panel, scene, gui, c, { offset: 0 }, startVisible);
      }
      inventoryPanels.push(panel);
      const pid = c.id?.trim();
      if (pid) {
        controlsById.set(pid, panel);
      }
      ;(isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts).push(panel as DepthGameObject);
      continue;
    }

    if (c.type === 'image') {
      const spr = addGuiImageSprite(scene, gui, c, depth, startVisible, extraSprites, controlsById);
      if (spr) {
        ;(isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts).push(spr as DepthGameObject);
      }
      continue;
    }

    if (c.type === 'button') {
      const chain = buttonPreEmitById.get(c.id);
      const preEmit =
        chain && chain.length > 0
          ? (): void => {
              for (const fn of chain) {
                fn();
              }
            }
          : undefined;
      const built = buildGuiButton(scene, gui, c, depth, startVisible, preEmit);
      if (built) {
        guiButtons.push(built);
        controlsById.set(c.id.trim(), built.hitTarget);
        const bucket = isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts;
        if (built.background) {
          bucket.push(built.background as DepthGameObject);
        }
        if (built.label) {
          bucket.push(built.label as DepthGameObject);
        }
        bucket.push(built.hitTarget as DepthGameObject);
      }
      continue;
    }

    if (c.type === 'trigger') {
      const zone = buildGuiTriggerZone(scene, c, depth, startVisible);
      if (zone) {
        triggerZones.push(zone);
        controlsById.set(c.id.trim(), zone);
        overlayDisposers.push(
          installGuiControlPointerHoverObserver(scene, gui, c.id, zone, {
            active: c.active !== false,
          }),
        );
        ;(isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts).push(zone as DepthGameObject);
      }
      continue;
    }

    if (c.type !== 'text') {
      continue;
    }
    const raw = c.text?.trim() ?? '';
    const initial = raw.length > 0 ? (c.text ?? '') : (placeholder ?? '');
    const lineVisible = startVisible && c.visible !== false;
    const line = addGuiBitmapLine(scene, c, initial, depth + (c.zIndex ?? 0), lineVisible);
    if (!line) {
      continue;
    }
    allLines.push(line);
    if (c.id) {
      linesById.set(c.id, line);
      controlsById.set(c.id, line);
      ;(isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts).push(line as DepthGameObject);
    } else {
      movablePackedParts.push(line as DepthGameObject);
    }
  }

  if (
    allLines.length === 0 &&
    inventoryPanels.length === 0 &&
    extraSprites.length === 0 &&
    guiButtons.length === 0 &&
    triggerZones.length === 0
  ) {
    return null;
  }

  const rootX = Math.round(gui.x ?? 0);
  const rootY = Math.round(gui.y ?? 0);
  const guiContentRoot = scene.add.container(rootX, rootY);
  guiContentRoot.setScrollFactor(0, 0);
  guiContentRoot.setDepth(depth);
  const indexed = movablePackedParts.map((go, index) => ({ go, index, depth: go.depth }));
  indexed.sort((a, b) => {
    const d = a.depth - b.depth;
    return d !== 0 ? d : a.index - b.index;
  });
  const minDepth = indexed.length > 0 ? indexed[0]!.depth : depth;
  for (const row of indexed) {
    guiContentRoot.add(row.go);
    row.go.setDepth(row.depth - minDepth);
  }

  const triggerZoneSet = new Set<Phaser.GameObjects.GameObject>(triggerZones);
  const guiButtonHitTargets = new Set<Phaser.GameObjects.GameObject>(
    guiButtons.map((b) => b.hitTarget as Phaser.GameObjects.GameObject),
  );

  /**
   * Pointer hover fan-out for every control with an **`id`**.
   *
   * - **Buttons** need `setInteractive` for real click handling and hover-tag swapping, so they stay interactive
   *   and we subscribe to Phaser's native `pointerover` / `pointerout` via {@link wireGuiControlHoverEvents}.
   * - **Triggers and every other control type** (image, inventoryPanel, text) are wired as **non-blocking
   *   pointer observers** via {@link installGuiControlPointerHoverObserver}. This preserves uniform
   *   `whenMouseEnter` / `whenMouseLeave` semantics without calling `setInteractive` on them — critical so
   *   overlays like the inventory bar do not consume clicks meant for room props / hotspots beneath them
   *   (Phaser's `input.topOnly` would otherwise deliver the click to the GUI sprite and skip the room).
   */
  for (const [id, target] of controlsById.entries()) {
    if (triggerZoneSet.has(target)) {
      /** Already wired in the trigger branch above. */
      continue;
    }
    if (guiButtonHitTargets.has(target)) {
      overlayDisposers.push(wireGuiControlHoverEvents(gui, id, target));
      continue;
    }
    overlayDisposers.push(
      installGuiControlPointerHoverObserver(scene, gui, id, target as GuiHoverObservableGameObject),
    );
  }

  const primaryLine = linesById.get('line') ?? allLines[0];
  const primaryInitialX = primaryLine?.x ?? 0;
  const primaryInitialY = primaryLine?.y ?? 0;
  const primaryInitialOriginX = primaryLine?.originX ?? 0;
  const primaryInitialOriginY = primaryLine?.originY ?? 0;

  const handle: GuiOverlayHandle = {
    setPrimaryText(text: string) {
      primaryLine?.setText(text);
    },
    setPrimaryScreenPositionBottomCenter(x: number, y: number) {
      primaryLine?.setOrigin(0.5, 1);
      primaryLine?.setPosition(Math.round(x), Math.round(y));
    },
    resetPrimaryScreenPosition() {
      primaryLine?.setOrigin(primaryInitialOriginX, primaryInitialOriginY);
      primaryLine?.setPosition(primaryInitialX, primaryInitialY);
    },
    setControlText(id: string, text: string) {
      linesById.get(id)?.setText(text);
    },
    setVisible(visible: boolean) {
      for (const line of allLines) {
        line.setVisible(visible);
      }
      for (const panel of inventoryPanels) {
        panel.setVisible(visible);
      }
      for (const s of extraSprites) {
        s.setVisible(visible);
      }
      for (const b of guiButtons) {
        b.hitTarget.setVisible(visible);
        b.background?.setVisible(visible);
        b.label?.setVisible(visible);
        if (visible && b.enabled) {
          applyGuiButtonInteractivity(b.hitTarget, b.width, b.height, b.enabled);
        } else {
          b.hitTarget.disableInteractive();
        }
      }
      for (const z of triggerZones) {
        z.setVisible(visible);
      }
    },
    setLetterSpacing(spacing: number) {
      for (const line of allLines) {
        line.setLetterSpacing(spacing);
      }
    },
    get gameObjects(): Phaser.GameObjects.GameObject[] {
      return [guiContentRoot, ...fixedPackedGameObjects, ...runtimeExtraGameObjects];
    },
    destroy() {
      disposeGuiRuntime?.();
      disposeGuiRuntime = null;
      runtimeExtraGameObjects.length = 0;
      for (const d of overlayDisposers) {
        d();
      }
      overlayDisposers.length = 0;
      guiContentRoot.destroy(true);
      for (const go of fixedPackedGameObjects) {
        go.destroy();
      }
      fixedPackedGameObjects.length = 0;
      allLines.length = 0;
      inventoryPanels.length = 0;
      extraSprites.length = 0;
      guiButtons.length = 0;
      triggerZones.length = 0;
      linesById.clear();
    },
  };

  const controlSnapshot = new Map(controlsById);

  return {
    handle,
    createGuiRuntime(queueInteraction: (factory: () => Promise<unknown>) => void): GuiRuntime {
      disposeGuiRuntime?.();
      disposeGuiRuntime = null;
      runtimeExtraGameObjects.length = 0;
      const runtime = new GuiRuntime({
        scene,
        guiId: gui.id,
        baseDepth: depth,
        contentRoot: guiContentRoot,
        controlGameObjectsById: controlSnapshot,
        queueInteraction,
      });
      disposeGuiRuntime = (): void => {
        runtime.dispose();
        runtimeExtraGameObjects.length = 0;
      };
      return runtime;
    },
  };
}
</file>

<file path="src/game/rooms/office/office.room.ts">
import { registerRoomScript } from '@engine/scripting';

/**
 * `whenLookAt` / `whenUse` / `whenTalkTo` / `whenPickUp` / … / `whenVerb` → prop → hotspot → character id. `B.prop` / `onProp` → props only.
 * `walkTo('…')` → same order, then `points[].id`, or `{ x, y }` room pixels.
 */
registerRoomScript(({ B }) => {
  console.log('🚀 Bennescript office.room.ts is being EXECUTED!');

  B.whenLookAt('henry', () => {
    console.log('✅ B.whenLookAt("henry") fired!');
    B.player.say('Hello from Bennescript!');
  });

  B.whenUse('desk', () => {
    console.log('✅ B.whenUse("desk") fired!');

    B.character('henry').walkTo('office-point-1');

    B.player.walkTo('henry');

    B.player.say('Hello from Bennescript! Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.');
  });

  B.whenLookAt('office-prop-cyberbuddy', () => {
    // TODO
  });

  B.whenUse('office-prop-cyberbuddy', () => {
    // TODO
  });

  B.whenLookAt('office-prop-glasses', () => {
    // TODO
  });

  B.whenUse('office-prop-glasses', () => {
    // TODO
  });


  B.whenUse('henry', () => {
    B.player.walkTo('henry');
    B.player.say('Hello from Bennescript! Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', { clickToSkip: false });
    B.character('henry').say('SUP DUDE!');
  });

  B.onProp('office-prop-cyberbuddy', 'slap', () => {
    // TODO
  });

  B.whenLookAt('office-prop-door', () => {
    // TODO
  });

  B.whenUse('office-prop-door', () => {
    // TODO
  });

  B.onProp('office-prop-door', 'slap', () => {
    // TODO
  });

  B.onProp('desk', 'slap', () => {
    // TODO
  });

  B.whenLookAt('desk', () => {
    // TODO
  });
});
</file>

<file path="src/game/rooms/office/office.room.json">
{
  "id": "office",
  "name": "Office",
  "size": {
    "width": 352,
    "height": 198
  },
  "scrollBounds": {
    "x": 0,
    "y": 0,
    "width": 352,
    "height": 198
  },
  "walkable": {
    "polygons": [
      {
        "id": "office-floor",
        "active": true,
        "points": [
          {
            "x": 48,
            "y": 152
          },
          {
            "x": 306,
            "y": 148
          },
          {
            "x": 308,
            "y": 114
          },
          {
            "x": 274,
            "y": 96
          },
          {
            "x": 65,
            "y": 103
          },
          {
            "x": 51,
            "y": 122
          }
        ],
        "holes": [
          {
            "id": "desk-hole",
            "active": true,
            "points": [
              {
                "x": 111,
                "y": 106
              },
              {
                "x": 158,
                "y": 103
              },
              {
                "x": 131,
                "y": 132
              },
              {
                "x": 85,
                "y": 128
              }
            ]
          }
        ]
      }
    ]
  },
  "hotspots": [
    {
      "id": "window",
      "active": true,
      "description": "",
      "zIndex": 0,
      "points": [
        {
          "x": 130,
          "y": 46
        },
        {
          "x": 215,
          "y": 46
        },
        {
          "x": 212,
          "y": 84
        },
        {
          "x": 131,
          "y": 82
        }
      ],
      "walkToPoint": {
        "x": 170,
        "y": 100
      },
      "lookAtPoint": {
        "x": 169,
        "y": 79
      },
      "onVerb": {
        "look": true
      }
    },
    {
      "id": "desk",
      "active": true,
      "description": "",
      "zIndex": 1,
      "points": [
        {
          "x": 58,
          "y": 64
        },
        {
          "x": 106,
          "y": 62
        },
        {
          "x": 91,
          "y": 101
        },
        {
          "x": 50,
          "y": 99
        }
      ],
      "walkToPoint": {
        "x": 74,
        "y": 123
      },
      "lookAtPoint": {
        "x": 75,
        "y": 91
      },
      "onVerb": {
        "use": true
      }
    }
  ],
  "props": [
    {
      "id": "office-prop-background",
      "tag": "Background",
      "zIndex": 1,
      "visible": true,
      "alpha": 1
    },
    {
      "id": "office-prop-shadow",
      "tag": "Shadow",
      "zIndex": 2,
      "visible": false,
      "alpha": 1
    },
    {
      "id": "office-prop-backlight",
      "tag": "Backlight",
      "zIndex": 0,
      "visible": true,
      "alpha": 1
    },
    {
      "id": "office-prop-fan",
      "tag": "Fan",
      "zIndex": 6,
      "visible": true,
      "alpha": 1,
      "animations": {
        "Fan": {
          "loop": true,
          "frameDuration": 150
        }
      }
    },
    {
      "id": "office-prop-chair",
      "tag": "Chair",
      "zIndex": 10,
      "visible": true,
      "alpha": 1
    },
    {
      "id": "desk",
      "tag": "Desk",
      "zIndex": 50,
      "clickable": true,
      "visible": true,
      "alpha": 1,
      "walkToPoint": {
        "x": 138,
        "y": 124
      },
      "lookAtPoint": {
        "x": 125,
        "y": 99
      },
      "description": "Paperwork, coffee stains, and a blinking answering machine light.",
      "collider": {
        "points": [
          {
            "x": 120,
            "y": 83
          },
          {
            "x": 145,
            "y": 84
          },
          {
            "x": 151,
            "y": 108
          },
          {
            "x": 129,
            "y": 129
          },
          {
            "x": 90,
            "y": 127
          },
          {
            "x": 89,
            "y": 101
          }
        ]
      },
      "onVerb": {
        "look": true,
        "use": true,
        "slap": true
      }
    },
    {
      "id": "office-prop-door",
      "tag": "DoorClosed",
      "zIndex": 12,
      "clickable": true,
      "visible": true,
      "alpha": 1,
      "walkToPoint": {
        "x": 270,
        "y": 111
      },
      "lookAtPoint": {
        "x": 284,
        "y": 96
      },
      "description": "A heavy door. The frosted glass reads something about \"Synergy.\"",
      "collider": {
        "points": [
          {
            "x": 272,
            "y": 44
          },
          {
            "x": 307,
            "y": 44
          },
          {
            "x": 304,
            "y": 113
          },
          {
            "x": 273,
            "y": 105
          }
        ]
      },
      "onVerb": {
        "look": true,
        "use": true,
        "slap": true
      }
    },
    {
      "id": "office-prop-coatrack",
      "tag": "Coatrack",
      "zIndex": 16,
      "visible": true,
      "alpha": 1,
      "collider": {
        "points": [
          {
            "x": 298,
            "y": 60
          },
          {
            "x": 308,
            "y": 61
          },
          {
            "x": 308,
            "y": 130
          },
          {
            "x": 300,
            "y": 131
          }
        ]
      }
    },
    {
      "id": "office-prop-jacket",
      "tag": "Jacket",
      "zIndex": 18,
      "clickable": true,
      "visible": true,
      "alpha": 1,
      "walkToPoint": {
        "x": 285,
        "y": 172
      },
      "lookAtPoint": {
        "x": 300,
        "y": 105
      },
      "description": "Someone’s jacket — still holding a faint smell of rain and toner.",
      "collider": {
        "points": [
          {
            "x": 289,
            "y": 72
          },
          {
            "x": 309,
            "y": 73
          },
          {
            "x": 305,
            "y": 102
          },
          {
            "x": 288,
            "y": 105
          }
        ]
      },
      "onVerb": {
        "look": true,
        "use": true
      }
    },
    {
      "id": "office-prop-phone-cutaway",
      "tag": "PhoneCutaway",
      "zIndex": 20,
      "visible": true,
      "alpha": 1
    },
    {
      "id": "office-prop-glasses",
      "tag": "Glasses",
      "zIndex": 55,
      "clickable": true,
      "visible": true,
      "alpha": 1,
      "walkToPoint": {
        "x": 165,
        "y": 172
      },
      "lookAtPoint": {
        "x": 198,
        "y": 118
      },
      "description": "Reading glasses abandoned next to a stack of forms.",
      "collider": {
        "points": [
          {
            "x": 109,
            "y": 89
          },
          {
            "x": 129,
            "y": 91
          },
          {
            "x": 129,
            "y": 99
          },
          {
            "x": 111,
            "y": 99
          }
        ]
      },
      "onVerb": {
        "look": true,
        "use": true
      }
    },
    {
      "id": "office-prop-cyberbuddy",
      "tag": "CyberBuddy",
      "zIndex": 24,
      "clickable": true,
      "visible": true,
      "alpha": 1,
      "walkToPoint": {
        "x": 219,
        "y": 102
      },
      "lookAtPoint": {
        "x": 249,
        "y": 96
      },
      "description": "A cheerful plastic desk mascot from a forgotten trade show.",
      "collider": {
        "points": [
          {
            "x": 244,
            "y": 76
          },
          {
            "x": 259,
            "y": 77
          },
          {
            "x": 268,
            "y": 103
          },
          {
            "x": 230,
            "y": 100
          }
        ]
      },
      "onVerb": {
        "look": true,
        "use": true,
        "slap": true
      }
    },
    {
      "id": "office-prop-plant",
      "tag": "Plant",
      "zIndex": 25,
      "visible": true,
      "alpha": 1,
      "clickable": false
    },
    {
      "id": "office-prop-plant2",
      "tag": "Plant2",
      "zIndex": 26,
      "visible": true,
      "alpha": 1
    }
  ],
  "characters": [
    {
      "instanceId": "hank-1",
      "definition": "hank/hank.character.json",
      "x": 96,
      "y": 170,
      "initialFacing": "L",
      "initialAnimation": "Idle",
      "visible": true,
      "zIndex": 40
    },
    {
      "instanceId": "henry-1",
      "definition": "henry/henry.character.json",
      "x": 200,
      "y": 148,
      "initialFacing": "R",
      "initialAnimation": "Idle",
      "visible": true,
      "zIndex": 101
    }
  ],
  "points": [
    {
      "id": "office-point-1",
      "x": 179,
      "y": 100
    },
    {
      "id": "office-point-2",
      "x": 72,
      "y": 135
    }
  ],
  "regions": [
    {
      "id": "office-region-1",
      "active": true,
      "points": [
        {
          "x": 123,
          "y": 98
        },
        {
          "x": 121,
          "y": 47
        },
        {
          "x": 200,
          "y": 75
        },
        {
          "x": 200,
          "y": 123
        },
        {
          "x": 152,
          "y": 123
        }
      ]
    }
  ]
}
</file>

<file path="src/game/game-config.json">
{
  "resolution": {
    "width": 320,
    "height": 180
  },
  "verbs": [
    {
      "id": "look",
      "label": "Look at"
    },
    {
      "id": "use",
      "label": "Use"
    },
    {
      "id": "slap",
      "label": "Slap"
    }
  ],
  "inputProfile": {
    "kind": "twoVerb",
    "primaryButtonVerb": "use",
    "secondaryButtonVerb": "look"
  },
  "defaultFallbackLine": "You can't do that.",
  "startingPlayerCharacter": "hank",
  "startingRoomId": "apartment",
  "audio": {
    "masterVolume": 1,
    "sfxVolume": 1,
    "musicVolume": 0.75,
    "dialogueVolume": 1
  },
  "debug": {
    "showWalkable": true,
    "showPropOutlines": true,
    "showGuiOutlines": false
  },
  "initialGameState": {
    "flags": {},
    "variables": {},
    "inventory": [
      "Key",
      "Chainsaw",
      "Ladder",
      "Broom",
      "Lantern",
      "SheetMusic",
      "Vacuum",
      "Candy1",
      "Newspaper"
    ]
  },
  "cursor": {
    "idleAnimation": "Idle",
    "activeAnimation": "Active",
    "hotspot": "center",
    "animations": {
      "Idle": {
        "loop": true
      },
      "Active": {
        "loop": true
      }
    },
    "display": {
      "aseprite": true
    }
  },
  "dialog": {
    "clickToSkip": true,
    "showText": true,
    "defaultTalkOffset": {
      "x": 0,
      "y": 0
    },
    "minDurationMs": 800,
    "msPerCharacter": 35,
    "maxDurationMs": 4500,
    "durationMultiplier": 1
  }
}
</file>

<file path="src/engine/scenes/RoomScene.ts">
import * as Phaser from 'phaser';
import {
  attachDirectionalAnimationApi,
  facingFromWorldDelta,
  playDirectionalAnimation,
  resolveInitialIdleFacing,
  resolveSpawnIdleFacing,
  type CharacterFacing,
  type DirectionalCharacterSprite,
} from '../directionalCharacterAnimation';
import { gameEvents } from '../events/EventBus';
import {
  PLAYER_WALK_START,
  PLAYER_WALK_STOP,
  type PlayerWalkStartPayload,
  type PlayerWalkStopPayload,
} from '../events/playerWalkEvents';
import {
  applyCharacterAnimationClips,
  setupCharacterAsepritePlayback,
} from '../characterAnimationPlayback';
import { getDialogSettings, getGameSettings } from '../ConfigManager';
import {
  applyGameCursorSpriteHotspot,
  CURSOR_TEXTURE_KEY,
  isBenneGameCursorAsepriteEnabled,
} from '../../game/cursorAseprite';
import { attachPostProcessingPlaceholder } from '../postfx/PostEffects';
import {
  cameraFollowOffsetForFeet,
  getCharacterWorldFeet,
  placeSpriteByFeet,
  resolveCharacterFeetLocal,
} from '../characterFeet';
import { pointInPolygon } from '../walkable';
import { findWalkPath } from '../pathfinding';
import { dispatchVerbInteraction } from '../verbs/dispatchVerb';
import {
  getCharacterVerbHandlers,
  getHotspotVerbHandlers,
  getPropVerbHandlers,
} from '../verbs/normalizeHandlers';
import { getEffectiveTwoVerbProfile } from '../verbs/verbConfig';
import { resolveVerbIdFromPointer } from '../verbs/resolvePointerVerb';
import { getInternalHeight, getInternalWidth, getStartingPlayerCharacterId, SCENE_ROOM } from '../../game/constants';
import type { CharacterAnimationsConfig } from '../../types/character';
import type { CharacterData } from '../../types/character';
import type { Point2, RoomData, RoomHotspotData, RoomPropInstance } from '../../types/room';
import type { RoomCharacterSpawn, RoomPropSpawn, RoomSceneStartData } from './BootScene';
import { createRoomScriptContext } from '../scripting/RoomScriptContext.js';
import { createCharacterScriptContext } from '../scripting/CharacterScriptContext.js';
import { createInventoryScriptContext } from '../scripting/InventoryScriptContext.js';
import type { CharacterScriptContext, InventoryScriptContext, RoomScriptContext } from '@engine/scripting/types.js';
import {
  buildGuiOverlay,
  GUI_OVERLAY_DEPTH_STRIDE,
  GUI_TEXT_OVERLAY_DEPTH,
  type GuiOverlayHandle,
} from '../gui/buildGuiOverlay';
import { getGuiBenneScript } from '../scripting/registerGuiScript.js';
import { getAllGuiData } from '../../game/loadGuiData';

/** Engine-reserved id for {@link RoomScene.setDialogTextOverlay} (Bennescript `say` / `say.now`). */
const DIALOG_TEXT_GUI_ID = 'dialog-text';

/**
 * Optional `Phaser.Game.registry` key: when set to a boolean, overrides the initial visibility of
 * every non-`dialog-text` GUI overlay at room load. Used by the BENNE room preview so authors can
 * toggle HUD GUIs on/off from the preview toolbar without hand-editing each GUI's `visible` in `*.gui.json`
 * flags. Unset (the default) preserves per-GUI JSON `visible` semantics (`false` hides at load;
 * omitted/`true` shows).
 */
const GENERIC_GUIS_INITIAL_VISIBILITY_REGISTRY_KEY = 'benneRoomSceneGenericGuisVisible';

/** Ignore walk clicks when already within this many pixels of the target. */
const MIN_WALK_DISTANCE_PX = 6;

/** Props use `zIndex`; characters render above this baseline. */
const CHARACTER_SCENE_DEPTH = 10_000;

/** Walkable / prop debug strokes render above characters. */
const DEBUG_OVERLAY_DEPTH = 20_000;

/** Renders above typical room + GUI depth so the custom pointer stays on top (shipped game). */
const CUSTOM_CURSOR_DEPTH = 500_000;

/** `startFollow` offset so the camera tracks {@link getCharacterWorldFeet}, not the sprite top-left. */
function getFeetFollowOffset(player: Phaser.GameObjects.Sprite): { x: number; y: number } {
  const lx = player.getData('feetLocalX') as number | undefined;
  const ly = player.getData('feetLocalY') as number | undefined;
  if (typeof lx === 'number' && typeof ly === 'number') {
    return cameraFollowOffsetForFeet({ x: lx, y: ly });
  }
  const data = player.getData('character') as CharacterData | undefined;
  const feet = data ? resolveCharacterFeetLocal(data, player) : { x: player.frame.width * 0.5, y: player.frame.height };
  return cameraFollowOffsetForFeet(feet);
}

/** Outline color for `debug.showWalkable` (green). */
const DEBUG_WALKABLE_STROKE = 0x33dd66;
/** Hole rings under an active walkable polygon (debug). */
const DEBUG_WALKABLE_HOLE_STROKE = 0x229955;
/** Outline color for `debug.showPropOutlines` (magenta). */
const DEBUG_PROP_COLLIDER_STROKE = 0xff44cc;
/** Live pathfinding polyline overlay color (cyan). */
const DEBUG_WALK_PATH_STROKE = 0x33ccff;

function mergeRoomPropAnimationClips(spawns: readonly RoomPropSpawn[]): CharacterAnimationsConfig {
  const out: CharacterAnimationsConfig = {};
  for (const s of spawns) {
    if (s.data.animations) {
      Object.assign(out, s.data.animations);
    }
  }
  return out;
}

export class RoomScene extends Phaser.Scene {
  private roomData!: RoomData;

  /** Player Aseprite sprite; null if no matching `startingPlayerCharacter` in the room. */
  player: DirectionalCharacterSprite | null = null;

  /**
   * Tracks the current editor camera mode so the camera can be reconfigured when the
   * panel resizes (`Scale.RESIZE` fires a resize event). Null = game runtime (no editor).
   */
  private editorCameraMode: 'navigate' | 'edit' | null = null;

  /**
   * Dedicated UI camera used **only** in the editor preview (`setEditorCameraMode`). In the
   * shipped game `cameras.main.zoom` stays at 1 (`Scale.FIT`) so `scrollFactor: 0` overlays
   * render at their literal `(x, y)`. In the preview the main camera is zoomed (`Scale.RESIZE`
   * + `cam.setZoom(scale)` to letterbox the game viewport inside the panel), and Phaser 4's
   * origin-aware zoom math pushes `scrollFactor=0` GUIs by `(origin × (1 − zoom))` — hundreds
   * of pixels off the viewport at typical editor scales. This camera has `origin=(0, 0)`,
   * `scroll=(0, 0)`, and matches the main camera's viewport + zoom so GUIs render at
   * `(x × zoom, y × zoom)` relative to the viewport top-left, exactly as they do in runtime.
   */
  private editorUiCamera: Phaser.Cameras.Scene2D.Camera | null = null;

  /** Scene objects that belong to the editor UI camera (all GUI overlay top-level objects). */
  private readonly editorUiGuiObjects = new Set<Phaser.GameObjects.GameObject>();

  /** Disposer for the `addedtoscene` listener that auto-ignores new non-GUI objects on the UI camera. */
  private editorUiChildListenerOff: (() => void) | null = null;

  private playerMoveTween: Phaser.Tweens.Tween | null = null;

  /**
   * Current player pathfinding polyline (waypoints, goal last). Set when a walk begins,
   * cleared on arrival or interruption. Rendered by {@link drawRoomDebugOverlays} when
   * `debug.showWalkable` is on so authors can see the chosen route around obstacles.
   */
  private currentPlayerPath: Point2[] | null = null;

  /** Debug graphics for the live player path (re-drawn each frame while walking). */
  private debugPathGraphics: Phaser.GameObjects.Graphics | null = null;

  /** Fired once when a walk tween completes successfully (instant walks may call it without a tween). */
  private walkArriveCallback: (() => void) | null = null;

  /** Props that need per-frame position updates for parallax scrolling. */
  private parallaxProps: Array<{
    sprite: Phaser.GameObjects.Sprite;
    baseX: number;
    baseY: number;
    parallaxDepth: number;
  }> = [];

  /** Prop id → sprite (every placed prop, for Bennescript). */
  private propSpritesById = new Map<string, Phaser.GameObjects.Sprite>();

  /** Runtime-only description overrides for props (B.prop(id).description). */
  private propDescriptionOverrides = new Map<string, string>();

  /** Character definition id → first spawned sprite/image in this room. */
  private characterSpritesByDefId = new Map<
    string,
    Phaser.GameObjects.Sprite | Phaser.GameObjects.Image
  >();

  /** Active scripted walks for non-player characters (by sprite identity). */
  private npcWalkTweens = new Map<
    Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    Phaser.Tweens.Tween
  >();

  /** String ids that already triggered `walkTo` resolution warnings (warn once per id per room load). */
  private unresolvedWalkTargetIdsWarned = new Set<string>();

  /** Screen-fixed dialogue text from `guis/dialog-text/dialog-text.gui.json`. */
  private dialogTextOverlay: GuiOverlayHandle | null = null;

  /** Every other registered GUI overlay (authoring under `src/game/guis/<id>/`), built automatically in `create`. */
  private genericGuiOverlays: GuiOverlayHandle[] = [];

  private readonly dialogOverlayScreenScratch = new Phaser.Math.Vector2();

  /**
   * When non-zero, a Bennescript `say` / `say.now` line timer is active — ignore room background walks
   * and prop/hotspot/character verb clicks so the player cannot act until the line ends.
   */
  private scriptedDialogInputSuppressionDepth = 0;

  /** When set, a left-click should end the active scripted dialog line early (global or per-line `say` options). */
  private scriptedDialogClickToSkip: (() => void) | null = null;

  /** Screen-space sprite when `game-config.json` enables `cursor.display.aseprite`. */
  private customCursorSprite: Phaser.GameObjects.Sprite | null = null;
  private lastCustomCursorActive: boolean | null = null;
  private readonly onCustomCursorPointerMove = (pointer: Phaser.Input.Pointer): void => {
    this.refreshCustomCursor(pointer);
  };

  constructor() {
    super(SCENE_ROOM);
  }

  create(data: RoomSceneStartData): void {
    this.roomData = data.room;
    this.player = null;
    this.playerMoveTween = null;
    this.currentPlayerPath = null;
    this.debugPathGraphics = null;
    this.parallaxProps = [];
    this.propSpritesById.clear();
    this.propDescriptionOverrides.clear();
    this.characterSpritesByDefId.clear();
    this.npcWalkTweens.clear();
    this.unresolvedWalkTargetIdsWarned.clear();

    attachPostProcessingPlaceholder(this.cameras.main);

    const vW = getInternalWidth();
    const vH = getInternalHeight();
    const roomW = data.room.size?.width ?? vW;
    const roomH = data.room.size?.height ?? vH;

    if (data.backgroundTextureKey) {
      // Render the background at its natural pixel dimensions — room.size controls camera
      // bounds and walkable extent, not how large the art appears.
      this.add.image(0, 0, data.backgroundTextureKey).setOrigin(0, 0);
    }

    this.spawnRoomProps(data);

    const sortedHotspots = [...data.room.hotspots].sort(
      (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
    );
    sortedHotspots.forEach((hotspot) => this.createHotspot(data.room.id, hotspot, roomW, roomH));
    data.characters.forEach((spawn) => this.spawnCharacter(data.room.id, spawn));

    this.setupRoomCamera(roomW, roomH);
    this.applyPlayerCameraFollow(roomW, roomH);
    this.drawRoomDebugOverlays(data);

    const guisSorted = [...getAllGuiData()].sort((a, b) => a.id.localeCompare(b.id));
    const nonDialogGuis = guisSorted.filter((g) => g.id !== DIALOG_TEXT_GUI_ID);
    const dialogGui = guisSorted.find((g) => g.id === DIALOG_TEXT_GUI_ID);

    const genericGuiVisibilityOverride = this.game.registry.get(
      GENERIC_GUIS_INITIAL_VISIBILITY_REGISTRY_KEY,
    );
    const hasGenericGuiVisibilityOverride = typeof genericGuiVisibilityOverride === 'boolean';

    this.genericGuiOverlays = [];
    let stackIndex = 0;
    for (const gui of nonDialogGuis) {
      const built = buildGuiOverlay(this, gui, {
        /** Preview / cutscene override wins; otherwise each GUI's required `visible` boolean. */
        startVisible: hasGenericGuiVisibilityOverride ? genericGuiVisibilityOverride : gui.visible,
        depth: GUI_TEXT_OVERLAY_DEPTH + stackIndex * GUI_OVERLAY_DEPTH_STRIDE,
      });
      if (built) {
        this.genericGuiOverlays.push(built.handle);
        const guiScript = getGuiBenneScript(gui.id);
        if (guiScript) {
          const rt = built.createGuiRuntime((factory) => guiScript.queueInteraction(factory));
          guiScript.notifyGuiBuilt(rt);
        }
      }
      stackIndex += 1;
    }

    const dialogBuilt = dialogGui
      ? buildGuiOverlay(this, dialogGui, {
          /** Speech UI is driven by {@link setDialogTextOverlay}, not the JSON `visible` flag at boot. */
          startVisible: false,
          depth: GUI_TEXT_OVERLAY_DEPTH + stackIndex * GUI_OVERLAY_DEPTH_STRIDE,
        })
      : null;
    this.dialogTextOverlay = dialogBuilt?.handle ?? null;
    if (dialogBuilt) {
      const dialogScript = getGuiBenneScript(DIALOG_TEXT_GUI_ID);
      if (dialogScript) {
        const rt = dialogBuilt.createGuiRuntime((factory) => dialogScript.queueInteraction(factory));
        dialogScript.notifyGuiBuilt(rt);
      }
    }

    this.setupCustomGameCursor();

    // ─────────────────────────────────────────────────────────────
    // Bennescript: after props, characters, player, and camera exist
    // ─────────────────────────────────────────────────────────────
    const roomScripts = (window as unknown as { __benneRoomScripts?: Array<(ctx: RoomScriptContext) => void> })
      .__benneRoomScripts;
    const characterScripts = (
      window as unknown as {
        __benneCharacterScripts?: ReadonlyArray<{
          characterId: string;
          registerFn: (ctx: CharacterScriptContext) => void;
        }>;
      }
    ).__benneCharacterScripts;
    const inventoryScripts = (
      window as unknown as {
        __benneInventoryScripts?: ReadonlyArray<{
          itemId: string;
          registerFn: (ctx: InventoryScriptContext) => void;
        }>;
      }
    ).__benneInventoryScripts;

    const benneDisposers: Array<() => void> = [];
    if (roomScripts && roomScripts.length > 0) {
      const ctx = createRoomScriptContext(gameEvents, data.room.id, this);
      benneDisposers.push(() => ctx.B.dispose());
      for (const registerFn of roomScripts) {
        try {
          registerFn(ctx);
        } catch (err) {
          console.error(`[Benne] Error in room script for ${data.room.id}:`, err);
        }
      }
    }

    if (characterScripts && characterScripts.length > 0) {
      const spawnedCharacterIds = new Set(data.characters.map((c) => c.data.id));
      for (const { characterId, registerFn } of characterScripts) {
        if (!spawnedCharacterIds.has(characterId)) {
          continue;
        }
        const ctx = createCharacterScriptContext(gameEvents, characterId, data.room.id, this);
        benneDisposers.push(() => ctx.B.dispose());
        try {
          registerFn(ctx);
        } catch (err) {
          console.error(
            `[Benne] Error in character script for ${characterId} in room ${data.room.id}:`,
            err,
          );
        }
      }
    }

    if (inventoryScripts && inventoryScripts.length > 0) {
      for (const { itemId, registerFn } of inventoryScripts) {
        const ctx = createInventoryScriptContext(gameEvents, itemId, data.room.id, this);
        benneDisposers.push(() => ctx.B.dispose());
        try {
          registerFn(ctx);
        } catch (err) {
          console.error(`[Benne] Error in inventory script for ${itemId} in room ${data.room.id}:`, err);
        }
      }
    }

    const benneDispose = benneDisposers.length > 0 ? () => benneDisposers.forEach((d) => d()) : null;

    this.input.mouse?.disableContextMenu();

    this.scale.on('resize', this.onScaleResize, this);
    this.input.on('pointerdown', this.handleRoomPointerDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      benneDispose?.();
      for (const h of this.genericGuiOverlays) {
        h.destroy();
      }
      this.genericGuiOverlays = [];
      this.dialogTextOverlay?.destroy();
      this.dialogTextOverlay = null;
      this.scriptedDialogInputSuppressionDepth = 0;
      this.scriptedDialogClickToSkip = null;
      this.scale.off('resize', this.onScaleResize, this);
      this.input.off('pointerdown', this.handleRoomPointerDown);
      this.input.off('pointermove', this.onCustomCursorPointerMove);
      this.teardownCustomGameCursor();
      this.editorUiChildListenerOff?.();
      this.editorUiChildListenerOff = null;
      this.editorUiGuiObjects.clear();
      this.editorUiCamera = null;
      this.stopPlayerMoveTween(true);
      for (const t of this.npcWalkTweens.values()) {
        t.stop();
      }
      this.npcWalkTweens.clear();
      this.debugPathGraphics = null;
    });
  }

  /**
   * Shows or hides every non-`dialog-text` GUI overlay registered under `src/game/guis/**`.
   * Does not affect the `dialog-text` overlay (that remains driven by {@link setDialogTextOverlay} /
   * `say`). Intended for preview toolbars and future cutscene HUD-hide logic.
   */
  setGenericGuisVisible(visible: boolean): void {
    for (const h of this.genericGuiOverlays) {
      h.setVisible(visible);
    }
  }

  /**
   * Shows or hides the `dialog-text` GUI line (`controls` text with `id: line` or the first text control).
   * With `talkCharacterDefinitionId`, places the line so its **bottom-center** sits on the character’s `talkPoint`
   * projected into GUI space (plus `game-config.json` `dialog.defaultTalkOffset`), including wrapped height.
   */
  setDialogTextOverlay(state: {
    visible: boolean;
    text?: string;
    talkCharacterDefinitionId?: string;
  }): void {
    const h = this.dialogTextOverlay;
    if (!h) {
      return;
    }
    const dialog = getDialogSettings();
    if (!state.visible) {
      h.resetPrimaryScreenPosition();
      h.setVisible(false);
      return;
    }
    if (state.text !== undefined && dialog.showText) {
      h.setPrimaryText(state.text);
    }
    if (!dialog.showText) {
      return;
    }
    const id = state.talkCharacterDefinitionId;
    if (id) {
      const anchor = this.getTalkAnchorWorldForCharacterDefinition(id);
      if (anchor) {
        const p = this.worldPointToDialogOverlayScreen(anchor.x, anchor.y);
        h.setPrimaryScreenPositionBottomCenter(
          p.x + dialog.defaultTalkOffset.x,
          p.y + dialog.defaultTalkOffset.y,
        );
      } else {
        h.resetPrimaryScreenPosition();
      }
    } else {
      h.resetPrimaryScreenPosition();
    }
    h.setVisible(true);
  }

  /**
   * Called when a timed Bennescript dialog line starts (including `say.now`). Paired with
   * {@link popScriptedDialogInputSuppression} when the line timer ends.
   */
  pushScriptedDialogInputSuppression(): void {
    this.scriptedDialogInputSuppressionDepth++;
  }

  popScriptedDialogInputSuppression(): void {
    this.scriptedDialogInputSuppressionDepth = Math.max(0, this.scriptedDialogInputSuppressionDepth - 1);
  }

  private isScriptedDialogInputSuppressed(): boolean {
    return this.scriptedDialogInputSuppressionDepth > 0;
  }

  /**
   * While a skippable scripted dialog line is showing, left-clicks invoke **`fn`** once (same cleanup as the timer).
   * Cleared when the line ends or when {@link clearScriptedDialogClickToSkip} runs.
   */
  setScriptedDialogClickToSkip(fn: (() => void) | null): void {
    this.scriptedDialogClickToSkip = fn;
  }

  clearScriptedDialogClickToSkip(): void {
    this.scriptedDialogClickToSkip = null;
  }

  /**
   * If a click-to-skip handler is registered and this is a primary-button down, runs the handler and returns true.
   */
  tryConsumeScriptedDialogClickToSkip(pointer: Phaser.Input.Pointer): boolean {
    if (!this.scriptedDialogClickToSkip) {
      return false;
    }
    if (!pointer.leftButtonDown()) {
      return false;
    }
    const fn = this.scriptedDialogClickToSkip;
    this.scriptedDialogClickToSkip = null;
    fn();
    return true;
  }

  /** World position of `CharacterData.talkPoint` for the first spawned sprite of this definition, or a default above the sprite top. */
  private getTalkAnchorWorldForCharacterDefinition(definitionId: string): Point2 | null {
    const sprite = this.getCharacterSprite(definitionId);
    if (!sprite) {
      return null;
    }
    const data = sprite.getData('character') as CharacterData | undefined;
    const f = sprite.frame;
    if (data?.talkPoint) {
      return { x: sprite.x + data.talkPoint.x, y: sprite.y + data.talkPoint.y };
    }
    return { x: sprite.x + f.width * 0.5, y: sprite.y - 4 };
  }

  /** Maps room/world pixels to coordinates in the same space as GUI `controls[].x` / `y` for this camera. */
  private worldPointToDialogOverlayScreen(wx: number, wy: number): Point2 {
    this.cameras.main.matrixCombined.transformPoint(wx, wy, this.dialogOverlayScreenScratch);
    return { x: this.dialogOverlayScreenScratch.x, y: this.dialogOverlayScreenScratch.y };
  }

  getRoomPropInstance(propId: string): RoomPropInstance | undefined {
    return this.roomData.props?.find((p) => p.id === propId);
  }

  getRoomHotspotInstance(hotspotId: string): RoomHotspotData | undefined {
    return this.roomData.hotspots.find((h) => h.id === hotspotId);
  }

  getPropSprite(propId: string): Phaser.GameObjects.Sprite | undefined {
    return this.propSpritesById.get(propId);
  }

  getCharacterSprite(definitionId: string): Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | undefined {
    return this.characterSpritesByDefId.get(definitionId);
  }

  getPropScriptDescription(propId: string): string {
    if (this.propDescriptionOverrides.has(propId)) {
      return this.propDescriptionOverrides.get(propId) ?? '';
    }
    return this.getRoomPropInstance(propId)?.description ?? '';
  }

  setPropScriptDescription(propId: string, value: string): void {
    this.propDescriptionOverrides.set(propId, value);
  }

  getPropScriptVisible(propId: string): boolean {
    const sprite = this.propSpritesById.get(propId);
    if (sprite) {
      return sprite.visible;
    }
    const inst = this.getRoomPropInstance(propId);
    return inst?.visible !== false;
  }

  setPropScriptVisible(propId: string, visible: boolean): void {
    this.propSpritesById.get(propId)?.setVisible(visible);
  }

  /**
   * Walk the player’s feet to a point in walkable space, routing around holes and concavities.
   * The path is computed in {@link findWalkPath} (visibility graph + A\*). Resolves when the
   * final leg completes, or immediately if there is no player / no usable geometry / the player
   * is already at the target.
   */
  walkPlayerToWorldPoint(worldX: number, worldY: number): Promise<void> {
    if (!this.player) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.movePlayerToward(worldX, worldY, resolve);
    });
  }

  /**
   * Walk the player to an explicit point or a named target (prop, hotspot, character, or room point id).
   */
  walkPlayerTo(target: Point2 | string): Promise<void> {
    const sprite = this.player;
    if (!sprite) {
      return Promise.resolve();
    }
    const feet = getCharacterWorldFeet(sprite);
    const dest = this.resolveWalkTarget(target, feet);
    return this.walkPlayerToWorldPoint(dest.x, dest.y);
  }

  /**
   * Walk a room character (by definition id) to an explicit point or a named target.
   */
  walkCharacterTo(definitionId: string, target: Point2 | string): Promise<void> {
    const sprite = this.characterSpritesByDefId.get(definitionId);
    if (!sprite) {
      return Promise.resolve();
    }
    const feet = getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
    const dest = this.resolveWalkTarget(target, feet);
    return this.walkCharacterToWorldPoint(sprite, dest.x, dest.y);
  }

  walkCharacterToWorldPoint(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    worldX: number,
    worldY: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      this.moveNpcToward(sprite, worldX, worldY, resolve);
    });
  }

  /**
   * Resolve a walk destination in room space. String ids: prop → hotspot → character → `room.points`,
   * first match wins; unknown id warns once and returns `walkerFeet`.
   */
  private resolveWalkTarget(target: Point2 | string, walkerFeet: Point2): Point2 {
    if (typeof target !== 'string') {
      return { x: target.x, y: target.y };
    }
    const id = target;

    const propInst = this.getRoomPropInstance(id);
    if (propInst) {
      if (propInst.walkToPoint) {
        return { x: propInst.walkToPoint.x, y: propInst.walkToPoint.y };
      }
      const colliderPts = propInst.collider?.points;
      if (colliderPts && colliderPts.length >= 3) {
        const onPoly = closestPointInOrOnSimplePolygon(walkerFeet.x, walkerFeet.y, colliderPts);
        if (onPoly) {
          return onPoly;
        }
      }
      const propSprite = this.propSpritesById.get(id);
      if (propSprite) {
        const f = propSprite.frame;
        return { x: propSprite.x + f.width * 0.5, y: propSprite.y + f.height * 0.5 };
      }
      return walkerFeet;
    }

    const hotspot = this.roomData.hotspots.find((h) => h.id === id);
    if (hotspot) {
      if (hotspot.walkToPoint) {
        return { x: hotspot.walkToPoint.x, y: hotspot.walkToPoint.y };
      }
      const hp = hotspot.points;
      if (hp.length >= 3) {
        const c = polygonRingCentroid(hp);
        if (c) {
          return c;
        }
      }
      return walkerFeet;
    }

    const charSprite = this.characterSpritesByDefId.get(id);
    if (charSprite) {
      const data = charSprite.getData('character') as CharacterData | undefined;
      if (data?.walkToPoint) {
        return {
          x: charSprite.x + data.walkToPoint.x,
          y: charSprite.y + data.walkToPoint.y,
        };
      }
      return getCharacterWorldFeet(charSprite as Phaser.GameObjects.Sprite);
    }

    const namedPoint = this.roomData.points?.find((p) => p.id === id);
    if (namedPoint) {
      return { x: namedPoint.x, y: namedPoint.y };
    }

    if (!this.unresolvedWalkTargetIdsWarned.has(id)) {
      this.unresolvedWalkTargetIdsWarned.add(id);
      console.warn(`[Benne] walkTo: unresolved target "${id}"`);
    }
    return walkerFeet;
  }

  /** Configures camera bounds and player follow for the current room. */
  private setupRoomCamera(roomW: number, roomH: number): void {
    const sb = this.roomData.scrollBounds;
    this.cameras.main.setBounds(
      sb?.x ?? 0,
      sb?.y ?? 0,
      sb?.width ?? roomW,
      sb?.height ?? roomH,
    );
  }

  /** Starts follow on the player’s feet (see `CharacterData.feet`). */
  private applyPlayerCameraFollow(roomW: number, roomH: number): void {
    const vW = getInternalWidth();
    const vH = getInternalHeight();
    if (!this.player || (roomW <= vW && roomH <= vH)) {
      return;
    }
    const feet = getFeetFollowOffset(this.player);
    this.cameras.main.startFollow(this.player, true, 1, 1, feet.x, feet.y);
  }

  update(): void {
    this.updateParallaxProps();
    this.updatePathDebug();
  }

  /**
   * Repositions parallax props: blends authored world `(x,y)` with the top-left of the visible
   * world rect (`camera.worldView`). Using `scrollX`/`scrollY` is wrong when zoom ≠ 1 (e.g. editor
   * navigate mode letterboxes with `setZoom(scale)`); `worldView` matches what the player sees and
   * stays stable when only the preview panel size changes.
   */
  private updateParallaxProps(): void {
    if (this.parallaxProps.length === 0) {
      return;
    }

    const cam = this.cameras.main;
    const anchorX = cam.worldView.x;
    const anchorY = cam.worldView.y;

    for (const entry of this.parallaxProps) {
      const { sprite, baseX, baseY, parallaxDepth: d } = entry;
      sprite.x = d * baseX + (1 - d) * anchorX;
      sprite.y = d * baseY + (1 - d) * anchorY;
    }
  }

  /** Re-applies the current editor camera mode when the preview panel is resized. */
  private readonly onScaleResize = (): void => {
    if (this.editorCameraMode !== null) {
      this.setEditorCameraMode(this.editorCameraMode);
    }
  };

  /**
   * Configures the camera for the editor preview panel (called by `RoomPolygonEditScene`).
   * Not used at game runtime.
   *
   * **Navigate mode** — letterboxes the game's virtual resolution (e.g. 352×198) inside the
   * panel using a camera viewport, maintaining the exact in-game look with player follow.
   *
   * **Edit mode** — expands the camera to fill the entire panel and fits the full room art
   * at the largest zoom that shows everything.  The camera viewport covers the whole canvas
   * so the room art is not constrained to the 16:9 frame.
   */
  setEditorCameraMode(mode: 'navigate' | 'edit'): void {
    this.editorCameraMode = mode;

    const panelW = this.scale.width;
    const panelH = this.scale.height;
    if (panelW <= 0 || panelH <= 0) {
      return;
    }

    const gameW = getInternalWidth();   // game's virtual resolution (e.g. 352)
    const gameH = getInternalHeight();  // game's virtual resolution (e.g. 198)
    const roomW = this.roomData.size?.width ?? gameW;
    const roomH = this.roomData.size?.height ?? gameH;
    const cam = this.cameras.main;

    if (mode === 'navigate') {
      // Letterbox: scale the game viewport (gameW × gameH) to fit the panel, centred.
      const scale = Math.min(panelW / gameW, panelH / gameH);
      const viewW = Math.round(gameW * scale);
      const viewH = Math.round(gameH * scale);
      const viewX = Math.round((panelW - viewW) / 2);
      const viewY = Math.round((panelH - viewH) / 2);
      cam.setViewport(viewX, viewY, viewW, viewH);
      cam.setZoom(scale);

      const sb = this.roomData.scrollBounds;
      cam.setBounds(
        sb?.x ?? 0,
        sb?.y ?? 0,
        sb?.width ?? roomW,
        sb?.height ?? roomH,
      );

      if (this.player && (roomW > gameW || roomH > gameH)) {
        const feet = getFeetFollowOffset(this.player);
        cam.startFollow(this.player, true, 1, 1, feet.x, feet.y);
      } else {
        cam.stopFollow();
      }
    } else {
      // Edit mode: full panel viewport, fit the room art inside it.
      cam.stopFollow();
      cam.setViewport(0, 0, panelW, panelH);

      const zoom = Math.min(panelW / roomW, panelH / roomH);
      cam.setZoom(zoom);

      // Room bounds — Phaser's clampX/Y will position the room at the canvas top-left.
      cam.setBounds(0, 0, roomW, roomH);
      cam.scrollX = 0;
      cam.scrollY = 0;
    }

    this.ensureEditorUiCamera();
    this.syncEditorUiCameraToMain();
  }

  /**
   * Lazily creates the editor UI camera (see the field doc on {@link editorUiCamera}). Collects
   * every top-level GUI overlay game object, makes the main camera `ignore` them, and makes the
   * UI camera `ignore` everything else currently in the scene. An `addedtoscene` listener keeps
   * the UI camera's ignore list correct as new non-GUI objects are added later (e.g. debug
   * overlays, props spawned by `spawnPropNow`).
   */
  private ensureEditorUiCamera(): void {
    if (this.editorUiCamera) {
      return;
    }
    const main = this.cameras.main;
    const uiCam = this.cameras.add(main.x, main.y, main.width, main.height);
    uiCam.setOrigin(0, 0);
    uiCam.setScroll(0, 0);
    uiCam.setBackgroundColor('rgba(0, 0, 0, 0)');
    uiCam.setName('editor-ui');
    this.editorUiCamera = uiCam;

    this.editorUiGuiObjects.clear();
    const registerOverlay = (h: GuiOverlayHandle | null): void => {
      if (!h) {
        return;
      }
      for (const obj of h.gameObjects) {
        this.editorUiGuiObjects.add(obj);
      }
    };
    for (const h of this.genericGuiOverlays) {
      registerOverlay(h);
    }
    registerOverlay(this.dialogTextOverlay);
    if (this.customCursorSprite) {
      this.editorUiGuiObjects.add(this.customCursorSprite);
    }

    main.ignore(Array.from(this.editorUiGuiObjects));
    const nonGui = this.children.list.filter((o) => !this.editorUiGuiObjects.has(o));
    if (nonGui.length > 0) {
      uiCam.ignore(nonGui);
    }

    const onAdded = (obj: Phaser.GameObjects.GameObject): void => {
      if (this.editorUiGuiObjects.has(obj)) {
        main.ignore(obj);
      } else {
        uiCam.ignore(obj);
      }
    };
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
    this.editorUiChildListenerOff = () => {
      this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
    };
  }

  /** Keeps the editor UI camera's viewport and zoom aligned with the main camera. */
  private syncEditorUiCameraToMain(): void {
    const uiCam = this.editorUiCamera;
    if (!uiCam) {
      return;
    }
    const main = this.cameras.main;
    uiCam.setViewport(main.x, main.y, main.width, main.height);
    uiCam.setZoom(main.zoom);
    uiCam.setScroll(0, 0);
  }

  private readonly handleRoomPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!pointer.leftButtonDown()) {
      return;
    }
    if (this.tryConsumeScriptedDialogClickToSkip(pointer)) {
      return;
    }
    if (this.isScriptedDialogInputSuppressed()) {
      return;
    }

    const hits = this.input.hitTestPointer(pointer);
    if (hits.length > 0) {
      return;
    }

    if (!this.player) {
      return;
    }

    const { x: worldX, y: worldY } = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.movePlayerToward(worldX, worldY);
  };

  /**
   * Stops the current walk tween if any. When `emitStop` is true, emits {@link PLAYER_WALK_STOP}
   * with reason `interrupted` (used when tearing down the scene).
   */
  private stopPlayerMoveTween(emitStop: boolean): void {
    this.walkArriveCallback = null;
    this.currentPlayerPath = null;
    if (!this.playerMoveTween) {
      return;
    }
    const tween = this.playerMoveTween;
    this.playerMoveTween = null;
    tween.stop();
    if (emitStop && this.player) {
      const facing = (this.player.getData('facing') as CharacterFacing | undefined) ?? resolveInitialIdleFacing(this.player);
      playDirectionalAnimation(this.player, 'Idle', facing);
      gameEvents.emit(PLAYER_WALK_STOP, {
        roomId: this.roomData.id,
        reason: 'interrupted',
      } satisfies PlayerWalkStopPayload);
    }
  }

  /**
   * Start a pathfound walk for the player toward a raw world point (not pre-clamped). Emits
   * {@link PLAYER_WALK_START} once for the final target, then chains one tween per leg of the
   * polyline returned by {@link findWalkPath}, updating directional animation between legs.
   * Fires {@link PLAYER_WALK_STOP} exactly once when the walk finishes or is interrupted.
   */
  private movePlayerToward(destX: number, destY: number, onArrive?: () => void): void {
    const sprite = this.player;
    if (!sprite) {
      onArrive?.();
      return;
    }

    const feetNow = getCharacterWorldFeet(sprite);
    const path = findWalkPath(
      feetNow,
      { x: destX, y: destY },
      this.roomData.walkable.polygons,
    );

    if (path.length === 0) {
      onArrive?.();
      return;
    }

    const final = path[path.length - 1]!;
    const totalDist = Math.hypot(final.x - feetNow.x, final.y - feetNow.y);
    if (totalDist < MIN_WALK_DISTANCE_PX) {
      onArrive?.();
      return;
    }

    if (this.playerMoveTween) {
      gameEvents.emit(PLAYER_WALK_STOP, {
        roomId: this.roomData.id,
        reason: 'interrupted',
      } satisfies PlayerWalkStopPayload);
    }
    this.stopPlayerMoveTween(false);

    this.walkArriveCallback = onArrive ?? null;
    this.currentPlayerPath = path;

    gameEvents.emit(PLAYER_WALK_START, {
      roomId: this.roomData.id,
      targetX: final.x,
      targetY: final.y,
    } satisfies PlayerWalkStartPayload);

    this.beginPlayerWalkLeg(sprite, path, 0);
  }

  /** Get (and memoize on the sprite) the feet offset in local sprite coordinates. */
  private getSpriteFeetLocal(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  ): { x: number; y: number } {
    let lx = sprite.getData('feetLocalX') as number | undefined;
    let ly = sprite.getData('feetLocalY') as number | undefined;
    if (typeof lx === 'number' && typeof ly === 'number') {
      return { x: lx, y: ly };
    }
    const data = sprite.getData('character') as CharacterData | undefined;
    const resolved = data
      ? resolveCharacterFeetLocal(data, sprite as Phaser.GameObjects.Sprite)
      : {
          x: (sprite as Phaser.GameObjects.Sprite).frame.width * 0.5,
          y: (sprite as Phaser.GameObjects.Sprite).frame.height,
        };
    lx = resolved.x;
    ly = resolved.y;
    sprite.setData('feetLocalX', lx);
    sprite.setData('feetLocalY', ly);
    return { x: lx, y: ly };
  }

  private beginPlayerWalkLeg(
    sprite: DirectionalCharacterSprite,
    path: readonly Point2[],
    legIndex: number,
  ): void {
    const walkSpeed = sprite.getData('walkSpeed') as number | undefined;
    const speed = typeof walkSpeed === 'number' && walkSpeed > 0 ? walkSpeed : 88;
    const { x: lx, y: ly } = this.getSpriteFeetLocal(sprite);

    const feetNow = getCharacterWorldFeet(sprite);
    const leg = path[legIndex]!;
    const dx = leg.x - feetNow.x;
    const dy = leg.y - feetNow.y;
    const distance = Math.hypot(dx, dy);

    // Skip zero-length legs (can occur if the path planner emits a waypoint right next to the
    // character, e.g. start already at a corner). Move to the next leg or finish.
    if (distance < 0.5) {
      if (legIndex + 1 < path.length) {
        this.beginPlayerWalkLeg(sprite, path, legIndex + 1);
        return;
      }
      this.finishPlayerWalk(sprite, facingFromWorldDelta(dx, dy));
      return;
    }

    const facing = facingFromWorldDelta(dx, dy);
    playDirectionalAnimation(sprite, 'Walk', facing);

    const durationMs = Math.max(1, Math.round((distance / speed) * 1000));

    const moveTween = this.tweens.add({
      targets: sprite,
      x: leg.x - lx,
      y: leg.y - ly,
      duration: durationMs,
      ease: 'Linear',
      onComplete: () => {
        // Leg was superseded (e.g. stopPlayerMoveTween nulled playerMoveTween) — do nothing.
        if (this.playerMoveTween !== moveTween) {
          return;
        }
        this.playerMoveTween = null;
        if (legIndex + 1 < path.length) {
          this.beginPlayerWalkLeg(sprite, path, legIndex + 1);
        } else {
          this.finishPlayerWalk(sprite, facing);
        }
      },
      onStop: () => {
        this.onPlayerWalkTweenStopped(moveTween);
      },
    });

    this.playerMoveTween = moveTween;
  }

  private finishPlayerWalk(sprite: DirectionalCharacterSprite, facing: CharacterFacing): void {
    this.currentPlayerPath = null;
    playDirectionalAnimation(sprite, 'Idle', facing);
    gameEvents.emit(PLAYER_WALK_STOP, {
      roomId: this.roomData.id,
      reason: 'complete',
    } satisfies PlayerWalkStopPayload);
    const arrive = this.walkArriveCallback;
    this.walkArriveCallback = null;
    arrive?.();
  }

  /**
   * Start a pathfound walk for a non-player character toward a raw world point (not pre-clamped).
   * Mirrors {@link movePlayerToward} but does not emit `PLAYER_WALK_*` events (those are
   * player-specific) and tracks its active tween in {@link npcWalkTweens} keyed by sprite.
   */
  private moveNpcToward(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    destX: number,
    destY: number,
    onArrive?: () => void,
  ): void {
    const feetNow = getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
    const path = findWalkPath(
      feetNow,
      { x: destX, y: destY },
      this.roomData.walkable.polygons,
    );

    if (path.length === 0) {
      onArrive?.();
      return;
    }

    const final = path[path.length - 1]!;
    const totalDist = Math.hypot(final.x - feetNow.x, final.y - feetNow.y);
    if (totalDist < MIN_WALK_DISTANCE_PX) {
      onArrive?.();
      return;
    }

    const prev = this.npcWalkTweens.get(sprite);
    if (prev) {
      prev.stop();
      this.npcWalkTweens.delete(sprite);
    }

    this.beginNpcWalkLeg(sprite, path, 0, onArrive);
  }

  private beginNpcWalkLeg(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    path: readonly Point2[],
    legIndex: number,
    onArrive?: () => void,
  ): void {
    const walkSpeed = sprite.getData('walkSpeed') as number | undefined;
    const speed = typeof walkSpeed === 'number' && walkSpeed > 0 ? walkSpeed : 88;
    const { x: lx, y: ly } = this.getSpriteFeetLocal(sprite);

    const feetNow = getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
    const leg = path[legIndex]!;
    const dx = leg.x - feetNow.x;
    const dy = leg.y - feetNow.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 0.5) {
      if (legIndex + 1 < path.length) {
        this.beginNpcWalkLeg(sprite, path, legIndex + 1, onArrive);
        return;
      }
      const facing = facingFromWorldDelta(dx, dy);
      if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
        playDirectionalAnimation(sprite as DirectionalCharacterSprite, 'Idle', facing);
      }
      onArrive?.();
      return;
    }

    const facing = facingFromWorldDelta(dx, dy);
    if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
      playDirectionalAnimation(sprite as DirectionalCharacterSprite, 'Walk', facing);
    }

    const durationMs = Math.max(1, Math.round((distance / speed) * 1000));

    const moveTween = this.tweens.add({
      targets: sprite,
      x: leg.x - lx,
      y: leg.y - ly,
      duration: durationMs,
      ease: 'Linear',
      onComplete: () => {
        if (this.npcWalkTweens.get(sprite) !== moveTween) {
          return;
        }
        this.npcWalkTweens.delete(sprite);
        if (legIndex + 1 < path.length) {
          this.beginNpcWalkLeg(sprite, path, legIndex + 1, onArrive);
          return;
        }
        if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
          playDirectionalAnimation(sprite as DirectionalCharacterSprite, 'Idle', facing);
        }
        onArrive?.();
      },
      onStop: () => {
        if (this.npcWalkTweens.get(sprite) !== moveTween) {
          return;
        }
        this.npcWalkTweens.delete(sprite);
        if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
          const idleFacing =
            (sprite.getData('facing') as CharacterFacing | undefined) ??
            resolveInitialIdleFacing(sprite as DirectionalCharacterSprite);
          playDirectionalAnimation(sprite as DirectionalCharacterSprite, 'Idle', idleFacing);
        }
      },
    });

    this.npcWalkTweens.set(sprite, moveTween);
  }

  private onPlayerWalkTweenStopped(tween: Phaser.Tweens.Tween): void {
    if (this.playerMoveTween !== tween) {
      return;
    }
    this.playerMoveTween = null;
    this.currentPlayerPath = null;
    if (this.player) {
      const facing =
        (this.player.getData('facing') as CharacterFacing | undefined) ?? resolveInitialIdleFacing(this.player);
      playDirectionalAnimation(this.player, 'Idle', facing);
    }
    gameEvents.emit(PLAYER_WALK_STOP, {
      roomId: this.roomData.id,
      reason: 'interrupted',
    } satisfies PlayerWalkStopPayload);
  }

  private drawRoomDebugOverlays(data: RoomSceneStartData): void {
    const debug = getGameSettings().debug;
    if (!debug?.showWalkable && !debug?.showPropOutlines) {
      return;
    }

    const lineWidth = 1;

    if (debug.showWalkable) {
      const gOuter = this.add.graphics();
      const gHoles = this.add.graphics();
      gOuter.lineStyle(lineWidth, DEBUG_WALKABLE_STROKE, 1);
      gHoles.lineStyle(lineWidth, DEBUG_WALKABLE_HOLE_STROKE, 1);
      for (const poly of this.roomData.walkable.polygons) {
        if (poly.active === false || poly.points.length < 3) {
          continue;
        }
        const vecs = poly.points.map((p) => new Phaser.Math.Vector2(p.x, p.y));
        gOuter.strokePoints(vecs, true);
        for (const h of poly.holes ?? []) {
          if (h.active === false || h.points.length < 3) {
            continue;
          }
          const hv = h.points.map((p) => new Phaser.Math.Vector2(p.x, p.y));
          gHoles.strokePoints(hv, true);
        }
      }
      gOuter.setDepth(DEBUG_OVERLAY_DEPTH);
      gHoles.setDepth(DEBUG_OVERLAY_DEPTH);
    }

    if (debug.showPropOutlines) {
      const g = this.add.graphics();
      g.lineStyle(lineWidth, DEBUG_PROP_COLLIDER_STROKE, 1);
      for (const spawn of data.props) {
        const pts = spawn.data.collider?.points;
        if (!pts || pts.length < 3) {
          continue;
        }
        const vecs = pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
        g.strokePoints(vecs, true);
      }
      g.setDepth(DEBUG_OVERLAY_DEPTH + 1);
    }

    if (debug.showWalkable) {
      // Shared Graphics reused every frame by updatePathDebug() — authoring-time visual feedback
      // for the pathfinding route around holes / concavities.
      this.debugPathGraphics = this.add.graphics();
      this.debugPathGraphics.setDepth(DEBUG_OVERLAY_DEPTH + 2);
    }
  }

  /**
   * Redraws the live player path polyline when `debug.showWalkable` is enabled. Cleared when
   * no walk is active. Called once per frame from {@link update}.
   */
  private updatePathDebug(): void {
    const g = this.debugPathGraphics;
    if (!g) {
      return;
    }
    g.clear();
    const path = this.currentPlayerPath;
    if (!path || path.length === 0 || !this.player) {
      return;
    }
    const feet = getCharacterWorldFeet(this.player);
    g.lineStyle(1, DEBUG_WALK_PATH_STROKE, 1);
    g.beginPath();
    g.moveTo(feet.x, feet.y);
    for (const p of path) {
      g.lineTo(p.x, p.y);
    }
    g.strokePath();
    g.fillStyle(DEBUG_WALK_PATH_STROKE, 1);
    for (const p of path) {
      g.fillRect(p.x - 1, p.y - 1, 3, 3);
    }
  }

  private spawnRoomProps(data: RoomSceneStartData): void {
    const textureKey = data.roomPropsTextureKey;
    if (!textureKey || data.props.length === 0) {
      return;
    }

    this.parallaxProps = [];

    const mergedClips = mergeRoomPropAnimationClips(data.props);
    const sorted = [...data.props].sort((a, b) => (a.data.zIndex ?? 0) - (b.data.zIndex ?? 0));

    // Must use the scene AnimationManager (no `target` sprite). Passing a sprite registers clips only on
    // that sprite; other props would never get `play()` and would stay on atlas frame 0 (often untagged).
    const created = this.anims.createFromAseprite(textureKey);
    applyCharacterAnimationClips(created, mergedClips);

    for (const spawn of sorted) {
      // Props render at their natural Aseprite frame dimensions. For full-room composite
      // sheets (the typical BENNE workflow) each frame already covers the full room width
      // and height, so no explicit setDisplaySize is needed.
      const sprite = this.add.sprite(spawn.x, spawn.y, textureKey).setOrigin(0, 0);
      sprite.setVisible(spawn.data.visible !== false);
      sprite.setAlpha(spawn.data.alpha ?? 1);
      sprite.setDepth(spawn.data.zIndex ?? 0);

      if (!this.anims.exists(spawn.tag)) {
        console.warn(`[Benne] Room prop '${spawn.id}' uses unknown Aseprite tag '${spawn.tag}'.`);
      } else {
        sprite.play(spawn.tag);
      }

      const pd = spawn.data.parallaxDepth;
      if (pd !== undefined && pd !== 1) {
        this.parallaxProps.push({
          sprite,
          baseX: spawn.x,
          baseY: spawn.y,
          parallaxDepth: pd,
        });
      }

      this.propSpritesById.set(spawn.id, sprite);
      this.setupRoomProp(data.room.id, spawn, sprite);
    }
  }

  private setupRoomProp(roomId: string, spawn: RoomPropSpawn, sprite: Phaser.GameObjects.Sprite): void {
    const d = spawn.data;
    if (!d.clickable) {
      return;
    }
    if (d.visible === false) {
      return;
    }

    const pts = d.collider?.points;
    if (!pts || pts.length < 3) {
      console.warn(`[Benne] Clickable prop '${spawn.id}' needs a collider polygon (at least 3 points).`);
      return;
    }

    const flat = pts.flatMap((p) => [p.x - spawn.x, p.y - spawn.y]);
    const poly = new Phaser.Geom.Polygon(flat);
    sprite.setInteractive({
      hitArea: poly,
      hitAreaCallback: Phaser.Geom.Polygon.Contains,
      useHandCursor: !isBenneGameCursorAsepriteEnabled(getGameSettings()),
    });

    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.tryConsumeScriptedDialogClickToSkip(pointer)) {
        return;
      }
      const profile = getEffectiveTwoVerbProfile(getGameSettings());
      const verbId = resolveVerbIdFromPointer(pointer, profile);
      if (!verbId) {
        return;
      }
      this.emitPropVerbInteraction(roomId, spawn, verbId);
    });
  }

  /**
   * Dispatches the **look** verb on this prop (same as a primary-button look click). Does not move or rotate the player.
   */
  tryBeginPropLook(roomId: string, spawn: RoomPropSpawn): void {
    this.emitPropVerbInteraction(roomId, spawn, 'look');
  }

  private resolvePropDescriptionForDispatch(spawn: RoomPropSpawn): string | undefined {
    if (this.propDescriptionOverrides.has(spawn.id)) {
      return this.propDescriptionOverrides.get(spawn.id);
    }
    return spawn.data.description;
  }

  private emitPropVerbInteraction(roomId: string, spawn: RoomPropSpawn, verbId: string): void {
    if (this.isScriptedDialogInputSuppressed()) {
      return;
    }
    console.log(`[Benne] verb "${verbId}" prop ${spawn.id}`);
    dispatchVerbInteraction(gameEvents, verbId, getPropVerbHandlers(spawn.data), {
      type: 'prop',
      propId: spawn.id,
      tag: spawn.tag,
      roomId,
      description: this.resolvePropDescriptionForDispatch(spawn),
      walkToPoint: spawn.data.walkToPoint,
      lookAtPoint: spawn.data.lookAtPoint,
    });
  }

  private createHotspot(roomId: string, hotspot: RoomHotspotData, roomW: number, roomH: number): void {
    if (hotspot.active === false) {
      return;
    }

    const pts = hotspot.points;
    if (!pts || pts.length < 3) {
      return;
    }

    const depth = 8000 + (hotspot.zIndex ?? 0);

    const onHotspotPointer = (pointer: Phaser.Input.Pointer): void => {
      if (this.tryConsumeScriptedDialogClickToSkip(pointer)) {
        return;
      }
      if (this.isScriptedDialogInputSuppressed()) {
        return;
      }
      const handlers = getHotspotVerbHandlers(hotspot);
      if (Object.keys(handlers.onVerb).length === 0 && handlers.onVerbFallback === undefined) {
        return;
      }
      const profile = getEffectiveTwoVerbProfile(getGameSettings());
      const verbId = resolveVerbIdFromPointer(pointer, profile);
      if (!verbId) {
        return;
      }
      console.log(`[Benne] verb "${verbId}" hotspot ${hotspot.id}`);
      dispatchVerbInteraction(gameEvents, verbId, handlers, {
        type: 'hotspot',
        hotspotId: hotspot.id,
        roomId,
        description: hotspot.description,
      });
    };

    const zone = this.add.zone(0, 0, roomW, roomH).setOrigin(0, 0).setDepth(depth);
    zone.setData('benneHotspot', true);
    const flat: number[] = [];
    for (const p of pts) {
      flat.push(p.x, p.y);
    }
    const geom = new Phaser.Geom.Polygon(flat);
    zone.setInteractive(geom, Phaser.Geom.Polygon.Contains);
    zone.input!.cursor = isBenneGameCursorAsepriteEnabled(getGameSettings()) ? 'none' : 'pointer';
    zone.on('pointerdown', onHotspotPointer);
  }

  private spawnCharacter(roomId: string, spawn: RoomCharacterSpawn): void {
    if (spawn.loadKind === 'aseprite') {
      this.spawnAsepriteCharacter(roomId, spawn);
      return;
    }

    const sprite = this.add.image(0, 0, spawn.textureKey);
    const feet = resolveCharacterFeetLocal(spawn.data, sprite as Phaser.GameObjects.Sprite);
    placeSpriteByFeet(sprite as Phaser.GameObjects.Sprite, feet, spawn.x, spawn.y);
    sprite.setDepth(CHARACTER_SCENE_DEPTH + (spawn.zIndex ?? 0));
    sprite.setVisible(spawn.visible !== false);
    sprite.setData('character', spawn.data);
    sprite.setData('walkSpeed', spawn.data.walkSpeed);
    sprite.setData('instanceId', spawn.instanceId);
    if (!this.characterSpritesByDefId.has(spawn.data.id)) {
      this.characterSpritesByDefId.set(spawn.data.id, sprite);
    }
    this.attachCharacterInteraction(roomId, spawn, sprite);
  }

  private spawnAsepriteCharacter(roomId: string, spawn: RoomCharacterSpawn): void {
    const sprite = this.add.sprite(0, 0, spawn.textureKey);
    sprite.setDepth(CHARACTER_SCENE_DEPTH + (spawn.zIndex ?? 0));
    sprite.setVisible(spawn.visible !== false);
    sprite.setData('character', spawn.data);
    sprite.setData('walkSpeed', spawn.data.walkSpeed);
    sprite.setData('instanceId', spawn.instanceId);
    const isPlayer = spawn.data.id === getStartingPlayerCharacterId();
    sprite.setData('isPlayer', isPlayer);

    const createdAnims = sprite.anims.createFromAseprite(spawn.textureKey);
    setupCharacterAsepritePlayback(sprite, spawn.data, createdAnims);
    attachDirectionalAnimationApi(sprite);

    const animBase = spawn.initialAnimation ?? 'Idle';
    const facing = resolveSpawnIdleFacing(sprite, spawn.initialFacing);
    playDirectionalAnimation(sprite, animBase, facing);

    const feet = resolveCharacterFeetLocal(spawn.data, sprite);
    placeSpriteByFeet(sprite, feet, spawn.x, spawn.y);

    this.attachCharacterInteraction(roomId, spawn, sprite);

    if (isPlayer) {
      this.player = sprite as DirectionalCharacterSprite;
    }
    if (!this.characterSpritesByDefId.has(spawn.data.id)) {
      this.characterSpritesByDefId.set(spawn.data.id, sprite);
    }
  }

  private attachCharacterInteraction(
    roomId: string,
    spawn: RoomCharacterSpawn,
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
  ): void {
    if (spawn.visible === false) {
      return;
    }
    const handlers = getCharacterVerbHandlers(spawn.data);
    if (
      !spawn.data.clickable ||
      (Object.keys(handlers.onVerb).length === 0 && handlers.onVerbFallback === undefined)
    ) {
      return;
    }

    const colliderPts = spawn.data.collider?.points;
    if (colliderPts && colliderPts.length >= 3) {
      const flat = colliderPts.flatMap((p) => [p.x, p.y]);
      const poly = new Phaser.Geom.Polygon(flat);
      sprite.setInteractive({
        hitArea: poly,
        hitAreaCallback: Phaser.Geom.Polygon.Contains,
        useHandCursor: !isBenneGameCursorAsepriteEnabled(getGameSettings()),
      });
    } else {
      sprite.setInteractive({ useHandCursor: !isBenneGameCursorAsepriteEnabled(getGameSettings()) });
    }
    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.tryConsumeScriptedDialogClickToSkip(pointer)) {
        return;
      }
      if (this.isScriptedDialogInputSuppressed()) {
        return;
      }
      const profile = getEffectiveTwoVerbProfile(getGameSettings());
      const verbId = resolveVerbIdFromPointer(pointer, profile);
      if (!verbId) {
        return;
      }
      console.log(`[Benne] verb "${verbId}" character ${spawn.data.id}`);
      const sx = sprite.x;
      const sy = sprite.y;
      const d = spawn.data;
      dispatchVerbInteraction(gameEvents, verbId, handlers, {
        type: 'character',
        characterId: d.id,
        instanceId: spawn.instanceId,
        roomId,
        description: d.description,
        ...(d.walkToPoint !== undefined
          ? { walkToPoint: { x: sx + d.walkToPoint.x, y: sy + d.walkToPoint.y } }
          : {}),
        ...(d.talkPoint !== undefined
          ? { talkPoint: { x: sx + d.talkPoint.x, y: sy + d.talkPoint.y } }
          : {}),
      });
    });
  }

  private setupCustomGameCursor(): void {
    const settings = getGameSettings();
    if (!isBenneGameCursorAsepriteEnabled(settings) || !this.textures.exists(CURSOR_TEXTURE_KEY)) {
      return;
    }
    const cfg = settings.cursor!;
    const idleKey = cfg.idleAnimation.trim();
    const activeKey = cfg.activeAnimation.trim();

    const created = this.anims.createFromAseprite(CURSOR_TEXTURE_KEY);
    applyCharacterAnimationClips(created, cfg.animations);

    if (!this.anims.exists(idleKey) || !this.anims.exists(activeKey)) {
      console.warn(
        `[Benne] Custom cursor: sheet is missing idle "${idleKey}" and/or active "${activeKey}" animation — skipping.`,
      );
      return;
    }

    this.input.setDefaultCursor('none');

    const sprite = this.add.sprite(0, 0, CURSOR_TEXTURE_KEY);
    sprite.setScrollFactor(0, 0);
    sprite.setDepth(CUSTOM_CURSOR_DEPTH);
    sprite.setName('benne-custom-cursor');
    sprite.play(idleKey);
    this.customCursorSprite = sprite;
    this.lastCustomCursorActive = false;

    this.input.on('pointermove', this.onCustomCursorPointerMove);
    this.refreshCustomCursor(this.input.activePointer);
  }

  private teardownCustomGameCursor(): void {
    if (!this.customCursorSprite) {
      return;
    }
    this.customCursorSprite.destroy();
    this.customCursorSprite = null;
    this.lastCustomCursorActive = null;
    this.input.setDefaultCursor('default');
  }

  private refreshCustomCursor(pointer: Phaser.Input.Pointer): void {
    const sprite = this.customCursorSprite;
    if (!sprite || !sprite.scene) {
      return;
    }
    const settings = getGameSettings();
    applyGameCursorSpriteHotspot(sprite, pointer, settings.cursor!);

    const idleKey = settings.cursor!.idleAnimation.trim();
    const activeKey = settings.cursor!.activeAnimation.trim();

    const overClickable = this.isCursorOverBenneClickable(this.input.hitTestPointer(pointer));
    if (this.lastCustomCursorActive === overClickable) {
      return;
    }
    this.lastCustomCursorActive = overClickable;
    sprite.play(overClickable ? activeKey : idleKey);
  }

  /**
   * True when Phaser’s hit stack includes a room prop (clickable path only registers hit areas),
   * hotspot zone, clickable character sprite, or GUI `button` hit target.
   */
  private isCursorOverBenneClickable(hits: Phaser.GameObjects.GameObject[]): boolean {
    for (const o of hits) {
      const go = o as Phaser.GameObjects.GameObject & { getData?: (key: string) => unknown };
      if (typeof go.getData === 'function') {
        if (go.getData('benneGuiButton') === true || go.getData('benneHotspot') === true) {
          return true;
        }
        if (go.getData('character')) {
          return true;
        }
      }
      for (const propSprite of this.propSpritesById.values()) {
        if (propSprite === o) {
          return true;
        }
      }
    }
    return false;
  }
}

function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Point2 {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq < 1e-18) {
    return { x: ax, y: ay };
  }
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + abx * t, y: ay + aby * t };
}

/** Closest point in or on a simple closed polygon (room space). */
function closestPointInOrOnSimplePolygon(
  px: number,
  py: number,
  vertices: readonly Point2[],
): Point2 | null {
  if (vertices.length < 3) {
    return null;
  }
  if (pointInPolygon(px, py, vertices)) {
    return { x: px, y: py };
  }
  let bestX = 0;
  let bestY = 0;
  let bestD = Infinity;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % n]!;
    const q = closestPointOnSegment(px, py, a.x, a.y, b.x, b.y);
    const d = (px - q.x) * (px - q.x) + (py - q.y) * (py - q.y);
    if (d < bestD) {
      bestD = d;
      bestX = q.x;
      bestY = q.y;
    }
  }
  return { x: bestX, y: bestY };
}

/** Centroid of a simple polygon; falls back to vertex average when area is degenerate. */
function polygonRingCentroid(pts: readonly Point2[]): Point2 | null {
  const n = pts.length;
  if (n < 3) {
    return null;
  }
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = pts[i]!.x;
    const yi = pts[i]!.y;
    const xj = pts[j]!.x;
    const yj = pts[j]!.y;
    const cross = xi * yj - xj * yi;
    twiceArea += cross;
    cx += (xi + xj) * cross;
    cy += (yi + yj) * cross;
  }
  if (Math.abs(twiceArea) < 1e-10) {
    let sx = 0;
    let sy = 0;
    for (const p of pts) {
      sx += p.x;
      sy += p.y;
    }
    return { x: sx / n, y: sy / n };
  }
  const k = 1 / (3 * twiceArea);
  return { x: cx * k, y: cy * k };
}
</file>

</files>
