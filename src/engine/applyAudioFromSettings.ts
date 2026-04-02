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
