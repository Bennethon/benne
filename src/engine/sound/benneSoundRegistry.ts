import type * as Phaser from 'phaser';
import type { SoundManager } from './SoundManager.js';

/** `game.registry` key for {@link SoundManager}. */
export const BENNE_SOUND_MANAGER_KEY = 'benneSoundManager';

/**
 * When true, {@link SoundManager} no-ops so editor previews never play scripted audio.
 * Set from preview `Phaser.Game` `callbacks.preBoot`; shipped runtime leaves unset/false.
 */
export const BENNE_AUDIO_SCRIPT_DISABLED_KEY = 'benneAudioScriptDisabled';

export function tryGetBenneSoundManager(game: Phaser.Game): SoundManager | null {
  const v = game.registry.get(BENNE_SOUND_MANAGER_KEY) as SoundManager | undefined;
  return v ?? null;
}

export function setBenneSoundManager(game: Phaser.Game, manager: SoundManager): void {
  game.registry.set(BENNE_SOUND_MANAGER_KEY, manager);
}

export function isBenneAudioScriptDisabled(game: Phaser.Game): boolean {
  return game.registry.get(BENNE_AUDIO_SCRIPT_DISABLED_KEY) === true;
}
