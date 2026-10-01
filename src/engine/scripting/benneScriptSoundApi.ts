import { getGameSettings } from '../ConfigManager.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import {
  readPersistedMusicSessionVolume,
  readPersistedSfxSessionVolume,
  writePersistedMusicSessionVolume,
  writePersistedSfxSessionVolume,
} from '../sound/audioGameState.js';
import { tryGetBenneSoundManager } from '../sound/benneSoundRegistry.js';
import type { MusicPlayOptions, SoundPlayOptions } from '../sound/benneSoundTypes.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { withNow } from './BenneScriptCore.js';
import type { BenneScriptSoundFacade } from './benneScriptFacades.js';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function resolveSoundManager() {
  const g = tryGetActiveBenneGame();
  return g ? tryGetBenneSoundManager(g) : null;
}

export function createBenneScriptSoundFacade(
  chain: (factory: () => Promise<unknown>) => void,
  getRoomScene: () => RoomScene | undefined,
): BenneScriptSoundFacade {
  /** True while an ESC cutscene skip is fast-forwarding the queue (see `RoomScene`). */
  const isSkipping = (): boolean => getRoomScene()?.isCutsceneSkipFastForwarding() === true;

  return {
    play: withNow(
      (key: string, options?: SoundPlayOptions) => {
        chain(() => {
          // One-shot SFX leave no lasting state, so a skipped cutscene does not fire them off.
          // Await start so the next step (a door animation, a line) does not run ahead of a
          // device that is still opening — that is what made entrance stings land seconds late.
          // A rejection must not drop the following step: B.room.changeTo is often that step.
          if (isSkipping()) {
            return Promise.resolve();
          }
          const playback = resolveSoundManager()?.playSfx(key, options) ?? Promise.resolve();
          return Promise.resolve(playback).then(
            () => undefined,
            (err: unknown) => {
              if (import.meta.env.DEV) {
                console.warn(`[Benne] B.sound.play("${key}") failed.`, err);
              }
            },
          );
        });
      },
      (key: string, options?: SoundPlayOptions) => {
        void resolveSoundManager()?.playSfx(key, options);
      },
    ),
    playAndWait: withNow(
      (key: string, options?: SoundPlayOptions) => {
        const sm = resolveSoundManager();
        if (!sm) {
          return;
        }
        chain(() => {
          if (isSkipping()) {
            return Promise.resolve();
          }
          return sm.playSfxAndWait(key, options).then(
            () => undefined,
            (err: unknown) => {
              if (import.meta.env.DEV) {
                console.warn(`[Benne] B.sound.playAndWait("${key}") failed.`, err);
              }
            },
          );
        });
      },
      (key: string, options?: SoundPlayOptions) => {
        void resolveSoundManager()?.playSfxAndWait(key, options);
      },
    ),
    playMusic: withNow(
      (key: string, options?: MusicPlayOptions) => {
        chain(() => {
          try {
            const sm = resolveSoundManager();
            if (!sm) {
              return Promise.resolve();
            }
            // Music is lasting state, so a skip still switches tracks — just without the crossfade.
            const playback = isSkipping()
              ? sm.playMusic(key, { ...options, fadeSeconds: 0 })
              : sm.playMusic(key, options);
            return Promise.resolve(playback).then(
              () => undefined,
              (err: unknown) => {
                if (import.meta.env.DEV) {
                  console.warn(`[Benne] B.sound.playMusic("${key}") failed.`, err);
                }
              },
            );
          } catch (err) {
            if (import.meta.env.DEV) {
              console.warn(`[Benne] B.sound.playMusic("${key}") failed.`, err);
            }
            return Promise.resolve();
          }
        });
      },
      (key: string, options?: MusicPlayOptions) => {
        resolveSoundManager()?.playMusic(key, options);
      },
    ),
    stop: withNow(
      (key?: string) => {
        chain(() => {
          resolveSoundManager()?.stopSfx(key);
          return Promise.resolve();
        });
      },
      (key?: string) => {
        resolveSoundManager()?.stopSfx(key);
      },
    ),
    stopMusic: withNow(
      () => {
        chain(() => {
          resolveSoundManager()?.stopMusic();
          return Promise.resolve();
        });
      },
      () => {
        resolveSoundManager()?.stopMusic();
      },
    ),
    setSfxVolume(volume: number): void {
      const v = clamp01(volume);
      resolveSoundManager()?.setSfxSessionVolume(v);
      const mgr = tryGetActiveGameStateManager();
      if (mgr) {
        writePersistedSfxSessionVolume(mgr, v);
      }
    },
    setMusicVolume(volume: number): void {
      const v = clamp01(volume);
      resolveSoundManager()?.setMusicSessionVolume(v);
      const mgr = tryGetActiveGameStateManager();
      if (mgr) {
        writePersistedMusicSessionVolume(mgr, v);
      }
    },
    getSfxVolume(): number {
      const sm = resolveSoundManager();
      if (sm) {
        return sm.getSfxSessionVolume();
      }
      const mgr = tryGetActiveGameStateManager();
      return mgr ? readPersistedSfxSessionVolume(mgr) : clamp01(getGameSettings().audio.sfxVolume);
    },
    getMusicVolume(): number {
      const sm = resolveSoundManager();
      if (sm) {
        return sm.getMusicSessionVolume();
      }
      const mgr = tryGetActiveGameStateManager();
      return mgr ? readPersistedMusicSessionVolume(mgr) : clamp01(getGameSettings().audio.musicVolume);
    },
    isPlaying(key: string): boolean {
      return resolveSoundManager()?.isSfxPlaying(key) ?? false;
    },
    isMusicPlaying(): boolean {
      return resolveSoundManager()?.isMusicPlaying() ?? false;
    },
  };
}
