import * as Phaser from 'phaser';
import {
  getEffectiveMusicVolume,
  getEffectiveSfxVolume,
} from '../applyAudioFromSettings.js';
import { BENNE_AUDIO_SCRIPT_DISABLED_KEY } from './benneSoundRegistry.js';
import type { MusicPlayOptions, SoundPlayOptions } from './benneSoundTypes.js';
import { benneMusicCacheKey, benneSfxCacheKey } from './benneAudioCacheKeys.js';

/** Author basename — must stay under `audio/sfx` / `audio/music`. */
const AUDIO_ID_RE = /^[a-zA-Z0-9_-]+$/;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function validateAudioId(id: string): boolean {
  return id.length > 0 && AUDIO_ID_RE.test(id);
}

/**
 * Game-scoped audio: uses {@link Phaser.Game#sound} only so playback survives `RoomScene` shutdown.
 */
export class SoundManager {
  private readonly game: Phaser.Game;
  private sfxSessionMultiplier = 1;
  private musicSessionMultiplier = 1;

  private readonly activeSfx = new Set<Phaser.Sound.BaseSound>();
  private readonly sfxAuthorBySound = new WeakMap<Phaser.Sound.BaseSound, string>();

  private musicSound: Phaser.Sound.BaseSound | null = null;

  constructor(game: Phaser.Game) {
    this.game = game;
  }

  /** True when editor preview muted scripted audio via registry. */
  private isScriptAudioDisabled(): boolean {
    return this.game.registry.get(BENNE_AUDIO_SCRIPT_DISABLED_KEY) === true;
  }

  private effectiveSfxVolume(options?: SoundPlayOptions): number {
    const base = getEffectiveSfxVolume();
    const opt = options?.volume;
    const mul = opt === undefined ? 1 : clamp01(opt);
    return clamp01(base * this.sfxSessionMultiplier * mul);
  }

  private effectiveMusicVolume(options?: MusicPlayOptions): number {
    const base = getEffectiveMusicVolume();
    const opt = options?.volume;
    const mul = opt === undefined ? 1 : clamp01(opt);
    return clamp01(base * this.musicSessionMultiplier * mul);
  }

  private refreshActiveVolumes(): void {
    if (this.isScriptAudioDisabled()) {
      return;
    }
    const sfxVol = clamp01(getEffectiveSfxVolume() * this.sfxSessionMultiplier);
    for (const sound of this.activeSfx) {
      if (!sound.isPlaying) {
        continue;
      }
      this.setInstanceVolume(sound, sfxVol);
    }
    if (this.musicSound && this.musicSound.isPlaying) {
      this.setInstanceVolume(this.musicSound, this.effectiveMusicVolume(undefined));
    }
  }

  private setInstanceVolume(sound: Phaser.Sound.BaseSound, volume: number): void {
    const v = clamp01(volume);
    const s = sound as Phaser.Sound.HTML5AudioSound | Phaser.Sound.WebAudioSound;
    s.volume = v;
  }

  playSfx(id: string, options?: SoundPlayOptions): void {
    if (this.isScriptAudioDisabled() || !validateAudioId(id)) {
      return;
    }
    const key = benneSfxCacheKey(id);
    if (!this.game.cache.audio.has(key)) {
      if (import.meta.env.DEV) {
        console.warn(`[Benne] B.sound.play: missing audio "${id}" (expected assets/audio/sfx/${id}.*).`);
      }
      return;
    }
    const volume = this.effectiveSfxVolume(options);
    const loop = options?.loop === true;
    const sound = this.game.sound.add(key, { volume, loop });
    this.sfxAuthorBySound.set(sound, id);
    this.activeSfx.add(sound);
    let cleanedFireAndForget = false;
    const cleanup = (): void => {
      if (cleanedFireAndForget) {
        return;
      }
      cleanedFireAndForget = true;
      this.activeSfx.delete(sound);
      this.sfxAuthorBySound.delete(sound);
      if (this.game.sound.getAll(key).includes(sound)) {
        this.game.sound.remove(sound);
      }
    };
    sound.once(Phaser.Sound.Events.COMPLETE, cleanup);
    sound.once(Phaser.Sound.Events.DESTROY, cleanup);
    sound.play();
  }

  /**
   * Returns a promise that resolves when the sound finishes or is stopped/destroyed.
   */
  playSfxAndWait(id: string, options?: SoundPlayOptions): Promise<void> {
    if (this.isScriptAudioDisabled() || !validateAudioId(id)) {
      return Promise.resolve();
    }
    const key = benneSfxCacheKey(id);
    if (!this.game.cache.audio.has(key)) {
      if (import.meta.env.DEV) {
        console.warn(`[Benne] B.sound.playAndWait: missing audio "${id}" (expected assets/audio/sfx/${id}.*).`);
      }
      return Promise.resolve();
    }
    const volume = this.effectiveSfxVolume(options);
    const loop = options?.loop === true;
    const sound = this.game.sound.add(key, { volume, loop });
    this.sfxAuthorBySound.set(sound, id);
    this.activeSfx.add(sound);

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      this.activeSfx.delete(sound);
      this.sfxAuthorBySound.delete(sound);
      if (this.game.sound.getAll(key).includes(sound)) {
        this.game.sound.remove(sound);
      }
    };
    sound.once(Phaser.Sound.Events.COMPLETE, cleanup);
    sound.once(Phaser.Sound.Events.DESTROY, cleanup);

    sound.play();
    return this.awaitSoundFinish(sound);
  }

  private awaitSoundFinish(sound: Phaser.Sound.BaseSound): Promise<void> {
    return new Promise((resolve) => {
      const finish = (): void => {
        sound.off(Phaser.Sound.Events.COMPLETE, finish);
        sound.off(Phaser.Sound.Events.STOP, finish);
        sound.off(Phaser.Sound.Events.DESTROY, finish);
        resolve();
      };
      if (!sound.isPlaying) {
        finish();
        return;
      }
      sound.once(Phaser.Sound.Events.COMPLETE, finish);
      sound.once(Phaser.Sound.Events.STOP, finish);
      sound.once(Phaser.Sound.Events.DESTROY, finish);
    });
  }

  playMusic(id: string, options?: MusicPlayOptions): void {
    if (this.isScriptAudioDisabled() || !validateAudioId(id)) {
      return;
    }
    const key = benneMusicCacheKey(id);
    if (!this.game.cache.audio.has(key)) {
      if (import.meta.env.DEV) {
        console.warn(`[Benne] B.sound.playMusic: missing audio "${id}" (expected assets/audio/music/${id}.*).`);
      }
      return;
    }

    if (this.musicSound) {
      this.musicSound.stop();
      this.game.sound.remove(this.musicSound);
      this.musicSound = null;
    }

    const volume = this.effectiveMusicVolume(options);
    const loop = options?.loop !== false;
    const sound = this.game.sound.add(key, { volume, loop });
    this.musicSound = sound;
    sound.play();
  }

  stopSfx(authorId?: string): void {
    if (this.isScriptAudioDisabled()) {
      return;
    }
    if (authorId === undefined) {
      this.stopAllSfx();
      return;
    }
    if (!validateAudioId(authorId)) {
      return;
    }
    const toStop: Phaser.Sound.BaseSound[] = [];
    for (const sound of this.activeSfx) {
      if (this.sfxAuthorBySound.get(sound) === authorId) {
        toStop.push(sound);
      }
    }
    for (const s of toStop) {
      s.stop();
      this.game.sound.remove(s);
      this.activeSfx.delete(s);
      this.sfxAuthorBySound.delete(s);
    }
  }

  stopAllSfx(): void {
    if (this.isScriptAudioDisabled()) {
      return;
    }
    for (const sound of [...this.activeSfx]) {
      sound.stop();
      this.game.sound.remove(sound);
      this.activeSfx.delete(sound);
      this.sfxAuthorBySound.delete(sound);
    }
  }

  stopMusic(): void {
    if (this.isScriptAudioDisabled()) {
      return;
    }
    if (this.musicSound) {
      this.musicSound.stop();
      this.game.sound.remove(this.musicSound);
      this.musicSound = null;
    }
  }

  setSfxSessionVolume(volume: number): void {
    this.sfxSessionMultiplier = clamp01(volume);
    this.refreshActiveVolumes();
  }

  setMusicSessionVolume(volume: number): void {
    this.musicSessionMultiplier = clamp01(volume);
    this.refreshActiveVolumes();
  }

  isSfxPlaying(authorId: string): boolean {
    if (!validateAudioId(authorId)) {
      return false;
    }
    for (const sound of this.activeSfx) {
      if (this.sfxAuthorBySound.get(sound) === authorId && sound.isPlaying) {
        return true;
      }
    }
    return false;
  }

  isMusicPlaying(): boolean {
    return this.musicSound != null && this.musicSound.isPlaying;
  }

  destroy(): void {
    this.stopAllSfx();
    this.stopMusic();
  }
}
