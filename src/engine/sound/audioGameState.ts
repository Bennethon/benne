import * as Phaser from 'phaser';
import { getGameSettings } from '../ConfigManager.js';
import type { GameStateManager } from '../gameState/GameStateManager.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { tryGetBenneSoundManager } from './benneSoundRegistry.js';

/** Persisted user SFX session multiplier (0–1); included in save snapshots. */
export const SETTINGS_SFX_VOLUME_VARIABLE = 'settings:sfxVolume';

/** Persisted user music session multiplier (0–1); included in save snapshots. */
export const SETTINGS_MUSIC_VOLUME_VARIABLE = 'settings:musicVolume';

export const PERSISTED_AUDIO_VOLUME_VARIABLE_KEYS = [
  SETTINGS_SFX_VOLUME_VARIABLE,
  SETTINGS_MUSIC_VOLUME_VARIABLE,
] as const;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function readNumericVariable(manager: GameStateManager, key: string): number | null {
  if (!manager.hasVariable(key)) {
    return null;
  }
  const v = manager.getVariable(key);
  if (typeof v === 'number' && Number.isFinite(v)) {
    return clamp01(v);
  }
  return null;
}

/** Effective SFX session multiplier: saved variable, else `game-config.json` `audio.sfxVolume`. */
export function readPersistedSfxSessionVolume(manager: GameStateManager): number {
  return readNumericVariable(manager, SETTINGS_SFX_VOLUME_VARIABLE) ?? clamp01(getGameSettings().audio.sfxVolume);
}

/** Effective music session multiplier: saved variable, else `game-config.json` `audio.musicVolume`. */
export function readPersistedMusicSessionVolume(manager: GameStateManager): number {
  return (
    readNumericVariable(manager, SETTINGS_MUSIC_VOLUME_VARIABLE) ??
    clamp01(getGameSettings().audio.musicVolume)
  );
}

export function writePersistedSfxSessionVolume(manager: GameStateManager, volume: number): void {
  manager.setVariable(SETTINGS_SFX_VOLUME_VARIABLE, clamp01(volume));
}

export function writePersistedMusicSessionVolume(manager: GameStateManager, volume: number): void {
  manager.setVariable(SETTINGS_MUSIC_VOLUME_VARIABLE, clamp01(volume));
}

/**
 * When applying a snapshot, keep prior `settings:*` volume variables if the incoming snapshot omits them
 * (new game keeps last slider values unless `initialGameState.variables` seeds them).
 */
export function mergePreserveAudioVolumeVariables(
  incoming: Record<string, unknown>,
  previous: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...incoming };
  for (const key of PERSISTED_AUDIO_VOLUME_VARIABLE_KEYS) {
    if (
      !Object.prototype.hasOwnProperty.call(incoming, key) &&
      Object.prototype.hasOwnProperty.call(previous, key)
    ) {
      merged[key] = previous[key];
    }
  }
  return merged;
}

/** Sync {@link SoundManager} session multipliers from game state (or config defaults when no manager). */
export function applyPersistedAudioSessionVolumes(game: Phaser.Game): void {
  const sm = tryGetBenneSoundManager(game);
  if (!sm) {
    return;
  }
  const mgr = tryGetActiveGameStateManager();
  const sfx = mgr ? readPersistedSfxSessionVolume(mgr) : clamp01(getGameSettings().audio.sfxVolume);
  const music = mgr ? readPersistedMusicSessionVolume(mgr) : clamp01(getGameSettings().audio.musicVolume);
  sm.setSfxSessionVolume(sfx);
  sm.setMusicSessionVolume(music);
}
