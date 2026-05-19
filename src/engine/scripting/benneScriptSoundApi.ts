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
): BenneScriptSoundFacade {
  return {
    play: withNow(
      (key: string, options?: SoundPlayOptions) => {
        chain(() => {
          resolveSoundManager()?.playSfx(key, options);
          return Promise.resolve();
        });
      },
      (key: string, options?: SoundPlayOptions) => {
        resolveSoundManager()?.playSfx(key, options);
      },
    ),
    playAndWait: withNow(
      (key: string, options?: SoundPlayOptions) => {
        const sm = resolveSoundManager();
        if (!sm) {
          return;
        }
        chain(() => sm.playSfxAndWait(key, options));
      },
      (key: string, options?: SoundPlayOptions) => {
        void resolveSoundManager()?.playSfxAndWait(key, options);
      },
    ),
    playMusic: withNow(
      (key: string, options?: MusicPlayOptions) => {
        chain(() => resolveSoundManager()?.playMusic(key, options) ?? Promise.resolve());
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
