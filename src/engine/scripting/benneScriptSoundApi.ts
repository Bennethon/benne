import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import { tryGetBenneSoundManager } from '../sound/benneSoundRegistry.js';
import type { MusicPlayOptions, SoundPlayOptions } from '../sound/benneSoundTypes.js';
import { withNow } from './BenneScriptCore.js';
import type { BenneScriptSoundFacade } from './benneScriptFacades.js';

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
      resolveSoundManager()?.setSfxSessionVolume(volume);
    },
    setMusicVolume(volume: number): void {
      resolveSoundManager()?.setMusicSessionVolume(volume);
    },
    isPlaying(key: string): boolean {
      return resolveSoundManager()?.isSfxPlaying(key) ?? false;
    },
    isMusicPlaying(): boolean {
      return resolveSoundManager()?.isMusicPlaying() ?? false;
    },
  };
}
