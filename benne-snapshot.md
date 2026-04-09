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
src/editor/preview/createRoomPreviewGame.ts
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
src/engine/events/playerWalkEvents.ts
src/engine/events/propInteractionEvents.ts
src/engine/events/verbInteractionEvents.ts
src/engine/Game.ts
src/engine/gameConfig.ts
src/engine/InteractiveObject.ts
src/engine/postfx/PostEffects.ts
src/engine/Room.ts
src/engine/scenes/BootScene.ts
src/engine/scenes/RoomScene.ts
src/engine/scripting/BenneScript.ts
src/engine/scripting/index.ts
src/engine/scripting/registerRoomScript.ts
src/engine/scripting/RoomScriptContext.ts
src/engine/scripting/types.ts
src/engine/verbs/dispatchVerb.ts
src/engine/verbs/normalizeHandlers.ts
src/engine/verbs/resolvePointerVerb.ts
src/engine/verbs/verbConfig.ts
src/engine/walkable.ts
src/game/assets/images/characters/clerk/clerk.json
src/game/assets/images/characters/clerk/clerk2.json
src/game/assets/images/characters/henry/henry.json
src/game/assets/images/rooms/office/office.json
src/game/assets/images/rooms/outside/outside.json
src/game/assets/images/rooms/outsideOffice/outsideOffice.json
src/game/characterAseprite.ts
src/game/characterPreviewIdleTag.ts
src/game/characters/bob/bob.character.json
src/game/characters/bob/bob.character.ts
src/game/characters/clerk/clerk.character.json
src/game/characters/clerk/clerk.character.ts
src/game/characters/henry/henry.character.json
src/game/characters/henry/henry.character.ts
src/game/characters/penny/penny.character.json
src/game/characters/penny/penny.character.ts
src/game/constants.ts
src/game/game-config.json
src/game/globalScript.ts
src/game/loadAsepriteAtlasData.ts
src/game/loadCharacterData.ts
src/game/loadStartRoom.ts
src/game/normalizeAsepriteJson.ts
src/game/registerGameContent.ts
src/game/resolveGameAssetUrl.ts
src/game/roomAseprite.ts
src/game/rooms/bathroom/bathroom.room.json
src/game/rooms/bathroom/bathroom.room.ts
src/game/rooms/office/office.room.json
src/game/rooms/office/office.room.ts
src/game/rooms/outside/outside.room.json
src/game/rooms/outside/outside.room.ts
src/game/rooms/outsideOffice/outsideOffice.room.json
src/game/rooms/outsideOffice/outsideOffice.room.ts
src/game/rooms/rooms.manifest.json
src/main.ts
src/types/character.ts
src/types/dialogue.ts
src/types/game.ts
src/types/inventory.ts
src/types/room.ts
vite.config.ts
</directory_structure>

<files>
This section contains the contents of the repository's files.

<file path="src/engine/scripting/BenneScript.ts">
import type { RoomPropInteractPayload } from '../events/propInteractionEvents.js'
import type { RoomScene } from '../scenes/RoomScene.js'
import { roomPropVerbEventId } from '../verbs/verbInteractionEvents.js' // adjust path if your helper is elsewhere

export class BenneScript {
  constructor(
    private events: Phaser.Events.EventEmitter,
    private roomId: string,
    private roomScene: RoomScene
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Prop verb handlers — the clean API you liked
  // ─────────────────────────────────────────────────────────────
  onProp(
    propId: string,
    verbId: string,
    handler: (payload: RoomPropInteractPayload) => void | Promise<void>
  ): void {
    const eventId = roomPropVerbEventId(this.roomId, propId, verbId)
    this.events.on(eventId, async (payload: RoomPropInteractPayload) => {
      try {
        await handler(payload)
      } catch (err) {
        console.error(`Error in ${eventId} handler:`, err)
      }
    })
  }

  /** Sugar: B.whenLookAt('desk', async () => { ... }) */
  whenLookAt(propId: string, handler: () => void | Promise<void>): void {
    this.onProp(propId, 'look', () => handler())
  }

  /** Sugar: B.whenUse('door', async () => { ... }) */
  whenUse(propId: string, handler: () => void | Promise<void>): void {
    this.onProp(propId, 'use', () => handler())
  }

  // ─────────────────────────────────────────────────────────────
  // Player actions (will become awaitable)
  // ─────────────────────────────────────────────────────────────
  async walkToProp(propId: string): Promise<void> {
    // TODO: implement using roomScene + walkable system
    // For now, just a placeholder that logs
    console.log(`[Bennescript] Player walking to prop: ${propId}`)
    // Future: await this.roomScene.player.walkToProp(propId)
  }

  async face(propIdOrCharacterId: string): Promise<void> {
    console.log(`[Bennescript] Player facing: ${propIdOrCharacterId}`)
    // Future: direction logic using feet + directional animation
  }

  // ─────────────────────────────────────────────────────────────
  // Dialogue / output (placeholder until we add proper system)
  // ─────────────────────────────────────────────────────────────
  say(line: string): void {
    console.log(`[Player] ${line}`)
    // Future: queue in dialogue system, await click-to-continue, show portrait, etc.
  }

  // ─────────────────────────────────────────────────────────────
  // Future-friendly stubs (easy to flesh out later)
  // ─────────────────────────────────────────────────────────────
  get player() {
    return {
      walkToProp: this.walkToProp.bind(this),
      face: this.face.bind(this),
      say: this.say.bind(this),
    }
  }

  // Example: B.props.desk (we can make this dynamic with Proxy later if desired)
}
</file>

<file path="src/engine/scripting/index.ts">
export * from './RoomScriptContext.js'
export * from './BenneScript.js'
export { registerRoomScript } from './registerRoomScript.js'
</file>

<file path="src/engine/scripting/registerRoomScript.ts">
import type { RoomScriptContext } from './types.js'
import { gameEvents } from '../gameEvents.js' // adjust path to your EventBus
import { RoomScene } from '../scenes/RoomScene.js' // adjust if needed

/**
 * New clean registration API.
 * This replaces the old raw events version.
 */
export function registerRoomScript(
  registerFn: (context: RoomScriptContext) => void
): void {
  // This function is called by registerGameContent during boot.
  // We need to pass the actual roomId and roomScene instance.
  // For now we'll register a setup function that will be called from RoomScene.create()

  // Temporary bridge: we'll improve this in the next step
  ;(registerFn as any).__benneRoomScript = true // marker for RoomScene
  ;(registerFn as any).__register = registerFn
}
</file>

<file path="src/engine/scripting/RoomScriptContext.ts">
import type { RoomScriptContext as ContextType } from './types.js'
import { BenneScript } from './BenneScript.js'

export function createRoomScriptContext(
  events: Phaser.Events.EventEmitter,
  roomId: string,
  roomScene: RoomScene
): ContextType {
  const B = new BenneScript(events, roomId, roomScene)

  const context: ContextType = {
    B,
    events,
    roomId,
    roomScene,
    onProp: B.onProp.bind(B),
    whenLookAt: B.whenLookAt.bind(B),
    whenUse: B.whenUse.bind(B),
  }

  return context
}
</file>

<file path="src/engine/scripting/types.ts">
import type { RoomPropInteractPayload } from '../events/propInteractionEvents.js'
import type { RoomScene } from '../scenes/RoomScene.js'

export interface RoomScriptContext {
  /** Main facade object — this is what authors use as `B` */
  readonly B: BenneScript

  /** Raw access if you really need it (advanced) */
  readonly events: Phaser.Events.EventEmitter
  readonly roomId: string
  readonly roomScene: RoomScene

  // Convenience re-exports so you can do B.onProp or just onProp inside the callback
  onProp: BenneScript['onProp']
  whenLookAt: BenneScript['whenLookAt']
  whenUse: BenneScript['whenUse']
  // ... more will be added later
}
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

<file path="src/game/assets/images/characters/clerk/clerk.json">
{ "frames": {
   "clerk 0.aseprite": {
    "frame": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 130
   },
   "clerk 1.aseprite": {
    "frame": { "x": 36, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 130
   },
   "clerk 2.aseprite": {
    "frame": { "x": 72, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 130
   },
   "clerk 3.aseprite": {
    "frame": { "x": 108, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 130
   },
   "clerk 4.aseprite": {
    "frame": { "x": 144, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 5.aseprite": {
    "frame": { "x": 0, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 6.aseprite": {
    "frame": { "x": 36, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 7.aseprite": {
    "frame": { "x": 72, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 8.aseprite": {
    "frame": { "x": 108, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 9.aseprite": {
    "frame": { "x": 144, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 10.aseprite": {
    "frame": { "x": 0, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 11.aseprite": {
    "frame": { "x": 36, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 12.aseprite": {
    "frame": { "x": 72, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 13.aseprite": {
    "frame": { "x": 108, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 14.aseprite": {
    "frame": { "x": 144, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 15.aseprite": {
    "frame": { "x": 0, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 16.aseprite": {
    "frame": { "x": 36, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 17.aseprite": {
    "frame": { "x": 72, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 18.aseprite": {
    "frame": { "x": 108, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 19.aseprite": {
    "frame": { "x": 144, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 20.aseprite": {
    "frame": { "x": 0, "y": 256, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   "clerk 21.aseprite": {
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
  "image": "clerk.png",
  "format": "RGBA8888",
  "size": { "w": 180, "h": 320 },
  "scale": "1",
  "frameTags": [
   { "name": "IdleL", "from": 0, "to": 0, "direction": "forward", "color": "#000000ff" },
   { "name": "IdleD", "from": 1, "to": 1, "direction": "forward", "color": "#000000ff" },
   { "name": "IdleR", "from": 2, "to": 2, "direction": "forward", "color": "#000000ff" },
   { "name": "IdleU", "from": 3, "to": 3, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkL", "from": 4, "to": 9, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkD", "from": 10, "to": 15, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkU", "from": 16, "to": 21, "direction": "forward", "color": "#000000ff" }
  ],
  "layers": [
   { "name": "Layer 2", "opacity": 255, "blendMode": "normal" },
   { "name": "R", "opacity": 255, "blendMode": "normal" },
   { "name": "D", "opacity": 255, "blendMode": "normal" },
   { "name": "L" },
   { "name": "Arm2", "group": "L", "opacity": 255, "blendMode": "normal" },
   { "name": "Leg", "group": "L", "opacity": 255, "blendMode": "normal" },
   { "name": "Torso", "group": "L", "opacity": 255, "blendMode": "normal" },
   { "name": "Arm", "group": "L", "opacity": 255, "blendMode": "normal" }
  ],
  "slices": [
  ]
 }
}
</file>

<file path="src/game/assets/images/characters/clerk/clerk2.json">
{ "frames": [
   {
    "filename": "clerk 0.aseprite",
    "frame": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 130
   },
   {
    "filename": "clerk 1.aseprite",
    "frame": { "x": 36, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 130
   },
   {
    "filename": "clerk 2.aseprite",
    "frame": { "x": 72, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 130
   },
   {
    "filename": "clerk 3.aseprite",
    "frame": { "x": 108, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 130
   },
   {
    "filename": "clerk 4.aseprite",
    "frame": { "x": 144, "y": 0, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 5.aseprite",
    "frame": { "x": 0, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 6.aseprite",
    "frame": { "x": 36, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 7.aseprite",
    "frame": { "x": 72, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 8.aseprite",
    "frame": { "x": 108, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 9.aseprite",
    "frame": { "x": 144, "y": 64, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 10.aseprite",
    "frame": { "x": 0, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 11.aseprite",
    "frame": { "x": 36, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 12.aseprite",
    "frame": { "x": 72, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 13.aseprite",
    "frame": { "x": 108, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 14.aseprite",
    "frame": { "x": 144, "y": 128, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 15.aseprite",
    "frame": { "x": 0, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 16.aseprite",
    "frame": { "x": 36, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 17.aseprite",
    "frame": { "x": 72, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 18.aseprite",
    "frame": { "x": 108, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 19.aseprite",
    "frame": { "x": 144, "y": 192, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 20.aseprite",
    "frame": { "x": 0, "y": 256, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   },
   {
    "filename": "clerk 21.aseprite",
    "frame": { "x": 36, "y": 256, "w": 36, "h": 64 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 36, "h": 64 },
    "sourceSize": { "w": 36, "h": 64 },
    "duration": 180
   }
 ],
 "meta": {
  "app": "https://www.aseprite.org/",
  "version": "1.3.18-beta1-x64",
  "image": "clerk.png",
  "format": "RGBA8888",
  "size": { "w": 180, "h": 320 },
  "scale": "1",
  "frameTags": [
   { "name": "IdleL", "from": 0, "to": 0, "direction": "forward", "color": "#000000ff" },
   { "name": "IdleD", "from": 1, "to": 1, "direction": "forward", "color": "#000000ff" },
   { "name": "IdleR", "from": 2, "to": 2, "direction": "forward", "color": "#000000ff" },
   { "name": "IdleU", "from": 3, "to": 3, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkL", "from": 4, "to": 9, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkD", "from": 10, "to": 15, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkU", "from": 16, "to": 21, "direction": "forward", "color": "#000000ff" }
  ],
  "layers": [
   { "name": "Layer 2", "opacity": 255, "blendMode": "normal" },
   { "name": "R", "opacity": 255, "blendMode": "normal" },
   { "name": "D", "opacity": 255, "blendMode": "normal" },
   { "name": "L" },
   { "name": "Arm2", "group": "L", "opacity": 255, "blendMode": "normal" },
   { "name": "Leg", "group": "L", "opacity": 255, "blendMode": "normal" },
   { "name": "Torso", "group": "L", "opacity": 255, "blendMode": "normal" },
   { "name": "Arm", "group": "L", "opacity": 255, "blendMode": "normal" }
  ],
  "slices": [
  ]
 }
}
</file>

<file path="src/game/assets/images/characters/henry/henry.json">
{ "frames": {
   "henry 0.aseprite": {
    "frame": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 1.aseprite": {
    "frame": { "x": 160, "y": 0, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 2.aseprite": {
    "frame": { "x": 320, "y": 0, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 3.aseprite": {
    "frame": { "x": 480, "y": 0, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 4.aseprite": {
    "frame": { "x": 640, "y": 0, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 5.aseprite": {
    "frame": { "x": 800, "y": 0, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 6.aseprite": {
    "frame": { "x": 960, "y": 0, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 7.aseprite": {
    "frame": { "x": 0, "y": 160, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 8.aseprite": {
    "frame": { "x": 160, "y": 160, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 9.aseprite": {
    "frame": { "x": 320, "y": 160, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 10.aseprite": {
    "frame": { "x": 480, "y": 160, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 11.aseprite": {
    "frame": { "x": 640, "y": 160, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 12.aseprite": {
    "frame": { "x": 800, "y": 160, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 13.aseprite": {
    "frame": { "x": 960, "y": 160, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 14.aseprite": {
    "frame": { "x": 0, "y": 320, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 15.aseprite": {
    "frame": { "x": 160, "y": 320, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 16.aseprite": {
    "frame": { "x": 320, "y": 320, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 17.aseprite": {
    "frame": { "x": 480, "y": 320, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 18.aseprite": {
    "frame": { "x": 640, "y": 320, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 19.aseprite": {
    "frame": { "x": 800, "y": 320, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 20.aseprite": {
    "frame": { "x": 960, "y": 320, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 21.aseprite": {
    "frame": { "x": 0, "y": 480, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 22.aseprite": {
    "frame": { "x": 160, "y": 480, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 23.aseprite": {
    "frame": { "x": 320, "y": 480, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 24.aseprite": {
    "frame": { "x": 480, "y": 480, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 25.aseprite": {
    "frame": { "x": 160, "y": 0, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 26.aseprite": {
    "frame": { "x": 640, "y": 480, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 27.aseprite": {
    "frame": { "x": 160, "y": 0, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 28.aseprite": {
    "frame": { "x": 800, "y": 480, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 29.aseprite": {
    "frame": { "x": 640, "y": 480, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 30.aseprite": {
    "frame": { "x": 320, "y": 0, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 31.aseprite": {
    "frame": { "x": 960, "y": 480, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 32.aseprite": {
    "frame": { "x": 320, "y": 0, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 33.aseprite": {
    "frame": { "x": 0, "y": 640, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 34.aseprite": {
    "frame": { "x": 960, "y": 480, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 35.aseprite": {
    "frame": { "x": 480, "y": 0, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 36.aseprite": {
    "frame": { "x": 160, "y": 640, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 37.aseprite": {
    "frame": { "x": 480, "y": 0, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 38.aseprite": {
    "frame": { "x": 320, "y": 640, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 39.aseprite": {
    "frame": { "x": 160, "y": 640, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 40.aseprite": {
    "frame": { "x": 640, "y": 0, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 41.aseprite": {
    "frame": { "x": 480, "y": 640, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 42.aseprite": {
    "frame": { "x": 640, "y": 640, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 43.aseprite": {
    "frame": { "x": 800, "y": 640, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 44.aseprite": {
    "frame": { "x": 960, "y": 640, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 45.aseprite": {
    "frame": { "x": 0, "y": 800, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 46.aseprite": {
    "frame": { "x": 160, "y": 800, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 47.aseprite": {
    "frame": { "x": 320, "y": 800, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 48.aseprite": {
    "frame": { "x": 480, "y": 800, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 49.aseprite": {
    "frame": { "x": 640, "y": 800, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 50.aseprite": {
    "frame": { "x": 800, "y": 800, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 51.aseprite": {
    "frame": { "x": 960, "y": 800, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 52.aseprite": {
    "frame": { "x": 0, "y": 960, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 53.aseprite": {
    "frame": { "x": 160, "y": 960, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 54.aseprite": {
    "frame": { "x": 640, "y": 800, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 55.aseprite": {
    "frame": { "x": 320, "y": 960, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 56.aseprite": {
    "frame": { "x": 640, "y": 800, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 57.aseprite": {
    "frame": { "x": 320, "y": 960, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 58.aseprite": {
    "frame": { "x": 640, "y": 800, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 59.aseprite": {
    "frame": { "x": 320, "y": 960, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 60.aseprite": {
    "frame": { "x": 640, "y": 800, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 61.aseprite": {
    "frame": { "x": 480, "y": 960, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 62.aseprite": {
    "frame": { "x": 640, "y": 960, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 63.aseprite": {
    "frame": { "x": 800, "y": 960, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   },
   "henry 64.aseprite": {
    "frame": { "x": 960, "y": 960, "w": 160, "h": 160 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 160, "h": 160 },
    "sourceSize": { "w": 160, "h": 160 },
    "duration": 200
   }
 },
 "meta": {
  "app": "https://www.aseprite.org/",
  "version": "1.3.18-beta1-x64",
  "image": "henry.png",
  "format": "RGBA8888",
  "size": { "w": 1120, "h": 1120 },
  "scale": "1",
  "frameTags": [
   { "name": "IdleDR", "from": 1, "to": 1, "direction": "forward", "color": "#000000ff" },
   { "name": "IdleDL", "from": 2, "to": 2, "direction": "forward", "color": "#000000ff" },
   { "name": "IdleL", "from": 3, "to": 3, "direction": "forward", "color": "#000000ff" },
   { "name": "IdleU", "from": 4, "to": 4, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkDR", "from": 5, "to": 8, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkDL", "from": 9, "to": 12, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkL", "from": 13, "to": 16, "direction": "forward", "color": "#000000ff" },
   { "name": "WalkU", "from": 17, "to": 20, "direction": "forward", "color": "#000000ff" },
   { "name": "GrabL", "from": 21, "to": 21, "direction": "forward", "color": "#000000ff" },
   { "name": "GrabU", "from": 22, "to": 22, "direction": "forward", "color": "#000000ff" },
   { "name": "ReachU", "from": 23, "to": 24, "direction": "forward", "color": "#000000ff" },
   { "name": "TalkDR", "from": 25, "to": 29, "direction": "forward", "color": "#000000ff" },
   { "name": "TalkDL", "from": 30, "to": 34, "direction": "forward", "color": "#000000ff" },
   { "name": "TalkL", "from": 35, "to": 39, "direction": "forward", "color": "#000000ff" },
   { "name": "TalkU", "from": 40, "to": 41, "direction": "forward", "color": "#000000ff" },
   { "name": "CrouchU", "from": 42, "to": 42, "direction": "forward", "color": "#000000ff" },
   { "name": "SandU", "from": 43, "to": 46, "direction": "forward", "color": "#000000ff" },
   { "name": "Saw_Intro", "from": 47, "to": 49, "direction": "forward", "color": "#000000ff" },
   { "name": "Saw_Sawing", "from": 50, "to": 53, "direction": "forward", "color": "#000000ff" },
   { "name": "Saw_Pant", "from": 54, "to": 60, "direction": "forward", "color": "#000000ff" },
   { "name": "DropWheels", "from": 61, "to": 64, "direction": "forward", "color": "#000000ff" }
  ],
  "layers": [
   { "name": "Face Back" },
   { "name": "body", "group": "Face Back", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 7", "group": "Face Back", "opacity": 255, "blendMode": "normal" },
   { "name": "kerchief", "group": "Face Back", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 5", "group": "Face Back", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 6", "group": "Face Back", "opacity": 255, "blendMode": "normal" },
   { "name": "Face Left" },
   { "name": "body", "group": "Face Left", "opacity": 255, "blendMode": "normal" },
   { "name": "head", "group": "Face Left", "opacity": 255, "blendMode": "normal" },
   { "name": "hair", "group": "Face Left", "opacity": 255, "blendMode": "normal" },
   { "name": "hat", "group": "Face Left", "opacity": 255, "blendMode": "normal" },
   { "name": "Face Front" },
   { "name": "body", "group": "Face Front", "opacity": 255, "blendMode": "normal" },
   { "name": "head", "group": "Face Front", "opacity": 255, "blendMode": "normal" },
   { "name": "WalkL" },
   { "name": "Legs2", "group": "WalkL", "opacity": 255, "blendMode": "normal" },
   { "name": "Legs", "group": "WalkL", "opacity": 255, "blendMode": "normal" },
   { "name": "Torso", "group": "WalkL", "opacity": 255, "blendMode": "normal" },
   { "name": "Arms", "group": "WalkL", "opacity": 255, "blendMode": "normal" },
   { "name": "Head", "group": "WalkL", "opacity": 255, "blendMode": "normal" },
   { "name": "WalkD" },
   { "name": "Legs", "group": "WalkD", "opacity": 255, "blendMode": "normal" },
   { "name": "Body", "group": "WalkD", "opacity": 255, "blendMode": "normal" },
   { "name": "Head", "group": "WalkD", "opacity": 255, "blendMode": "normal" },
   { "name": "WalkU", "opacity": 255, "blendMode": "normal" },
   { "name": "GrabL" },
   { "name": "Layer 1", "group": "GrabL", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 2", "group": "GrabL", "opacity": 255, "blendMode": "normal" },
   { "name": "Reach and Grab Up" },
   { "name": "Layer 4", "group": "Reach and Grab Up", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 3", "group": "Reach and Grab Up", "opacity": 255, "blendMode": "normal" },
   { "name": "Sawing" },
   { "name": "Shavings", "group": "Sawing", "opacity": 255, "blendMode": "normal" },
   { "name": "Char", "group": "Sawing", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 12", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 8", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 10", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 9", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 11", "opacity": 255, "blendMode": "normal" }
  ],
  "slices": [
  ]
 }
}
</file>

<file path="src/game/assets/images/rooms/outside/outside.json">
{ "frames": {
   "outside 0.aseprite": {
    "frame": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 100
   },
   "outside 1.aseprite": {
    "frame": { "x": 352, "y": 0, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 100
   },
   "outside 2.aseprite": {
    "frame": { "x": 704, "y": 0, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 100
   },
   "outside 3.aseprite": {
    "frame": { "x": 0, "y": 198, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 100
   },
   "outside 4.aseprite": {
    "frame": { "x": 352, "y": 198, "w": 352, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 352, "h": 198 },
    "sourceSize": { "w": 352, "h": 198 },
    "duration": 100
   }
 },
 "meta": {
  "app": "https://www.aseprite.org/",
  "version": "1.3.18-beta1-x64",
  "image": "outside.png",
  "format": "RGBA8888",
  "size": { "w": 1056, "h": 396 },
  "scale": "1",
  "frameTags": [
   { "name": "Background", "from": 1, "to": 1, "direction": "forward", "color": "#000000ff" },
   { "name": "Wall", "from": 2, "to": 2, "direction": "forward", "color": "#000000ff" },
   { "name": "Gate", "from": 3, "to": 3, "direction": "forward", "color": "#000000ff" },
   { "name": "Car", "from": 4, "to": 4, "direction": "forward", "color": "#000000ff" }
  ],
  "layers": [
   { "name": "Sky", "opacity": 255, "blendMode": "normal" },
   { "name": "Back Hill", "opacity": 255, "blendMode": "normal" },
   { "name": "House", "opacity": 255, "blendMode": "normal" },
   { "name": "Hill", "opacity": 255, "blendMode": "normal" },
   { "name": "Path", "opacity": 255, "blendMode": "normal" },
   { "name": "Gate", "opacity": 255, "blendMode": "normal" },
   { "name": "Wall", "opacity": 255, "blendMode": "normal" },
   { "name": "Wall Arch", "opacity": 255, "blendMode": "normal" },
   { "name": "Callbox", "opacity": 255, "blendMode": "normal" },
   { "name": "Bushes", "opacity": 255, "blendMode": "normal" },
   { "name": "Car", "opacity": 255, "blendMode": "normal" },
   { "name": "Player", "opacity": 255, "blendMode": "normal" },
   { "name": "UI", "opacity": 255, "blendMode": "normal" }
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

<file path="src/game/characters/penny/penny.character.json">
{
  "id": "penny",
  "name": "Penny",
  "description": "",
  "walkSpeed": 88,
  "clickable": false,
  "display": {
    "aseprite": true
  }
}
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

<file path="src/game/resolveGameAssetUrl.ts">
/**
 * Resolves paths from room JSON (`images/...` under `src/game/assets/`) to Vite-built URLs.
 */
const imageUrls = import.meta.glob('./assets/**/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  as: 'url',
}) as Record<string, string>;

const jsonUrls = import.meta.glob('./assets/**/*.json', {
  eager: true,
  as: 'url',
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

<file path="src/game/rooms/bathroom/bathroom.room.json">
{
  "id": "bathroom",
  "name": "Bathroom",
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
    "polygons": []
  },
  "hotspots": [],
  "points": [],
  "regions": [],
  "props": []
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

<file path="src/types/inventory.ts">
export interface InventoryDefinition {
  id: string;
  name: string;
  description: string;
  /** Inventory row / UI icon texture key */
  iconTextureKey?: string;
}
</file>

<file path="src/editor/preview/buildPreviewManifest.ts">
import { getAsepriteAssetPaths, getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/characterAseprite';
import {
    getRoomAsepriteAssetPaths,
    getRoomAsepriteTextureKey,
} from '../../game/roomAseprite';
import {
    readAsepriteFrameTagNamesFromRawJson,
    warnIfAnimationConfigKeysMissingFromFrameTags,
} from '../../game/loadAsepriteAtlasData';
import { normalizeAsepriteJsonForPhaser } from '../../game/normalizeAsepriteJson';
import { joinGameWebviewUri } from './previewUrls';
import type { CharacterData } from '../../types/character';
import type { RoomCharacterInstance, RoomData, RoomPropInstance } from '../../types/room';
import type {
    RoomCharacterSpawn,
    RoomPropSpawn,
    RoomSceneStartData,
} from '../../engine/scenes/BootScene';

export type PreviewManifest = {
    loads: PreviewLoadEntry[];
    startData: RoomSceneStartData;
    revokeObjectUrls: string[];
};

type PreviewLoadEntry =
    | { kind: 'image'; key: string; url: string }
    | { kind: 'aseprite'; key: string; textureURL: string; atlasURL: string };

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

    const startData: RoomSceneStartData = {
        room,
        backgroundTextureKey,
        characters: spawns,
        props: propSpawns,
        roomPropsTextureKey,
    };

    return { loads, startData, revokeObjectUrls };
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

const BTN_ACTIVE = 'background:#3d5a80;color:#e8ecff;border:1px solid #5a7aaa;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;font-family:system-ui,sans-serif;';
const BTN_IDLE = 'background:#3a3a52;color:#e8ecff;border:1px solid #5a5a70;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;font-family:system-ui,sans-serif;';

function wireTopbar(characterJsonUri: string, game: Game | null): void {
  setTopbar(`
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid #2e2e44;background:#222230;">
      <span style="font:12px system-ui,sans-serif;color:#b8bdd0;">Edit</span>
      <button type="button" id="benne-char-mode-feet" style="${BTN_ACTIVE}">Feet</button>
      <button type="button" id="benne-char-mode-collider" style="${BTN_IDLE}">Collider</button>
      <span style="font:12px system-ui,sans-serif;color:#8892a8;">· zoom · middle pan · F fit</span>
      <button type="button" id="benne-char-save-feet" style="background:#3d5a80;color:#e8ecff;border:1px solid #5a7aaa;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;font-family:system-ui,sans-serif;">Save feet</button>
      <button type="button" id="benne-char-save-collider" style="background:#4a3d60;color:#e8ecff;border:1px solid #7a5a9a;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;font-family:system-ui,sans-serif;">Save collider</button>
      <button type="button" id="benne-char-refresh" style="${BTN_IDLE}">Refresh</button>
    </div>
    <div style="font:11px system-ui,sans-serif;color:#8a92a8;padding:4px 12px 8px;background:#1e1e2a;">Feet: drag yellow handle. Collider (magenta): place 3+ points, double-click edge to add, Delete removes selected. Saving with fewer than three points removes the custom collider (full sprite clickable).</div>
  `);

  const setMode = (mode: 'feet' | 'collider'): void => {
    const fn = game?.registry.get('benneCharacterPreviewSetMode') as
      | ((m: 'feet' | 'collider') => void)
      | undefined;
    fn?.(mode);
    const bf = document.getElementById('benne-char-mode-feet') as HTMLButtonElement | null;
    const bc = document.getElementById('benne-char-mode-collider') as HTMLButtonElement | null;
    if (bf) {
      bf.style.cssText = mode === 'feet' ? BTN_ACTIVE : BTN_IDLE;
    }
    if (bc) {
      bc.style.cssText = mode === 'collider' ? BTN_ACTIVE : BTN_IDLE;
    }
  };

  document.getElementById('benne-char-mode-feet')?.addEventListener('click', () => setMode('feet'));
  document.getElementById('benne-char-mode-collider')?.addEventListener('click', () => setMode('collider'));
  setMode('feet');

  document.getElementById('benne-char-save-feet')?.addEventListener('click', () => {
    const readFeet = game?.registry.get('benneCharacterPreviewReadFeet') as (() => { x: number; y: number }) | undefined;
    if (!readFeet || !vscodeApi) {
      return;
    }
    const feet = readFeet();
    vscodeApi.postMessage({
      type: 'benne/charPreview/saveFeet',
      characterJsonUri,
      feet,
    });
  });
  document.getElementById('benne-char-save-collider')?.addEventListener('click', () => {
    const readCollider = game?.registry.get('benneCharacterPreviewReadCollider') as
      | (() => { points: { x: number; y: number }[] } | null)
      | undefined;
    if (!readCollider || !vscodeApi) {
      return;
    }
    const collider = readCollider();
    vscodeApi.postMessage({
      type: 'benne/charPreview/saveCollider',
      characterJsonUri,
      collider,
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
  if (msg?.type === 'benne/charPreview/colliderSaveResult') {
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
  if (msg?.type === 'benne/charPreview/feetSaveResult') {
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

<file path="src/editor/preview/createCharacterPreviewGame.ts">
import * as Phaser from 'phaser';
import { applyBootAudioSettings } from '../../engine/applyAudioFromSettings';
import {
  placeSpriteByFeet,
  resolveCharacterFeetLocal,
  type CharacterFeetLocal,
} from '../../engine/characterFeet';
import type { CharacterData } from '../../types/character';
import type { Point2 } from '../../types/room';
import { PreviewPolygonOverlay } from './previewPolygonOverlay';

const BOOT = 'BenneCharacterPreviewBoot';
const PREVIEW = 'BenneCharacterPreview';

/** Padding around the sprite frame in world pixels (matches room editor “fit art” feel). */
const WORLD_PAD = 56;
/** Room-editor-style vertex handle: yellow fill, dark stroke (`RoomPolygonEditScene`). */
const HANDLE_FILL = 0xffee44;
const HANDLE_STROKE = 0x1a1a24;
const HANDLE_RADIUS = 3.5;

/** Collider overlay editing (same CSS radii as `RoomPolygonEditScene`). */
const HANDLE_R_CSS = 6;
const EDGE_HIT_CSS = 14;
const LINE_WIDTH_CSS = 2;
const MIN_COLLIDER_POINTS = 3;
const COL_COLLIDER = 0xff66cc;

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

export type CharacterPreviewGamePayload = {
  textureKey: string;
  textureURL: string;
  atlasURL: string;
  character: CharacterData;
  idleTag: string;
  revokeObjectUrls: string[];
};

function editorGameConfig(parent: HTMLElement): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
  return {
    type: Phaser.WEBGL,
    parent,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    antialias: false,
    scale: {
      parent,
      mode: Phaser.Scale.RESIZE,
    },
    render: {
      powerPreference: 'high-performance',
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
  private marker!: Phaser.GameObjects.Arc;
  private feetLocal!: CharacterFeetLocal;
  private worldW = 0;
  private worldH = 0;
  private isPanning = false;
  private panLastX = 0;
  private panLastY = 0;

  private overlay?: PreviewPolygonOverlay;
  /** Collider vertices in frame-local space (same as `feet` / character JSON). */
  private colliderLocal: Point2[] = [];
  private editMode: 'feet' | 'collider' = 'feet';
  private selectedVertexIndex: number | null = null;
  private dragVertexIndex: number | null = null;
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
    const fw = this.sprite.frame.width;
    const fh = this.sprite.frame.height;
    this.worldW = fw + WORLD_PAD * 2;
    this.worldH = fh + WORLD_PAD * 2;

    const feetWx = WORLD_PAD + this.feetLocal.x;
    const feetWy = WORLD_PAD + this.feetLocal.y;
    placeSpriteByFeet(this.sprite, this.feetLocal, feetWx, feetWy);

    this.marker = this.add
      .circle(feetWx, feetWy, HANDLE_RADIUS, HANDLE_FILL, 1)
      .setStrokeStyle(2, HANDLE_STROKE, 0.55)
      .setDepth(100);

    this.marker.setInteractive({ draggable: true });
    this.input.setDraggable(this.marker);
    this.input.on(
      'drag',
      (
        _pointer: Phaser.Input.Pointer,
        obj: Phaser.GameObjects.GameObject,
        dragX: number,
        dragY: number,
      ) => {
        if (obj !== this.marker) {
          return;
        }
        this.marker.setPosition(dragX, dragY);
        this.clampMarkerToFrame();
      },
    );

    const mount = this.game.canvas.parentElement;
    if (mount) {
      this.overlay = new PreviewPolygonOverlay(this.game, mount);
      this.overlay.setPointerEventsEnabled(false);
      this.overlay.canvas.addEventListener('pointerdown', this.onOverlayPointerDown);
      this.overlay.canvas.addEventListener('pointermove', this.onOverlayPointerMove);
      this.overlay.canvas.addEventListener('pointerup', this.onOverlayPointerUp);
      this.overlay.canvas.addEventListener('pointercancel', this.onOverlayPointerUp);
      this.overlay.canvas.addEventListener('keydown', this.onOverlayKeyDown);
      this.overlay.canvas.addEventListener('wheel', this.onOverlayWheel, { passive: false });
    }

    this.game.registry.set('benneCharacterPreviewReadFeet', () => ({ ...this.feetLocal }));
    this.game.registry.set('benneCharacterPreviewReadCollider', () => this.readColliderForSave());
    this.game.registry.set('benneCharacterPreviewSetMode', (m: 'feet' | 'collider') => {
      this.setEditMode(m);
    });

    const cam = this.cameras.main;
    cam.setBackgroundColor(0x1a1a2e);
    cam.setBounds(0, 0, this.worldW, this.worldH);
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
      .text(10, 10, 'Wheel = zoom · middle-drag = pan · F = fit · Collider mode: magenta polygon', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#c8c8d8',
      })
      .setScrollFactor(0)
      .setDepth(200);
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

  private clampLocalPoint(lx: number, ly: number): Point2 {
    const fw = this.sprite.frame.width;
    const fh = this.sprite.frame.height;
    return { x: Phaser.Math.Clamp(lx, 0, fw), y: Phaser.Math.Clamp(ly, 0, fh) };
  }

  setEditMode(mode: 'feet' | 'collider'): void {
    this.editMode = mode;
    if (mode === 'feet') {
      this.marker.setInteractive({ draggable: true });
      this.input.setDraggable(this.marker);
      this.overlay?.setPointerEventsEnabled(false);
    } else {
      this.marker.disableInteractive();
      this.overlay?.setPointerEventsEnabled(true);
      this.selectedVertexIndex = null;
      this.dragVertexIndex = null;
      this.downOnVertex = false;
      this.tapEdge = null;
    }
  }

  update(): void {
    const ov = this.overlay;
    if (!ov) {
      return;
    }
    ov.syncLayout();
    const cam = this.cameras.main;
    const worldPts = this.colliderWorldPoints();
    ov.clearAndDraw(
      {
        pts: worldPts,
        strokeStyle: hexToCss(COL_COLLIDER),
        handleFill: '#ffee44',
        handleStroke: '#1a1a24',
        selectedIndex: this.editMode === 'collider' ? this.selectedVertexIndex : null,
        handleRadiusCss: HANDLE_R_CSS,
        lineWidthCss: LINE_WIDTH_CSS,
      },
      cam,
    );
  }

  private pointerCss(e: PointerEvent): { cx: number; cy: number } {
    const rect = this.game.canvas.getBoundingClientRect();
    return { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
  }

  private readonly onOverlayWheel = (e: WheelEvent): void => {
    if (this.editMode !== 'collider') {
      return;
    }
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
    if (this.editMode !== 'collider') {
      return;
    }
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

    if (pts.length < MIN_COLLIDER_POINTS) {
      const vi = pts.length > 0 ? hitVertexCss(cx, cy, worldPts, HANDLE_R_CSS, toCss) : -1;
      if (vi >= 0) {
        this.downOnVertex = true;
        this.dragVertexIndex = vi;
        this.selectedVertexIndex = vi;
        return;
      }
      return;
    }

    const vi = hitVertexCss(cx, cy, worldPts, HANDLE_R_CSS, toCss);
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
    if (!ov || this.editMode !== 'collider') {
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

    if (this.dragVertexIndex === null) {
      return;
    }
    const cam = this.cameras.main;
    const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, cam);
    const lx = wx - this.sprite.x;
    const ly = wy - this.sprite.y;
    const c = this.clampLocalPoint(lx, ly);
    const i = this.dragVertexIndex;
    if (i >= 0 && i < this.colliderLocal.length) {
      this.colliderLocal[i] = c;
    }
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

    if (!ov || this.editMode !== 'collider') {
      this.dragVertexIndex = null;
      this.downOnVertex = false;
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

    if (this.downOnVertex || this.dragVertexIndex !== null) {
      this.dragVertexIndex = null;
      this.downOnVertex = false;
      return;
    }

    if (pts.length < MIN_COLLIDER_POINTS && !this.downOnVertex && this.dragVertexIndex === null) {
      pts.push(this.clampLocalPoint(lx, ly));
      this.tapEdge = null;
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
          const cl = this.clampLocalPoint(lx, ly);
          insertPointOnEdgeLocal(pts, edgeIdx, cl.x, cl.y);
          this.tapEdge = null;
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
    if (this.editMode !== 'collider') {
      return;
    }
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

  private clampMarkerToFrame(): void {
    const fw = this.sprite.frame.width;
    const fh = this.sprite.frame.height;
    let fx = this.marker.x - this.sprite.x;
    let fy = this.marker.y - this.sprite.y;
    fx = Phaser.Math.Clamp(fx, 0, fw);
    fy = Phaser.Math.Clamp(fy, 0, fh);
    this.feetLocal = { x: fx, y: fy };
    this.marker.setPosition(this.sprite.x + fx, this.sprite.y + fy);
    this.game.registry.set('benneCharacterPreviewReadFeet', () => ({ ...this.feetLocal }));
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

<file path="src/editor/preview/createRoomPreviewGame.ts">
import * as Phaser from 'phaser';
import { applyBootAudioSettings } from '../../engine/applyAudioFromSettings';
import { RoomScene } from '../../engine/scenes/RoomScene';
import { SCENE_ROOM } from '../../game/constants';
import type { PreviewManifest } from './buildPreviewManifest';
import type { RoomPolygonPatch } from './polygonPatchTypes';
import { BENNE_POLYGON_EDIT_SCENE, RoomPolygonEditScene } from './RoomPolygonEditScene';

export type RoomPreviewGameOptions = {
    roomJsonUri: string;
    onPolygonPatch: (patch: RoomPolygonPatch) => void;
};

/**
 * Editor-specific Phaser config.
 *
 * Uses `Scale.RESIZE` so the canvas always fills the preview panel. Camera management
 * (navigate letterbox vs edit full-panel view) is handled by `RoomScene.setEditorCameraMode`.
 * This differs from the playable game which uses `Scale.FIT` with integer zoom.
 */
function getEditorPhaserGameConfig(
    parent: HTMLElement,
): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
    return {
        type: Phaser.WEBGL,
        parent,
        backgroundColor: '#1a1a2e',
        pixelArt: true,
        antialias: false,
        scale: {
            parent,
            mode: Phaser.Scale.RESIZE,
        },
        render: {
            powerPreference: 'high-performance',
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
                } else {
                    this.load.aseprite({
                        key: L.key,
                        textureURL: L.textureURL,
                        atlasURL: L.atlasURL,
                    });
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
            },
        },
        scene: [BennePreviewLoader, RoomScene, RoomPolygonEditScene],
    });
}
</file>

<file path="src/engine/Game.ts">
import * as Phaser from 'phaser';
import { createGameConfig } from './gameConfig';

/**
 * Creates the root {@link Phaser.Game} instance (Benne engine entry).
 * Resolution and scale mode come from `src/game/game-config.json` via {@link createGameConfig}.
 */
export function createBenneGame(parent: HTMLElement | string): Phaser.Game {
  return new Phaser.Game(createGameConfig(parent));
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

<file path="src/game/assets/images/rooms/outsideOffice/outsideOffice.json">
{ "frames": {
   "outsideOffice 0.aseprite": {
    "frame": { "x": 0, "y": 0, "w": 768, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 768, "h": 198 },
    "sourceSize": { "w": 768, "h": 198 },
    "duration": 100
   },
   "outsideOffice 1.aseprite": {
    "frame": { "x": 768, "y": 0, "w": 768, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 768, "h": 198 },
    "sourceSize": { "w": 768, "h": 198 },
    "duration": 100
   },
   "outsideOffice 2.aseprite": {
    "frame": { "x": 1536, "y": 0, "w": 768, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 768, "h": 198 },
    "sourceSize": { "w": 768, "h": 198 },
    "duration": 100
   },
   "outsideOffice 3.aseprite": {
    "frame": { "x": 2304, "y": 0, "w": 768, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 768, "h": 198 },
    "sourceSize": { "w": 768, "h": 198 },
    "duration": 100
   },
   "outsideOffice 4.aseprite": {
    "frame": { "x": 0, "y": 198, "w": 768, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 768, "h": 198 },
    "sourceSize": { "w": 768, "h": 198 },
    "duration": 100
   },
   "outsideOffice 5.aseprite": {
    "frame": { "x": 768, "y": 198, "w": 768, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 768, "h": 198 },
    "sourceSize": { "w": 768, "h": 198 },
    "duration": 100
   },
   "outsideOffice 6.aseprite": {
    "frame": { "x": 1536, "y": 198, "w": 768, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 768, "h": 198 },
    "sourceSize": { "w": 768, "h": 198 },
    "duration": 100
   },
   "outsideOffice 7.aseprite": {
    "frame": { "x": 2304, "y": 198, "w": 768, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 768, "h": 198 },
    "sourceSize": { "w": 768, "h": 198 },
    "duration": 100
   },
   "outsideOffice 8.aseprite": {
    "frame": { "x": 0, "y": 396, "w": 768, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 768, "h": 198 },
    "sourceSize": { "w": 768, "h": 198 },
    "duration": 100
   },
   "outsideOffice 9.aseprite": {
    "frame": { "x": 768, "y": 396, "w": 768, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 768, "h": 198 },
    "sourceSize": { "w": 768, "h": 198 },
    "duration": 100
   },
   "outsideOffice 10.aseprite": {
    "frame": { "x": 0, "y": 396, "w": 768, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 768, "h": 198 },
    "sourceSize": { "w": 768, "h": 198 },
    "duration": 100
   },
   "outsideOffice 11.aseprite": {
    "frame": { "x": 1536, "y": 396, "w": 768, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 768, "h": 198 },
    "sourceSize": { "w": 768, "h": 198 },
    "duration": 100
   },
   "outsideOffice 12.aseprite": {
    "frame": { "x": 2304, "y": 396, "w": 768, "h": 198 },
    "rotated": false,
    "trimmed": false,
    "spriteSourceSize": { "x": 0, "y": 0, "w": 768, "h": 198 },
    "sourceSize": { "w": 768, "h": 198 },
    "duration": 100
   }
 },
 "meta": {
  "app": "https://www.aseprite.org/",
  "version": "1.3.18-beta1-x64",
  "image": "outsideOffice.png",
  "format": "RGBA8888",
  "size": { "w": 3072, "h": 594 },
  "scale": "1",
  "frameTags": [
   { "name": "OceanSky", "from": 3, "to": 3, "direction": "forward", "color": "#000000ff" },
   { "name": "Mountains", "from": 4, "to": 4, "direction": "forward", "color": "#000000ff" },
   { "name": "Nearground", "from": 5, "to": 5, "direction": "forward", "color": "#000000ff" },
   { "name": "Car", "from": 6, "to": 6, "direction": "forward", "color": "#000000ff" },
   { "name": "Bug", "from": 7, "to": 10, "direction": "forward", "color": "#000000ff" },
   { "name": "Break", "from": 11, "to": 11, "direction": "forward", "color": "#000000ff" },
   { "name": "desk", "from": 12, "to": 12, "direction": "forward", "color": "#000000ff" }
  ],
  "layers": [
   { "name": "screen width line", "opacity": 255, "blendMode": "normal" },
   { "name": "AI Dusk 2", "opacity": 255, "blendMode": "normal" },
   { "name": "AI Dusk 1", "opacity": 255, "blendMode": "normal" },
   { "name": "Night" },
   { "name": "Sky Water", "group": "Night", "opacity": 255, "blendMode": "normal" },
   { "name": "Sky Evdr", "group": "Night", "opacity": 255, "blendMode": "normal" },
   { "name": "Mtns City", "group": "Night", "opacity": 255, "blendMode": "normal" },
   { "name": "road night", "group": "Night", "opacity": 255, "blendMode": "normal" },
   { "name": "Foreground", "group": "Night", "opacity": 255, "blendMode": "normal" },
   { "name": "Day" },
   { "name": "Sky Water Day", "group": "Day", "opacity": 255, "blendMode": "normal" },
   { "name": "Sky Evdr Copy", "group": "Day", "opacity": 255, "blendMode": "normal" },
   { "name": "Mtns Day", "group": "Day", "opacity": 255, "blendMode": "normal" },
   { "name": "City Day", "group": "Day", "opacity": 255, "blendMode": "normal" },
   { "name": "road Day", "group": "Day", "opacity": 255, "blendMode": "normal" },
   { "name": "Foreground Day", "group": "Day", "opacity": 255, "blendMode": "normal" },
   { "name": "Landlord", "opacity": 255, "blendMode": "normal" },
   { "name": "Car" },
   { "name": "Car", "group": "Car", "opacity": 255, "blendMode": "normal" },
   { "name": "bug", "group": "Car", "opacity": 255, "blendMode": "normal" },
   { "name": "window break", "group": "Car", "opacity": 255, "blendMode": "normal" },
   { "name": "Layer 4", "opacity": 255, "blendMode": "normal" }
  ],
  "slices": [
  ]
 }
}
</file>

<file path="src/game/characters/bob/bob.character.json">
{
  "id": "bob",
  "name": "Bob",
  "description": "",
  "walkSpeed": 88,
  "clickable": true,
  "display": {
    "aseprite": true
  },
  "onVerb": {
    "use": true
  }
}
</file>

<file path="src/game/characters/bob/bob.character.ts">
import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';
import { characterVerbEventId } from '@engine/events/verbInteractionEvents';

/**
 * Character script for `bob` — register verb handlers on the game EventBus.
 */
export function registerCharacterScript(_events: EventBus): void {
  // Example global: _events.on(characterVerbEventId('bob', 'look'), (_payload) => { ... });

  _events.on(characterVerbEventId('bob', 'use'), (_payload: CharacterVerbInteractPayload) => {
    // TODO
  });
}
</file>

<file path="src/game/characters/clerk/clerk.character.ts">
import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';
import { characterVerbEventId, roomCharacterVerbEventId } from '@engine/events/verbInteractionEvents';

/**
 * Character script for `clerk` — register verb handlers on the game EventBus.
 */
export function registerCharacterScript(_events: EventBus): void {
  _events.on(characterVerbEventId('clerk', 'look'), (payload: CharacterVerbInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'Someone is working here.'}`);
  });

  // Room-specific override example (takes precedence over character-global when present).
  _events.on(roomCharacterVerbEventId('office', 'clerk', 'look'), (payload: CharacterVerbInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'Someone is working here.'}`);
  });
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

<file path="src/game/registerGameContent.ts">
import type { EventBus } from '../engine/events/EventBus';
import { gameEvents } from '../engine/events/EventBus';
import { registerGlobalScript } from './globalScript';

const roomScriptModules = import.meta.glob<{ registerRoomScript?: (events: EventBus) => void }>(
  './rooms/**/*.room.ts',
  { eager: true },
);

const characterScriptModules = import.meta.glob<{
  registerCharacterScript?: (events: EventBus) => void;
}>(
  './characters/**/*.character.ts',
  { eager: true },
);

/**
 * Registers globalScript, every `*.room.ts` that exports registerRoomScript, then every
 * `*.character.ts` under `characters/` that exports registerCharacterScript.
 */
export function registerGameContent(): void {
  registerGlobalScript(gameEvents);

  for (const mod of Object.values(roomScriptModules)) {
    mod.registerRoomScript?.(gameEvents);
  }

  for (const mod of Object.values(characterScriptModules)) {
    mod.registerCharacterScript?.(gameEvents);
  }
}
</file>

<file path="src/game/rooms/bathroom/bathroom.room.ts">
import type { EventBus } from '@engine/events/EventBus';

/**
 * Room script for `bathroom` — keep all handlers for this room here (PowerQuest-style).
 * Export name is fixed so `registerGameContent` can discover files via `*.room.ts` glob.
 */
export function registerRoomScript(_events: EventBus): void {
  // Example: use roomPropVerbEventId('bathroom', 'propName', 'look') for room-scoped handlers.
}
</file>

<file path="src/main.ts">
import './style.css';
import { createBenneGame } from './engine/Game';
import { registerGameContent } from './game/registerGameContent';

const parent = document.querySelector<HTMLElement>('#game-container');
if (!parent) {
  throw new Error('Missing #game-container');
}

registerGameContent();
createBenneGame(parent);
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

<file path="src/engine/ConfigManager.ts">
import type { GameSettings } from '../types/game';
import rawSettings from '../game/game-config.json';

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
    for (const key of ['showWalkable', 'showPropOutlines'] as const) {
      const v = d[key];
      if (v !== undefined && typeof v !== 'boolean') {
        throw new Error(`game-config debug.${key} must be a boolean when present`);
      }
    }
  }
  assertVerbSettings(data);
}

const settings = rawSettings as GameSettings;
assertGameSettings(settings);

/**
 * Synchronous access to `src/game/game-config.json` (bundled by Vite at build time).
 */
export function getGameSettings(): GameSettings {
  return settings;
}
</file>

<file path="src/engine/gameConfig.ts">
import * as Phaser from 'phaser';
import { getGameSettings } from './ConfigManager';
import { BootScene } from './scenes/BootScene';
import { RoomScene } from './scenes/RoomScene';

/** Shared Phaser settings (resolution, scale, render) — scenes are added per entrypoint. */
export function getBennePhaserGameConfigBase(
  parent: HTMLElement | string,
): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
  const { width, height } = getGameSettings().resolution;

  return {
    type: Phaser.WEBGL,
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
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width,
      height,
      zoom: Phaser.Scale.MAX_ZOOM,
      autoRound: true,
    },
    render: {
      powerPreference: 'high-performance',
    },
  };
}

export function createGameConfig(parent: HTMLElement | string): Phaser.Types.Core.GameConfig {
  return {
    ...getBennePhaserGameConfigBase(parent),
    scene: [BootScene, RoomScene],
  };
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

<file path="src/game/characters/henry/henry.character.ts">
import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';
import { characterVerbEventId } from '@engine/events/verbInteractionEvents';

/**
 * Character script for `henry` — register verb handlers on the game EventBus.
 */
export function registerCharacterScript(_events: EventBus): void {
  // Example global: _events.on(characterVerbEventId('henry', 'look'), (_payload) => { ... });

  _events.on(characterVerbEventId('henry', 'look'), (_payload: CharacterVerbInteractPayload) => {
    console.log("It looks like Henry!");
  });
}
</file>

<file path="src/game/characters/penny/penny.character.ts">
import type { EventBus } from '@engine/events/EventBus';

/**
 * Character script for `penny` — register verb handlers on the game EventBus.
 */
export function registerCharacterScript(_events: EventBus): void {
  // Example global: _events.on(characterVerbEventId('penny', 'look'), (payload: CharacterVerbInteractPayload) => { ... });
}
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

export type AsepriteAssetSheetKind = 'character' | 'room' | 'inventory';

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
 * Frame-tag names for a bundled character, room, or inventory Aseprite sheet (`images/<kind folder>/<id>/<id>.json`).
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
</file>

<file path="src/game/rooms/outside/outside.room.ts">
import type { EventBus } from '@engine/events/EventBus';

/**
 * Room script for `outside` — keep all handlers for this room here (PowerQuest-style).
 * Export name is fixed so `registerGameContent` can discover files via `*.room.ts` glob.
 */
export function registerRoomScript(_events: EventBus): void {
  // Example: use roomPropVerbEventId('outside', 'outside-desk', 'look') for room-scoped handlers.
}
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

<file path="src/editor/preview/previewPolygonOverlay.ts">
import type { Cameras, Game } from 'phaser';
import type { Point2 } from '../../types/room';

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
}
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
  | { type: 'character'; characterId: string; instanceId: string; roomId: string; description?: string };

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
  verbFallback?: boolean;
};

export type VerbUnhandledPayload = {
  verbId: string;
  target: VerbInteractTarget;
  fallbackLine: string;
};
</file>

<file path="src/game/globalScript.ts">
import type { EventBus } from '@engine/events/EventBus';
import { VERB_GLOBAL_FALLBACK_EVENT, VERB_UNHANDLED_EVENT } from '@engine/events/verbInteractionEvents';
import type { VerbGlobalFallbackPayload, VerbUnhandledPayload } from '@engine/events/verbInteractionEvents';

/**
 * Handlers for events that are not tied to a single room (inventory, UI, global flags, verbs, etc.).
 *
 * Verb fallback chain (engine): object scoped handler (room/character channels) → object fallback →
 * `verb:global:<id>` → `verb:global:fallback` → `verb:unhandled`.
 */
export function registerGlobalScript(events: EventBus): void {
  // Example per-verb defaults (opt-in): events.on(globalVerbHandlerEventId('use'), (payload) => { ... });

  events.on(VERB_GLOBAL_FALLBACK_EVENT, (payload: VerbGlobalFallbackPayload) => {
    if (payload.verbId === 'use') {
      console.log("I can't use that.");
    } else if (payload.verbId === 'look') {
      console.log('It looks like nothing.');
    }
    // Last script-level fallback before the engine emits `verb:unhandled`.
  });

  events.on(VERB_UNHANDLED_EVENT, (p: VerbUnhandledPayload) => {
    // No dialogue UI yet: surface the configured line in dev; hook UI here later.
    if (import.meta.env.DEV) {
      console.info(`[Benne] verb:unhandled → "${p.fallbackLine}"`, p.target);
    }
  });
}
</file>

<file path="src/game/rooms/outside/outside.room.json">
{
  "id": "outside",
  "name": "Outside",
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
    "polygons": []
  },
  "hotspots": [
    {
      "id": "outside-hotspot-1",
      "active": true,
      "description": "",
      "zIndex": 0,
      "points": [
        {
          "x": 152,
          "y": 75
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
      ],
      "walkToPoint": {
        "x": 176,
        "y": 135
      },
      "lookAtPoint": {
        "x": 176,
        "y": 99
      }
    }
  ],
  "props": [
    {
      "id": "outside-prop-car",
      "tag": "Car",
      "zIndex": 5,
      "visible": true,
      "alpha": 1
    },
    {
      "id": "outside-prop-bush",
      "tag": "Bush",
      "zIndex": 1,
      "visible": true,
      "alpha": 1,
      "clickable": true,
      "collider": {
        "points": [
          {
            "x": 107,
            "y": 86
          },
          {
            "x": 93,
            "y": 113
          },
          {
            "x": 124,
            "y": 127
          }
        ]
      },
      "walkToPoint": {
        "x": 0,
        "y": 0
      },
      "lookAtPoint": {
        "x": 12,
        "y": 0
      }
    },
    {
      "id": "outside-prop-background",
      "tag": "Background",
      "zIndex": 0,
      "visible": true,
      "alpha": 1
    },
    {
      "id": "outside-prop-gate",
      "tag": "Gate",
      "zIndex": 3,
      "visible": true,
      "alpha": 1
    }
  ],
  "points": [
    {
      "id": "outside-point-1",
      "x": 176,
      "y": 99
    }
  ],
  "regions": [
    {
      "id": "outside-region-1",
      "active": true,
      "points": [
        {
          "x": 152,
          "y": 75
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
    },
    {
      "id": "outside-region-2",
      "active": true,
      "points": [
        {
          "x": 152,
          "y": 75
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
};
</file>

<file path="src/engine/scenes/BootScene.ts">
import * as Phaser from 'phaser';
import { applyBootAudioSettings } from '../applyAudioFromSettings';
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

<file path="src/game/characters/clerk/clerk.character.json">
{
  "id": "clerk",
  "name": "Clerk",
  "description": "A tired office clerk shuffling papers.",
  "walkSpeed": 88,
  "clickable": false,
  "display": {
    "aseprite": true
  },
  "animations": {
    "WalkL": {
      "loop": true,
      "frameDuration": 83
    },
    "WalkD": {
      "loop": true,
      "frameDuration": 83
    },
    "WalkU": {
      "loop": true,
      "frameDuration": 83
    },
    "IdleD": {
      "loop": true
    },
    "IdleU": {
      "loop": true
    },
    "IdleL": {
      "loop": true
    },
    "IdleR": {
      "loop": true
    }
  },
  "onVerb": {
    "look": true
  },
  "feet": {
    "x": 18,
    "y": 62
  }
}
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
    }
  },
  "feet": {
    "x": 79,
    "y": 120
  },
  "onVerb": {
    "look": true
  },
  "collider": {
    "points": [
      {
        "x": 48,
        "y": 60
      },
      {
        "x": 58,
        "y": 43
      },
      {
        "x": 77,
        "y": 36
      },
      {
        "x": 91,
        "y": 38
      },
      {
        "x": 100,
        "y": 44
      },
      {
        "x": 114,
        "y": 57
      },
      {
        "x": 111,
        "y": 74
      },
      {
        "x": 104,
        "y": 112
      },
      {
        "x": 95,
        "y": 123
      },
      {
        "x": 62,
        "y": 122
      },
      {
        "x": 50,
        "y": 108
      }
    ]
  }
}
</file>

<file path="src/game/rooms/rooms.manifest.json">
{
  "startRoomId": "office",
  "rooms": [
    {
      "id": "bathroom",
      "definition": "bathroom/bathroom.room.json"
    },
    {
      "id": "kitchen",
      "definition": "kitchen/kitchen.room.json"
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

<file path="src/types/game.ts">
export interface RoomManifestEntry {
  id: string;
  definition: string;
}

export interface RoomsManifestData {
  startRoomId: string;
  rooms: RoomManifestEntry[];
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
}
</file>

<file path="src/game/rooms/office/office.room.ts">
import type { EventBus } from '@engine/events/EventBus';
import type { RoomPropInteractPayload, RoomHotspotInteractPayload } from '@engine/events/propInteractionEvents';
import { roomHotspotVerbEventId, roomPropVerbEventId } from '@engine/events/verbInteractionEvents';
/**
 * Room script for `office` — keep all handlers for this room here (PowerQuest-style).
 * Export name is fixed so `registerGameContent` can discover files via `*.room.ts` glob.
 */
export function registerRoomScript(_events: EventBus): void {
  _events.on(roomPropVerbEventId('office', 'desk', 'look'), (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the desk.'}`);
  });

  _events.on(roomPropVerbEventId('office', 'desk', 'use'), () => {
    console.log(`[Office] The desk prop is unusable.`);
  });

  _events.on(roomPropVerbEventId('office', 'office-prop-door', 'look'), (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the door.'}`);
  });

  _events.on(roomPropVerbEventId('office', 'office-prop-jacket', 'look'), (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the jacket.'}`);
  });

  _events.on(roomPropVerbEventId('office', 'office-prop-glasses', 'look'), (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the glasses.'}`);
  });

  _events.on(roomPropVerbEventId('office', 'office-prop-cyberbuddy', 'look'), (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the desk toy.'}`);
  });

  _events.on(roomPropVerbEventId('office', 'office-prop-jacket', 'use'), (_payload: RoomPropInteractPayload) => {
    // TODO
  });

  _events.on(roomHotspotVerbEventId('office', 'office-hotspot-1', 'look'), (_payload: RoomHotspotInteractPayload) => {
    console.log(`[Office] Looks like a window`);
  });

  _events.on(roomHotspotVerbEventId('office', 'desk', 'use'), (payload: RoomHotspotInteractPayload) => {
    console.log(`[Office] The desk hotspot is unusable.`);
  });
}
</file>

<file path="src/game/rooms/outsideOffice/outsideOffice.room.ts">
import type { EventBus } from '@engine/events/EventBus';
import type { RoomPropInteractPayload, CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';
import { roomPropVerbEventId, roomCharacterVerbEventId } from '@engine/events/verbInteractionEvents';
/**
 * Room script for `outsideOffice` — keep all handlers for this room here (PowerQuest-style).
 * Export name is fixed so `registerGameContent` can discover files via `*.room.ts` glob.
 */
export function registerRoomScript(_events: EventBus): void {
  // Example: _events.on(roomPropVerbEventId('outsideOffice', 'propName', 'look'), () => { ... });

  _events.on(roomPropVerbEventId('outsideOffice', 'outsideOffice-prop-car', 'look'), (payload: RoomPropInteractPayload) => {
    console.log(`[Outside Office] ${payload.description ?? 'You look at the car.'}`);
  });

  _events.on(roomPropVerbEventId('outsideOffice', 'desk', 'use'), (payload: RoomPropInteractPayload) => {
    console.log(`[Outside Office] The desk is unusable.`);
  });

  _events.on(roomCharacterVerbEventId('outsideOffice', 'henry', 'look'), (payload: CharacterVerbInteractPayload) => {
    console.log(`[Outside Office] It looks like Henry outside the office!`);
  });
}
</file>

<file path="src/game/rooms/outsideOffice/outsideOffice.room.json">
{
  "id": "outsideOffice",
  "name": "Outside Office",
  "size": {
    "width": 769,
    "height": 198
  },
  "scrollBounds": {
    "x": 2,
    "y": 0,
    "width": 765,
    "height": 198
  },
  "walkable": {
    "polygons": [
      {
        "id": "outsideOffice-floor",
        "active": true,
        "points": [
          {
            "x": 21,
            "y": 183
          },
          {
            "x": 758,
            "y": 185
          },
          {
            "x": 761,
            "y": 157
          },
          {
            "x": 696,
            "y": 142
          },
          {
            "x": 562,
            "y": 144
          },
          {
            "x": 461,
            "y": 130
          },
          {
            "x": 422,
            "y": 119
          },
          {
            "x": 330,
            "y": 146
          },
          {
            "x": 234,
            "y": 126
          },
          {
            "x": 229,
            "y": 87
          },
          {
            "x": 124,
            "y": 111
          },
          {
            "x": 47,
            "y": 149
          },
          {
            "x": 20,
            "y": 166
          }
        ],
        "holes": []
      }
    ]
  },
  "hotspots": [
    {
      "id": "outsideOffice-hotspot-sky",
      "active": true,
      "description": "",
      "zIndex": 0,
      "points": [
        {
          "x": 143,
          "y": 10
        },
        {
          "x": 277,
          "y": 13
        },
        {
          "x": 311,
          "y": 62
        },
        {
          "x": 135,
          "y": 57
        }
      ],
      "walkToPoint": {
        "x": 222,
        "y": 95
      },
      "lookAtPoint": {
        "x": 216,
        "y": 53
      }
    }
  ],
  "props": [
    {
      "id": "outsideOffice-prop-oceansky",
      "tag": "OceanSky",
      "zIndex": 0,
      "visible": true,
      "alpha": 1,
      "parallaxDepth": 0.5
    },
    {
      "id": "outsideOffice-prop-mountains",
      "tag": "Mountains",
      "zIndex": 1,
      "visible": true,
      "alpha": 1,
      "parallaxDepth": 0.8
    },
    {
      "id": "outsideOffice-prop-nearground",
      "tag": "Nearground",
      "zIndex": 2,
      "visible": true,
      "alpha": 1
    },
    {
      "id": "outsideOffice-prop-car",
      "tag": "Car",
      "zIndex": 3,
      "visible": true,
      "alpha": 1,
      "clickable": true,
      "collider": {
        "points": [
          {
            "x": 262,
            "y": 116
          },
          {
            "x": 310,
            "y": 94
          },
          {
            "x": 333,
            "y": 74
          },
          {
            "x": 375,
            "y": 78
          },
          {
            "x": 424,
            "y": 97
          },
          {
            "x": 414,
            "y": 121
          },
          {
            "x": 395,
            "y": 124
          },
          {
            "x": 375,
            "y": 129
          },
          {
            "x": 361,
            "y": 142
          },
          {
            "x": 276,
            "y": 128
          }
        ]
      },
      "walkToPoint": {
        "x": 0,
        "y": 0
      },
      "lookAtPoint": {
        "x": 12,
        "y": 0
      }
    },
    {
      "id": "outsideOffice-prop-bug",
      "tag": "Bug",
      "zIndex": 4,
      "visible": true,
      "alpha": 1,
      "clickable": true
    },
    {
      "id": "outsideOffice-prop-break",
      "tag": "Break",
      "zIndex": 5,
      "visible": true,
      "alpha": 1,
      "clickable": true
    },
    {
      "id": "desk",
      "tag": "desk",
      "zIndex": 7,
      "visible": true,
      "alpha": 1,
      "clickable": true,
      "onVerb": {
        "use": true
      },
      "collider": {
        "points": [
          {
            "x": 168,
            "y": 90
          },
          {
            "x": 216,
            "y": 83
          },
          {
            "x": 225,
            "y": 107
          },
          {
            "x": 168,
            "y": 119
          }
        ]
      },
      "walkToPoint": {
        "x": 201,
        "y": 121
      },
      "lookAtPoint": {
        "x": 195,
        "y": 103
      }
    }
  ],
  "characters": [
    {
      "instanceId": "clerk-1",
      "definition": "clerk/clerk.character.json",
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
      "x": 400,
      "y": 148,
      "initialFacing": "L",
      "initialAnimation": "Idle",
      "visible": true,
      "zIndex": 101
    }
  ]
}
</file>

<file path="src/editor/preview/roomEditorMain.ts">
import type { Game } from 'phaser';
import type { RoomData } from '../../types/room';
import { buildPreviewManifest } from './buildPreviewManifest';
import { createRoomPreviewPhaserGame } from './createRoomPreviewGame';
import { polygonEditBridge } from './polygonEditBridge';
import type { RoomPolygonPatch } from './polygonPatchTypes';

declare function acquireVsCodeApi(): { postMessage(data: unknown): void };

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
        });
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
vscodeApi?.postMessage({ type: 'benne/preview/ready' });
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

<file path="src/game/game-config.json">
{
  "resolution": {
    "width": 352,
    "height": 198
  },
  "verbs": [
    { "id": "look", "label": "Look at" },
    { "id": "use", "label": "Use" }
  ],
  "inputProfile": {
    "kind": "twoVerb",
    "primaryButtonVerb": "use",
    "secondaryButtonVerb": "look"
  },
  "defaultFallbackLine": "You can't do that.",
  "startingPlayerCharacter": "clerk",
  "startingRoomId": "office",
  "audio": {
    "masterVolume": 1,
    "sfxVolume": 1,
    "musicVolume": 0.75,
    "dialogueVolume": 1
  },
  "debug": {
    "showWalkable": false,
    "showPropOutlines": false
  }
}
</file>

<file path="src/types/character.ts">
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
import { applyCharacterAnimationClips, setupCharacterAsepritePlayback } from '../characterAnimationPlayback';
import { getGameSettings } from '../ConfigManager';
import { attachPostProcessingPlaceholder } from '../postfx/PostEffects';
import {
  cameraFollowOffsetForFeet,
  getCharacterWorldFeet,
  placeSpriteByFeet,
  resolveCharacterFeetLocal,
} from '../characterFeet';
import { clampWalkDestinationTowardClick } from '../walkable';
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
import type { RoomData, RoomHotspotData } from '../../types/room';
import type { RoomCharacterSpawn, RoomPropSpawn, RoomSceneStartData } from './BootScene';

/** Ignore walk clicks when already within this many pixels of the target. */
const MIN_WALK_DISTANCE_PX = 6;

/** Props use `zIndex`; characters render above this baseline. */
const CHARACTER_SCENE_DEPTH = 10_000;

/** Walkable / prop debug strokes render above characters. */
const DEBUG_OVERLAY_DEPTH = 20_000;

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

  private playerMoveTween: Phaser.Tweens.Tween | null = null;

  /** Fired once when a walk tween completes successfully (instant walks may call it without a tween). */
  private walkArriveCallback: (() => void) | null = null;

  /** Props that need per-frame position updates for parallax scrolling. */
  private parallaxProps: Array<{
    sprite: Phaser.GameObjects.Sprite;
    baseX: number;
    baseY: number;
    parallaxDepth: number;
  }> = [];

  constructor() {
    super(SCENE_ROOM);
  }

  create(data: RoomSceneStartData): void {
    this.roomData = data.room;
    this.player = null;
    this.playerMoveTween = null;
    this.parallaxProps = [];

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

    this.input.mouse?.disableContextMenu();

    this.scale.on('resize', this.onScaleResize, this);
    this.input.on('pointerdown', this.handleRoomPointerDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onScaleResize, this);
      this.input.off('pointerdown', this.handleRoomPointerDown);
      this.stopPlayerMoveTween(true);
    });
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
  }

  private readonly handleRoomPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!pointer.leftButtonDown()) {
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

    const feet = getCharacterWorldFeet(this.player);
    const dest = clampWalkDestinationTowardClick(
      feet.x,
      feet.y,
      worldX,
      worldY,
      this.roomData.walkable.polygons,
    );
    if (!dest) {
      return;
    }

    this.movePlayerToward(dest.x, dest.y);
  };

  /**
   * Stops the current walk tween if any. When `emitStop` is true, emits {@link PLAYER_WALK_STOP}
   * with reason `interrupted` (used when tearing down the scene).
   */
  private stopPlayerMoveTween(emitStop: boolean): void {
    this.walkArriveCallback = null;
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

  private movePlayerToward(destX: number, destY: number, onArrive?: () => void): void {
    const sprite = this.player;
    if (!sprite) {
      return;
    }

    const walkSpeed = sprite.getData('walkSpeed') as number | undefined;
    const speed = typeof walkSpeed === 'number' && walkSpeed > 0 ? walkSpeed : 88;

    let lx = sprite.getData('feetLocalX') as number | undefined;
    let ly = sprite.getData('feetLocalY') as number | undefined;
    if (typeof lx !== 'number' || typeof ly !== 'number') {
      const data = sprite.getData('character') as CharacterData | undefined;
      const resolved = data
        ? resolveCharacterFeetLocal(data, sprite)
        : { x: sprite.frame.width * 0.5, y: sprite.frame.height };
      lx = resolved.x;
      ly = resolved.y;
      sprite.setData('feetLocalX', lx);
      sprite.setData('feetLocalY', ly);
    }

    const feetNow = getCharacterWorldFeet(sprite);
    const dx = destX - feetNow.x;
    const dy = destY - feetNow.y;
    const distance = Math.hypot(dx, dy);
    if (distance < MIN_WALK_DISTANCE_PX) {
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

    const facing = facingFromWorldDelta(dx, dy);
    playDirectionalAnimation(sprite, 'Walk', facing);

    const durationMs = Math.max(1, Math.round((distance / speed) * 1000));

    gameEvents.emit(PLAYER_WALK_START, {
      roomId: this.roomData.id,
      targetX: destX,
      targetY: destY,
    } satisfies PlayerWalkStartPayload);

    const moveTween = this.tweens.add({
      targets: sprite,
      x: destX - lx,
      y: destY - ly,
      duration: durationMs,
      ease: 'Linear',
      onComplete: () => {
        this.onPlayerWalkTweenComplete(moveTween, facing);
      },
      onStop: () => {
        this.onPlayerWalkTweenStopped(moveTween);
      },
    });

    this.playerMoveTween = moveTween;
  }

  private onPlayerWalkTweenComplete(tween: Phaser.Tweens.Tween, facing: CharacterFacing): void {
    if (this.playerMoveTween !== tween) {
      return;
    }
    this.playerMoveTween = null;
    if (this.player) {
      playDirectionalAnimation(this.player, 'Idle', facing);
    }
    gameEvents.emit(PLAYER_WALK_STOP, {
      roomId: this.roomData.id,
      reason: 'complete',
    } satisfies PlayerWalkStopPayload);
    const arrive = this.walkArriveCallback;
    this.walkArriveCallback = null;
    arrive?.();
  }

  private onPlayerWalkTweenStopped(tween: Phaser.Tweens.Tween): void {
    if (this.playerMoveTween !== tween) {
      return;
    }
    this.playerMoveTween = null;
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
      useHandCursor: true,
    });

    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
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

  private emitPropVerbInteraction(roomId: string, spawn: RoomPropSpawn, verbId: string): void {
    console.log(`[Benne] verb "${verbId}" prop ${spawn.id}`);
    dispatchVerbInteraction(gameEvents, verbId, getPropVerbHandlers(spawn.data), {
      type: 'prop',
      propId: spawn.id,
      tag: spawn.tag,
      roomId,
      description: spawn.data.description,
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
    const flat: number[] = [];
    for (const p of pts) {
      flat.push(p.x, p.y);
    }
    const geom = new Phaser.Geom.Polygon(flat);
    zone.setInteractive(geom, Phaser.Geom.Polygon.Contains);
    zone.input!.cursor = 'pointer';
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
        useHandCursor: true,
      });
    } else {
      sprite.setInteractive({ useHandCursor: true });
    }
    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const profile = getEffectiveTwoVerbProfile(getGameSettings());
      const verbId = resolveVerbIdFromPointer(pointer, profile);
      if (!verbId) {
        return;
      }
      console.log(`[Benne] verb "${verbId}" character ${spawn.data.id}`);
      dispatchVerbInteraction(gameEvents, verbId, handlers, {
        type: 'character',
        characterId: spawn.data.id,
        instanceId: spawn.instanceId,
        roomId,
        description: spawn.data.description,
      });
    });
  }
}
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
      "id": "office-hotspot-1",
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
      "visible": true,
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
        "use": true
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
        "look": true
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
      "zIndex": 22,
      "clickable": true,
      "visible": false,
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
        "look": true
      }
    },
    {
      "id": "office-prop-cyberbuddy",
      "tag": "CyberBuddy",
      "zIndex": 24,
      "clickable": true,
      "visible": false,
      "alpha": 1,
      "walkToPoint": {
        "x": 155,
        "y": 172
      },
      "lookAtPoint": {
        "x": 192,
        "y": 102
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
        "look": true
      }
    },
    {
      "id": "office-prop-plant",
      "tag": "Plant",
      "zIndex": 25,
      "visible": true,
      "alpha": 1
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
      "instanceId": "clerk-1",
      "definition": "clerk/clerk.character.json",
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
      "initialFacing": "L",
      "initialAnimation": "Idle",
      "visible": true,
      "zIndex": 101
    }
  ],
  "points": [
    {
      "id": "office-point-1",
      "x": 143,
      "y": 115
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

</files>
