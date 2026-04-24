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

export function characterAnimationVariableKey(characterId: string): string {
  return `character:${characterId}:animation`;
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
