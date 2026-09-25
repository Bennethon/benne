import type { HotspotId, PropId, RegionId, WalkableId } from '../../types/generated/benne-game-ids.js';
import type { Point2 } from '../../types/room.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { withNow } from './BenneScriptCore.js';
import type {
  BenneScriptHotspotFacade,
  BenneScriptPropFacade,
  BenneScriptRegionActiveFacade,
  BenneScriptSoundFacade,
  BenneScriptVideoFacade,
  BenneScriptWalkableActiveFacade,
} from './benneScriptFacades.js';

/** Resolves the room the script is acting on. Looked up when each operation runs. */
export type RoomEntitySceneResolver = () => RoomScene | undefined;

type ChainFn = (factory: () => Promise<unknown>) => void;

let warnedRoomEntityNoScene = false;

function warnRoomEntityNoScene(): void {
  if (import.meta.env.DEV && !warnedRoomEntityNoScene) {
    warnedRoomEntityNoScene = true;
    console.warn(
      '[Benne] B.prop / B.hotspot / B.region / B.walkable used while RoomScene is not active — ignored.',
    );
  }
}

function resolveRoomEntityScene(getScene: RoomEntitySceneResolver): RoomScene | undefined {
  const scene = getScene();
  if (!scene) {
    warnRoomEntityNoScene();
    return undefined;
  }
  return scene;
}

const noopHotspotFacade: BenneScriptHotspotFacade = {
  get active() {
    return true;
  },
  set active(_v: boolean) {},
  get clickable() {
    return true;
  },
  set clickable(_v: boolean) {},
  get description() {
    return '';
  },
  set description(_v: string) {},
};

const noopRegionActiveFacade: BenneScriptRegionActiveFacade = {
  get active() {
    return true;
  },
  set active(_v: boolean) {},
};

const noopWalkableActiveFacade: BenneScriptWalkableActiveFacade = {
  get active() {
    return true;
  },
  set active(_v: boolean) {},
};

/**
 * `B.prop(id)` for room scripts and dialog sessions. Queued members use `chain`; each call
 * resolves `RoomScene` when it runs. Missing scene: DEV warn once, then no-op.
 */
export function createBenneScriptPropFacade(
  propId: PropId,
  getScene: RoomEntitySceneResolver,
  chain: ChainFn,
  sound: BenneScriptSoundFacade,
  video: BenneScriptVideoFacade,
): BenneScriptPropFacade {
  return {
    sound,
    video,
    hide: withNow(
      () => {
        chain(() => {
          resolveRoomEntityScene(getScene)?.setPropScriptVisible(propId, false);
          return Promise.resolve();
        });
      },
      () => {
        resolveRoomEntityScene(getScene)?.setPropScriptVisible(propId, false);
      },
    ),
    show: withNow(
      () => {
        chain(() => {
          resolveRoomEntityScene(getScene)?.setPropScriptVisible(propId, true);
          return Promise.resolve();
        });
      },
      () => {
        resolveRoomEntityScene(getScene)?.setPropScriptVisible(propId, true);
      },
    ),
    get visible() {
      return resolveRoomEntityScene(getScene)?.getPropScriptVisible(propId) ?? false;
    },
    set visible(v: boolean) {
      chain(() => {
        resolveRoomEntityScene(getScene)?.setPropScriptVisible(propId, v);
        return Promise.resolve();
      });
    },
    visibleNow(v: boolean): void {
      resolveRoomEntityScene(getScene)?.setPropScriptVisible(propId, v);
    },
    get clickable() {
      return resolveRoomEntityScene(getScene)?.getPropScriptClickable(propId) ?? false;
    },
    set clickable(v: boolean) {
      chain(() => {
        resolveRoomEntityScene(getScene)?.setPropScriptClickable(propId, v);
        return Promise.resolve();
      });
    },
    get description() {
      return resolveRoomEntityScene(getScene)?.getPropScriptDescription(propId) ?? '';
    },
    set description(v: string) {
      resolveRoomEntityScene(getScene)?.setPropScriptDescription(propId, v);
    },
    get animation() {
      return resolveRoomEntityScene(getScene)?.getPropScriptBaseAnimationTag(propId) ?? '';
    },
    set animation(tag: string) {
      chain(() => {
        resolveRoomEntityScene(getScene)?.setPropScriptBaseAnimationTag(propId, tag);
        return Promise.resolve();
      });
    },
    animationNow(tag: string): void {
      resolveRoomEntityScene(getScene)?.setPropScriptBaseAnimationTag(propId, tag);
    },
    playAnimation: withNow(
      (tag: string) => {
        chain(() => {
          const scene = resolveRoomEntityScene(getScene);
          if (!scene) {
            return Promise.resolve();
          }
          return scene.playPropScriptAnimationOneShot(propId, tag);
        });
      },
      (tag: string) => {
        const scene = resolveRoomEntityScene(getScene);
        if (!scene) {
          return;
        }
        void scene.playPropScriptAnimationOneShot(propId, tag);
      },
    ),
    fade: withNow(
      (fromAlpha: number, toAlpha: number, durationSeconds: number) => {
        chain(() => {
          const scene = resolveRoomEntityScene(getScene);
          if (!scene) {
            return Promise.resolve();
          }
          return scene.fadePropScriptAlpha(propId, fromAlpha, toAlpha, durationSeconds);
        });
      },
      (fromAlpha: number, toAlpha: number, durationSeconds: number) => {
        const scene = resolveRoomEntityScene(getScene);
        if (!scene) {
          return;
        }
        void scene.fadePropScriptAlpha(propId, fromAlpha, toAlpha, durationSeconds);
      },
    ),
    moveTo: withNow(
      (point: Point2) => {
        chain(() => {
          resolveRoomEntityScene(getScene)?.movePropToNow(propId, point);
          return Promise.resolve();
        });
      },
      (point: Point2) => {
        resolveRoomEntityScene(getScene)?.movePropToNow(propId, point);
      },
    ),
    moveToNow(point: Point2): void {
      resolveRoomEntityScene(getScene)?.movePropToNow(propId, point);
    },
  };
}

/**
 * `B.hotspot(id)` for room scripts and dialog sessions. Getters and setters are immediate.
 * Empty id: DEV warn and a no-op facade. Missing scene: DEV warn once, then no-op.
 */
export function createBenneScriptHotspotFacade(
  hotspotId: HotspotId,
  getScene: RoomEntitySceneResolver,
): BenneScriptHotspotFacade {
  const hid = String(hotspotId).trim();
  if (hid.length === 0) {
    if (import.meta.env.DEV) {
      console.warn('[Benne] B.hotspot: hotspot id must be a non-empty string.');
    }
    return noopHotspotFacade;
  }
  return {
    get active() {
      return resolveRoomEntityScene(getScene)?.getHotspotScriptActive(hid) ?? false;
    },
    set active(v: boolean) {
      resolveRoomEntityScene(getScene)?.setHotspotScriptActive(hid, v);
    },
    get clickable() {
      return resolveRoomEntityScene(getScene)?.getHotspotScriptActive(hid) ?? false;
    },
    set clickable(v: boolean) {
      resolveRoomEntityScene(getScene)?.setHotspotScriptActive(hid, v);
    },
    get description() {
      return resolveRoomEntityScene(getScene)?.getHotspotScriptDescription(hid) ?? '';
    },
    set description(v: string) {
      resolveRoomEntityScene(getScene)?.setHotspotScriptDescription(hid, v);
    },
  };
}

/**
 * `B.region(id).active` for room scripts and dialog sessions. Immediate (not queued).
 * Empty id: DEV warn and a no-op facade. Missing scene: DEV warn once, then no-op.
 * Enter / exit hooks stay on the room script.
 */
export function createBenneScriptRegionActiveFacade(
  regionId: RegionId,
  getScene: RoomEntitySceneResolver,
): BenneScriptRegionActiveFacade {
  const rid = String(regionId).trim();
  if (rid.length === 0) {
    if (import.meta.env.DEV) {
      console.warn('[Benne] B.region: region id must be a non-empty string.');
    }
    return noopRegionActiveFacade;
  }
  return {
    get active() {
      return resolveRoomEntityScene(getScene)?.getRegionScriptActive(rid) ?? false;
    },
    set active(v: boolean) {
      resolveRoomEntityScene(getScene)?.setRegionScriptActive(rid, v);
    },
  };
}

/**
 * `B.walkable(id).active` for room scripts and dialog sessions. Immediate (not queued).
 * Empty id: DEV warn and a no-op facade. Missing scene: DEV warn once, then no-op.
 */
export function createBenneScriptWalkableActiveFacade(
  walkableId: WalkableId,
  getScene: RoomEntitySceneResolver,
): BenneScriptWalkableActiveFacade {
  const wid = String(walkableId).trim();
  if (wid.length === 0) {
    if (import.meta.env.DEV) {
      console.warn('[Benne] B.walkable: walkable id must be a non-empty string.');
    }
    return noopWalkableActiveFacade;
  }
  return {
    get active() {
      return resolveRoomEntityScene(getScene)?.getWalkableScriptActive(wid) ?? false;
    },
    set active(v: boolean) {
      resolveRoomEntityScene(getScene)?.setWalkableScriptActive(wid, v);
    },
  };
}
