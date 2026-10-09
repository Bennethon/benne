/**
 * Dev/test-only engine hooks for automated playthroughs (`npm run test:playthrough`).
 *
 * Installed on `window.__BENNE_HOOKS__` by the game and BENNE Play entries in dev builds (or when
 * `VITE_BENNE_TEST_HOOKS=true`); production bundles never import this module.
 *
 * Every action goes through the same path as a real click: the hook emits a synthetic primary
 * pointer event on the game object the player would have clicked (prop sprite, hotspot zone,
 * character sprite, GUI button, inventory slot) or on the room's background input. Verb and item
 * selection are set on the {@link GameStateManager} exactly as the verb bar and inventory panel do.
 * Nothing here calls the scripting API, so the same tests run before and after the scripting port.
 */
import * as Phaser from 'phaser';
import { SCENE_ROOM } from '../content/constants';
import { getAllGuiData } from '../content/loadGuiData';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager';
import { BENNE_GUI_BUTTON_ID_DATA_KEY, benneGuiButtonReadEnabled, type BenneGuiButtonIdData } from '../gui/guiButtonRuntime';
import { isInteractionActivityRunning } from '../interaction/interactionActivity';
import { isRoomTransitionInProgress } from '../scenes/roomTransitionGlobals';
import type { RoomScene } from '../scenes/RoomScene';
import { dialogChoiceSyntheticButtonId } from '../events/dialogEvents';
import { resolveDefaultItemVerbId } from '../verbs/verbConfig';
import { getGameSettings } from '../ConfigManager';

/**
 * - `busy`: a transition, cutscene, script, walk or speech line is running.
 * - `world`: the player can click the room.
 * - `dialog`: a dialog's options are on screen, waiting for a choice.
 */
export type BenneTestPhase = 'busy' | 'world' | 'dialog';

export interface BenneTestState {
  room: string;
  phase: BenneTestPhase;
  /** Milliseconds the current {@link phase} has held without interruption. */
  phaseMs: number;
  /** Open dialog (choice list), if any. */
  dialog: string | null;
  flags: Record<string, unknown>;
  variables: Record<string, unknown>;
  /** Active player's inventory item ids, in panel order. */
  inventory: string[];
  activeVerb: string | null;
  activeItem: string | null;
  /** The character the player controls. */
  player: string;
}

export interface BenneTestHooks {
  state(): BenneTestState;
  /** Look at / take / talk to … `targetId` (prop, hotspot or character id in the current room). */
  verb(verbId: string, targetId: string): void;
  /** Walk to a prop/hotspot/character stand point, a room point id, a region (its centre), or room pixels. */
  walkTo(target: string | { x: number; y: number }): void;
  /** Use inventory `itemId` on a prop, hotspot or character in the current room (`verbId`: an item verb, default the use verb). */
  useItem(itemId: string, targetId: string, verbId?: string): void;
  /** Use inventory `itemId` on another inventory item (clicks that item's inventory slot). */
  combine(itemId: string, targetItemId: string, verbId?: string): void;
  /** Select `verbId` as the verb bar does (dropping any armed item), then click `itemId`'s inventory slot (e.g. Look at an item). */
  inventoryVerb(verbId: string, itemId: string): void;
  /** Pick a dialog option by its id in `*.dialog.json`. */
  choose(optionId: string): void;
  /** Click a GUI button by GUI id and control id. */
  clickGui(guiId: string, controlId: string): void;
  /** Left-click to skip the current speech line (or other click-to-skip). Returns false if nothing to skip. */
  skipLine(): boolean;
  /** Skip each click-to-skip line once it has been on screen for `minShowMs`. */
  setAutoSkip(enabled: boolean, minShowMs?: number): void;
  /** Visible prop state for assertions. */
  prop(propId: string): { visible: boolean; animation: string | null } | null;
  /**
   * Every speech line shown so far, oldest first: `[Player] text` for the active player, else
   * `[Character <id>] text`. Recorded where the line appears on screen, so it is the same for any
   * scripting API.
   */
  speech(): string[];
}

class HookError extends Error {
  override name = 'BenneHookError';
}

type Clickable = Phaser.GameObjects.GameObject & {
  visible?: boolean;
  alpha?: number;
  parentContainer?: Phaser.GameObjects.Container | null;
};

function syntheticPointer(scene: Phaser.Scene, x = 0, y = 0): Phaser.Input.Pointer {
  return {
    id: -1,
    x,
    y,
    worldX: x,
    worldY: y,
    button: 0,
    buttons: 1,
    isDown: true,
    camera: scene.cameras.main,
    event: null,
    leftButtonDown: () => true,
    rightButtonDown: () => false,
    middleButtonDown: () => false,
    leftButtonReleased: () => true,
    rightButtonReleased: () => false,
    middleButtonReleased: () => false,
  } as unknown as Phaser.Input.Pointer;
}

/** Visible and opaque all the way up its container chain, as a player would see it. */
function isShown(go: Clickable): boolean {
  for (let o: Clickable | null | undefined = go; o; o = o.parentContainer) {
    if (o.visible === false || (typeof o.alpha === 'number' && o.alpha <= 0)) {
      return false;
    }
  }
  return true;
}

function forEachGameObject(
  list: readonly Phaser.GameObjects.GameObject[],
  visit: (go: Phaser.GameObjects.GameObject) => void,
): void {
  for (const go of list) {
    visit(go);
    if (go instanceof Phaser.GameObjects.Container) {
      forEachGameObject(go.list, visit);
    }
  }
}

function polygonCentroid(points: ReadonlyArray<{ x: number; y: number }>): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

export function installBenneTestHooks(game: Phaser.Game): BenneTestHooks {
  let lastPhase: BenneTestPhase = 'busy';
  let phaseSince = performance.now();
  let autoSkip = false;
  let autoSkipMinShowMs = 250;
  let skipPendingSince: number | null = null;
  const speechLog: string[] = [];
  const speechWatched = new WeakSet<RoomScene>();

  /** Records each line `scene` puts in its speaking-text overlay. The scene instance is reused across rooms. */
  const watchSpeech = (scene: RoomScene): void => {
    if (speechWatched.has(scene)) {
      return;
    }
    speechWatched.add(scene);
    const show = scene.setDialogTextOverlay.bind(scene);
    scene.setDialogTextOverlay = (overlay) => {
      const speaker = overlay.talkCharacterDefinitionId;
      if (overlay.visible && overlay.text && speaker) {
        const who = speaker === scene.getActivePlayerCharacterId() ? 'Player' : `Character ${speaker}`;
        speechLog.push(`[${who}] ${overlay.text}`);
      }
      show(overlay);
    };
  };

  const room = (): RoomScene | null => {
    if (!game.scene.isActive(SCENE_ROOM)) {
      return null;
    }
    return game.scene.getScene(SCENE_ROOM) as RoomScene;
  };

  const requireRoom = (): RoomScene => {
    const scene = room();
    if (!scene) {
      throw new HookError('Room scene is not active.');
    }
    return scene;
  };

  const findGuiButton = (scene: RoomScene, guiId: string, controlId: string): Phaser.GameObjects.Container | null => {
    let found: Phaser.GameObjects.Container | null = null;
    forEachGameObject(scene.children.list, (go) => {
      const id = go.getData?.(BENNE_GUI_BUTTON_ID_DATA_KEY) as BenneGuiButtonIdData | undefined;
      if (id && id.guiId === guiId && id.controlId === controlId && isShown(go as Clickable)) {
        found = go as Phaser.GameObjects.Container;
      }
    });
    return found;
  };

  const findInventorySlot = (scene: RoomScene, itemId: string): Phaser.GameObjects.GameObject | null => {
    let found: Phaser.GameObjects.GameObject | null = null;
    forEachGameObject(scene.children.list, (go) => {
      if (go.getData?.('benneInventoryItemId') === itemId && isShown(go as Clickable) && go.input?.enabled) {
        found = go;
      }
    });
    return found;
  };

  const rawPhase = (): BenneTestPhase => {
    const scene = room();
    if (!scene || isRoomTransitionInProgress(game)) {
      return 'busy';
    }
    const s = scene.getInputStateForTesting();
    if (
      s.cutscene ||
      s.playerWalking ||
      isInteractionActivityRunning() ||
      scene.hasScriptedDialogClickToSkip()
    ) {
      return 'busy';
    }
    if (s.dialogChoice) {
      let optionsShown = false;
      forEachGameObject(scene.children.list, (go) => {
        const id = go.getData?.(BENNE_GUI_BUTTON_ID_DATA_KEY) as BenneGuiButtonIdData | undefined;
        if (id && id.guiId === s.dialogChoice!.guiId && id.controlId.startsWith('dc__') && isShown(go as Clickable)) {
          optionsShown = true;
        }
      });
      return optionsShown ? 'dialog' : 'busy';
    }
    return s.pointerBlocked ? 'busy' : 'world';
  };

  /** Recomputes the phase now (not only once per frame) so an action is never mistaken for idle. */
  const trackPhase = (): void => {
    const p = rawPhase();
    if (p !== lastPhase) {
      lastPhase = p;
      phaseSince = performance.now();
    }
  };

  const clickObject = (scene: RoomScene, go: Phaser.GameObjects.GameObject, what: string): void => {
    if (!isShown(go as Clickable) || !go.input?.enabled) {
      throw new HookError(`${what} is not clickable right now (hidden or not interactive).`);
    }
    go.emit('pointerdown', syntheticPointer(scene), 0, 0, { stopPropagation() {} });
  };

  const clickTarget = (scene: RoomScene, targetId: string): void => {
    const target = scene.getClickTargetObjectForTesting(targetId);
    if (!target) {
      throw new HookError(`No prop, hotspot or character "${targetId}" in room "${scene.getRoomDataForTesting().id}".`);
    }
    clickObject(scene, target.object, `${target.type} "${targetId}"`);
  };

  const clickButton = (scene: RoomScene, button: Phaser.GameObjects.Container): void => {
    const pointer = syntheticPointer(scene);
    button.emit('pointerdown', pointer, 0, 0, { stopPropagation() {} });
    button.emit('pointerup', pointer, 0, 0, { stopPropagation() {} });
  };

  /** Pages inventory panels with their back/forward buttons, as a player would, until `itemId` shows. */
  const pageInventoryTo = (scene: RoomScene, itemId: string): Phaser.GameObjects.GameObject | null => {
    for (const gui of getAllGuiData()) {
      for (const c of gui.controls ?? []) {
        if (c.type !== 'inventoryPanel') {
          continue;
        }
        for (const buttonId of [c.backButton, c.forwardButton]) {
          for (let i = 0; i < 50; i++) {
            const slot = findInventorySlot(scene, itemId);
            if (slot) {
              return slot;
            }
            const button = buttonId ? findGuiButton(scene, gui.id, buttonId) : null;
            if (!button || benneGuiButtonReadEnabled(button) === false) {
              break;
            }
            clickButton(scene, button);
          }
        }
      }
    }
    return findInventorySlot(scene, itemId);
  };

  /** Selects `verbId` (the default item verb) and `itemId`, as clicking Use and then the item in the inventory panel does. */
  const armItem = (itemId: string, verbId?: string): void => {
    const manager = resolveGameStateManager(game);
    if (!manager.getInventoryItems().some((i) => i.id === itemId)) {
      throw new HookError(`"${itemId}" is not in the inventory.`);
    }
    manager.setActiveVerb(verbId ?? resolveDefaultItemVerbId(getGameSettings()));
    manager.setActiveInventoryItem(itemId);
  };

  const requirePhase = (want: BenneTestPhase, action: string): void => {
    const p = rawPhase();
    if (p !== want) {
      throw new HookError(`${action}: game is "${p}", expected "${want}".`);
    }
  };

  const hooks: BenneTestHooks = {
    state() {
      trackPhase();
      const manager = resolveGameStateManager(game);
      const snapshot = manager.getSnapshot({ runFlushHooks: false });
      const scene = room();
      return {
        room: manager.getCurrentRoom(),
        phase: lastPhase,
        phaseMs: Math.round(performance.now() - phaseSince),
        dialog: scene?.getInputStateForTesting().dialogChoice?.dialogId ?? null,
        flags: { ...snapshot.flags },
        variables: { ...snapshot.variables },
        inventory: manager.getInventoryItems().map((i) => i.id),
        activeVerb: manager.getActiveVerb(),
        activeItem: manager.getActiveInventoryItemId(),
        player: manager.getActivePlayerCharacterId(),
      };
    },

    verb(verbId, targetId) {
      requirePhase('world', `verb ${verbId} ${targetId}`);
      const scene = requireRoom();
      const manager = resolveGameStateManager(game);
      manager.clearActiveInventoryItem();
      manager.setActiveVerb(verbId);
      clickTarget(scene, targetId);
    },

    walkTo(target) {
      requirePhase('world', `walkTo ${JSON.stringify(target)}`);
      const scene = requireRoom();
      const manager = resolveGameStateManager(game);
      manager.clearActiveInventoryItem();
      manager.clearActiveVerb();
      let point: { x: number; y: number } | null = typeof target === 'string' ? null : target;
      if (typeof target === 'string') {
        if (scene.getClickTargetObjectForTesting(target)) {
          clickTarget(scene, target);
          return;
        }
        const data = scene.getRoomDataForTesting();
        const named = data.points?.find((p) => p.id === target);
        const region = data.regions?.find((r) => r.id === target);
        point = named ? { x: named.x, y: named.y } : region ? polygonCentroid(region.points) : null;
        if (!point) {
          throw new HookError(`No target, point or region "${target}" in room "${data.id}".`);
        }
      }
      // Room pixels → canvas pixels for the main camera (inverse of `getWorldPoint`, no rotation).
      const cam = scene.cameras.main;
      const o = cam.getWorldPoint(0, 0);
      const u = cam.getWorldPoint(1, 1);
      const sx = (point!.x - o.x) / (u.x - o.x);
      const sy = (point!.y - o.y) / (u.y - o.y);
      scene.input.emit('pointerdown', syntheticPointer(scene, sx, sy), []);
    },

    useItem(itemId, targetId, verbId) {
      requirePhase('world', `useItem ${itemId} ${targetId}`);
      const scene = requireRoom();
      armItem(itemId, verbId);
      clickTarget(scene, targetId);
    },

    combine(itemId, targetItemId, verbId) {
      requirePhase('world', `combine ${itemId} ${targetItemId}`);
      const scene = requireRoom();
      const slot = pageInventoryTo(scene, targetItemId);
      if (!slot) {
        throw new HookError(`combine: "${targetItemId}" is not in the inventory panel.`);
      }
      armItem(itemId, verbId);
      clickObject(scene, slot, `inventory slot "${targetItemId}"`);
    },

    inventoryVerb(verbId, itemId) {
      requirePhase('world', `inventoryVerb ${verbId} ${itemId}`);
      const scene = requireRoom();
      const slot = pageInventoryTo(scene, itemId);
      if (!slot) {
        throw new HookError(`inventoryVerb: "${itemId}" is not in the inventory panel.`);
      }
      const manager = resolveGameStateManager(game);
      manager.clearActiveInventoryItem();
      manager.setActiveVerb(verbId);
      clickObject(scene, slot, `inventory slot "${itemId}"`);
    },

    choose(optionId) {
      requirePhase('dialog', `choose ${optionId}`);
      const scene = requireRoom();
      const session = scene.getInputStateForTesting().dialogChoice!;
      const buttonId = dialogChoiceSyntheticButtonId(optionId);
      // Long option lists scroll; page through like a player would until the option is on screen.
      for (const direction of ['scrollUp', 'scrollDown']) {
        for (let i = 0; i < 20; i++) {
          const button = findGuiButton(scene, session.guiId, buttonId);
          if (button) {
            if (benneGuiButtonReadEnabled(button) === false) {
              throw new HookError(`choose: option "${optionId}" is disabled.`);
            }
            clickButton(scene, button);
            return;
          }
          const scroll = findGuiButton(scene, session.guiId, direction);
          if (!scroll || benneGuiButtonReadEnabled(scroll) === false) {
            break;
          }
          clickButton(scene, scroll);
        }
      }
      throw new HookError(`choose: option "${optionId}" is not offered in dialog "${session.dialogId}".`);
    },

    clickGui(guiId, controlId) {
      const scene = requireRoom();
      const button = findGuiButton(scene, guiId, controlId);
      if (!button) {
        throw new HookError(`clickGui: no visible button "${controlId}" in GUI "${guiId}".`);
      }
      if (benneGuiButtonReadEnabled(button) === false) {
        throw new HookError(`clickGui: button "${controlId}" in GUI "${guiId}" is disabled.`);
      }
      clickButton(scene, button);
    },

    skipLine() {
      const scene = room();
      if (!scene || !scene.hasScriptedDialogClickToSkip()) {
        return false;
      }
      scene.input.emit('pointerdown', syntheticPointer(scene), []);
      return true;
    },

    setAutoSkip(enabled, minShowMs = 250) {
      autoSkip = enabled;
      autoSkipMinShowMs = minShowMs;
      skipPendingSince = null;
    },

    prop(propId) {
      const scene = room();
      const target = scene?.getClickTargetObjectForTesting(propId);
      if (!target || target.type !== 'prop') {
        return null;
      }
      const sprite = target.object as Phaser.GameObjects.Sprite;
      return { visible: sprite.visible, animation: sprite.anims?.currentAnim?.key ?? null };
    },

    speech() {
      return [...speechLog];
    },
  };

  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    const now = performance.now();
    trackPhase();
    const scene = room();
    if (scene) {
      watchSpeech(scene);
    }
    if (!autoSkip || !scene || !scene.hasScriptedDialogClickToSkip()) {
      skipPendingSince = null;
      return;
    }
    skipPendingSince ??= now;
    if (now - skipPendingSince >= autoSkipMinShowMs) {
      skipPendingSince = null;
      hooks.skipLine();
    }
  });

  (window as unknown as { __BENNE_HOOKS__?: BenneTestHooks }).__BENNE_HOOKS__ = hooks;
  return hooks;
}
