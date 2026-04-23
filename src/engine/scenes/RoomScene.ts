import * as Phaser from 'phaser';
import {
  attachDirectionalAnimationApi,
  facingFromWorldDelta,
  playDirectionalAnimation,
  resolveInitialIdleFacing,
  resolveSpawnIdleFacing,
  type CharacterFacing,
  type DirectionalCharacterSprite,
} from '../directionalCharacterAnimation';
import { gameEvents } from '../events/EventBus';
import {
  GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT,
  GAME_STATE_ACTIVE_VERB_CHANGED_EVENT,
  GAME_STATE_INVENTORY_CHANGED_EVENT,
} from '../../types/gameState';
import {
  getPerItemInventoryTextureKey,
  inventoryPhaserAnimationKeyForTag,
  sharedInventoryTextureKey,
} from '../../game/inventoryAseprite';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry';
import {
  PLAYER_WALK_START,
  PLAYER_WALK_STOP,
  type PlayerWalkStartPayload,
  type PlayerWalkStopPayload,
} from '../events/playerWalkEvents';
import {
  applyCharacterAnimationClips,
  setupCharacterAsepritePlayback,
} from '../characterAnimationPlayback';
import { getDialogSettings, getGameSettings } from '../ConfigManager';
import {
  applyGameCursorSpriteHotspot,
  CURSOR_TEXTURE_KEY,
  isBenneGameCursorAsepriteEnabled,
} from '../../game/cursorAseprite';
import { attachPostProcessingPlaceholder } from '../postfx/PostEffects';
import {
  cameraFollowOffsetForFeet,
  getCharacterWorldFeet,
  placeSpriteByFeet,
  resolveCharacterFeetLocal,
} from '../characterFeet';
import { pointInPolygon } from '../walkable';
import { findWalkPath } from '../pathfinding';
import { dispatchVerbInteraction } from '../verbs/dispatchVerb';
import {
  dispatchInventoryOnVerbTargetInteraction,
  shouldDispatchInventoryUsedOnVerbForGame,
  shouldDropActiveInventoryOnUse,
} from '../verbs/dispatchInventoryVerb';
import {
  getCharacterVerbHandlers,
  getHotspotVerbHandlers,
  getPropVerbHandlers,
} from '../verbs/normalizeHandlers';
import { getEffectiveInputProfile } from '../verbs/verbConfig';
import { resolvePointerVerbForTarget } from '../verbs/resolvePointerVerb';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager';
import { getInternalHeight, getInternalWidth, getStartingPlayerCharacterId, SCENE_ROOM } from '../../game/constants';
import type { CharacterAnimationsConfig } from '../../types/character';
import type { CharacterData } from '../../types/character';
import type { InventoryItemData } from '../../types/inventory';
import type { Point2, RoomData, RoomHotspotData, RoomPropInstance } from '../../types/room';
import type { RoomCharacterSpawn, RoomPropSpawn, RoomSceneStartData } from './BootScene';
import { createRoomScriptContext } from '../scripting/RoomScriptContext.js';
import { createCharacterScriptContext } from '../scripting/CharacterScriptContext.js';
import { createInventoryScriptContext } from '../scripting/InventoryScriptContext.js';
import type { CharacterScriptContext, InventoryScriptContext, RoomScriptContext } from '@engine/scripting/types.js';
import {
  buildGuiOverlay,
  GUI_OVERLAY_DEPTH_STRIDE,
  GUI_TEXT_OVERLAY_DEPTH,
  type GuiOverlayHandle,
} from '../gui/buildGuiOverlay';
import { getGuiBenneScript } from '../scripting/registerGuiScript.js';
import { getAllGuiData } from '../../game/loadGuiData';
import {
  applyRoomStackDepths,
  compareRoomStackEntities,
  type RoomStackEntity,
} from '../room/roomStackDrawOrder';

/** Engine-reserved id for {@link RoomScene.setDialogTextOverlay} (Bennescript `say` / `say.now`). */
const DIALOG_TEXT_GUI_ID = 'dialog-text';

/**
 * Optional `Phaser.Game.registry` key: when set to a boolean, overrides the initial visibility of
 * every non-`dialog-text` GUI overlay at room load. Used by the BENNE room preview so authors can
 * toggle HUD GUIs on/off from the preview toolbar without hand-editing each GUI's `visible` in `*.gui.json`
 * flags. Unset (the default) preserves per-GUI JSON `visible` semantics (`false` hides at load;
 * omitted/`true` shows).
 */
const GENERIC_GUIS_INITIAL_VISIBILITY_REGISTRY_KEY = 'benneRoomSceneGenericGuisVisible';

/** Ignore walk clicks when already within this many pixels of the target. */
const MIN_WALK_DISTANCE_PX = 6;

/** Walkable / prop debug strokes render above characters. */
const DEBUG_OVERLAY_DEPTH = 20_000;

/** Renders above typical room + GUI depth so the custom pointer stays on top (shipped game). */
const CUSTOM_CURSOR_DEPTH = 500_000;

/** `startFollow` offset so the camera tracks {@link getCharacterWorldFeet}, not the sprite top-left. */
function getFeetFollowOffset(player: Phaser.GameObjects.Sprite): { x: number; y: number } {
  const lx = player.getData('feetLocalX') as number | undefined;
  const ly = player.getData('feetLocalY') as number | undefined;
  if (typeof lx === 'number' && typeof ly === 'number') {
    return cameraFollowOffsetForFeet({ x: lx, y: ly });
  }
  const data = player.getData('character') as CharacterData | undefined;
  const feet = data ? resolveCharacterFeetLocal(data, player) : { x: player.frame.width * 0.5, y: player.frame.height };
  return cameraFollowOffsetForFeet(feet);
}

/** Outline color for `debug.showWalkable` (green). */
const DEBUG_WALKABLE_STROKE = 0x33dd66;
/** Hole rings under an active walkable polygon (debug). */
const DEBUG_WALKABLE_HOLE_STROKE = 0x229955;
/** Outline color for `debug.showPropOutlines` (magenta). */
const DEBUG_PROP_COLLIDER_STROKE = 0xff44cc;
/** Live pathfinding polyline overlay color (cyan). */
const DEBUG_WALK_PATH_STROKE = 0x33ccff;

function mergeRoomPropAnimationClips(spawns: readonly RoomPropSpawn[]): CharacterAnimationsConfig {
  const out: CharacterAnimationsConfig = {};
  for (const s of spawns) {
    if (s.data.animations) {
      Object.assign(out, s.data.animations);
    }
  }
  return out;
}

export class RoomScene extends Phaser.Scene {
  private roomData!: RoomData;

  /** Player Aseprite sprite; null if no matching `startingPlayerCharacter` in the room. */
  player: DirectionalCharacterSprite | null = null;

  /**
   * Tracks the current editor camera mode so the camera can be reconfigured when the
   * panel resizes (`Scale.RESIZE` fires a resize event). Null = game runtime (no editor).
   */
  private editorCameraMode: 'navigate' | 'edit' | null = null;

  /**
   * Dedicated UI camera used **only** in the editor preview (`setEditorCameraMode`). In the
   * shipped game `cameras.main.zoom` stays at 1 (`Scale.FIT`) so `scrollFactor: 0` overlays
   * render at their literal `(x, y)`. In the preview the main camera is zoomed (`Scale.RESIZE`
   * + `cam.setZoom(scale)` to letterbox the game viewport inside the panel), and Phaser 4's
   * origin-aware zoom math pushes `scrollFactor=0` GUIs by `(origin × (1 − zoom))` — hundreds
   * of pixels off the viewport at typical editor scales. This camera has `origin=(0, 0)`,
   * `scroll=(0, 0)`, and matches the main camera's viewport + zoom so GUIs render at
   * `(x × zoom, y × zoom)` relative to the viewport top-left, exactly as they do in runtime.
   */
  private editorUiCamera: Phaser.Cameras.Scene2D.Camera | null = null;

  /** Scene objects that belong to the editor UI camera (all GUI overlay top-level objects). */
  private readonly editorUiGuiObjects = new Set<Phaser.GameObjects.GameObject>();

  /** Disposer for the `addedtoscene` listener that auto-ignores new non-GUI objects on the UI camera. */
  private editorUiChildListenerOff: (() => void) | null = null;

  private playerMoveTween: Phaser.Tweens.Tween | null = null;

  /**
   * Current player pathfinding polyline (waypoints, goal last). Set when a walk begins,
   * cleared on arrival or interruption. Rendered by {@link drawRoomDebugOverlays} when
   * `debug.showWalkable` is on so authors can see the chosen route around obstacles.
   */
  private currentPlayerPath: Point2[] | null = null;

  /** Debug graphics for the live player path (re-drawn each frame while walking). */
  private debugPathGraphics: Phaser.GameObjects.Graphics | null = null;

  /** Fired once when a walk tween completes successfully (instant walks may call it without a tween). */
  private walkArriveCallback: (() => void) | null = null;

  /** Props that need per-frame position updates for parallax scrolling. */
  private parallaxProps: Array<{
    sprite: Phaser.GameObjects.Sprite;
    baseX: number;
    baseY: number;
    parallaxDepth: number;
  }> = [];

  /**
   * Props, characters, and hotspot zones sorted each frame by {@link compareRoomStackEntities}
   * (zIndex + optional baselines).
   */
  private roomStackEntities: RoomStackEntity[] = [];

  /** Prop id → sprite (every placed prop, for Bennescript). */
  private propSpritesById = new Map<string, Phaser.GameObjects.Sprite>();

  /** Runtime-only description overrides for props (B.prop(id).description). */
  private propDescriptionOverrides = new Map<string, string>();

  /** Character definition id → first spawned sprite/image in this room. */
  private characterSpritesByDefId = new Map<
    string,
    Phaser.GameObjects.Sprite | Phaser.GameObjects.Image
  >();

  /** Active scripted walks for non-player characters (by sprite identity). */
  private npcWalkTweens = new Map<
    Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    Phaser.Tweens.Tween
  >();

  /** String ids that already triggered `walkTo` resolution warnings (warn once per id per room load). */
  private unresolvedWalkTargetIdsWarned = new Set<string>();

  /** Screen-fixed dialogue text from `guis/dialog-text/dialog-text.gui.json`. */
  private dialogTextOverlay: GuiOverlayHandle | null = null;

  /** Dedupes missing-`dialog-text` warnings for Bennescript `say` (once per room `create`). */
  private missingDialogTextOverlaySayWarned = false;

  /** Every other registered GUI overlay (authoring under `src/game/guis/<id>/`), built automatically in `create`. */
  private genericGuiOverlays: GuiOverlayHandle[] = [];

  private readonly dialogOverlayScreenScratch = new Phaser.Math.Vector2();

  /**
   * When non-zero, a Bennescript `say` / `say.now` line timer is active — ignore room background walks
   * and prop/hotspot/character verb clicks so the player cannot act until the line ends.
   */
  private scriptedDialogInputSuppressionDepth = 0;

  /** When set, a left-click should end the active scripted dialog line early (global or per-line `say` options). */
  private scriptedDialogClickToSkip: (() => void) | null = null;

  /** Screen-space sprite when `game-config.json` enables `cursor.display.aseprite`. */
  private customCursorSprite: Phaser.GameObjects.Sprite | null = null;
  /** Dedupes {@link refreshCustomCursor} work when pointer + visual mode are unchanged. */
  private lastCustomCursorVisualKey: string | null = null;
  private readonly refreshAllVerbLineOverlays = (): void => {
    for (const h of this.genericGuiOverlays) {
      h.refreshVerbLineText();
    }
    this.dialogTextOverlay?.refreshVerbLineText();
  };

  private readonly onRoomPointerMove = (pointer: Phaser.Input.Pointer): void => {
    this.refreshAllVerbLineOverlays();
    if (this.customCursorSprite) {
      this.refreshCustomCursor(pointer);
    }
  };
  private readonly onCustomGameStateForCursor = (): void => {
    this.lastCustomCursorVisualKey = null;
    this.refreshCustomCursor(this.input.activePointer);
  };

  constructor() {
    super(SCENE_ROOM);
  }

  create(data: RoomSceneStartData): void {
    this.roomData = data.room;
    this.player = null;
    this.playerMoveTween = null;
    this.currentPlayerPath = null;
    this.debugPathGraphics = null;
    this.parallaxProps = [];
    this.roomStackEntities = [];
    this.propSpritesById.clear();
    this.propDescriptionOverrides.clear();
    this.characterSpritesByDefId.clear();
    this.npcWalkTweens.clear();
    this.unresolvedWalkTargetIdsWarned.clear();
    this.missingDialogTextOverlaySayWarned = false;

    attachPostProcessingPlaceholder(this.cameras.main);

    const vW = getInternalWidth();
    const vH = getInternalHeight();
    const roomW = data.room.size?.width ?? vW;
    const roomH = data.room.size?.height ?? vH;

    if (data.backgroundTextureKey) {
      // Render the background at its natural pixel dimensions — room.size controls camera
      // bounds and walkable extent, not how large the art appears.
      this.add.image(0, 0, data.backgroundTextureKey).setOrigin(0, 0);
    }

    this.spawnRoomProps(data);

    const sortedHotspots = [...data.room.hotspots].sort(
      (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
    );
    sortedHotspots.forEach((hotspot) => this.createHotspot(data.room.id, hotspot, roomW, roomH));
    data.characters.forEach((spawn) => this.spawnCharacter(data.room.id, spawn));
    this.updateRoomStackDepths();

    this.setupRoomCamera(roomW, roomH);
    this.applyPlayerCameraFollow(roomW, roomH);
    this.drawRoomDebugOverlays(data);

    const guisSorted = [...getAllGuiData()].sort((a, b) => a.id.localeCompare(b.id));
    const nonDialogGuis = guisSorted.filter((g) => g.id !== DIALOG_TEXT_GUI_ID);
    const dialogGui = guisSorted.find((g) => g.id === DIALOG_TEXT_GUI_ID);

    const genericGuiVisibilityOverride = this.game.registry.get(
      GENERIC_GUIS_INITIAL_VISIBILITY_REGISTRY_KEY,
    );
    const hasGenericGuiVisibilityOverride = typeof genericGuiVisibilityOverride === 'boolean';

    this.genericGuiOverlays = [];
    let stackIndex = 0;
    const inventoryPanelPointerContext = {
      roomId: data.room.id,
      isInputSuppressed: (): boolean => this.isScriptedDialogInputSuppressed(),
      tryConsumeDialogClickToSkip: (pointer: Phaser.Input.Pointer): boolean =>
        this.tryConsumeScriptedDialogClickToSkip(pointer),
    };
    const verbLineHoverDescription = (): string | null =>
      this.resolveVerbLineHoverDescription(this.input.activePointer);
    for (const gui of nonDialogGuis) {
      const built = buildGuiOverlay(this, gui, {
        /** Preview / cutscene override wins; otherwise each GUI's required `visible` boolean. */
        startVisible: hasGenericGuiVisibilityOverride ? genericGuiVisibilityOverride : gui.visible,
        depth: GUI_TEXT_OVERLAY_DEPTH + stackIndex * GUI_OVERLAY_DEPTH_STRIDE,
        inventoryPanelPointerContext,
        verbLineHoverDescription,
      });
      if (built) {
        this.genericGuiOverlays.push(built.handle);
        const guiScript = getGuiBenneScript(gui.id);
        if (guiScript) {
          const rt = built.createGuiRuntime((factory) => guiScript.queueInteraction(factory));
          guiScript.notifyGuiBuilt(rt);
        }
      }
      stackIndex += 1;
    }

    const dialogBuilt = dialogGui
      ? buildGuiOverlay(this, dialogGui, {
          /** Speech UI is driven by {@link setDialogTextOverlay}, not the JSON `visible` flag at boot. */
          startVisible: false,
          depth: GUI_TEXT_OVERLAY_DEPTH + stackIndex * GUI_OVERLAY_DEPTH_STRIDE,
          inventoryPanelPointerContext,
          verbLineHoverDescription,
        })
      : null;
    this.dialogTextOverlay = dialogBuilt?.handle ?? null;
    if (dialogBuilt) {
      const dialogScript = getGuiBenneScript(DIALOG_TEXT_GUI_ID);
      if (dialogScript) {
        const rt = dialogBuilt.createGuiRuntime((factory) => dialogScript.queueInteraction(factory));
        dialogScript.notifyGuiBuilt(rt);
      }
    }

    this.setupCustomGameCursor();
    this.input.on('pointermove', this.onRoomPointerMove);
    gameEvents.on(GAME_STATE_INVENTORY_CHANGED_EVENT, this.refreshAllVerbLineOverlays);

    // ─────────────────────────────────────────────────────────────
    // Bennescript: after props, characters, player, and camera exist
    // ─────────────────────────────────────────────────────────────
    const roomScripts = (window as unknown as { __benneRoomScripts?: Array<(ctx: RoomScriptContext) => void> })
      .__benneRoomScripts;
    const characterScripts = (
      window as unknown as {
        __benneCharacterScripts?: ReadonlyArray<{
          characterId: string;
          registerFn: (ctx: CharacterScriptContext) => void;
        }>;
      }
    ).__benneCharacterScripts;
    const inventoryScripts = (
      window as unknown as {
        __benneInventoryScripts?: ReadonlyArray<{
          itemId: string;
          registerFn: (ctx: InventoryScriptContext) => void;
        }>;
      }
    ).__benneInventoryScripts;

    const benneDisposers: Array<() => void> = [];
    if (roomScripts && roomScripts.length > 0) {
      const ctx = createRoomScriptContext(gameEvents, data.room.id, this);
      benneDisposers.push(() => ctx.B.dispose());
      for (const registerFn of roomScripts) {
        try {
          registerFn(ctx);
        } catch (err) {
          console.error(`[Benne] Error in room script for ${data.room.id}:`, err);
        }
      }
    }

    if (characterScripts && characterScripts.length > 0) {
      const spawnedCharacterIds = new Set(data.characters.map((c) => c.data.id));
      for (const { characterId, registerFn } of characterScripts) {
        if (!spawnedCharacterIds.has(characterId)) {
          continue;
        }
        const ctx = createCharacterScriptContext(gameEvents, characterId, data.room.id, this);
        benneDisposers.push(() => ctx.B.dispose());
        try {
          registerFn(ctx);
        } catch (err) {
          console.error(
            `[Benne] Error in character script for ${characterId} in room ${data.room.id}:`,
            err,
          );
        }
      }
    }

    if (inventoryScripts && inventoryScripts.length > 0) {
      for (const { itemId, registerFn } of inventoryScripts) {
        const ctx = createInventoryScriptContext(gameEvents, itemId, data.room.id, this);
        benneDisposers.push(() => ctx.B.dispose());
        try {
          registerFn(ctx);
        } catch (err) {
          console.error(`[Benne] Error in inventory script for ${itemId} in room ${data.room.id}:`, err);
        }
      }
    }

    const benneDispose = benneDisposers.length > 0 ? () => benneDisposers.forEach((d) => d()) : null;

    this.input.mouse?.disableContextMenu();

    this.scale.on('resize', this.onScaleResize, this);
    this.input.on('pointerdown', this.handleRoomPointerDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      benneDispose?.();
      for (const h of this.genericGuiOverlays) {
        h.destroy();
      }
      this.genericGuiOverlays = [];
      this.dialogTextOverlay?.destroy();
      this.dialogTextOverlay = null;
      this.scriptedDialogInputSuppressionDepth = 0;
      this.scriptedDialogClickToSkip = null;
      this.scale.off('resize', this.onScaleResize, this);
      this.input.off('pointerdown', this.handleRoomPointerDown);
      this.input.off('pointermove', this.onRoomPointerMove);
      gameEvents.off(GAME_STATE_INVENTORY_CHANGED_EVENT, this.refreshAllVerbLineOverlays);
      this.teardownCustomGameCursor();
      this.editorUiChildListenerOff?.();
      this.editorUiChildListenerOff = null;
      this.editorUiGuiObjects.clear();
      this.editorUiCamera = null;
      this.stopPlayerMoveTween(true);
      for (const t of this.npcWalkTweens.values()) {
        t.stop();
      }
      this.npcWalkTweens.clear();
      this.debugPathGraphics = null;
    });
  }

  /**
   * Shows or hides every non-`dialog-text` GUI overlay registered under `src/game/guis/**`.
   * Does not affect the `dialog-text` overlay (that remains driven by {@link setDialogTextOverlay} /
   * `say`). Intended for preview toolbars and future cutscene HUD-hide logic.
   */
  setGenericGuisVisible(visible: boolean): void {
    for (const h of this.genericGuiOverlays) {
      h.setVisible(visible);
    }
  }

  /**
   * Shows or hides the `dialog-text` GUI line (`controls` text with `id: line` or the first text control).
   * With `talkCharacterDefinitionId`, places the line so its **bottom-center** sits on the character’s `talkPoint`
   * projected into GUI space (plus `game-config.json` `dialog.defaultTalkOffset`), including wrapped height.
   */
  setDialogTextOverlay(state: {
    visible: boolean;
    text?: string;
    talkCharacterDefinitionId?: string;
  }): void {
    const h = this.dialogTextOverlay;
    if (!h) {
      if (state.visible && !this.missingDialogTextOverlaySayWarned) {
        this.missingDialogTextOverlaySayWarned = true;
        console.warn(
          '[Benne] Bennescript `say` cannot show dialogue: no `dialog-text` GUI was loaded. ' +
            'Add `src/game/guis/dialog-text/dialog-text.gui.json` (see game templates or docs/architecture.md).',
        );
      }
      return;
    }
    const dialog = getDialogSettings();
    if (!state.visible) {
      h.resetPrimaryScreenPosition();
      h.setVisible(false);
      return;
    }
    if (state.text !== undefined && dialog.showText) {
      h.setPrimaryText(state.text);
    }
    if (!dialog.showText) {
      return;
    }
    const id = state.talkCharacterDefinitionId;
    if (id) {
      const anchor = this.getTalkAnchorWorldForCharacterDefinition(id);
      if (anchor) {
        const p = this.worldPointToDialogOverlayScreen(anchor.x, anchor.y);
        h.setPrimaryScreenPositionBottomCenter(
          p.x + dialog.defaultTalkOffset.x,
          p.y + dialog.defaultTalkOffset.y,
        );
      } else {
        h.resetPrimaryScreenPosition();
      }
    } else {
      h.resetPrimaryScreenPosition();
    }
    h.setVisible(true);
  }

  /**
   * Called when a timed Bennescript dialog line starts (including `say.now`). Paired with
   * {@link popScriptedDialogInputSuppression} when the line timer ends.
   */
  pushScriptedDialogInputSuppression(): void {
    this.scriptedDialogInputSuppressionDepth++;
  }

  popScriptedDialogInputSuppression(): void {
    this.scriptedDialogInputSuppressionDepth = Math.max(0, this.scriptedDialogInputSuppressionDepth - 1);
  }

  private isScriptedDialogInputSuppressed(): boolean {
    return this.scriptedDialogInputSuppressionDepth > 0;
  }

  /**
   * While a skippable scripted dialog line is showing, left-clicks invoke **`fn`** once (same cleanup as the timer).
   * Cleared when the line ends or when {@link clearScriptedDialogClickToSkip} runs.
   */
  setScriptedDialogClickToSkip(fn: (() => void) | null): void {
    this.scriptedDialogClickToSkip = fn;
  }

  clearScriptedDialogClickToSkip(): void {
    this.scriptedDialogClickToSkip = null;
  }

  /**
   * If a click-to-skip handler is registered and this is a primary-button down, runs the handler and returns true.
   */
  tryConsumeScriptedDialogClickToSkip(pointer: Phaser.Input.Pointer): boolean {
    if (!this.scriptedDialogClickToSkip) {
      return false;
    }
    if (!pointer.leftButtonDown()) {
      return false;
    }
    const fn = this.scriptedDialogClickToSkip;
    this.scriptedDialogClickToSkip = null;
    fn();
    return true;
  }

  /** World position of `CharacterData.talkPoint` for the first spawned sprite of this definition, or a default above the sprite top. */
  private getTalkAnchorWorldForCharacterDefinition(definitionId: string): Point2 | null {
    const sprite = this.getCharacterSprite(definitionId);
    if (!sprite) {
      return null;
    }
    const data = sprite.getData('character') as CharacterData | undefined;
    const f = sprite.frame;
    if (data?.talkPoint) {
      return { x: sprite.x + data.talkPoint.x, y: sprite.y + data.talkPoint.y };
    }
    return { x: sprite.x + f.width * 0.5, y: sprite.y - 4 };
  }

  /** Maps room/world pixels to coordinates in the same space as GUI `controls[].x` / `y` for this camera. */
  private worldPointToDialogOverlayScreen(wx: number, wy: number): Point2 {
    this.cameras.main.matrixCombined.transformPoint(wx, wy, this.dialogOverlayScreenScratch);
    return { x: this.dialogOverlayScreenScratch.x, y: this.dialogOverlayScreenScratch.y };
  }

  getRoomPropInstance(propId: string): RoomPropInstance | undefined {
    return this.roomData.props?.find((p) => p.id === propId);
  }

  getRoomHotspotInstance(hotspotId: string): RoomHotspotData | undefined {
    return this.roomData.hotspots.find((h) => h.id === hotspotId);
  }

  getPropSprite(propId: string): Phaser.GameObjects.Sprite | undefined {
    return this.propSpritesById.get(propId);
  }

  getCharacterSprite(definitionId: string): Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | undefined {
    return this.characterSpritesByDefId.get(definitionId);
  }

  getPropScriptDescription(propId: string): string {
    if (this.propDescriptionOverrides.has(propId)) {
      return this.propDescriptionOverrides.get(propId) ?? '';
    }
    return this.getRoomPropInstance(propId)?.description ?? '';
  }

  setPropScriptDescription(propId: string, value: string): void {
    this.propDescriptionOverrides.set(propId, value);
  }

  getPropScriptVisible(propId: string): boolean {
    const sprite = this.propSpritesById.get(propId);
    if (sprite) {
      return sprite.visible;
    }
    const inst = this.getRoomPropInstance(propId);
    return inst?.visible !== false;
  }

  setPropScriptVisible(propId: string, visible: boolean): void {
    this.propSpritesById.get(propId)?.setVisible(visible);
  }

  /**
   * Walk the player’s feet to a point in walkable space, routing around holes and concavities.
   * The path is computed in {@link findWalkPath} (visibility graph + A\*). Resolves when the
   * final leg completes, or immediately if there is no player / no usable geometry / the player
   * is already at the target.
   */
  walkPlayerToWorldPoint(worldX: number, worldY: number): Promise<void> {
    if (!this.player) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.movePlayerToward(worldX, worldY, resolve);
    });
  }

  /**
   * Walk the player to an explicit point or a named target (prop, hotspot, character, or room point id).
   */
  walkPlayerTo(target: Point2 | string): Promise<void> {
    const sprite = this.player;
    if (!sprite) {
      return Promise.resolve();
    }
    const feet = getCharacterWorldFeet(sprite);
    const dest = this.resolveWalkTarget(target, feet);
    return this.walkPlayerToWorldPoint(dest.x, dest.y);
  }

  /**
   * Turn the player to face a **look-at** point in room space (e.g. prop / hotspot **`lookAtPoint`**),
   * or when **`lookAtWorld`** is omitted, the same walk destination as {@link walkPlayerTo} for
   * **`walkFallbackTarget`**. If the vector from the player’s feet to the target is ~0, leaves
   * facing unchanged (avoids spurious “face down”).
   */
  facePlayerTowardClicked(lookAtWorld: Point2 | null, walkFallbackTarget: Point2 | string | null): void {
    const sprite = this.player;
    if (!sprite) {
      return;
    }
    const feet = getCharacterWorldFeet(sprite);
    let toward: Point2 | undefined;
    if (lookAtWorld) {
      toward = lookAtWorld;
    } else if (walkFallbackTarget != null) {
      toward = this.resolveWalkTarget(walkFallbackTarget, feet);
    }
    if (!toward) {
      return;
    }
    const dx = toward.x - feet.x;
    const dy = toward.y - feet.y;
    if (Math.hypot(dx, dy) < 1e-2) {
      return;
    }
    const facing = facingFromWorldDelta(dx, dy);
    playDirectionalAnimation(sprite, 'Idle', facing);
  }

  /**
   * Walk a room character (by definition id) to an explicit point or a named target.
   */
  walkCharacterTo(definitionId: string, target: Point2 | string): Promise<void> {
    const sprite = this.characterSpritesByDefId.get(definitionId);
    if (!sprite) {
      return Promise.resolve();
    }
    const feet = getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
    const dest = this.resolveWalkTarget(target, feet);
    return this.walkCharacterToWorldPoint(sprite, dest.x, dest.y);
  }

  walkCharacterToWorldPoint(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    worldX: number,
    worldY: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      this.moveNpcToward(sprite, worldX, worldY, resolve);
    });
  }

  /**
   * Resolve a walk destination in room space. String ids: prop → hotspot → character → `room.points`,
   * first match wins; unknown id warns once and returns `walkerFeet`.
   */
  private resolveWalkTarget(target: Point2 | string, walkerFeet: Point2): Point2 {
    if (typeof target !== 'string') {
      return { x: target.x, y: target.y };
    }
    const id = target;

    const propInst = this.getRoomPropInstance(id);
    if (propInst) {
      if (propInst.walkToPoint) {
        return { x: propInst.walkToPoint.x, y: propInst.walkToPoint.y };
      }
      const colliderPts = propInst.collider?.points;
      if (colliderPts && colliderPts.length >= 3) {
        const onPoly = closestPointInOrOnSimplePolygon(walkerFeet.x, walkerFeet.y, colliderPts);
        if (onPoly) {
          return onPoly;
        }
      }
      const propSprite = this.propSpritesById.get(id);
      if (propSprite) {
        const f = propSprite.frame;
        return { x: propSprite.x + f.width * 0.5, y: propSprite.y + f.height * 0.5 };
      }
      return walkerFeet;
    }

    const hotspot = this.roomData.hotspots.find((h) => h.id === id);
    if (hotspot) {
      if (hotspot.walkToPoint) {
        return { x: hotspot.walkToPoint.x, y: hotspot.walkToPoint.y };
      }
      const hp = hotspot.points;
      if (hp.length >= 3) {
        const c = polygonRingCentroid(hp);
        if (c) {
          return c;
        }
      }
      return walkerFeet;
    }

    const charSprite = this.characterSpritesByDefId.get(id);
    if (charSprite) {
      const data = charSprite.getData('character') as CharacterData | undefined;
      if (data?.walkToPoint) {
        return {
          x: charSprite.x + data.walkToPoint.x,
          y: charSprite.y + data.walkToPoint.y,
        };
      }
      return getCharacterWorldFeet(charSprite as Phaser.GameObjects.Sprite);
    }

    const namedPoint = this.roomData.points?.find((p) => p.id === id);
    if (namedPoint) {
      return { x: namedPoint.x, y: namedPoint.y };
    }

    if (!this.unresolvedWalkTargetIdsWarned.has(id)) {
      this.unresolvedWalkTargetIdsWarned.add(id);
      console.warn(`[Benne] walkTo: unresolved target "${id}"`);
    }
    return walkerFeet;
  }

  /** Configures camera bounds and player follow for the current room. */
  private setupRoomCamera(roomW: number, roomH: number): void {
    const sb = this.roomData.scrollBounds;
    this.cameras.main.setBounds(
      sb?.x ?? 0,
      sb?.y ?? 0,
      sb?.width ?? roomW,
      sb?.height ?? roomH,
    );
  }

  /** Starts follow on the player’s feet (see `CharacterData.feet`). */
  private applyPlayerCameraFollow(roomW: number, roomH: number): void {
    const vW = getInternalWidth();
    const vH = getInternalHeight();
    if (!this.player || (roomW <= vW && roomH <= vH)) {
      return;
    }
    const feet = getFeetFollowOffset(this.player);
    this.cameras.main.startFollow(this.player, true, 1, 1, feet.x, feet.y);
  }

  update(): void {
    this.updateParallaxProps();
    this.updateRoomStackDepths();
    this.updatePathDebug();
  }

  /** Re-sorts props, characters, and hotspot zones by `zIndex` and optional `baseline` rules. */
  private updateRoomStackDepths(): void {
    if (this.roomStackEntities.length === 0) {
      return;
    }
    const sorted = [...this.roomStackEntities].sort(compareRoomStackEntities);
    applyRoomStackDepths(sorted);
  }

  /**
   * Repositions parallax props: blends authored world `(x,y)` with the top-left of the visible
   * world rect (`camera.worldView`). Using `scrollX`/`scrollY` is wrong when zoom ≠ 1 (e.g. editor
   * navigate mode letterboxes with `setZoom(scale)`); `worldView` matches what the player sees and
   * stays stable when only the preview panel size changes.
   */
  private updateParallaxProps(): void {
    if (this.parallaxProps.length === 0) {
      return;
    }

    const cam = this.cameras.main;
    const anchorX = cam.worldView.x;
    const anchorY = cam.worldView.y;

    for (const entry of this.parallaxProps) {
      const { sprite, baseX, baseY, parallaxDepth: d } = entry;
      sprite.x = d * baseX + (1 - d) * anchorX;
      sprite.y = d * baseY + (1 - d) * anchorY;
    }
  }

  /** Re-applies the current editor camera mode when the preview panel is resized. */
  private readonly onScaleResize = (): void => {
    if (this.editorCameraMode !== null) {
      this.setEditorCameraMode(this.editorCameraMode);
    }
  };

  /**
   * Configures the camera for the editor preview panel (called by `RoomPolygonEditScene`).
   * Not used at game runtime.
   *
   * **Navigate mode** — letterboxes the game's virtual resolution (e.g. 352×198) inside the
   * panel using a camera viewport, maintaining the exact in-game look with player follow.
   *
   * **Edit mode** — expands the camera to fill the entire panel and fits the full room art
   * at the largest zoom that shows everything.  The camera viewport covers the whole canvas
   * so the room art is not constrained to the 16:9 frame.
   */
  setEditorCameraMode(mode: 'navigate' | 'edit'): void {
    this.editorCameraMode = mode;

    const panelW = this.scale.width;
    const panelH = this.scale.height;
    if (panelW <= 0 || panelH <= 0) {
      return;
    }

    const gameW = getInternalWidth();   // game's virtual resolution (e.g. 352)
    const gameH = getInternalHeight();  // game's virtual resolution (e.g. 198)
    const roomW = this.roomData.size?.width ?? gameW;
    const roomH = this.roomData.size?.height ?? gameH;
    const cam = this.cameras.main;

    if (mode === 'navigate') {
      // Letterbox: scale the game viewport (gameW × gameH) to fit the panel, centred.
      const scale = Math.min(panelW / gameW, panelH / gameH);
      const viewW = Math.round(gameW * scale);
      const viewH = Math.round(gameH * scale);
      const viewX = Math.round((panelW - viewW) / 2);
      const viewY = Math.round((panelH - viewH) / 2);
      cam.setViewport(viewX, viewY, viewW, viewH);
      cam.setZoom(scale);

      const sb = this.roomData.scrollBounds;
      cam.setBounds(
        sb?.x ?? 0,
        sb?.y ?? 0,
        sb?.width ?? roomW,
        sb?.height ?? roomH,
      );

      if (this.player && (roomW > gameW || roomH > gameH)) {
        const feet = getFeetFollowOffset(this.player);
        cam.startFollow(this.player, true, 1, 1, feet.x, feet.y);
      } else {
        cam.stopFollow();
      }
    } else {
      // Edit mode: full panel viewport, fit the room art inside it.
      cam.stopFollow();
      cam.setViewport(0, 0, panelW, panelH);

      const zoom = Math.min(panelW / roomW, panelH / roomH);
      cam.setZoom(zoom);

      // Room bounds — Phaser's clampX/Y will position the room at the canvas top-left.
      cam.setBounds(0, 0, roomW, roomH);
      cam.scrollX = 0;
      cam.scrollY = 0;
    }

    this.ensureEditorUiCamera();
    this.syncEditorUiCameraToMain();
  }

  /**
   * Lazily creates the editor UI camera (see the field doc on {@link editorUiCamera}). Collects
   * every top-level GUI overlay game object, makes the main camera `ignore` them, and makes the
   * UI camera `ignore` everything else currently in the scene. An `addedtoscene` listener keeps
   * the UI camera's ignore list correct as new non-GUI objects are added later (e.g. debug
   * overlays, props spawned by `spawnPropNow`).
   */
  private ensureEditorUiCamera(): void {
    if (this.editorUiCamera) {
      return;
    }
    const main = this.cameras.main;
    const uiCam = this.cameras.add(main.x, main.y, main.width, main.height);
    uiCam.setOrigin(0, 0);
    uiCam.setScroll(0, 0);
    uiCam.setBackgroundColor('rgba(0, 0, 0, 0)');
    uiCam.setName('editor-ui');
    this.editorUiCamera = uiCam;

    this.editorUiGuiObjects.clear();
    const registerOverlay = (h: GuiOverlayHandle | null): void => {
      if (!h) {
        return;
      }
      for (const obj of h.gameObjects) {
        this.editorUiGuiObjects.add(obj);
      }
    };
    for (const h of this.genericGuiOverlays) {
      registerOverlay(h);
    }
    registerOverlay(this.dialogTextOverlay);
    if (this.customCursorSprite) {
      this.editorUiGuiObjects.add(this.customCursorSprite);
    }

    main.ignore(Array.from(this.editorUiGuiObjects));
    const nonGui = this.children.list.filter((o) => !this.editorUiGuiObjects.has(o));
    if (nonGui.length > 0) {
      uiCam.ignore(nonGui);
    }

    const onAdded = (obj: Phaser.GameObjects.GameObject): void => {
      if (this.editorUiGuiObjects.has(obj)) {
        main.ignore(obj);
      } else {
        uiCam.ignore(obj);
      }
    };
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
    this.editorUiChildListenerOff = () => {
      this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
    };
  }

  /** Keeps the editor UI camera's viewport and zoom aligned with the main camera. */
  private syncEditorUiCameraToMain(): void {
    const uiCam = this.editorUiCamera;
    if (!uiCam) {
      return;
    }
    const main = this.cameras.main;
    uiCam.setViewport(main.x, main.y, main.width, main.height);
    uiCam.setZoom(main.zoom);
    uiCam.setScroll(0, 0);
  }

  private readonly handleRoomPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (this.tryConsumeScriptedDialogClickToSkip(pointer)) {
      return;
    }
    if (this.isScriptedDialogInputSuppressed()) {
      return;
    }

    const hits = this.input.hitTestPointer(pointer);
    if (hits.length > 0) {
      return;
    }

    const manager = resolveGameStateManager(this.game);
    const hasActiveInventory = manager.getActiveInventoryItemId() != null;

    if (pointer.rightButtonDown()) {
      // Right-click on empty space clears the active verb (and active inventory if armed). No walk.
      if (hasActiveInventory) {
        manager.clearActiveInventoryItem();
      }
      manager.clearActiveVerb();
      return;
    }
    if (!pointer.leftButtonDown()) {
      return;
    }

    if (hasActiveInventory) {
      // Left-click on empty space while armed clears the selection instead of walking; the player
      // has to re-arm before walking to aim at a target.
      manager.clearActiveInventoryItem();
      manager.clearActiveVerb();
      return;
    }

    if (!this.player) {
      return;
    }

    const { x: worldX, y: worldY } = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.movePlayerToward(worldX, worldY);
  };

  /**
   * Stops the current walk tween if any. When `emitStop` is true, emits {@link PLAYER_WALK_STOP}
   * with reason `interrupted` (used when tearing down the scene).
   */
  private stopPlayerMoveTween(emitStop: boolean): void {
    this.walkArriveCallback = null;
    this.currentPlayerPath = null;
    if (!this.playerMoveTween) {
      return;
    }
    const tween = this.playerMoveTween;
    this.playerMoveTween = null;
    tween.stop();
    if (emitStop && this.player) {
      const facing = (this.player.getData('facing') as CharacterFacing | undefined) ?? resolveInitialIdleFacing(this.player);
      playDirectionalAnimation(this.player, 'Idle', facing);
      gameEvents.emit(PLAYER_WALK_STOP, {
        roomId: this.roomData.id,
        reason: 'interrupted',
      } satisfies PlayerWalkStopPayload);
    }
  }

  /**
   * Start a pathfound walk for the player toward a raw world point (not pre-clamped). Emits
   * {@link PLAYER_WALK_START} once for the final target, then chains one tween per leg of the
   * polyline returned by {@link findWalkPath}, updating directional animation between legs.
   * Fires {@link PLAYER_WALK_STOP} exactly once when the walk finishes or is interrupted.
   */
  private movePlayerToward(destX: number, destY: number, onArrive?: () => void): void {
    const sprite = this.player;
    if (!sprite) {
      onArrive?.();
      return;
    }

    const feetNow = getCharacterWorldFeet(sprite);
    const path = findWalkPath(
      feetNow,
      { x: destX, y: destY },
      this.roomData.walkable.polygons,
    );

    if (path.length === 0) {
      onArrive?.();
      return;
    }

    const final = path[path.length - 1]!;
    const totalDist = Math.hypot(final.x - feetNow.x, final.y - feetNow.y);
    if (totalDist < MIN_WALK_DISTANCE_PX) {
      onArrive?.();
      return;
    }

    if (this.playerMoveTween) {
      gameEvents.emit(PLAYER_WALK_STOP, {
        roomId: this.roomData.id,
        reason: 'interrupted',
      } satisfies PlayerWalkStopPayload);
    }
    this.stopPlayerMoveTween(false);

    this.walkArriveCallback = onArrive ?? null;
    this.currentPlayerPath = path;

    gameEvents.emit(PLAYER_WALK_START, {
      roomId: this.roomData.id,
      targetX: final.x,
      targetY: final.y,
    } satisfies PlayerWalkStartPayload);

    this.beginPlayerWalkLeg(sprite, path, 0);
  }

  /** Get (and memoize on the sprite) the feet offset in local sprite coordinates. */
  private getSpriteFeetLocal(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  ): { x: number; y: number } {
    let lx = sprite.getData('feetLocalX') as number | undefined;
    let ly = sprite.getData('feetLocalY') as number | undefined;
    if (typeof lx === 'number' && typeof ly === 'number') {
      return { x: lx, y: ly };
    }
    const data = sprite.getData('character') as CharacterData | undefined;
    const resolved = data
      ? resolveCharacterFeetLocal(data, sprite as Phaser.GameObjects.Sprite)
      : {
          x: (sprite as Phaser.GameObjects.Sprite).frame.width * 0.5,
          y: (sprite as Phaser.GameObjects.Sprite).frame.height,
        };
    lx = resolved.x;
    ly = resolved.y;
    sprite.setData('feetLocalX', lx);
    sprite.setData('feetLocalY', ly);
    return { x: lx, y: ly };
  }

  private beginPlayerWalkLeg(
    sprite: DirectionalCharacterSprite,
    path: readonly Point2[],
    legIndex: number,
  ): void {
    const walkSpeed = sprite.getData('walkSpeed') as number | undefined;
    const speed = typeof walkSpeed === 'number' && walkSpeed > 0 ? walkSpeed : 88;
    const { x: lx, y: ly } = this.getSpriteFeetLocal(sprite);

    const feetNow = getCharacterWorldFeet(sprite);
    const leg = path[legIndex]!;
    const dx = leg.x - feetNow.x;
    const dy = leg.y - feetNow.y;
    const distance = Math.hypot(dx, dy);

    // Skip zero-length legs (can occur if the path planner emits a waypoint right next to the
    // character, e.g. start already at a corner). Move to the next leg or finish.
    if (distance < 0.5) {
      if (legIndex + 1 < path.length) {
        this.beginPlayerWalkLeg(sprite, path, legIndex + 1);
        return;
      }
      this.finishPlayerWalk(sprite, facingFromWorldDelta(dx, dy));
      return;
    }

    const facing = facingFromWorldDelta(dx, dy);
    playDirectionalAnimation(sprite, 'Walk', facing);

    const durationMs = Math.max(1, Math.round((distance / speed) * 1000));

    const moveTween = this.tweens.add({
      targets: sprite,
      x: leg.x - lx,
      y: leg.y - ly,
      duration: durationMs,
      ease: 'Linear',
      onComplete: () => {
        // Leg was superseded (e.g. stopPlayerMoveTween nulled playerMoveTween) — do nothing.
        if (this.playerMoveTween !== moveTween) {
          return;
        }
        this.playerMoveTween = null;
        if (legIndex + 1 < path.length) {
          this.beginPlayerWalkLeg(sprite, path, legIndex + 1);
        } else {
          this.finishPlayerWalk(sprite, facing);
        }
      },
      onStop: () => {
        this.onPlayerWalkTweenStopped(moveTween);
      },
    });

    this.playerMoveTween = moveTween;
  }

  private finishPlayerWalk(sprite: DirectionalCharacterSprite, facing: CharacterFacing): void {
    this.currentPlayerPath = null;
    playDirectionalAnimation(sprite, 'Idle', facing);
    gameEvents.emit(PLAYER_WALK_STOP, {
      roomId: this.roomData.id,
      reason: 'complete',
    } satisfies PlayerWalkStopPayload);
    const arrive = this.walkArriveCallback;
    this.walkArriveCallback = null;
    arrive?.();
  }

  /**
   * Start a pathfound walk for a non-player character toward a raw world point (not pre-clamped).
   * Mirrors {@link movePlayerToward} but does not emit `PLAYER_WALK_*` events (those are
   * player-specific) and tracks its active tween in {@link npcWalkTweens} keyed by sprite.
   */
  private moveNpcToward(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    destX: number,
    destY: number,
    onArrive?: () => void,
  ): void {
    const feetNow = getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
    const path = findWalkPath(
      feetNow,
      { x: destX, y: destY },
      this.roomData.walkable.polygons,
    );

    if (path.length === 0) {
      onArrive?.();
      return;
    }

    const final = path[path.length - 1]!;
    const totalDist = Math.hypot(final.x - feetNow.x, final.y - feetNow.y);
    if (totalDist < MIN_WALK_DISTANCE_PX) {
      onArrive?.();
      return;
    }

    const prev = this.npcWalkTweens.get(sprite);
    if (prev) {
      prev.stop();
      this.npcWalkTweens.delete(sprite);
    }

    this.beginNpcWalkLeg(sprite, path, 0, onArrive);
  }

  private beginNpcWalkLeg(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    path: readonly Point2[],
    legIndex: number,
    onArrive?: () => void,
  ): void {
    const walkSpeed = sprite.getData('walkSpeed') as number | undefined;
    const speed = typeof walkSpeed === 'number' && walkSpeed > 0 ? walkSpeed : 88;
    const { x: lx, y: ly } = this.getSpriteFeetLocal(sprite);

    const feetNow = getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
    const leg = path[legIndex]!;
    const dx = leg.x - feetNow.x;
    const dy = leg.y - feetNow.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 0.5) {
      if (legIndex + 1 < path.length) {
        this.beginNpcWalkLeg(sprite, path, legIndex + 1, onArrive);
        return;
      }
      const facing = facingFromWorldDelta(dx, dy);
      if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
        playDirectionalAnimation(sprite as DirectionalCharacterSprite, 'Idle', facing);
      }
      onArrive?.();
      return;
    }

    const facing = facingFromWorldDelta(dx, dy);
    if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
      playDirectionalAnimation(sprite as DirectionalCharacterSprite, 'Walk', facing);
    }

    const durationMs = Math.max(1, Math.round((distance / speed) * 1000));

    const moveTween = this.tweens.add({
      targets: sprite,
      x: leg.x - lx,
      y: leg.y - ly,
      duration: durationMs,
      ease: 'Linear',
      onComplete: () => {
        if (this.npcWalkTweens.get(sprite) !== moveTween) {
          return;
        }
        this.npcWalkTweens.delete(sprite);
        if (legIndex + 1 < path.length) {
          this.beginNpcWalkLeg(sprite, path, legIndex + 1, onArrive);
          return;
        }
        if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
          playDirectionalAnimation(sprite as DirectionalCharacterSprite, 'Idle', facing);
        }
        onArrive?.();
      },
      onStop: () => {
        if (this.npcWalkTweens.get(sprite) !== moveTween) {
          return;
        }
        this.npcWalkTweens.delete(sprite);
        if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
          const idleFacing =
            (sprite.getData('facing') as CharacterFacing | undefined) ??
            resolveInitialIdleFacing(sprite as DirectionalCharacterSprite);
          playDirectionalAnimation(sprite as DirectionalCharacterSprite, 'Idle', idleFacing);
        }
      },
    });

    this.npcWalkTweens.set(sprite, moveTween);
  }

  private onPlayerWalkTweenStopped(tween: Phaser.Tweens.Tween): void {
    if (this.playerMoveTween !== tween) {
      return;
    }
    this.playerMoveTween = null;
    this.currentPlayerPath = null;
    if (this.player) {
      const facing =
        (this.player.getData('facing') as CharacterFacing | undefined) ?? resolveInitialIdleFacing(this.player);
      playDirectionalAnimation(this.player, 'Idle', facing);
    }
    gameEvents.emit(PLAYER_WALK_STOP, {
      roomId: this.roomData.id,
      reason: 'interrupted',
    } satisfies PlayerWalkStopPayload);
  }

  private drawRoomDebugOverlays(data: RoomSceneStartData): void {
    const debug = getGameSettings().debug;
    if (!debug?.showWalkable && !debug?.showPropOutlines) {
      return;
    }

    const lineWidth = 1;

    if (debug.showWalkable) {
      const gOuter = this.add.graphics();
      const gHoles = this.add.graphics();
      gOuter.lineStyle(lineWidth, DEBUG_WALKABLE_STROKE, 1);
      gHoles.lineStyle(lineWidth, DEBUG_WALKABLE_HOLE_STROKE, 1);
      for (const poly of this.roomData.walkable.polygons) {
        if (poly.active === false || poly.points.length < 3) {
          continue;
        }
        const vecs = poly.points.map((p) => new Phaser.Math.Vector2(p.x, p.y));
        gOuter.strokePoints(vecs, true);
        for (const h of poly.holes ?? []) {
          if (h.active === false || h.points.length < 3) {
            continue;
          }
          const hv = h.points.map((p) => new Phaser.Math.Vector2(p.x, p.y));
          gHoles.strokePoints(hv, true);
        }
      }
      gOuter.setDepth(DEBUG_OVERLAY_DEPTH);
      gHoles.setDepth(DEBUG_OVERLAY_DEPTH);
    }

    if (debug.showPropOutlines) {
      const g = this.add.graphics();
      g.lineStyle(lineWidth, DEBUG_PROP_COLLIDER_STROKE, 1);
      for (const spawn of data.props) {
        const pts = spawn.data.collider?.points;
        if (!pts || pts.length < 3) {
          continue;
        }
        const vecs = pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
        g.strokePoints(vecs, true);
      }
      g.setDepth(DEBUG_OVERLAY_DEPTH + 1);
    }

    if (debug.showWalkable) {
      // Shared Graphics reused every frame by updatePathDebug() — authoring-time visual feedback
      // for the pathfinding route around holes / concavities.
      this.debugPathGraphics = this.add.graphics();
      this.debugPathGraphics.setDepth(DEBUG_OVERLAY_DEPTH + 2);
    }
  }

  /**
   * Redraws the live player path polyline when `debug.showWalkable` is enabled. Cleared when
   * no walk is active. Called once per frame from {@link update}.
   */
  private updatePathDebug(): void {
    const g = this.debugPathGraphics;
    if (!g) {
      return;
    }
    g.clear();
    const path = this.currentPlayerPath;
    if (!path || path.length === 0 || !this.player) {
      return;
    }
    const feet = getCharacterWorldFeet(this.player);
    g.lineStyle(1, DEBUG_WALK_PATH_STROKE, 1);
    g.beginPath();
    g.moveTo(feet.x, feet.y);
    for (const p of path) {
      g.lineTo(p.x, p.y);
    }
    g.strokePath();
    g.fillStyle(DEBUG_WALK_PATH_STROKE, 1);
    for (const p of path) {
      g.fillRect(p.x - 1, p.y - 1, 3, 3);
    }
  }

  private spawnRoomProps(data: RoomSceneStartData): void {
    const textureKey = data.roomPropsTextureKey;
    if (!textureKey || data.props.length === 0) {
      return;
    }

    this.parallaxProps = [];

    const mergedClips = mergeRoomPropAnimationClips(data.props);
    const sorted = [...data.props].sort((a, b) => (a.data.zIndex ?? 0) - (b.data.zIndex ?? 0));

    // Must use the scene AnimationManager (no `target` sprite). Passing a sprite registers clips only on
    // that sprite; other props would never get `play()` and would stay on atlas frame 0 (often untagged).
    const created = this.anims.createFromAseprite(textureKey);
    applyCharacterAnimationClips(created, mergedClips);

    for (const spawn of sorted) {
      // Props render at their natural Aseprite frame dimensions. For full-room composite
      // sheets (the typical BENNE workflow) each frame already covers the full room width
      // and height, so no explicit setDisplaySize is needed.
      const sprite = this.add.sprite(spawn.x, spawn.y, textureKey).setOrigin(0, 0);
      sprite.setVisible(spawn.data.visible !== false);
      sprite.setAlpha(spawn.data.alpha ?? 1);

      if (!this.anims.exists(spawn.tag)) {
        console.warn(`[Benne] Room prop '${spawn.id}' uses unknown Aseprite tag '${spawn.tag}'.`);
      } else {
        sprite.play(spawn.tag);
      }

      const pd = spawn.data.parallaxDepth;
      if (pd !== undefined && pd !== 1) {
        this.parallaxProps.push({
          sprite,
          baseX: spawn.x,
          baseY: spawn.y,
          parallaxDepth: pd,
        });
      }

      this.propSpritesById.set(spawn.id, sprite);
      this.setupRoomProp(data.room.id, spawn, sprite);

      this.roomStackEntities.push({
        kind: 'prop',
        sprite,
        zIndex: spawn.data.zIndex ?? 0,
        baselineRoomY: spawn.data.baseline,
        sortKey: spawn.id,
      });
    }
  }

  private setupRoomProp(roomId: string, spawn: RoomPropSpawn, sprite: Phaser.GameObjects.Sprite): void {
    const d = spawn.data;
    if (!d.clickable) {
      return;
    }
    if (d.visible === false) {
      return;
    }

    const pts = d.collider?.points;
    if (!pts || pts.length < 3) {
      console.warn(`[Benne] Clickable prop '${spawn.id}' needs a collider polygon (at least 3 points).`);
      return;
    }

    const flat = pts.flatMap((p) => [p.x - spawn.x, p.y - spawn.y]);
    const poly = new Phaser.Geom.Polygon(flat);
    sprite.setInteractive({
      hitArea: poly,
      hitAreaCallback: Phaser.Geom.Polygon.Contains,
      useHandCursor: !isBenneGameCursorAsepriteEnabled(getGameSettings()),
    });

    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.tryConsumeScriptedDialogClickToSkip(pointer)) {
        return;
      }
      const profile = getEffectiveInputProfile(getGameSettings());
      const manager = resolveGameStateManager(this.game);
      const resolution = resolvePointerVerbForTarget(
        pointer,
        profile,
        { defaultVerb: spawn.data.defaultVerb },
        manager.getActiveVerb(),
        manager.getActiveInventoryItemId(),
      );
      if (resolution.kind === 'none') {
        return;
      }
      if (resolution.kind === 'clearActive') {
        manager.clearActiveInventoryItem();
        manager.clearActiveVerb();
        return;
      }
      if (resolution.kind === 'walkToTarget') {
        void this.walkPlayerTo(spawn.id);
        return;
      }
      if (resolution.kind === 'verb') {
        if (shouldDispatchInventoryUsedOnVerbForGame(manager, resolution.verbId, resolution)) {
          const itemId = manager.getActiveInventoryItemId()!;
          const shouldDrop = shouldDropActiveInventoryOnUse(itemId);
          console.log(
            `[Benne] inventory-on "${resolution.verbId}" item ${itemId} → prop ${spawn.id}`,
          );
          const handled = dispatchInventoryOnVerbTargetInteraction(gameEvents, itemId, resolution.verbId, {
            type: 'prop',
            propId: spawn.id,
            tag: spawn.tag,
            roomId,
            description: this.resolvePropDescriptionForDispatch(spawn),
            walkToPoint: spawn.data.walkToPoint,
            lookAtPoint: spawn.data.lookAtPoint,
          });
          if (!handled && shouldDrop) {
            manager.clearActiveInventoryItem();
          }
          if (resolution.consumeActive && shouldDrop) {
            manager.clearActiveVerb();
          }
          return;
        }
      }
      this.emitPropVerbInteraction(roomId, spawn, resolution.verbId);
      if (resolution.consumeActive) {
        manager.clearActiveVerb();
      }
    });
  }

  /**
   * Dispatches the **look** verb on this prop (same as a primary-button look click). Does not move or rotate the player.
   */
  tryBeginPropLook(roomId: string, spawn: RoomPropSpawn): void {
    this.emitPropVerbInteraction(roomId, spawn, 'look');
  }

  private resolvePropDescriptionForDispatch(spawn: RoomPropSpawn): string | undefined {
    if (this.propDescriptionOverrides.has(spawn.id)) {
      return this.propDescriptionOverrides.get(spawn.id);
    }
    return spawn.data.description;
  }

  private emitPropVerbInteraction(roomId: string, spawn: RoomPropSpawn, verbId: string): void {
    if (this.isScriptedDialogInputSuppressed()) {
      return;
    }
    console.log(`[Benne] verb "${verbId}" prop ${spawn.id}`);
    dispatchVerbInteraction(gameEvents, verbId, getPropVerbHandlers(spawn.data), {
      type: 'prop',
      propId: spawn.id,
      tag: spawn.tag,
      roomId,
      description: this.resolvePropDescriptionForDispatch(spawn),
      walkToPoint: spawn.data.walkToPoint,
      lookAtPoint: spawn.data.lookAtPoint,
    });
  }

  private createHotspot(roomId: string, hotspot: RoomHotspotData, roomW: number, roomH: number): void {
    if (hotspot.active === false) {
      return;
    }

    const pts = hotspot.points;
    if (!pts || pts.length < 3) {
      return;
    }

    const onHotspotPointer = (pointer: Phaser.Input.Pointer): void => {
      if (this.tryConsumeScriptedDialogClickToSkip(pointer)) {
        return;
      }
      if (this.isScriptedDialogInputSuppressed()) {
        return;
      }
      const handlers = getHotspotVerbHandlers(hotspot);
      const profile = getEffectiveInputProfile(getGameSettings());
      const manager = resolveGameStateManager(this.game);
      const resolution = resolvePointerVerbForTarget(
        pointer,
        profile,
        { defaultVerb: hotspot.defaultVerb },
        manager.getActiveVerb(),
        manager.getActiveInventoryItemId(),
      );
      if (resolution.kind === 'none') {
        return;
      }
      if (resolution.kind === 'clearActive') {
        manager.clearActiveInventoryItem();
        manager.clearActiveVerb();
        return;
      }
      if (resolution.kind === 'walkToTarget') {
        void this.walkPlayerTo(hotspot.id);
        return;
      }
      if (resolution.kind === 'verb') {
        if (shouldDispatchInventoryUsedOnVerbForGame(manager, resolution.verbId, resolution)) {
          const itemId = manager.getActiveInventoryItemId()!;
          const shouldDrop = shouldDropActiveInventoryOnUse(itemId);
          console.log(
            `[Benne] inventory-on "${resolution.verbId}" item ${itemId} → hotspot ${hotspot.id}`,
          );
          const handled = dispatchInventoryOnVerbTargetInteraction(gameEvents, itemId, resolution.verbId, {
            type: 'hotspot',
            hotspotId: hotspot.id,
            roomId,
            description: hotspot.description,
            walkToPoint: hotspot.walkToPoint,
            lookAtPoint: hotspot.lookAtPoint,
          });
          if (!handled && shouldDrop) {
            manager.clearActiveInventoryItem();
          }
          if (resolution.consumeActive && shouldDrop) {
            manager.clearActiveVerb();
          }
          return;
        }
      }
      if (Object.keys(handlers.onVerb).length === 0 && handlers.onVerbFallback === undefined) {
        return;
      }
      console.log(`[Benne] verb "${resolution.verbId}" hotspot ${hotspot.id}`);
      dispatchVerbInteraction(gameEvents, resolution.verbId, handlers, {
        type: 'hotspot',
        hotspotId: hotspot.id,
        roomId,
        description: hotspot.description,
        walkToPoint: hotspot.walkToPoint,
        lookAtPoint: hotspot.lookAtPoint,
      });
      if (resolution.consumeActive) {
        manager.clearActiveVerb();
      }
    };

    const zone = this.add.zone(0, 0, roomW, roomH).setOrigin(0, 0);
    zone.setData('benneHotspot', true);
    zone.setData('benneHotspotId', hotspot.id);
    const flat: number[] = [];
    for (const p of pts) {
      flat.push(p.x, p.y);
    }
    const geom = new Phaser.Geom.Polygon(flat);
    zone.setInteractive(geom, Phaser.Geom.Polygon.Contains);
    zone.input!.cursor = isBenneGameCursorAsepriteEnabled(getGameSettings()) ? 'none' : 'pointer';
    zone.on('pointerdown', onHotspotPointer);

    this.roomStackEntities.push({
      kind: 'hotspot',
      zone,
      zIndex: hotspot.zIndex ?? 0,
      baselineRoomY: hotspot.baseline,
      sortKey: `hotspot:${hotspot.id}`,
    });
  }

  private spawnCharacter(roomId: string, spawn: RoomCharacterSpawn): void {
    if (spawn.loadKind === 'aseprite') {
      this.spawnAsepriteCharacter(roomId, spawn);
      return;
    }

    const sprite = this.add.image(0, 0, spawn.textureKey);
    const feet = resolveCharacterFeetLocal(spawn.data, sprite as Phaser.GameObjects.Sprite);
    placeSpriteByFeet(sprite as Phaser.GameObjects.Sprite, feet, spawn.x, spawn.y);
    sprite.setVisible(spawn.visible !== false);
    sprite.setData('character', spawn.data);
    sprite.setData('walkSpeed', spawn.data.walkSpeed);
    sprite.setData('instanceId', spawn.instanceId);
    if (!this.characterSpritesByDefId.has(spawn.data.id)) {
      this.characterSpritesByDefId.set(spawn.data.id, sprite);
    }
    this.roomStackEntities.push({
      kind: 'character',
      sprite,
      zIndex: spawn.zIndex ?? 0,
      character: spawn.data,
      sortKey: `character:${spawn.instanceId}`,
    });
    this.attachCharacterInteraction(roomId, spawn, sprite);
  }

  private spawnAsepriteCharacter(roomId: string, spawn: RoomCharacterSpawn): void {
    const sprite = this.add.sprite(0, 0, spawn.textureKey);
    sprite.setVisible(spawn.visible !== false);
    sprite.setData('character', spawn.data);
    sprite.setData('walkSpeed', spawn.data.walkSpeed);
    sprite.setData('instanceId', spawn.instanceId);
    const isPlayer = spawn.data.id === getStartingPlayerCharacterId();
    sprite.setData('isPlayer', isPlayer);

    const createdAnims = sprite.anims.createFromAseprite(spawn.textureKey);
    setupCharacterAsepritePlayback(sprite, spawn.data, createdAnims);
    attachDirectionalAnimationApi(sprite);

    const animBase = spawn.initialAnimation ?? 'Idle';
    const facing = resolveSpawnIdleFacing(sprite, spawn.initialFacing);
    playDirectionalAnimation(sprite, animBase, facing);

    const feet = resolveCharacterFeetLocal(spawn.data, sprite);
    placeSpriteByFeet(sprite, feet, spawn.x, spawn.y);

    this.attachCharacterInteraction(roomId, spawn, sprite);

    if (isPlayer) {
      this.player = sprite as DirectionalCharacterSprite;
    }
    if (!this.characterSpritesByDefId.has(spawn.data.id)) {
      this.characterSpritesByDefId.set(spawn.data.id, sprite);
    }
    this.roomStackEntities.push({
      kind: 'character',
      sprite,
      zIndex: spawn.zIndex ?? 0,
      character: spawn.data,
      sortKey: `character:${spawn.instanceId}`,
    });
  }

  private attachCharacterInteraction(
    roomId: string,
    spawn: RoomCharacterSpawn,
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
  ): void {
    if (spawn.visible === false) {
      return;
    }
    const handlers = getCharacterVerbHandlers(spawn.data);
    if (
      !spawn.data.clickable ||
      (Object.keys(handlers.onVerb).length === 0 && handlers.onVerbFallback === undefined)
    ) {
      return;
    }

    const colliderPts = spawn.data.collider?.points;
    if (colliderPts && colliderPts.length >= 3) {
      const flat = colliderPts.flatMap((p) => [p.x, p.y]);
      const poly = new Phaser.Geom.Polygon(flat);
      sprite.setInteractive({
        hitArea: poly,
        hitAreaCallback: Phaser.Geom.Polygon.Contains,
        useHandCursor: !isBenneGameCursorAsepriteEnabled(getGameSettings()),
      });
    } else {
      sprite.setInteractive({ useHandCursor: !isBenneGameCursorAsepriteEnabled(getGameSettings()) });
    }
    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.tryConsumeScriptedDialogClickToSkip(pointer)) {
        return;
      }
      if (this.isScriptedDialogInputSuppressed()) {
        return;
      }
      const profile = getEffectiveInputProfile(getGameSettings());
      const manager = resolveGameStateManager(this.game);
      const resolution = resolvePointerVerbForTarget(
        pointer,
        profile,
        { defaultVerb: spawn.data.defaultVerb },
        manager.getActiveVerb(),
        manager.getActiveInventoryItemId(),
      );
      if (resolution.kind === 'none') {
        return;
      }
      if (resolution.kind === 'clearActive') {
        manager.clearActiveInventoryItem();
        manager.clearActiveVerb();
        return;
      }
      if (resolution.kind === 'walkToTarget') {
        void this.walkPlayerTo(spawn.data.id);
        return;
      }
      if (resolution.kind === 'verb') {
        if (shouldDispatchInventoryUsedOnVerbForGame(manager, resolution.verbId, resolution)) {
          const itemId = manager.getActiveInventoryItemId()!;
          const shouldDrop = shouldDropActiveInventoryOnUse(itemId);
          console.log(
            `[Benne] inventory-on "${resolution.verbId}" item ${itemId} → character ${spawn.data.id}`,
          );
          const sx = sprite.x;
          const sy = sprite.y;
          const d = spawn.data;
          const handled = dispatchInventoryOnVerbTargetInteraction(gameEvents, itemId, resolution.verbId, {
            type: 'character',
            characterId: d.id,
            instanceId: spawn.instanceId,
            roomId,
            description: d.description,
            ...(d.walkToPoint !== undefined
              ? { walkToPoint: { x: sx + d.walkToPoint.x, y: sy + d.walkToPoint.y } }
              : {}),
            ...(d.talkPoint !== undefined
              ? { talkPoint: { x: sx + d.talkPoint.x, y: sy + d.talkPoint.y } }
              : {}),
          });
          if (!handled && shouldDrop) {
            manager.clearActiveInventoryItem();
          }
          if (resolution.consumeActive && shouldDrop) {
            manager.clearActiveVerb();
          }
          return;
        }
      }
      console.log(`[Benne] verb "${resolution.verbId}" character ${spawn.data.id}`);
      const sx = sprite.x;
      const sy = sprite.y;
      const d = spawn.data;
      dispatchVerbInteraction(gameEvents, resolution.verbId, handlers, {
        type: 'character',
        characterId: d.id,
        instanceId: spawn.instanceId,
        roomId,
        description: d.description,
        ...(d.walkToPoint !== undefined
          ? { walkToPoint: { x: sx + d.walkToPoint.x, y: sy + d.walkToPoint.y } }
          : {}),
        ...(d.talkPoint !== undefined
          ? { talkPoint: { x: sx + d.talkPoint.x, y: sy + d.talkPoint.y } }
          : {}),
      });
      if (resolution.consumeActive) {
        manager.clearActiveVerb();
      }
    });
  }

  private setupCustomGameCursor(): void {
    const settings = getGameSettings();
    if (!isBenneGameCursorAsepriteEnabled(settings) || !this.textures.exists(CURSOR_TEXTURE_KEY)) {
      return;
    }
    const cfg = settings.cursor!;
    const idleKey = cfg.idleAnimation.trim();
    const activeKey = cfg.activeAnimation.trim();

    const created = this.anims.createFromAseprite(CURSOR_TEXTURE_KEY);
    applyCharacterAnimationClips(created, cfg.animations);

    if (!this.anims.exists(idleKey) || !this.anims.exists(activeKey)) {
      console.warn(
        `[Benne] Custom cursor: sheet is missing idle "${idleKey}" and/or active "${activeKey}" animation — skipping.`,
      );
      return;
    }

    this.input.setDefaultCursor('none');

    const sprite = this.add.sprite(0, 0, CURSOR_TEXTURE_KEY);
    sprite.setScrollFactor(0, 0);
    sprite.setDepth(CUSTOM_CURSOR_DEPTH);
    sprite.setName('benne-custom-cursor');
    sprite.play(idleKey);
    this.customCursorSprite = sprite;
    this.lastCustomCursorVisualKey = null;

    gameEvents.on(GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT, this.onCustomGameStateForCursor);
    gameEvents.on(GAME_STATE_ACTIVE_VERB_CHANGED_EVENT, this.onCustomGameStateForCursor);
    this.refreshCustomCursor(this.input.activePointer);
  }

  private teardownCustomGameCursor(): void {
    if (!this.customCursorSprite) {
      return;
    }
    this.customCursorSprite.destroy();
    this.customCursorSprite = null;
    this.lastCustomCursorVisualKey = null;
    gameEvents.off(GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT, this.onCustomGameStateForCursor);
    gameEvents.off(GAME_STATE_ACTIVE_VERB_CHANGED_EVENT, this.onCustomGameStateForCursor);
    this.input.setDefaultCursor('default');
  }

  private ensureAsepriteAnimsFromAtlasOnce(textureKey: string): void {
    if (!this.textures.exists(textureKey)) {
      return;
    }
    const flagKey = `__benneAsepriteAnims:${textureKey}`;
    if (this.game.registry.get(flagKey)) {
      return;
    }
    this.anims.createFromAseprite(textureKey);
    this.game.registry.set(flagKey, true);
  }

  /**
   * When an inventory item is active and its definition sets {@link InventoryItemData.cursorAnimation} on a
   * loaded sheet, returns texture + resolved Phaser animation key; otherwise `null` (caller uses verb cursor).
   */
  private tryActiveInventoryCursorClip(): { textureKey: string; animKey: string } | null {
    const manager = resolveGameStateManager(this.game);
    const itemId = manager.getActiveInventoryItemId();
    if (itemId == null || itemId.length === 0) {
      return null;
    }
    const def = getInventoryDefinition(itemId);
    if (!def) {
      return null;
    }
    const tag = def.cursorAnimation?.trim();
    if (!tag) {
      return null;
    }
    const mode = def.display?.aseprite;
    if (mode !== true && mode !== 'shared') {
      return null;
    }
    const textureKey = mode === 'shared' ? sharedInventoryTextureKey : getPerItemInventoryTextureKey(itemId);
    if (!this.textures.exists(textureKey)) {
      return null;
    }
    this.ensureAsepriteAnimsFromAtlasOnce(textureKey);
    const animKey = inventoryPhaserAnimationKeyForTag(def, tag);
    if (!this.anims.exists(animKey)) {
      return null;
    }
    return { textureKey, animKey };
  }

  /**
   * Short label for the prop, hotspot, or GUI inventory row under the pointer (verb line / LucasArts-style).
   */
  private resolveVerbLineHoverDescription(pointer: Phaser.Input.Pointer): string | null {
    if (this.isScriptedDialogInputSuppressed()) {
      return null;
    }
    const hits = this.input.hitTestPointer(pointer);
    for (const o of hits) {
      const go = o as Phaser.GameObjects.GameObject & { getData?: (key: string) => unknown };
      if (typeof go.getData !== 'function') {
        continue;
      }
      if (go.getData('benneGuiButton') === true) {
        continue;
      }
      if (go.getData('benneInventorySlot') === true) {
        const itemId = go.getData('benneInventoryItemId') as string | undefined;
        if (!itemId) {
          return null;
        }
        const inv = getInventoryDefinition(itemId) as InventoryItemData | undefined;
        if (!inv) {
          return null;
        }
        const fromDesc = inv.description?.trim();
        if (fromDesc && fromDesc.length > 0) {
          return fromDesc;
        }
        const fromName = inv.name?.trim();
        return fromName && fromName.length > 0 ? fromName : null;
      }
      if (go.getData('benneHotspot') === true) {
        const hid = go.getData('benneHotspotId') as string | undefined;
        if (!hid) {
          return null;
        }
        const hs = this.roomData.hotspots.find((h) => h.id === hid);
        const d = hs?.description?.trim();
        return d && d.length > 0 ? d : null;
      }
      if (go.getData('character')) {
        return null;
      }
      for (const [propId, propSprite] of this.propSpritesById) {
        if (propSprite === o) {
          const trimmedOverride = this.propDescriptionOverrides.get(propId)?.trim();
          if (trimmedOverride && trimmedOverride.length > 0) {
            return trimmedOverride;
          }
          const p = this.roomData.props?.find((rp) => rp.id === propId);
          const pd = p?.description?.trim();
          return pd && pd.length > 0 ? pd : null;
        }
      }
      break;
    }
    return null;
  }

  private refreshCustomCursor(pointer: Phaser.Input.Pointer): void {
    const sprite = this.customCursorSprite;
    if (!sprite || !sprite.scene) {
      return;
    }
    const settings = getGameSettings();
    applyGameCursorSpriteHotspot(sprite, pointer, settings.cursor!);

    const idleKey = settings.cursor!.idleAnimation.trim();
    const activeKey = settings.cursor!.activeAnimation.trim();

    const overClickable = this.isCursorOverBenneClickable(this.input.hitTestPointer(pointer));
    // Active inventory cursor clips take precedence regardless of hover target.
    const invClip = this.tryActiveInventoryCursorClip();
    const visualKey = invClip
      ? `inv|${invClip.textureKey}|${invClip.animKey}`
      : overClickable
        ? `verb|${activeKey}`
        : `idle|${idleKey}`;

    if (this.lastCustomCursorVisualKey === visualKey) {
      return;
    }
    this.lastCustomCursorVisualKey = visualKey;

    if (invClip) {
      sprite.setTexture(invClip.textureKey);
      sprite.play(invClip.animKey);
      return;
    }
    if (!overClickable) {
      sprite.setTexture(CURSOR_TEXTURE_KEY);
      sprite.play(idleKey);
      return;
    }
    sprite.setTexture(CURSOR_TEXTURE_KEY);
    sprite.play(activeKey);
  }

  /**
   * True when Phaser’s hit stack includes a room prop (clickable path only registers hit areas),
   * hotspot zone, clickable character sprite, or GUI `button` hit target.
   */
  private isCursorOverBenneClickable(hits: Phaser.GameObjects.GameObject[]): boolean {
    for (const o of hits) {
      const go = o as Phaser.GameObjects.GameObject & { getData?: (key: string) => unknown };
      if (typeof go.getData === 'function') {
        if (
          go.getData('benneGuiButton') === true ||
          go.getData('benneHotspot') === true ||
          go.getData('benneInventorySlot') === true
        ) {
          return true;
        }
        if (go.getData('character')) {
          return true;
        }
      }
      for (const propSprite of this.propSpritesById.values()) {
        if (propSprite === o) {
          return true;
        }
      }
    }
    return false;
  }
}

function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Point2 {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq < 1e-18) {
    return { x: ax, y: ay };
  }
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + abx * t, y: ay + aby * t };
}

/** Closest point in or on a simple closed polygon (room space). */
function closestPointInOrOnSimplePolygon(
  px: number,
  py: number,
  vertices: readonly Point2[],
): Point2 | null {
  if (vertices.length < 3) {
    return null;
  }
  if (pointInPolygon(px, py, vertices)) {
    return { x: px, y: py };
  }
  let bestX = 0;
  let bestY = 0;
  let bestD = Infinity;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % n]!;
    const q = closestPointOnSegment(px, py, a.x, a.y, b.x, b.y);
    const d = (px - q.x) * (px - q.x) + (py - q.y) * (py - q.y);
    if (d < bestD) {
      bestD = d;
      bestX = q.x;
      bestY = q.y;
    }
  }
  return { x: bestX, y: bestY };
}

/** Centroid of a simple polygon; falls back to vertex average when area is degenerate. */
function polygonRingCentroid(pts: readonly Point2[]): Point2 | null {
  const n = pts.length;
  if (n < 3) {
    return null;
  }
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = pts[i]!.x;
    const yi = pts[i]!.y;
    const xj = pts[j]!.x;
    const yj = pts[j]!.y;
    const cross = xi * yj - xj * yi;
    twiceArea += cross;
    cx += (xi + xj) * cross;
    cy += (yi + yj) * cross;
  }
  if (Math.abs(twiceArea) < 1e-10) {
    let sx = 0;
    let sy = 0;
    for (const p of pts) {
      sx += p.x;
      sy += p.y;
    }
    return { x: sx / n, y: sy / n };
  }
  const k = 1 / (3 * twiceArea);
  return { x: cx * k, y: cy * k };
}
