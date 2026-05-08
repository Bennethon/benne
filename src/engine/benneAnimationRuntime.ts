import * as Phaser from 'phaser';
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

/** Saved per-room character feet world position (lazily written via flush hooks; see {@link writeSavedCharacterPosition}). */
export function characterPositionVariableKey(roomId: string, characterId: string): string {
  return `room:${roomId}:character:${characterId}:position`;
}

/** Saved per-room prop top-left world position (lazily written via flush hooks; see {@link writeSavedPropPosition}). */
export function roomPropPositionVariableKey(roomId: string, propId: string): string {
  return `room:${roomId}:prop:${propId}:position`;
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
