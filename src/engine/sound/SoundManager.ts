import * as Phaser from 'phaser';
import {
  getEffectiveDialogueVolume,
  getEffectiveMusicVolume,
  getEffectiveSfxVolume,
} from '../applyAudioFromSettings.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { writePersistedCurrentMusicId } from './audioGameState.js';
import { BENNE_AUDIO_SCRIPT_DISABLED_KEY } from './benneSoundRegistry.js';
import type { MusicPlayOptions, SoundPlayOptions } from './benneSoundTypes.js';
import { benneMusicCacheKey, benneSfxCacheKey, benneVoiceCacheKey } from './benneAudioCacheKeys.js';

/** Author basename — must stay under `audio/sfx`, `audio/music`, or `audio/voice`. */
const AUDIO_ID_RE = /^[a-zA-Z0-9_-]+$/;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function validateAudioId(id: string): boolean {
  return id.length > 0 && AUDIO_ID_RE.test(id);
}

/**
 * Best-effort playback head in seconds for crossfade sync (Phaser `Sound` implementations).
 */
function tryGetMusicPlaybackSeconds(sound: Phaser.Sound.BaseSound): number | null {
  if (!sound.isPlaying) {
    return null;
  }
  try {
    const s = sound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
    const t = s.seek;
    if (typeof t === 'number' && Number.isFinite(t) && t >= 0) {
      return t;
    }
  } catch {
    /* HTML5 / WebAudio seek can throw on some states — treat as unknown. */
  }
  return null;
}

function readSoundVolume(sound: Phaser.Sound.BaseSound): number {
  const s = sound as Phaser.Sound.HTML5AudioSound | Phaser.Sound.WebAudioSound;
  return typeof s.volume === 'number' && Number.isFinite(s.volume) ? s.volume : 0;
}

export interface VoicePlaybackHandle {
  readonly durationMs: number | null;
  stop(): void;
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
  private readonly activeVoice = new Set<Phaser.Sound.BaseSound>();

  /** Primary music slot (incoming / sole instance). */
  private musicSound: Phaser.Sound.BaseSound | null = null;
  /** Outgoing music instance during an active crossfade only. */
  private musicFadeOutSound: Phaser.Sound.BaseSound | null = null;
  /** Completes the queued Bennescript step for the active crossfade (single slot). */
  private musicFadeInteractionResolve: (() => void) | null = null;
  /** Non-zero while a volume ramp uses {@link requestAnimationFrame}. */
  private musicFadeRafId = 0;
  /** Author basename for the primary music slot (persisted to game state on change). */
  private musicAuthorId: string | null = null;

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

  private effectiveVoiceVolume(): number {
    return getEffectiveDialogueVolume();
  }

  private cancelMusicFadeRaf(): void {
    if (this.musicFadeRafId !== 0) {
      cancelAnimationFrame(this.musicFadeRafId);
      this.musicFadeRafId = 0;
    }
  }

  private resolveMusicFadeInteractionIfPending(): void {
    const done = this.musicFadeInteractionResolve;
    if (!done) {
      return;
    }
    this.musicFadeInteractionResolve = null;
    done();
  }

  private killMusicVolumeTweens(): void {
    const scenes = this.game.scene.getScenes(false);
    for (let i = 0; i < scenes.length; i++) {
      const tweens = scenes[i].tweens;
      if (this.musicSound) {
        tweens.killTweensOf(this.musicSound);
      }
      if (this.musicFadeOutSound) {
        tweens.killTweensOf(this.musicFadeOutSound);
      }
    }
  }

  /**
   * Stops and removes every music instance and cancels crossfade tweens.
   * Used for instant replace, `stopMusic`, and `destroy`.
   */
  private hardStopAllMusicTracks(): void {
    this.cancelMusicFadeRaf();
    this.killMusicVolumeTweens();
    this.resolveMusicFadeInteractionIfPending();
    if (this.musicFadeOutSound) {
      try {
        this.musicFadeOutSound.stop();
      } catch {
        /* ignore */
      }
      if (this.game.sound.getAll(this.musicFadeOutSound.key).includes(this.musicFadeOutSound)) {
        this.game.sound.remove(this.musicFadeOutSound);
      }
      this.musicFadeOutSound = null;
    }
    if (this.musicSound) {
      try {
        this.musicSound.stop();
      } catch {
        /* ignore */
      }
      if (this.game.sound.getAll(this.musicSound.key).includes(this.musicSound)) {
        this.game.sound.remove(this.musicSound);
      }
      this.musicSound = null;
    }
  }

  /**
   * Clears any fade-out slot and detaches the current primary slot when it is usable as an
   * outgoing crossfade source. Non-playing primaries are removed.
   */
  private consumePrimaryMusicForCrossfade(): Phaser.Sound.BaseSound | null {
    this.cancelMusicFadeRaf();
    this.killMusicVolumeTweens();
    this.resolveMusicFadeInteractionIfPending();
    if (this.musicFadeOutSound) {
      try {
        this.musicFadeOutSound.stop();
      } catch {
        /* ignore */
      }
      if (this.game.sound.getAll(this.musicFadeOutSound.key).includes(this.musicFadeOutSound)) {
        this.game.sound.remove(this.musicFadeOutSound);
      }
      this.musicFadeOutSound = null;
    }

    const current = this.musicSound;
    this.musicSound = null;
    if (!current) {
      return null;
    }
    if (!current.isPlaying) {
      try {
        current.stop();
      } catch {
        /* ignore */
      }
      if (this.game.sound.getAll(current.key).includes(current)) {
        this.game.sound.remove(current);
      }
      return null;
    }
    return current;
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
    const voiceVol = this.effectiveVoiceVolume();
    for (const sound of this.activeVoice) {
      if (!sound.isPlaying) {
        continue;
      }
      this.setInstanceVolume(sound, voiceVol);
    }
    // Crossfade tweens own music volumes until the fade completes.
    if (this.musicFadeOutSound != null) {
      return;
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

  private persistCurrentMusicId(id: string | null): void {
    this.musicAuthorId = id;
    const mgr = tryGetActiveGameStateManager();
    if (mgr) {
      writePersistedCurrentMusicId(mgr, id);
    }
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

  playVoice(id: string): VoicePlaybackHandle | null {
    if (this.isScriptAudioDisabled() || !validateAudioId(id)) {
      return null;
    }
    const key = benneVoiceCacheKey(id);
    if (!this.game.cache.audio.has(key)) {
      if (import.meta.env.DEV) {
        console.warn(`[Benne] voice: missing audio "${id}" (expected assets/audio/voice/${id}.*).`);
      }
      return null;
    }
    const sound = this.game.sound.add(key, { volume: this.effectiveVoiceVolume(), loop: false });
    this.activeVoice.add(sound);

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      this.activeVoice.delete(sound);
      if (this.game.sound.getAll(key).includes(sound)) {
        this.game.sound.remove(sound);
      }
    };
    sound.once(Phaser.Sound.Events.COMPLETE, cleanup);
    sound.once(Phaser.Sound.Events.DESTROY, cleanup);

    let started = false;
    try {
      started = sound.play();
    } catch {
      started = false;
    }

    if (!started) {
      cleanup();
      if (import.meta.env.DEV) {
        console.warn(`[Benne] voice: failed to start "${id}".`);
      }
      return null;
    }

    const durationSeconds =
      typeof sound.duration === 'number' && Number.isFinite(sound.duration) && sound.duration > 0
        ? sound.duration
        : null;

    return {
      durationMs: durationSeconds == null ? null : Math.round(durationSeconds * 1000),
      stop: () => {
        if (cleaned) {
          return;
        }
        try {
          sound.stop();
        } catch {
          /* ignore */
        }
        cleanup();
      },
    };
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

  /**
   * Plays music. Resolves immediately for instant playback; when **`fadeSeconds`** > 0, resolves
   * after the crossfade duration so Bennescript **`interactionTail`** steps stay ordered.
   */
  playMusic(id: string, options?: MusicPlayOptions): Promise<void> {
    if (this.isScriptAudioDisabled() || !validateAudioId(id)) {
      return Promise.resolve();
    }
    const key = benneMusicCacheKey(id);
    if (!this.game.cache.audio.has(key)) {
      if (import.meta.env.DEV) {
        console.warn(`[Benne] B.sound.playMusic: missing audio "${id}" (expected assets/audio/music/${id}.*).`);
      }
      return Promise.resolve();
    }

    const fadeRaw = options?.fadeSeconds;
    const fadeSeconds =
      typeof fadeRaw === 'number' && Number.isFinite(fadeRaw) && fadeRaw > 0 ? fadeRaw : 0;

    if (fadeSeconds <= 0) {
      this.hardStopAllMusicTracks();
      const volume = this.effectiveMusicVolume(options);
      const loop = options?.loop !== false;
      const sound = this.game.sound.add(key, { volume, loop });
      this.musicSound = sound;
      sound.play();
      this.persistCurrentMusicId(id);
      return Promise.resolve();
    }

    return this.playMusicCrossfade(id, key, options, fadeSeconds);
  }

  /**
   * Linear volume crossfade using real time ({@link requestAnimationFrame}), not scene tweens or
   * {@link Phaser.Time.Clock} — enter-room-after-fade hooks run while {@link RoomScene} cutscene
   * depth suppresses input until the interaction tail drains; scene clocks / tween updates must
   * not gate that tail.
   */
  private runMusicCrossfadeWithRaf(
    incoming: Phaser.Sound.BaseSound,
    outgoing: Phaser.Sound.BaseSound | null,
    targetVolume: number,
    durationMs: number,
  ): void {
    const start = performance.now();
    const startOut = outgoing ? clamp01(readSoundVolume(outgoing)) : 0;

    const finalize = (): void => {
      this.musicFadeRafId = 0;
      try {
        if (incoming === this.musicSound) {
          this.setInstanceVolume(incoming, targetVolume);
        }
        if (outgoing) {
          try {
            outgoing.stop();
          } catch {
            /* ignore */
          }
          if (this.game.sound.getAll(outgoing.key).includes(outgoing)) {
            this.game.sound.remove(outgoing);
          }
        }
        if (this.musicFadeOutSound === outgoing) {
          this.musicFadeOutSound = null;
        }
      } finally {
        this.resolveMusicFadeInteractionIfPending();
      }
    };

    const tick = (): void => {
      if (!this.game.sound.getAll(incoming.key).includes(incoming)) {
        this.musicFadeRafId = 0;
        try {
          if (outgoing && this.game.sound.getAll(outgoing.key).includes(outgoing)) {
            try {
              outgoing.stop();
            } catch {
              /* ignore */
            }
            this.game.sound.remove(outgoing);
          }
          if (this.musicFadeOutSound === outgoing) {
            this.musicFadeOutSound = null;
          }
        } finally {
          this.resolveMusicFadeInteractionIfPending();
        }
        return;
      }
      const elapsed = performance.now() - start;
      const u = Math.min(1, durationMs > 0 ? elapsed / durationMs : 1);
      this.setInstanceVolume(incoming, targetVolume * u);
      if (outgoing && this.game.sound.getAll(outgoing.key).includes(outgoing)) {
        this.setInstanceVolume(outgoing, startOut * (1 - u));
      }
      if (u >= 1) {
        finalize();
        return;
      }
      this.musicFadeRafId = requestAnimationFrame(tick);
    };

    this.musicFadeRafId = requestAnimationFrame(tick);
  }

  private playMusicCrossfade(
    authorId: string,
    key: string,
    options: MusicPlayOptions | undefined,
    fadeSeconds: number,
  ): Promise<void> {
    const outgoing = this.consumePrimaryMusicForCrossfade();
    const loop = options?.loop !== false;
    const targetVolume = this.effectiveMusicVolume(options);
    const durationMs = fadeSeconds * 1000;

    const incoming = this.game.sound.add(key, { volume: 0, loop });
    this.musicFadeOutSound = outgoing;
    this.musicSound = incoming;

    const playConfig: Phaser.Types.Sound.SoundConfig = {};
    if (options?.sync === true && outgoing) {
      const head = tryGetMusicPlaybackSeconds(outgoing);
      const dur =
        typeof incoming.duration === 'number' && Number.isFinite(incoming.duration)
          ? incoming.duration
          : null;
      if (head != null && dur != null && dur > 0.05) {
        const clamped = Math.min(Math.max(0, head), Math.max(0, dur - 0.05));
        playConfig.seek = clamped;
      }
    }

    let started = false;
    try {
      started = Object.keys(playConfig).length > 0 ? incoming.play(playConfig) : incoming.play();
    } catch {
      started = false;
    }

    if (!started) {
      this.killMusicVolumeTweens();
      if (this.game.sound.getAll(key).includes(incoming)) {
        this.game.sound.remove(incoming);
      }
      this.musicSound = null;
      if (outgoing && outgoing.isPlaying) {
        this.musicSound = outgoing;
      } else if (outgoing) {
        try {
          outgoing.stop();
        } catch {
          /* ignore */
        }
        if (this.game.sound.getAll(outgoing.key).includes(outgoing)) {
          this.game.sound.remove(outgoing);
        }
      }
      this.musicFadeOutSound = null;
      if (import.meta.env.DEV) {
        console.warn(`[Benne] B.sound.playMusic: failed to start crossfade for "${key}".`);
      }
      return Promise.resolve();
    }

    this.persistCurrentMusicId(authorId);

    return new Promise((resolve) => {
      this.musicFadeInteractionResolve = resolve;
      this.runMusicCrossfadeWithRaf(incoming, outgoing, targetVolume, durationMs);
    });
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

  stopAllVoice(): void {
    if (this.isScriptAudioDisabled()) {
      return;
    }
    for (const sound of [...this.activeVoice]) {
      sound.stop();
      this.game.sound.remove(sound);
      this.activeVoice.delete(sound);
    }
  }

  stopMusic(): void {
    if (this.isScriptAudioDisabled()) {
      return;
    }
    this.hardStopAllMusicTracks();
    this.persistCurrentMusicId(null);
  }

  getCurrentMusicId(): string | null {
    return this.musicAuthorId;
  }

  getSfxSessionVolume(): number {
    return this.sfxSessionMultiplier;
  }

  getMusicSessionVolume(): number {
    return this.musicSessionMultiplier;
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
    return (
      (this.musicSound != null && this.musicSound.isPlaying) ||
      (this.musicFadeOutSound != null && this.musicFadeOutSound.isPlaying)
    );
  }

  destroy(): void {
    this.stopAllSfx();
    this.stopAllVoice();
    this.stopMusic();
  }
}
