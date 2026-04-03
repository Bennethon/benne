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
