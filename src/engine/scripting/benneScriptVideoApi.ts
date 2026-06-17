import type { VideoId } from '../../types/generated/benne-game-ids.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import type { VideoPlayOptions } from '../video/benneVideoTypes.js';
import { withNow } from './BenneScriptCore.js';
import type { BenneScriptVideoFacade } from './benneScriptFacades.js';

let warnedNoRoomScene = false;

function warnNoRoomScene(): void {
  if (!import.meta.env.DEV || warnedNoRoomScene) {
    return;
  }
  warnedNoRoomScene = true;
  console.warn('[Benne] B.video used while RoomScene is not active — ignored.');
}

/**
 * Builds the shared `B.video` facade. Playback lives in {@link RoomScene} (created above room art,
 * below every GUI overlay); this facade only resolves the active room and queues calls. Mirrors
 * {@link import('./benneScriptSoundApi.js').createBenneScriptSoundFacade} (blocking vs `.now`) but uses
 * the `B.camera`-style RoomScene resolution + DEV warn-once. `play` starts playback and resolves
 * immediately so the script chain keeps running concurrently; `playAndWait` blocks until the video ends.
 * Active playback suppresses input in RoomScene; `VideoPlayOptions.clickToSkip` only controls whether
 * primary clicks also stop the active video.
 */
export function createBenneScriptVideoFacade(
  chain: (factory: () => Promise<unknown>) => void,
  getRoomScene: () => RoomScene | undefined,
): BenneScriptVideoFacade {
  const resolveScene = (): RoomScene | undefined => {
    const scene = getRoomScene();
    if (!scene) {
      warnNoRoomScene();
    }
    return scene;
  };

  return {
    play: withNow(
      (key: VideoId, options?: VideoPlayOptions) => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        chain(() => {
          scene.startRoomVideo(key, options);
          return Promise.resolve();
        });
      },
      (key: VideoId, options?: VideoPlayOptions) => {
        resolveScene()?.startRoomVideo(key, options);
      },
    ),
    playAndWait: withNow(
      (key: VideoId, options?: VideoPlayOptions) => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        chain(() => scene.startRoomVideo(key, options).whenComplete);
      },
      (key: VideoId, options?: VideoPlayOptions) => {
        void resolveScene()?.startRoomVideo(key, options).whenComplete;
      },
    ),
    pause: withNow(
      () => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        chain(() => {
          scene.pauseRoomVideo();
          return Promise.resolve();
        });
      },
      () => {
        resolveScene()?.pauseRoomVideo();
      },
    ),
    resume: withNow(
      () => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        chain(() => {
          scene.resumeRoomVideo();
          return Promise.resolve();
        });
      },
      () => {
        resolveScene()?.resumeRoomVideo();
      },
    ),
    stop: withNow(
      () => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        chain(() => {
          scene.stopRoomVideo();
          return Promise.resolve();
        });
      },
      () => {
        resolveScene()?.stopRoomVideo();
      },
    ),
    seek: withNow(
      (seconds: number) => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        chain(() => {
          scene.seekRoomVideo(seconds);
          return Promise.resolve();
        });
      },
      (seconds: number) => {
        resolveScene()?.seekRoomVideo(seconds);
      },
    ),
    isPlaying(): boolean {
      return getRoomScene()?.isRoomVideoPlaying() ?? false;
    },
  };
}
