import type * as Phaser from 'phaser';
import type { GuiId } from '../../types/generated/benne-game-ids.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { withNow, type BlockingWithNow } from './BenneScriptCore.js';
import type { BenneScriptGuiOverlayRef } from './benneScriptFacades.js';
import {
  createBenneNoopGuiControlFacade,
  createDetachedBenneNoopGuiControlFacade,
  type BenneScriptControlBinding,
  type BenneScriptControlBindingTarget,
  type ControlFacade,
  type GuiRuntime,
} from './GuiRuntime.js';
import { getGuiBenneScript } from './registerGuiScript.js';
import { notifyGuiVisibility } from '../bennescript/guis.js';

type ChainFn = (factory: () => Promise<unknown>) => void;

/**
 * Shared **`B.gui(id)`** accessor for GUI scripts and room scripts.
 * **`queueVisibility`** selects whether **`show` / `hide`** wait on the caller’s interaction tail.
 */
export interface BenneScriptGuiOverlayAccessorOptions {
  /**
   * When **`true`** (room scripts), **`show` / `hide`** append to {@link chain} and **`.now`** applies immediately.
   * When **`false`** (GUI scripts), both the call and **`.now`** apply immediately.
   */
  queueVisibility: boolean;
  chain: ChainFn;
  resolveRoomScene: () => RoomScene | null;
  /** Scene for an inert control facade when the overlay runtime has no scene of its own. */
  resolveScene: (rt: GuiRuntime | null | undefined, room: RoomScene | null) => Phaser.Scene | null;
  subscribe: (event: string, handler: (payload: unknown) => void) => void;
  subscribeImmediate: (event: string, handler: (payload: unknown) => void) => void;
}

function applyOverlayVisible(overlayGuiId: string, visible: boolean, room: RoomScene | null): void {
  const handle = room?.tryGetGuiOverlayHandle(overlayGuiId);
  if (!handle) {
    if (import.meta.env.DEV) {
      console.warn(
        `[Benne] B.gui("${overlayGuiId}").${visible ? 'show' : 'hide'}(): overlay not found in active room — no-op.`,
      );
    }
    return;
  }
  handle.setVisible(visible);
  const targetScript = getGuiBenneScript(overlayGuiId);
  const rt = room?.tryGetGuiRuntime(overlayGuiId);
  if (targetScript && rt) {
    if (visible) {
      targetScript.notifyGuiShown(rt);
    } else {
      targetScript.notifyGuiHidden(rt);
    }
  }
  notifyGuiVisibility(overlayGuiId, visible);
}

function makeVisibilityAction(
  visible: boolean,
  overlayGuiId: string,
  options: BenneScriptGuiOverlayAccessorOptions,
): BlockingWithNow<[]> {
  const immediate = (): void => {
    applyOverlayVisible(overlayGuiId, visible, options.resolveRoomScene());
  };
  if (!options.queueVisibility) {
    return withNow(immediate, immediate);
  }
  return withNow(
    () => {
      options.chain(() => {
        immediate();
        return Promise.resolve();
      });
    },
    immediate,
  );
}

/**
 * Address one built GUI overlay by **`*.gui.json` `id`** (`show` / `hide` / `control`).
 */
export function createBenneScriptGuiOverlayRef(
  overlayGuiId: GuiId,
  options: BenneScriptGuiOverlayAccessorOptions,
): BenneScriptGuiOverlayRef {
  const gid = String(overlayGuiId).trim();
  const bindingFor = (controlId: string): BenneScriptControlBinding => ({
    guiId: gid,
    controlId,
    subscribe: (event, handler) => {
      options.subscribe(event, (payload) => {
        handler(payload);
      });
    },
    subscribeImmediate: (event, handler) => {
      options.subscribeImmediate(event, (payload) => {
        handler(payload);
      });
    },
  });

  return {
    control(controlId: string): ControlFacade {
      const id = controlId.trim();
      const queue = (factory: () => Promise<unknown>) => options.chain(factory);
      const room = options.resolveRoomScene();
      const rt = room?.tryGetGuiRuntime(gid);
      const scene = options.resolveScene(rt, room);
      const binding = id ? bindingFor(id) : null;
      const attachBinding = (facade: BenneScriptControlBindingTarget): void => {
        if (binding) {
          facade.attachScriptBinding(binding);
        }
      };
      if (!scene) {
        const detached = createDetachedBenneNoopGuiControlFacade(queue);
        attachBinding(detached);
        return detached;
      }
      if (!id) {
        return createBenneNoopGuiControlFacade(scene, queue);
      }
      const resolved =
        rt?.createControlFacade(id, queue) ?? createBenneNoopGuiControlFacade(scene, queue);
      attachBinding(resolved);
      return resolved;
    },
    show: makeVisibilityAction(true, gid, options),
    hide: makeVisibilityAction(false, gid, options),
  };
}
