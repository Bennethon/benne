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
