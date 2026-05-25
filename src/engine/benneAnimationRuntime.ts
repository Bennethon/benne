import * as Phaser from 'phaser';
import { getStartingPlayerCharacterId } from '../game/boot/constants.js';
import type { CharacterFollowOptions } from '../types/characterFollow.js';
import type { Point2 } from '../types/room.js';
import type { CharacterFacingLetter } from '../types/character.js';
import { playCharacterAnimation } from './characterAnimationPlayback.js';
import type { GameStateManager } from './gameState/GameStateManager.js';
import {
  playDirectionalAnimation,
  resolveInitialIdleFacing,
  type CharacterFacing,
} from './directionalCharacterAnimation.js';

export function roomPropAnimationVariableKey(roomId: string, propId: string): string {
  return `room:${roomId}:prop:${propId}:animation`;
}

export function roomPropVisibleVariableKey(roomId: string, propId: string): string {
  return `room:${roomId}:prop:${propId}:visible`;
}

export function roomPropAlphaVariableKey(roomId: string, propId: string): string {
  return `room:${roomId}:prop:${propId}:alpha`;
}

export function characterAnimationVariableKey(characterId: string): string {
  return `character:${characterId}:animation`;
}

export function characterAlphaVariableKey(characterId: string): string {
  return `character:${characterId}:alpha`;
}

export function characterVisibleVariableKey(characterId: string): string {
  return `character:${characterId}:visible`;
}

export function characterMovableVariableKey(characterId: string): string {
  return `character:${characterId}:movable`;
}

/** Saved per-room character feet world position (lazily written via flush hooks; see {@link writeSavedCharacterPosition}). */
export function characterPositionVariableKey(roomId: string, characterId: string): string {
  return `room:${roomId}:character:${characterId}:position`;
}

/** Saved per-room prop top-left world position (lazily written via flush hooks; see {@link writeSavedPropPosition}). */
export function roomPropPositionVariableKey(roomId: string, propId: string): string {
  return `room:${roomId}:prop:${propId}:position`;
}

/** Persistence key for `B.region(id).active` overrides. */
export function roomRegionActiveVariableKey(roomId: string, regionId: string): string {
  return `room:${roomId}:region:${regionId}:active`;
}

/**
 * Effective `B.region(id).active` — saved override (boolean) when set, else `jsonDefault`
 * (`true` when the JSON field is omitted or anything other than `false`).
 */
export function readSavedRegionActive(
  manager: GameStateManager,
  roomId: string,
  regionId: string,
  jsonDefault: boolean,
): boolean {
  const v = manager.getVariable(roomRegionActiveVariableKey(roomId, regionId));
  return typeof v === 'boolean' ? v : jsonDefault;
}

/** Persist `B.region(id).active = …` for this room+region pair. */
export function writeSavedRegionActive(
  manager: GameStateManager,
  roomId: string,
  regionId: string,
  active: boolean,
): void {
  manager.setVariable(roomRegionActiveVariableKey(roomId, regionId), active);
}

/** Persistence key for `B.hotspot(id).active` overrides. */
export function roomHotspotActiveVariableKey(roomId: string, hotspotId: string): string {
  return `room:${roomId}:hotspot:${hotspotId}:active`;
}

/**
 * Effective `B.hotspot(id).active` — saved override (boolean) when set, else `jsonDefault`
 * (`true` when the JSON field is omitted or anything other than `false`).
 */
export function readSavedHotspotActive(
  manager: GameStateManager,
  roomId: string,
  hotspotId: string,
  jsonDefault: boolean,
): boolean {
  const v = manager.getVariable(roomHotspotActiveVariableKey(roomId, hotspotId));
  return typeof v === 'boolean' ? v : jsonDefault;
}

/** Persist `B.hotspot(id).active = …` for this room+hotspot pair. */
export function writeSavedHotspotActive(
  manager: GameStateManager,
  roomId: string,
  hotspotId: string,
  active: boolean,
): void {
  manager.setVariable(roomHotspotActiveVariableKey(roomId, hotspotId), active);
}

/** Sprite data: persisted override tag (`string`) or `null` when cleared. */
export const BENNE_CHARACTER_ANIMATION_OVERRIDE_KEY = 'benneAnimationOverride';

export function getCharacterAnimationOverrideTag(sprite: Phaser.GameObjects.Sprite): string | null {
  const v = sprite.getData(BENNE_CHARACTER_ANIMATION_OVERRIDE_KEY);
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function setCharacterAnimationOverrideTagOnSprite(
  sprite: Phaser.GameObjects.Sprite,
  tag: string | null,
): void {
  sprite.setData(BENNE_CHARACTER_ANIMATION_OVERRIDE_KEY, tag == null || tag === '' ? null : tag);
}

export function readSavedCharacterAnimationOverride(
  manager: GameStateManager,
  characterId: string,
): string | null {
  const v = manager.getVariable(characterAnimationVariableKey(characterId));
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function writeSavedCharacterAnimationOverride(
  manager: GameStateManager,
  characterId: string,
  tag: string | null,
): void {
  const key = characterAnimationVariableKey(characterId);
  if (tag == null || tag === '') {
    manager.clearVariable(key);
  } else {
    manager.setVariable(key, tag);
  }
}

export function readSavedPropBaseAnimationTag(
  manager: GameStateManager,
  roomId: string,
  propId: string,
  jsonTag: string,
): string {
  const v = manager.getVariable(roomPropAnimationVariableKey(roomId, propId));
  return typeof v === 'string' && v.length > 0 ? v : jsonTag;
}

export function writeSavedPropBaseAnimationTag(
  manager: GameStateManager,
  roomId: string,
  propId: string,
  tag: string,
): void {
  manager.setVariable(roomPropAnimationVariableKey(roomId, propId), tag);
}

/** Effective `B.prop(id).visible` — saved override (boolean) when set, else `jsonDefault`. */
export function readSavedPropVisible(
  manager: GameStateManager,
  roomId: string,
  propId: string,
  jsonDefault: boolean,
): boolean {
  const v = manager.getVariable(roomPropVisibleVariableKey(roomId, propId));
  return typeof v === 'boolean' ? v : jsonDefault;
}

/** Persist `B.prop(id).visible` for this room+prop pair (booleans only). */
export function writeSavedPropVisible(
  manager: GameStateManager,
  roomId: string,
  propId: string,
  visible: boolean,
): void {
  manager.setVariable(roomPropVisibleVariableKey(roomId, propId), visible);
}

/** Effective `B.prop(id)` alpha — saved override when set in `[0, 1]`, else `jsonDefault`. */
export function readSavedPropAlpha(
  manager: GameStateManager,
  roomId: string,
  propId: string,
  jsonDefault: number,
): number {
  const v = manager.getVariable(roomPropAlphaVariableKey(roomId, propId));
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.min(1, Math.max(0, v));
  }
  return jsonDefault;
}

/** Persist the **final** alpha (`toAlpha`) after a `B.prop(id).fade(...)` call (clamped to `[0, 1]`). */
export function writeSavedPropAlpha(
  manager: GameStateManager,
  roomId: string,
  propId: string,
  alpha: number,
): void {
  const clamped = Math.min(1, Math.max(0, alpha));
  manager.setVariable(roomPropAlphaVariableKey(roomId, propId), clamped);
}

/** Effective `B.character(id)` alpha — saved override when set in `[0, 1]`, else `jsonDefault` (typically `1`). */
export function readSavedCharacterAlpha(
  manager: GameStateManager,
  characterId: string,
  jsonDefault: number = 1,
): number {
  const v = manager.getVariable(characterAlphaVariableKey(characterId));
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.min(1, Math.max(0, v));
  }
  return jsonDefault;
}

/** Persist the **final** alpha (`toAlpha`) after a `B.character(id).fade(...)` call (clamped to `[0, 1]`). */
export function writeSavedCharacterAlpha(
  manager: GameStateManager,
  characterId: string,
  alpha: number,
): void {
  const clamped = Math.min(1, Math.max(0, alpha));
  manager.setVariable(characterAlphaVariableKey(characterId), clamped);
}

/** Effective `B.character(id).visible` — saved override (boolean) when set, else `jsonDefault`. */
export function readSavedCharacterVisible(
  manager: GameStateManager,
  characterId: string,
  jsonDefault: boolean,
): boolean {
  const v = manager.getVariable(characterVisibleVariableKey(characterId));
  return typeof v === 'boolean' ? v : jsonDefault;
}

/** Persist `B.character(id).hide` / `show` / `visible = …` / `visibleNow(…)` for this character id. */
export function writeSavedCharacterVisible(
  manager: GameStateManager,
  characterId: string,
  visible: boolean,
): void {
  manager.setVariable(characterVisibleVariableKey(characterId), visible);
}

/**
 * Effective `B.character(id).movable` / `B.player.movable` — saved override (boolean) when set,
 * else `jsonDefault` (`true` when the JSON field is omitted or anything other than `false`).
 */
export function readSavedCharacterMovable(
  manager: GameStateManager,
  characterId: string,
  jsonDefault: boolean,
): boolean {
  const v = manager.getVariable(characterMovableVariableKey(characterId));
  return typeof v === 'boolean' ? v : jsonDefault;
}

/** Persist script `movable = …` for this character definition id. */
export function writeSavedCharacterMovable(
  manager: GameStateManager,
  characterId: string,
  movable: boolean,
): void {
  manager.setVariable(characterMovableVariableKey(characterId), movable);
}

function readSavedXY(manager: GameStateManager, key: string): { x: number; y: number } | null {
  const v = manager.getVariable(key);
  if (
    v != null &&
    typeof v === 'object' &&
    typeof (v as { x?: unknown }).x === 'number' &&
    typeof (v as { y?: unknown }).y === 'number' &&
    Number.isFinite((v as { x: number }).x) &&
    Number.isFinite((v as { y: number }).y)
  ) {
    return { x: (v as { x: number }).x, y: (v as { y: number }).y };
  }
  return null;
}

/**
 * Per-room saved feet world position for a character definition id, or `null` when no
 * position has been flushed for this `(roomId, characterId)` pair.
 *
 * Spawn paths use this to override the room JSON `(x, y)` so an NPC moved during gameplay
 * stays where the player last left them (until the next flush updates it).
 */
export function readSavedCharacterPosition(
  manager: GameStateManager,
  roomId: string,
  characterId: string,
): { x: number; y: number } | null {
  return readSavedXY(manager, characterPositionVariableKey(roomId, characterId));
}

/**
 * Persist a character's feet world position for `(roomId, characterId)`. Called from
 * {@link import('./scenes/RoomScene.js').RoomScene.flushRuntimeStateToGameState} only —
 * not from per-tick walk callbacks.
 */
export function writeSavedCharacterPosition(
  manager: GameStateManager,
  roomId: string,
  characterId: string,
  position: { x: number; y: number },
): void {
  manager.setVariable(characterPositionVariableKey(roomId, characterId), {
    x: position.x,
    y: position.y,
  });
}

/**
 * Per-room saved sprite top-left world position for a room prop id, or `null` when no
 * position has been flushed for this `(roomId, propId)` pair. For parallax props this is
 * the **authored** origin (i.e. the value written into `benneRoomPropAuthoredX/Y`), not
 * the parallax-displaced live `sprite.x / y`.
 */
export function readSavedPropPosition(
  manager: GameStateManager,
  roomId: string,
  propId: string,
): { x: number; y: number } | null {
  return readSavedXY(manager, roomPropPositionVariableKey(roomId, propId));
}

/**
 * Persist a prop's top-left (or authored, for parallax) world position for `(roomId, propId)`.
 * Called from {@link import('./scenes/RoomScene.js').RoomScene.flushRuntimeStateToGameState}.
 */
export function writeSavedPropPosition(
  manager: GameStateManager,
  roomId: string,
  propId: string,
  position: { x: number; y: number },
): void {
  manager.setVariable(roomPropPositionVariableKey(roomId, propId), {
    x: position.x,
    y: position.y,
  });
}

/** Non-directional override clip when set; otherwise directional idle from current `facing`. */
export function applyCharacterEffectiveAnimation(sprite: Phaser.GameObjects.Sprite): void {
  if (!(sprite instanceof Phaser.GameObjects.Sprite) || !sprite.anims) {
    return;
  }
  const override = getCharacterAnimationOverrideTag(sprite);
  if (override) {
    if (sprite.anims.exists(override)) {
      playCharacterAnimation(sprite, override);
    } else {
      console.warn(`[Benne] Missing override animation "${override}" — falling back to idle.`);
      applyCharacterDirectionalIdleFromFacing(sprite);
    }
    return;
  }
  applyCharacterDirectionalIdleFromFacing(sprite);
}

function applyCharacterDirectionalIdleFromFacing(sprite: Phaser.GameObjects.Sprite): void {
  const facing =
    (sprite.getData('facing') as CharacterFacing | undefined) ?? resolveInitialIdleFacing(sprite);
  playDirectionalAnimation(sprite, 'Idle', facing);
}

export function setCharacterFacingLetterOnly(
  sprite: Phaser.GameObjects.Sprite,
  direction: CharacterFacingLetter,
): void {
  sprite.setData('facing', direction as CharacterFacing);
}

export function characterFaceLetterRespectingOverride(
  sprite: Phaser.GameObjects.Sprite,
  direction: CharacterFacingLetter,
): void {
  if (!(sprite instanceof Phaser.GameObjects.Sprite) || !sprite.anims) {
    return;
  }
  if (getCharacterAnimationOverrideTag(sprite)) {
    setCharacterFacingLetterOnly(sprite, direction);
    return;
  }
  playDirectionalAnimation(sprite, 'Idle', direction as CharacterFacing);
}

/** Current clip key, or persisted override tag even if the clip is missing. */
export function getCharacterEffectiveAnimationTag(sprite: Phaser.GameObjects.Sprite): string {
  if (!(sprite instanceof Phaser.GameObjects.Sprite) || !sprite.anims) {
    return '';
  }
  const override = getCharacterAnimationOverrideTag(sprite);
  if (override) {
    return override;
  }
  const name = sprite.anims.getName();
  return typeof name === 'string' ? name : '';
}

/** Sprite `setData` key: transient speed multiplier for follow-initiated walks (cleared when the walk ends). */
export const BENNE_FOLLOW_SPEED_MULT_KEY = 'benneFollowWalkSpeedMult';

/** Sprite `setData` key: `'follow'` while a walk tween was started by the character-follow driver. */
export const BENNE_FOLLOW_WALK_PURPOSE_KEY = 'benneFollowWalkPurpose';

export function characterFollowingTargetVariableKey(characterId: string): string {
  return `character:${characterId}:followingTarget`;
}

export function characterFollowOptionsVariableKey(characterId: string): string {
  return `character:${characterId}:followOptions`;
}

/** Fully resolved follow options (used for runtime + persisted JSON). */
export interface CharacterFollowEffectiveOptions {
  minDistance: number;
  repathThreshold: number;
  offset: Point2;
  speedMultiplier: number;
  faceTargetWhenIdle: boolean;
  pauseDuringCutscene: boolean;
}

function coerceFinitePositive(n: unknown, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Merges author input into effective follow options (defaults match the Bennescript API contract).
 */
export function mergeCharacterFollowOptions(input?: CharacterFollowOptions | null): CharacterFollowEffectiveOptions {
  const minDistance = coerceFinitePositive(input?.minDistance, 48);
  let repathThreshold = coerceFinitePositive(input?.repathThreshold, minDistance + 12);
  if (repathThreshold < minDistance) {
    repathThreshold = minDistance + 12;
  }
  const ox = input?.offset?.x;
  const oy = input?.offset?.y;
  const offset: Point2 = {
    x: typeof ox === 'number' && Number.isFinite(ox) ? ox : 0,
    y: typeof oy === 'number' && Number.isFinite(oy) ? oy : 0,
  };
  const speedMultiplier = coerceFinitePositive(input?.speedMultiplier, 1);
  const faceTargetWhenIdle = input?.faceTargetWhenIdle !== false;
  const pauseDuringCutscene = input?.pauseDuringCutscene !== false;
  return {
    minDistance,
    repathThreshold,
    offset,
    speedMultiplier,
    faceTargetWhenIdle,
    pauseDuringCutscene,
  };
}

function parseFollowOptionsVariable(raw: unknown): CharacterFollowOptions | null {
  if (raw == null || typeof raw !== 'object') {
    return null;
  }
  const o = raw as Record<string, unknown>;
  return {
    minDistance: o.minDistance as number | undefined,
    repathThreshold: o.repathThreshold as number | undefined,
    offset:
      o.offset != null && typeof o.offset === 'object'
        ? {
            x: (o.offset as { x?: unknown }).x as number,
            y: (o.offset as { y?: unknown }).y as number,
          }
        : undefined,
    speedMultiplier: o.speedMultiplier as number | undefined,
    faceTargetWhenIdle: o.faceTargetWhenIdle as boolean | undefined,
    pauseDuringCutscene: o.pauseDuringCutscene as boolean | undefined,
  };
}

/** Persisted follow target id (`"player"` or a character definition id), or `null` when not following. */
export function readSavedCharacterFollowingTarget(
  manager: GameStateManager,
  characterId: string,
): string | null {
  const v = manager.getVariable(characterFollowingTargetVariableKey(characterId));
  if (typeof v === 'string' && v.length > 0) {
    return v;
  }
  return null;
}

export function readSavedCharacterFollowEffectiveOptions(
  manager: GameStateManager,
  characterId: string,
): CharacterFollowEffectiveOptions {
  const raw = manager.getVariable(characterFollowOptionsVariableKey(characterId));
  return mergeCharacterFollowOptions(parseFollowOptionsVariable(raw));
}

export function writeSavedCharacterFollowState(
  manager: GameStateManager,
  followerId: string,
  targetId: string,
  options: CharacterFollowEffectiveOptions,
): void {
  manager.setVariable(characterFollowingTargetVariableKey(followerId), targetId);
  manager.setVariable(characterFollowOptionsVariableKey(followerId), {
    minDistance: options.minDistance,
    repathThreshold: options.repathThreshold,
    offset: { x: options.offset.x, y: options.offset.y },
    speedMultiplier: options.speedMultiplier,
    faceTargetWhenIdle: options.faceTargetWhenIdle,
    pauseDuringCutscene: options.pauseDuringCutscene,
  });
}

export function clearSavedCharacterFollowState(manager: GameStateManager, followerId: string): void {
  manager.clearVariable(characterFollowingTargetVariableKey(followerId));
  manager.clearVariable(characterFollowOptionsVariableKey(followerId));
}

/**
 * Validates and persists follow state for **`B.character(…).startFollowingCharacter`** /
 * **`B.player.startFollowingCharacter`** (also used from {@link RoomScene} when a room is active).
 * Returns **`false`** when the call is a no-op (self-follow, empty target).
 */
export function applyPersistedCharacterFollowFromScript(
  manager: GameStateManager,
  followerId: string,
  targetIdRaw: string,
  options?: CharacterFollowOptions | null,
): boolean {
  const trimmed = targetIdRaw.trim();
  if (!trimmed) {
    if (import.meta.env.DEV) {
      console.warn('[Benne] startFollowingCharacter: empty target id — no-op.');
    }
    return false;
  }
  const targetPersist = trimmed.toLowerCase() === 'player' ? 'player' : trimmed;
  const targetDef = targetPersist === 'player' ? getStartingPlayerCharacterId() : targetPersist;
  if (targetDef === followerId) {
    if (import.meta.env.DEV) {
      console.warn(
        `[Benne] startFollowingCharacter: "${followerId}" cannot follow themselves — no-op.`,
      );
    }
    return false;
  }
  const effective = mergeCharacterFollowOptions(options ?? undefined);
  writeSavedCharacterFollowState(manager, followerId, targetPersist, effective);
  return true;
}

/**
 * Resolves when a **finite** clip finishes (`ANIMATION_COMPLETE`).
 *
 * **Looping** clips (`repeat === -1`) never complete — for scripted one-shots we wait **one full cycle**
 * (`anim.duration` ms) so `playAnimation` is visible before the revert (e.g. `WalkU` with `loop: true`).
 */
export function promiseWhenSpriteAnimationFinishes(
  sprite: Phaser.GameObjects.Sprite,
  animKey: string,
): Promise<void> {
  return new Promise((resolve) => {
    const scene = sprite.scene;
    // Character clips from `sprite.anims.createFromAseprite` live on the sprite only (not global `scene.anims`).
    // Room prop clips are created on the scene AnimationManager — check both.
    const anim = sprite.anims.exists(animKey)
      ? sprite.anims.get(animKey)
      : scene.anims.exists(animKey)
        ? scene.anims.get(animKey)
        : null;
    if (!anim) {
      resolve();
      return;
    }
    if (anim.repeat === -1) {
      const cycleMs = Math.max(1, Math.ceil(anim.duration || anim.msPerFrame * anim.getTotalFrames()));
      scene.time.delayedCall(cycleMs, resolve);
      return;
    }
    const onComplete = (completed: Phaser.Animations.Animation): void => {
      if (completed.key === animKey) {
        sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, onComplete);
        resolve();
      }
    };
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, onComplete);
  });
}
