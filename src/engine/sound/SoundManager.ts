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

/**
 * Room reveal waits this long for the output device to actually start.
 * Scheduling a buffer before that plays it seconds later.
 */
const AUDIO_OUTPUT_READY_TIMEOUT_MS = 3_000;

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

/**
 * BENNE Play is an editor webview iframe. That window blurs as soon as focus is anywhere
 * else in the editor. Phaser's default `pauseOnBlur` then suspends Web Audio and only
 * resumes on `window` focus, so music started from a room script stays silent.
 */
function shouldKeepWebAudioRunning(): boolean {
  const base = (globalThis as { __BENNE_PLAY_MEDIA_BASE__?: unknown }).__BENNE_PLAY_MEDIA_BASE__;
  if (typeof base === 'string' && base.length > 0) {
    return true;
  }
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

/**
 * Phaser schedules Web Audio param changes at time 0 ("immediately"). Once the context clock
 * has advanced, that time is in the past: some browsers throw, and others keep the previous
 * gain, so music started after the first click stays silent or rejects the script queue.
 * Clamp those timestamps to the active context clock.
 */
let activeAudioContext: BaseAudioContext | null = null;
let audioParamSchedulingInstalled = false;

function installImmediateAudioParamScheduling(context: BaseAudioContext): void {
  activeAudioContext = context;
  if (audioParamSchedulingInstalled) {
    return;
  }
  audioParamSchedulingInstalled = true;
  const original = AudioParam.prototype.setValueAtTime;
  AudioParam.prototype.setValueAtTime = function (this: AudioParam, value: number, startTime: number): AudioParam {
    const now = activeAudioContext?.currentTime ?? 0;
    const time = Number.isFinite(startTime) && startTime < now ? now : startTime;
    return original.call(this, value, time);
  };
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

  /** In-flight {@link prepareForPlayback}. Callers join this instead of starting another wait. */
  private playbackReady: Promise<void> | null = null;
  /** Last wait ended before the device was running. Avoids stalling every later SFX for the full timeout. */
  private outputWaitGaveUp = false;
  /** Stops the silent buffer that holds the output device open between clips. */
  private keepAliveStop: (() => void) | null = null;
  private keepAliveListenerArmed = false;
  /** SFX starts held until the context is running. Cleared on {@link stopAllSfx}. */
  private readonly deferredSfxStarts = new Set<() => void>();
  /** Music starts held until the context is running. Cleared on {@link stopMusic}. */
  private readonly deferredMusicStarts = new Set<() => void>();

  constructor(game: Phaser.Game) {
    this.game = game;
    if (shouldKeepWebAudioRunning()) {
      this.game.sound.pauseOnBlur = false;
    }
    const context = (game.sound as { context?: AudioContext }).context;
    if (context) {
      installImmediateAudioParamScheduling(context);
      this.armKeepAliveWhenRunning(context);
      if (shouldKeepWebAudioRunning()) {
        this.keepWebAudioRunning(context);
      }
      // Overlaps boot loading, so the device is already open when the first room appears.
      void context.resume().then(
        () => undefined,
        () => undefined,
      );
    }
  }

  /**
   * If something still suspends the context (a blur that landed before this manager
   * existed, or the browser autoplay lock), bring it back. A suspended context plays
   * nothing until `resume()`, and Play often never receives a matching focus event.
   */
  private keepWebAudioRunning(context: AudioContext): void {
    let resuming = false;
    const resume = (): void => {
      if (resuming || (context.state !== 'suspended' && context.state !== 'interrupted')) {
        return;
      }
      resuming = true;
      void context.resume().then(
        () => {
          resuming = false;
        },
        () => {
          resuming = false;
        },
      );
    };
    resume();
    context.addEventListener('statechange', resume);
    this.game.events.once(Phaser.Core.Events.DESTROY, () => {
      context.removeEventListener('statechange', resume);
    });
  }

  private audioContext(): AudioContext | undefined {
    return (this.game.sound as { context?: AudioContext }).context;
  }

  /** True when scripted playback can start without waiting on the output device. */
  isAudioRunning(): boolean {
    if (this.isScriptAudioDisabled()) {
      return true;
    }
    const ctx = this.audioContext();
    return !ctx || ctx.state === 'running';
  }

  /**
   * Resume Web Audio and hold a silent buffer so the output device stays awake.
   * Room transitions await this before the fade-in: a buffer started while the
   * device is still opening is heard seconds after the entrance script asked for it.
   * Resolves when the context is running, resume is rejected (autoplay), or the wait times out.
   */
  prepareForPlayback(): Promise<void> {
    if (this.isScriptAudioDisabled()) {
      return Promise.resolve();
    }
    const ctx = this.audioContext();
    if (!ctx || ctx.state === 'running') {
      if (ctx) {
        this.ensureKeepAlive(ctx);
      }
      this.outputWaitGaveUp = false;
      return Promise.resolve();
    }
    if (this.outputWaitGaveUp) {
      return Promise.resolve();
    }
    if (this.playbackReady) {
      return this.playbackReady;
    }
    const pending = this.waitUntilAudioRunning(ctx).finally(() => {
      if (this.playbackReady === pending) {
        this.playbackReady = null;
      }
    });
    this.playbackReady = pending;
    return pending;
  }

  private waitUntilAudioRunning(ctx: AudioContext): Promise<void> {
    if (ctx.state === 'running') {
      this.ensureKeepAlive(ctx);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        try {
          ctx.removeEventListener('statechange', onState);
        } catch {
          /* ignore */
        }
        try {
          if (ctx.state === 'running') {
            this.outputWaitGaveUp = false;
            this.ensureKeepAlive(ctx);
          } else {
            this.outputWaitGaveUp = true;
          }
        } finally {
          // A throw while arming the keep-alive must not leave this promise pending.
          // Callers such as B.sound.play sit on the interaction queue ahead of B.room.changeTo.
          resolve();
        }
      };
      const onState = (): void => {
        if (ctx.state === 'running') {
          finish();
        }
      };
      const timer = window.setTimeout(finish, AUDIO_OUTPUT_READY_TIMEOUT_MS);
      ctx.addEventListener('statechange', onState);
      void ctx.resume().then(
        () => {
          if (ctx.state === 'running') {
            finish();
          }
        },
        () => finish(),
      );
    });
  }

  /** Start the silent hold as soon as the context is running, including after a later unlock. */
  private armKeepAliveWhenRunning(ctx: AudioContext): void {
    if (this.keepAliveListenerArmed) {
      return;
    }
    this.keepAliveListenerArmed = true;
    const tryStart = (): void => {
      if (ctx.state === 'running') {
        this.ensureKeepAlive(ctx);
      }
    };
    tryStart();
    ctx.addEventListener('statechange', tryStart);
    this.game.events.once(Phaser.Core.Events.DESTROY, () => {
      ctx.removeEventListener('statechange', tryStart);
    });
  }

  /**
   * Looping silence keeps the audio device from sleeping after {@link stopAllSfx} on a room leave.
   * The next real clip then starts with the script instead of paying the device's open delay.
   */
  private ensureKeepAlive(ctx: AudioContext): void {
    if (this.keepAliveStop || ctx.state !== 'running' || this.isScriptAudioDisabled()) {
      return;
    }
    let source: AudioBufferSourceNode;
    let gain: GainNode;
    try {
      const length = Math.max(1, Math.floor(ctx.sampleRate * 0.25));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch {
      return;
    }
    this.keepAliveStop = () => {
      try {
        source.stop();
      } catch {
        /* ignore */
      }
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
      try {
        gain.disconnect();
      } catch {
        /* ignore */
      }
    };
  }

  private stopKeepAlive(): void {
    this.keepAliveStop?.();
    this.keepAliveStop = null;
  }

  private deferUntilRunning(ctx: AudioContext, bucket: Set<() => void>, start: () => void): void {
    const run = (): void => {
      if (ctx.state !== 'running') {
        return;
      }
      ctx.removeEventListener('statechange', run);
      if (!bucket.delete(run)) {
        return;
      }
      this.ensureKeepAlive(ctx);
      start();
    };
    bucket.add(run);
    ctx.addEventListener('statechange', run);
    void ctx.resume().then(
      () => undefined,
      () => undefined,
    );
  }

  private cancelDeferred(bucket: Set<() => void>): void {
    const ctx = this.audioContext();
    for (const run of bucket) {
      ctx?.removeEventListener('statechange', run);
    }
    bucket.clear();
  }

  /**
   * Runs `start` once the output device is running. If it still isn't after
   * {@link prepareForPlayback}, holds `start` until then so the buffer isn't scheduled early.
   */
  private async withRunningAudio(start: () => void | Promise<void>): Promise<void> {
    if (this.isScriptAudioDisabled()) {
      return;
    }
    try {
      await this.prepareForPlayback();
    } catch {
      return;
    }
    const ctx = this.audioContext();
    if (ctx && ctx.state !== 'running') {
      this.deferUntilRunning(ctx, this.deferredSfxStarts, () => {
        void Promise.resolve(start()).then(
          () => undefined,
          () => undefined,
        );
      });
      return;
    }
    if (ctx) {
      this.ensureKeepAlive(ctx);
    }
    try {
      await start();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[Benne] sound: playback failed.', err);
      }
    }
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

  /**
   * Resolves once playback has been started on a running audio device (not when the clip ends).
   * The script step can then continue in sync with the sound.
   */
  playSfx(id: string, options?: SoundPlayOptions): Promise<void> {
    if (!this.canStartSfx(id, 'play')) {
      return Promise.resolve();
    }
    const start = (): void => {
      this.spawnSfx(id, options);
    };
    // Do not hold the interaction queue on a device that is not running. The next step is
    // often B.room.changeTo, and that transition never starts if this promise stays pending.
    // The clip is deferred until the device wakes; the entrance fade already waits separately.
    if (!this.isAudioRunning()) {
      const ctx = this.audioContext();
      if (ctx) {
        this.deferUntilRunning(ctx, this.deferredSfxStarts, start);
        void this.prepareForPlayback();
      }
      return Promise.resolve();
    }
    return this.withRunningAudio(start);
  }

  /**
   * Returns a promise that resolves when the sound finishes or is stopped/destroyed.
   */
  playSfxAndWait(id: string, options?: SoundPlayOptions): Promise<void> {
    if (!this.canStartSfx(id, 'playAndWait')) {
      return Promise.resolve();
    }
    return this.withRunningAudio(() => {
      const sound = this.spawnSfx(id, options);
      return sound ? this.awaitSoundFinish(sound) : Promise.resolve();
    });
  }

  private canStartSfx(id: string, api: 'play' | 'playAndWait'): boolean {
    if (this.isScriptAudioDisabled() || !validateAudioId(id)) {
      return false;
    }
    const key = benneSfxCacheKey(id);
    if (!this.game.cache.audio.has(key)) {
      if (import.meta.env.DEV) {
        console.warn(
          `[Benne] B.sound.${api}: missing audio "${id}" (expected assets/audio/sfx/${id}.*).`,
        );
      }
      return false;
    }
    return true;
  }

  /** Creates and starts one SFX. Caller must already be on a running audio device. */
  private spawnSfx(id: string, options?: SoundPlayOptions): Phaser.Sound.BaseSound | null {
    const key = benneSfxCacheKey(id);
    if (!this.game.cache.audio.has(key)) {
      return null;
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
      try {
        if (this.game.sound.getAll(key).includes(sound)) {
          this.game.sound.remove(sound);
        }
      } catch {
        /* remove can throw if the node is already gone */
      }
    };
    sound.once(Phaser.Sound.Events.COMPLETE, cleanup);
    sound.once(Phaser.Sound.Events.DESTROY, cleanup);
    try {
      if (!sound.play()) {
        cleanup();
        return null;
      }
    } catch (err) {
      cleanup();
      if (import.meta.env.DEV) {
        console.warn(`[Benne] B.sound.play("${id}") failed.`, err);
      }
      return null;
    }
    return sound;
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
    return this.playMusicAsync(id, options);
  }

  private async playMusicAsync(id: string, options?: MusicPlayOptions): Promise<void> {
    if (this.isScriptAudioDisabled() || !validateAudioId(id)) {
      return;
    }
    const key = benneMusicCacheKey(id);
    if (!this.game.cache.audio.has(key)) {
      console.warn(
        `[Benne] B.sound.playMusic: missing audio "${id}" (expected assets/audio/music/${id}.*).`,
      );
      return;
    }

    await this.prepareForPlayback();
    const ctx = this.audioContext();
    if (ctx && ctx.state !== 'running') {
      this.deferUntilRunning(ctx, this.deferredMusicStarts, () => {
        void this.playMusicAsync(id, options);
      });
      return;
    }

    const fadeRaw = options?.fadeSeconds;
    const fadeSeconds =
      typeof fadeRaw === 'number' && Number.isFinite(fadeRaw) && fadeRaw > 0 ? fadeRaw : 0;

    if (fadeSeconds <= 0) {
      this.hardStopAllMusicTracks();
      try {
        const volume = this.effectiveMusicVolume(options);
        const loop = options?.loop !== false;
        const sound = this.game.sound.add(key, { volume, loop });
        this.musicSound = sound;
        const started = sound.play();
        if (!started) {
          throw new Error('play() returned false');
        }
        this.persistCurrentMusicId(id);
      } catch (err) {
        this.musicSound = null;
        const ctx = (this.game.sound as { context?: AudioContext }).context;
        console.warn(
          `[Benne] B.sound.playMusic: failed to start "${id}" (audio context ${ctx?.state ?? 'none'}).`,
          err,
        );
      }
      return;
    }

    await this.playMusicCrossfade(id, key, options, fadeSeconds);
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
      console.warn(`[Benne] B.sound.playMusic: failed to start crossfade for "${key}".`);
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
    this.cancelDeferred(this.deferredSfxStarts);
    if (this.isScriptAudioDisabled()) {
      return;
    }
    for (const sound of [...this.activeSfx]) {
      this.activeSfx.delete(sound);
      this.sfxAuthorBySound.delete(sound);
      this.stopAndRemoveSound(sound);
    }
  }

  stopAllVoice(): void {
    if (this.isScriptAudioDisabled()) {
      return;
    }
    for (const sound of [...this.activeVoice]) {
      this.activeVoice.delete(sound);
      this.stopAndRemoveSound(sound);
    }
  }

  /** `stop` / `remove` can throw if the buffer source is already gone. A room leave must still proceed. */
  private stopAndRemoveSound(sound: Phaser.Sound.BaseSound): void {
    try {
      sound.stop();
    } catch {
      /* ignore */
    }
    try {
      this.game.sound.remove(sound);
    } catch {
      /* ignore */
    }
  }

  stopMusic(): void {
    this.cancelDeferred(this.deferredMusicStarts);
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
    this.cancelDeferred(this.deferredSfxStarts);
    this.cancelDeferred(this.deferredMusicStarts);
    this.stopKeepAlive();
    this.stopAllSfx();
    this.stopAllVoice();
    this.stopMusic();
  }
}
