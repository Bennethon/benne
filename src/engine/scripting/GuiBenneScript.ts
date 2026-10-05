import * as Phaser from 'phaser';
import {
  guiAllButtonsClickEventId,
  guiButtonClickEventId,
  type GuiAllButtonsClickPayload,
} from '../events/guiButtonEvents.js';
import {
  guiCheckboxCheckEventId,
  guiCheckboxUncheckEventId,
} from '../events/guiCheckboxEvents.js';
import {
  guiControlMouseEnterEventId,
  guiControlMouseLeaveEventId,
} from '../events/guiControlHoverEvents.js';
import type { DialogId, GuiId } from '../../types/generated/benne-game-ids.js';
import { SCENE_ROOM } from '../../game/boot/constants.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { BenneScriptCore } from './BenneScriptCore.js';
import type { BenneScriptDialogCommandSurface, BenneScriptGuiOverlayRef } from './benneScriptFacades.js';
import {
  createLazyBenneScriptGameStateNamespace,
  createLazyBenneScriptInventoryNamespace,
  type BenneScriptGameStateNamespace,
  type BenneScriptInventoryNamespace,
} from './benneScriptGameStateApi.js';
import { createBenneScriptGuiOverlayRef } from './benneScriptGuiApi.js';
import type { GuiRuntime } from './GuiRuntime.js';
import {
  createBenneScriptDialogAccessor,
  createNoopDialogCommandSurface,
} from './DialogBenneScript.js';
import type { RoomScene } from '../scenes/RoomScene.js';

/**
 * Bennescript facade for `*.gui.ts`: GUI-scoped channels (button clicks, pointer hover per control), `raw`, and `wait`.
 * Handlers run through the same interaction queue as room / character scripts.
 */
export class GuiBenneScript extends BenneScriptCore {
  private readonly guiId: string;
  /** Resolves the game lazily — `registerGuiScript` runs before `createBenneGame`. */
  readonly dialog: (dialogId: DialogId) => BenneScriptDialogCommandSurface;
  readonly state: BenneScriptGameStateNamespace;
  readonly inventory: BenneScriptInventoryNamespace;
  private readonly onGuiBuiltHandlers: Array<(gui: GuiRuntime) => void> = [];
  private readonly onGuiShowHandlers: Array<(gui: GuiRuntime) => void> = [];
  private readonly onGuiHideHandlers: Array<(gui: GuiRuntime) => void> = [];
  /** While `onGuiBuilt` handlers run, supports {@link GuiBenneScript.scene}. */
  private activeGuiRuntime: GuiRuntime | null = null;

  /**
   * Resolve another GUI overlay’s controls by id (same pattern as **`B.dialog`** / **`B.inventory`**).
   * Call from **`onGuiBuilt`** (after the room registers {@link GuiRuntime} instances — includes **`this.guiId`** overlays).
   * **`show` / `hide`** (and **`.now`**) apply immediately — they do not wait on this GUI script’s interaction tail.
   */
  gui(overlayGuiId: GuiId): BenneScriptGuiOverlayRef {
    return createBenneScriptGuiOverlayRef(overlayGuiId, {
      queueVisibility: false,
      chain: (factory) => this.chain(factory),
      resolveRoomScene: () => GuiBenneScript.tryResolveRoomSceneForGuiOverlay(),
      resolveScene: (rt, room) => this.resolveSceneForGuiControlNoop(rt, room),
      subscribe: (event, handler) => {
        this.subscribe(event, handler);
      },
      subscribeImmediate: (event, handler) => {
        this.subscribeImmediateWithPayload(event, handler);
      },
    });
  }

  private resolveSceneForGuiControlNoop(
    rt: GuiRuntime | null | undefined,
    rm: RoomScene | null,
  ): Phaser.Scene | null {
    if (rt?.scene) {
      return rt.scene;
    }
    if (this.activeGuiRuntime?.scene) {
      return this.activeGuiRuntime.scene;
    }
    if (rm) {
      return rm;
    }
    const g = tryGetActiveBenneGame();
    const room = g?.scene.getScene(SCENE_ROOM) as RoomScene | undefined;
    if (room) {
      return room;
    }
    const scenes = g?.scene.getScenes(true);
    const first = scenes?.[0];
    return first ?? null;
  }

  private static tryResolveRoomSceneForGuiOverlay(): RoomScene | null {
    const g = tryGetActiveBenneGame();
    return (g?.scene.getScene(SCENE_ROOM) as RoomScene | undefined) ?? null;
  }

  constructor(events: Phaser.Events.EventEmitter, guiId: string) {
    super(
      events,
      () => null,
      () => {
        const g = tryGetActiveBenneGame();
        return (g?.scene.getScene(SCENE_ROOM) as RoomScene | undefined) ?? undefined;
      },
    );
    this.guiId = guiId;
    this.state = createLazyBenneScriptGameStateNamespace(() => tryGetActiveGameStateManager());
    this.inventory = createLazyBenneScriptInventoryNamespace(
      () => tryGetActiveGameStateManager(),
      () => {
        const g = tryGetActiveBenneGame();
        return (g?.scene.getScene(SCENE_ROOM) as RoomScene | undefined) ?? undefined;
      },
      (factory) => this.chain(factory),
    );
    this.dialog = (dialogId: string) => {
      const manager = tryGetActiveGameStateManager();
      const game = tryGetActiveBenneGame();
      if (!manager || !game) {
        if (import.meta.env.DEV) {
          console.warn(
            `[Benne] B.dialog("${dialogId}") from GUI "${this.guiId}": game not ready — no-op surface.`,
          );
        }
        return createNoopDialogCommandSurface();
      }
      return createBenneScriptDialogAccessor(manager, game, (factory) => this.chain(factory))(dialogId);
    };
  }

  /**
   * The active room scene while an **`onGuiBuilt`** handler runs (e.g. **`B.scene.scale.width`** for full canvas width).
   * Not available at `registerGuiScript` top level — use **`gui.scene`** from the **`onGuiBuilt`** callback parameter if you prefer.
   */
  get scene(): Phaser.Scene {
    const rt = this.activeGuiRuntime;
    if (!rt) {
      throw new Error(
        `[Benne] B.scene ("${this.guiId}") is only available synchronously inside B.onGuiBuilt — use the gui argument's gui.scene, or move code into the callback.`,
      );
    }
    return rt.scene;
  }

  /**
   * Registers a callback invoked each time this GUI’s overlay is built in the room scene (fresh {@link GuiRuntime}
   * per load). Use for custom layout and tweens — keep work generic; engine stays data-driven.
   */
  onGuiBuilt(callback: (gui: GuiRuntime) => void): void {
    this.onGuiBuiltHandlers.push(callback);
  }

  /**
   * Registers a callback invoked when this GUI overlay becomes visible via {@link BenneScriptGuiOverlayRef.show}
   * (including `B.gui(this.guiId).show()` from a room script or another GUI script). Use to refresh lists that read persisted state.
   */
  onGuiShow(callback: (gui: GuiRuntime) => void): void {
    this.onGuiShowHandlers.push(callback);
  }

  /**
   * Registers a callback invoked when this GUI overlay is hidden via {@link BenneScriptGuiOverlayRef.hide}.
   */
  onGuiHide(callback: (gui: GuiRuntime) => void): void {
    this.onGuiHideHandlers.push(callback);
  }

  /**
   * Queues async work on this GUI script’s interaction tail (same lazy factory semantics as {@link BenneScriptCore}).
   * Used by {@link GuiRuntime} / {@link ControlFacade} tweens.
   */
  /** GUI handlers don't block saving (BenneScript §4.16). */
  protected override reportsGameplayInteractions(): boolean {
    return false;
  }

  queueInteraction(factory: () => Promise<unknown>): void {
    this.chain(factory);
  }

  /**
   * Called from the scene after {@link buildGuiOverlay}; runs all `onGuiBuilt` registrations for this overlay instance.
   */
  notifyGuiBuilt(gui: GuiRuntime): void {
    this.activeGuiRuntime = gui;
    try {
      for (const handler of this.onGuiBuiltHandlers) {
        try {
          handler(gui);
        } catch (err) {
          console.error(`[Benne] Error in onGuiBuilt handler for GUI "${this.guiId}":`, err);
        }
      }
    } finally {
      this.activeGuiRuntime = null;
    }
  }

  /** Called from {@link BenneScriptGuiOverlayRef.show} after the overlay is shown. */
  notifyGuiShown(gui: GuiRuntime): void {
    for (const handler of this.onGuiShowHandlers) {
      try {
        handler(gui);
      } catch (err) {
        console.error(`[Benne] Error in onGuiShow handler for GUI "${this.guiId}":`, err);
      }
    }
  }

  /** Called from {@link BenneScriptGuiOverlayRef.hide} after the overlay is hidden. */
  notifyGuiHidden(gui: GuiRuntime): void {
    for (const handler of this.onGuiHideHandlers) {
      try {
        handler(gui);
      } catch (err) {
        console.error(`[Benne] Error in onGuiHide handler for GUI "${this.guiId}":`, err);
      }
    }
  }

  /**
   * When the player activates a specific `button` control (by `id` in `*.gui.json`), run `handler`.
   * Mirrors verb sugar (`whenLookAt`, …): one string id, scoped to this GUI file’s `registerGuiScript` id.
   */
  whenButtonClick(buttonId: string, handler: () => void): void {
    this.subscribe(guiButtonClickEventId(this.guiId, buttonId), () => {
      handler();
    });
  }

  /**
   * Runs when any `button` control in this GUI is activated; receives the control `id`.
   * Prefer {@link whenButtonClick} for normal wiring; use this for logging, shared fallbacks, etc.
   */
  whenAnyButtonClick(handler: (buttonId: string) => void): void {
    this.subscribe(guiAllButtonsClickEventId(this.guiId), (payload) => {
      const p = payload as GuiAllButtonsClickPayload | undefined;
      if (p && typeof p.buttonId === 'string') {
        handler(p.buttonId);
      }
    });
  }

  /**
   * When the player toggles a `checkbox` control to **checked**, run `handler`.
   * Programmatic **`control(…).checked = true`** does not invoke this.
   */
  whenCheckboxCheck(checkboxId: string, handler: () => void): void {
    this.subscribe(guiCheckboxCheckEventId(this.guiId, checkboxId), () => {
      handler();
    });
  }

  /**
   * When the player toggles a `checkbox` control to **unchecked**, run `handler`.
   * Programmatic **`control(…).checked = false`** does not invoke this.
   */
  whenCheckboxUncheck(checkboxId: string, handler: () => void): void {
    this.subscribe(guiCheckboxUncheckEventId(this.guiId, checkboxId), () => {
      handler();
    });
  }

  /**
   * Runs when the pointer enters the hit area of a GUI control with this **`id`**. Works for any authored
   * control that exposes a hit area: **`trigger`**, **`button`** (while enabled), **`checkbox`**, **`image`**, **`inventoryPanel`**,
   * and **`text`** (bounded by its rendered size).
   */
  whenMouseEnter(controlId: string, handler: () => void): void {
    const id = controlId.trim();
    if (!id) {
      return;
    }
    this.subscribeImmediate(guiControlMouseEnterEventId(this.guiId, id), () => {
      handler();
    });
  }

  /**
   * Runs when the pointer leaves a GUI control’s hit area. Paired with {@link whenMouseEnter}; same control-id rules.
   */
  whenMouseLeave(controlId: string, handler: () => void): void {
    const id = controlId.trim();
    if (!id) {
      return;
    }
    this.subscribeImmediate(guiControlMouseLeaveEventId(this.guiId, id), () => {
      handler();
    });
  }
}
