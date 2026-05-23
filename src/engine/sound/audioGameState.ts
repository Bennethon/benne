import * as Phaser from 'phaser';
import { getGameSettings } from '../ConfigManager.js';
import type { GameStateManager } from '../gameState/GameStateManager.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { tryGetBenneSoundManager } from './benneSoundRegistry.js';

/** Persisted user SFX session multiplier (0–1); included in save snapshots. */
export const SETTINGS_SFX_VOLUME_VARIABLE = 'settings:sfxVolume';

/** Persisted user music session multiplier (0–1); included in save snapshots. */
export const SETTINGS_MUSIC_VOLUME_VARIABLE = 'settings:musicVolume';

/** Persisted current music stem (basename); included in save snapshots. Cleared when music stops. */
export const SETTINGS_CURRENT_MUSIC_VARIABLE = 'settings:currentMusicId';

export const PERSISTED_AUDIO_VOLUME_VARIABLE_KEYS = [
  SETTINGS_SFX_VOLUME_VARIABLE,
  SETTINGS_MUSIC_VOLUME_VARIABLE,
] as const;

/** Volume + current music track keys preserved when an incoming snapshot omits them. */
export const PERSISTED_AUDIO_STATE_VARIABLE_KEYS = [
  ...PERSISTED_AUDIO_VOLUME_VARIABLE_KEYS,
  SETTINGS_CURRENT_MUSIC_VARIABLE,
] as const;

/** Author basename — must stay under `audio/music`. */
const MUSIC_ID_RE = /^[a-zA-Z0-9_-]+$/;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function isValidMusicId(id: string): boolean {
  return id.length > 0 && MUSIC_ID_RE.test(id);
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

/**
 * Saved music stem when the variable is present.
 * - `undefined` — key absent (legacy snapshot / never set)
 * - `null` — explicitly stopped
 * - `string` — valid music stem
 */
export function readPersistedCurrentMusicId(manager: GameStateManager): string | null | undefined {
  if (!manager.hasVariable(SETTINGS_CURRENT_MUSIC_VARIABLE)) {
    return undefined;
  }
  const v = manager.getVariable(SETTINGS_CURRENT_MUSIC_VARIABLE);
  if (v === null || v === '') {
    return null;
  }
  if (typeof v === 'string' && isValidMusicId(v)) {
    return v;
  }
  return null;
}

export function writePersistedSfxSessionVolume(manager: GameStateManager, volume: number): void {
  manager.setVariable(SETTINGS_SFX_VOLUME_VARIABLE, clamp01(volume));
}

export function writePersistedMusicSessionVolume(manager: GameStateManager, volume: number): void {
  manager.setVariable(SETTINGS_MUSIC_VOLUME_VARIABLE, clamp01(volume));
}

export function writePersistedCurrentMusicId(manager: GameStateManager, id: string | null): void {
  if (id === null) {
    manager.clearVariable(SETTINGS_CURRENT_MUSIC_VARIABLE);
    return;
  }
  if (isValidMusicId(id)) {
    manager.setVariable(SETTINGS_CURRENT_MUSIC_VARIABLE, id);
  }
}

/**
 * When applying a snapshot, keep prior `settings:*` audio variables if the incoming snapshot omits them
 * (new game keeps last slider values unless `initialGameState.variables` seeds them).
 */
export function mergePreserveAudioVolumeVariables(
  incoming: Record<string, unknown>,
  previous: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...incoming };
  for (const key of PERSISTED_AUDIO_STATE_VARIABLE_KEYS) {
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

/**
 * Restores the saved music track after snapshot apply / boot.
 * Legacy snapshots without `settings:currentMusicId` are left unchanged.
 */
export function applyPersistedMusicTrack(game: Phaser.Game): void {
  const sm = tryGetBenneSoundManager(game);
  const mgr = tryGetActiveGameStateManager();
  if (!sm || !mgr) {
    return;
  }
  const savedId = readPersistedCurrentMusicId(mgr);
  if (savedId === undefined) {
    return;
  }
  const liveId = sm.getCurrentMusicId();
  if (savedId === null) {
    if (liveId !== null) {
      sm.stopMusic();
    }
    return;
  }
  if (savedId === liveId) {
    return;
  }
  void sm.playMusic(savedId);
}
