import type { ResolvableTargetId } from '../../types/generated/benne-game-ids.js';
import type { Point2 } from '../../types/room.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { withNow } from './BenneScriptCore.js';
import type { BenneScriptCameraFacade } from './benneScriptFacades.js';

let warnedNoRoomScene = false;

function warnNoRoomScene(): void {
  if (!import.meta.env.DEV || warnedNoRoomScene) {
    return;
  }
  warnedNoRoomScene = true;
  console.warn('[Benne] B.camera used while RoomScene is not active — ignored.');
}

export function createBenneScriptCameraFacade(
  chain: (factory: () => Promise<unknown>) => void,
  getRoomScene: () => RoomScene | undefined,
): BenneScriptCameraFacade {
  const resolveScene = (): RoomScene | undefined => {
    const scene = getRoomScene();
    if (!scene) {
      warnNoRoomScene();
    }
    return scene;
  };

  return {
    focus: withNow(
      (target: Point2 | ResolvableTargetId, transitionSeconds?: number) => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        chain(() => scene.queueCameraFocus(target, transitionSeconds));
      },
      (target: Point2 | ResolvableTargetId, transitionSeconds?: number) => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        void scene.queueCameraFocus(target, transitionSeconds);
      },
    ),
    reset: withNow(
      (transitionSeconds?: number) => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        chain(() => scene.queueCameraReset(transitionSeconds));
      },
      (transitionSeconds?: number) => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        void scene.queueCameraReset(transitionSeconds);
      },
    ),
    setZoom: withNow(
      (zoom: number, transitionSeconds?: number) => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        chain(() => scene.queueCameraSetZoom(zoom, transitionSeconds));
      },
      (zoom: number, transitionSeconds?: number) => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        void scene.queueCameraSetZoom(zoom, transitionSeconds);
      },
    ),
    resetZoom: withNow(
      (transitionSeconds?: number) => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        chain(() => scene.queueCameraResetZoom(transitionSeconds));
      },
      (transitionSeconds?: number) => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        void scene.queueCameraResetZoom(transitionSeconds);
      },
    ),
    zoomTo: withNow(
      (target: Point2 | ResolvableTargetId, zoom: number, transitionSeconds?: number) => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        chain(() => scene.queueCameraZoomTo(target, zoom, transitionSeconds));
      },
      (target: Point2 | ResolvableTargetId, zoom: number, transitionSeconds?: number) => {
        const scene = resolveScene();
        if (!scene) {
          return;
        }
        void scene.queueCameraZoomTo(target, zoom, transitionSeconds);
      },
    ),
    shake(intensity?: number, durationSeconds?: number, falloff?: boolean): void {
      const scene = resolveScene();
      if (!scene) {
        return;
      }
      scene.cameraShake(intensity, durationSeconds, falloff);
    },
  };
}
