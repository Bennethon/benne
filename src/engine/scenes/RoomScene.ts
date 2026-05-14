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
  GAME_STATE_VARIABLE_CHANGED_EVENT,
  type GameStateVariableChangedPayload,
} from '../../types/gameState';
import { cursorPhaserAnimationKey, roomPropPhaserAnimationKey } from '../../game/asepritePhaserAnimationKeys';
import {
  getPerItemInventoryTextureKey,
  inventoryPhaserAnimationKeyForTag,
  sharedInventoryTextureKey,
} from '../../game/inventoryAseprite';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry';
import {
  inventoryCursorAnimationVariableKey,
  inventoryDefaultAnimationVariableKey,
  readEffectiveInventoryCursorAnimationTag,
  readEffectiveInventoryDefaultAnimationTag,
} from '../inventory/inventoryScriptingAnimations.js';
import {
  PLAYER_WALK_START,
  PLAYER_WALK_STOP,
  type PlayerWalkStartPayload,
  type PlayerWalkStopPayload,
} from '../events/playerWalkEvents';
import { ensureAsepriteAtlasAnimationsRegisteredOnce } from '../aseprite/ensureAsepriteAtlasAnimationsOnce.js';
import {
  applyCharacterAnimationClips,
  playCharacterAnimation,
  setupCharacterAsepritePlayback,
} from '../characterAnimationPlayback';
import {
  applyCharacterEffectiveAnimation,
  characterFaceLetterRespectingOverride,
  getCharacterAnimationOverrideTag,
  getCharacterEffectiveAnimationTag,
  promiseWhenSpriteAnimationFinishes,
  readSavedCharacterAlpha,
  readSavedCharacterAnimationOverride,
  readSavedCharacterMovable,
  readSavedCharacterPosition,
  readSavedCharacterVisible,
  readSavedPropAlpha,
  readSavedPropBaseAnimationTag,
  readSavedPropPosition,
  readSavedPropVisible,
  readSavedHotspotActive,
  readSavedRegionActive,
  writeSavedHotspotActive,
  writeSavedRegionActive,
  setCharacterAnimationOverrideTagOnSprite,
  writeSavedCharacterAlpha,
  writeSavedCharacterAnimationOverride,
  writeSavedCharacterMovable,
  writeSavedCharacterPosition,
  writeSavedCharacterVisible,
  writeSavedPropAlpha,
  writeSavedPropBaseAnimationTag,
  writeSavedPropPosition,
  writeSavedPropVisible,
} from '../benneAnimationRuntime';
import { registerSnapshotFlushHook } from '../gameState/snapshotFlushHooks';
import type { CharacterFacingLetter } from '../../types/character';
import { getDialogSettings, getGameSettings, getPerspectiveSettings } from '../ConfigManager';
import {
  applyGameCursorSpriteHotspot,
  CURSOR_TEXTURE_KEY,
  isBenneGameCursorAsepriteEnabled,
} from '../../game/cursorAseprite';
import {
  syncBenneRoomPropTightWorldPosition,
  warnDevIfAsepriteJsonMissingSpriteSourceSize,
  wireBenneRoomPropTightPlacementAfterFrameChanges,
} from '../aseprite/asepriteFramePlacement';
import { attachPostProcessingPlaceholder } from '../postfx/PostEffects';
import {
  attachBenneCharacterPerspectiveRenderNodes,
  registerBenneCharacterPerspectiveBatch,
} from '../rendering/benneCharacterPerspectiveBatch.js';
import {
  BENNE_RUNTIME_HI_DPI_WIRED_REGISTRY_KEY,
  syncBenneRuntimeHiDpiSceneMainCameras,
} from '../benneRuntimeHiDpiScale.js';
import {
  cameraFollowOffsetForFeet,
  getCharacterWorldFeet,
  placeSpriteByFeet,
  resolveCharacterFeetLocal,
  type CharacterFeetLocal,
} from '../characterFeet';
import {
  applyCharacterSpriteRegionTintFromWinningRegion,
  computeRoomRegionPerspective,
  resolveWinningRoomRegionIdAtFeet,
} from '../room/regionCharacterScale';
import { roomRegionEnterEventId, roomRegionExitEventId } from '../events/regionEnterExitEvents';
import type { RegionEnterExitContext } from '../../types/regionEnterExit';
import { clampWalkDestinationTowardClick, pointInPolygon, withNonWalkableRegionsAsHoles } from '../walkable';
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
import { resolvePointerVerbForTarget, type PointerVerbTarget } from '../verbs/resolvePointerVerb';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager';
import { incrementRoomVisitCount } from '../gameState/roomVisitState';
import { getInternalHeight, getInternalWidth, getStartingPlayerCharacterId, SCENE_ROOM } from '../../game/constants';
import type { CharacterAnimationsConfig } from '../../types/character';
import type { CharacterData } from '../../types/character';
import type { InventoryItemData } from '../../types/inventory';
import type { VerbHoverTarget } from '../../types/verbContext';
import type { Point2, RoomData, RoomHotspotData, RoomPropInstance } from '../../types/room';
import type { GuiButtonControl, GuiData, GuiGridControl } from '../../types/gui';
import type { RoomCharacterSpawn, RoomPropSpawn, RoomSceneStartData } from './BootScene';
import { createRoomScriptContext } from '../scripting/RoomScriptContext.js';
import { createCharacterScriptContext } from '../scripting/CharacterScriptContext.js';
import { createInventoryScriptContext } from '../scripting/InventoryScriptContext.js';
import type { CharacterScriptContext, InventoryScriptContext } from '@engine/scripting/types.js';
import { getCallbacksForRoom } from '../scripting/registerRoomScript.js';
import {
  buildGuiOverlay,
  GUI_OVERLAY_DEPTH_STRIDE,
  GUI_TEXT_OVERLAY_DEPTH,
  type GuiOverlayHandle,
} from '../gui/buildGuiOverlay';
import { getRegisteredDialogChoiceGuiIds, getDialogDefinition } from '../dialog/dialogDefinitionRegistry';
import {
  dialogOptionUsedVariableKey,
  readEffectiveDialogOptionEnabled,
} from '../dialog/dialogOptionVariables';
import type { Dialog } from '../../types/dialogue';
import {
  DialogChoiceDynamicRowState,
  DIALOG_CHOICE_GRID_ID,
  getDialogChoiceAvailableHeightPx,
  getDialogChoiceScrollButtonState,
} from '../dialog/dialogChoiceGuiRuntime';
import {
  DIALOG_STARTED_EVENT,
  DIALOG_STOPPED_EVENT,
  DIALOG_OPTION_ENABLED_CHANGED_EVENT,
  dialogChoiceSyntheticButtonId,
  type DialogStartedPayload,
  type DialogStoppedPayload,
  type DialogOptionEnabledChangedPayload,
} from '../events/dialogEvents';
import { guiAllButtonsClickEventId, guiButtonClickEventId, type GuiAllButtonsClickPayload } from '../events/guiButtonEvents';
import { endDialogSessionIfMatches, getActiveDialogBenneScript } from '../scripting/dialogSession.js';
import {
  BENNE_VERB_CONTEXT_CHANGED_EVENT,
  clearBenneVerbHoverContext,
  getBenneVerbContextChangedEmitter,
  publishBenneVerbHoverContext,
} from '../scripting/benneVerbContextScriptSurface.js';
import type { GuiRuntime } from '../scripting/GuiRuntime.js';
import {
  BENNE_SCREEN_FADE_DEFAULT_COLOR,
  BENNE_SCREEN_FADE_DEFAULT_DURATION_SEC,
  BENNE_SCREEN_FADE_OVERLAY_DEPTH,
} from './roomScreenFadeConstants';
import { getGuiBenneScript } from '../scripting/registerGuiScript.js';
import type { BenneScriptCore } from '../scripting/BenneScriptCore.js';
import {
  tryGetGlobalBenneScriptForRoomTransitions,
  tryGetRoomTransitionOrchestrator,
} from './roomTransitionGlobals.js';
import { clearPlayFromRegistrationsForRoom } from '../scripting/devPlayFromRegistry.js';
import { BENNE_ROOM_START_KIND_KEY, type BenneRoomStartKind } from './roomStartKindConstants.js';
import { getAllGuiData } from '../../game/loadGuiData';
import {
  applyRoomStackDepths,
  sortRoomStackEntities,
  type RoomStackEntity,
} from '../room/roomStackDrawOrder';

/** Engine-reserved id for {@link RoomScene.setDialogTextOverlay} (Bennescript `say` / `say.now`). */
const SPEAKING_TEXT_GUI_ID = 'speaking-text';

/** Engine-reserved id for {@link RoomScene.setDisplayTextOverlay} (Bennescript `display` / `display.now`). */
const DISPLAY_TEXT_GUI_ID = 'display-text';

/**
 * Optional `Phaser.Game.registry` key: when set to a boolean, overrides the initial visibility of
 * every non-`speaking-text` GUI overlay at room load. Used by the BENNE room preview so authors can
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
  const sx = player.scaleX;
  const sy = player.scaleY;
  const lx = player.getData('feetLocalX') as number | undefined;
  const ly = player.getData('feetLocalY') as number | undefined;
  if (typeof lx === 'number' && typeof ly === 'number') {
    return cameraFollowOffsetForFeet({ x: lx * sx, y: ly * sy });
  }
  const data = player.getData('character') as CharacterData | undefined;
  const feet = data ? resolveCharacterFeetLocal(data, player) : { x: player.frame.width * 0.5, y: player.frame.height };
  return cameraFollowOffsetForFeet({ x: feet.x * sx, y: feet.y * sy });
}

/** Outline color for `debug.showWalkable` (green). */
const DEBUG_WALKABLE_STROKE = 0x33dd66;
/** Hole rings under an active walkable polygon (debug). */
const DEBUG_WALKABLE_HOLE_STROKE = 0x229955;
/** Outline color for `debug.showPropOutlines` (magenta). */
const DEBUG_PROP_COLLIDER_STROKE = 0xff44cc;
/** Outline color for `debug.showRegionOutlines` (amber; distinct from walkable / prop / path). */
const DEBUG_REGION_STROKE = 0xffaa33;
/** Live pathfinding polyline overlay color (cyan). */
const DEBUG_WALK_PATH_STROKE = 0x33ccff;

function mergeRoomPropAnimationClips(spawns: readonly RoomPropSpawn[], roomId: string): CharacterAnimationsConfig {
  const out: CharacterAnimationsConfig = {};
  for (const s of spawns) {
    if (s.data.animations) {
      for (const [k, v] of Object.entries(s.data.animations)) {
        out[roomPropPhaserAnimationKey(roomId, k)] = v;
      }
    }
  }
  return out;
}

function verbHoverDefaultVerbPatch(def: PointerVerbTarget): Pick<VerbHoverTarget, 'defaultVerb'> {
  const v = def.defaultVerb;
  return v && v.length > 0 ? { defaultVerb: v } : {};
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
   * shipped game `cameras.main.zoom` follows {@link syncBenneRuntimeHiDpiSceneMainCameras} (hi-DPI
   * `Scale.NONE` layout) so `scrollFactor: 0` overlays stay aligned with the main viewport. In the
   * preview the main camera is zoomed (`Scale.RESIZE`
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

  /** Bennescript cores active for this `RoomScene` (reset interaction tails before leave / transition). */
  private benneCoresForTransitionReset: BenneScriptCore[] = [];

  /** Props that need per-frame position updates for parallax scrolling. */
  private parallaxProps: Array<{
    sprite: Phaser.GameObjects.Sprite;
    baseX: number;
    baseY: number;
    parallaxDepth: number;
  }> = [];

  /**
   * Props, characters, and hotspot zones reordered each frame by {@link sortRoomStackEntities}
   * (`zIndex` + optional `baseline` rules, with a deterministic fallback when those rules contradict).
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

  /**
   * First JSON `RoomCharacterInstance.visible` fold (`!== false`) per character definition id
   * in this room (same “first wins” rule as {@link characterSpritesByDefId}).
   */
  private characterJsonVisibleByDefId = new Map<string, boolean>();
  /** Definition JSON default for `CharacterData.movable` (first spawn in this room wins). */
  private characterJsonMovableByDefId = new Map<string, boolean>();

  /** Active scripted walks for non-player characters (by sprite identity). */
  private npcWalkTweens = new Map<
    Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    Phaser.Tweens.Tween
  >();

  /** String ids that already triggered `walkTo` resolution warnings (warn once per id per room load). */
  private unresolvedWalkTargetIdsWarned = new Set<string>();

  /** `B.hotspot(id)` with an id not in `roomData.hotspots` — warn once per id per room load. */
  private unknownHotspotScriptIdsWarned = new Set<string>();

  /**
   * Unregister handle for the snapshot flush hook installed in {@link create} and torn down on
   * {@link Phaser.Scenes.Events.SHUTDOWN}. Null when no hook is registered (preview / pre-create).
   */
  private snapshotFlushHookUnregister: (() => void) | null = null;

  /**
   * Full-screen fade (above all GUI overlays, below the custom pointer). Tweened by
   * {@link queueScreenFadeToAlpha} (`B.fadeOut` / `B.fadeIn`). Null only before `create` or after shutdown.
   */
  private screenFadeRect: Phaser.GameObjects.Rectangle | null = null;

  /** Screen-fixed Speaking Text overlay (`speaking-text` id): `guis/speaking-text/speaking-text.gui.json`. */
  private dialogTextOverlay: GuiOverlayHandle | null = null;

  /** Screen-fixed Display Text overlay (`display-text` id): `guis/display-text/display-text.gui.json`. */
  private displayTextOverlay: GuiOverlayHandle | null = null;

  /** Dedupes missing-`speaking-text` warnings for Bennescript `say` (once per room `create`). */
  private missingDialogTextOverlaySayWarned = false;

  /** Dedupes missing-`display-text` warnings for Bennescript `display` (once per room `create`). */
  private missingDisplayTextOverlayWarned = false;

  /** Every other registered GUI overlay (authoring under `src/game/guis/<id>/`), built automatically in `create`. */
  private genericGuiOverlays: GuiOverlayHandle[] = [];

  /** Latest {@link GuiRuntime} per overlay id for **`B.gui(…)`** on GUI scripts (generic + speaking-text + choice GUIs). */
  private guiRuntimeByGuiId = new Map<string, GuiRuntime>();

  /**
   * Parallel to {@link genericGuiOverlays}: each overlay’s effective visibility before the active dialog session hid
   * them. `null` when no dialog is open.
   */
  private genericGuiVisibilityBeforeDialog: boolean[] | null = null;

  /**
   * Choice-dialog GUIs (`dialog` plus any `guiId` from `*.dialog.json`), built like `speaking-text` and kept hidden until
   * {@link DIALOG_STARTED_EVENT}.
   */
  private readonly dialogChoiceInstallByGuiId = new Map<
    string,
    {
      built: NonNullable<ReturnType<typeof buildGuiOverlay>>;
      guiData: GuiData;
      baseDepth: number;
    }
  >();
  private readonly dialogChoiceRuntimeByGuiId = new Map<string, GuiRuntime>();
  private readonly dialogChoiceRowState = new DialogChoiceDynamicRowState();
  private activeDialogChoiceSession: { guiId: string; dialogId: string; scrollOffset: number } | null = null;
  /** True while {@link pushScriptedDialogInputSuppression} was called for an active choice overlay (paired with {@link onDialogChoiceStopped}). */
  private dialogChoiceInputSuppressionActive = false;
  private dialogChoiceUiDisposers: Array<() => void> = [];

  private readonly dialogOverlayScreenScratch = new Phaser.Math.Vector2();
  /** Scratch for {@link refreshCustomCursor} when the editor UI camera owns the pointer sprite. */
  private readonly customCursorWorldScratch = new Phaser.Math.Vector2();

  /**
   * When non-zero, a Bennescript `say` / `say.now` line timer is active — ignore room background walks
   * and prop/hotspot/character verb clicks so the player cannot act until the line ends.
   */
  private scriptedDialogInputSuppressionDepth = 0;

  /**
   * Reference-counted cutscene depth. While > 0 ALL pointer input (props, hotspots, characters,
   * GUI buttons, inventory rows, background walks, hover descriptions) is suppressed. Only the
   * click-to-skip scripted-dialog path remains live. Increment via {@link pushCutscene},
   * decrement via {@link popCutscene}. Reset to 0 on room transitions.
   */
  private cutsceneDepth = 0;

  /**
   * Character definition id → last frame’s winning `room.regions[].id` at world feet (`null` = outside all).
   * Used with {@link syncCharacterRegionEnterExit} (Bennescript **`B.region`…`whenEnter` / `whenExit`**).
   */
  private characterFeetWinningRegionId = new Map<string, string | null>();

  /** First `update` pass seeds {@link characterFeetWinningRegionId} without emitting enter/exit. */
  private regionEnterExitSeeded = false;

  /** When set, a left-click should end the active scripted dialog line early (global or per-line `say` options). */
  private scriptedDialogClickToSkip: (() => void) | null = null;

  /** Screen-space sprite when `game-config.json` enables `cursor.display.aseprite`. */
  private customCursorSprite: Phaser.GameObjects.Sprite | null = null;
  /** Dedupes {@link refreshCustomCursor} work when pointer + visual mode are unchanged. */
  private lastCustomCursorVisualKey: string | null = null;
  /** Republish **`B.currentHoverDescription`** / hover target from the active pointer (e.g. after inventory reshuffle). */
  private readonly syncVerbHoverScriptSurfaceAtActivePointer = (): void => {
    this.syncVerbHoverScriptSurface(this.input.activePointer);
  };

  private readonly onRoomPointerMove = (pointer: Phaser.Input.Pointer): void => {
    this.syncVerbHoverScriptSurfaceAtActivePointer();
    if (this.customCursorSprite) {
      this.refreshCustomCursor(pointer);
    }
  };
  private readonly onCustomGameStateForCursor = (): void => {
    this.lastCustomCursorVisualKey = null;
    this.refreshCustomCursor(this.input.activePointer);
  };

  private readonly onVariableChangeForCustomCursor = (payload: unknown): void => {
    const p = payload as GameStateVariableChangedPayload;
    const key = p.key;
    if (typeof key !== 'string' || !key.endsWith(':cursorAnimation')) {
      return;
    }
    this.lastCustomCursorVisualKey = null;
    this.refreshCustomCursor(this.input.activePointer);
  };

  constructor() {
    super(SCENE_ROOM);
  }

  create(data: RoomSceneStartData): void {
    registerBenneCharacterPerspectiveBatch(this.game);
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
    this.characterJsonVisibleByDefId.clear();
    this.characterJsonMovableByDefId.clear();
    this.npcWalkTweens.clear();
    this.characterFeetWinningRegionId.clear();
    this.regionEnterExitSeeded = false;
    this.restoreRegionActiveOverrides();
    this.restoreHotspotActiveOverrides();
    this.unresolvedWalkTargetIdsWarned.clear();
    this.unknownHotspotScriptIdsWarned.clear();
    this.missingDialogTextOverlaySayWarned = false;
    this.missingDisplayTextOverlayWarned = false;
    this.genericGuiVisibilityBeforeDialog = null;
    this.benneCoresForTransitionReset.length = 0;

    // Pull-up character/prop positions whenever a snapshot is taken, the room is left, or
    // `B.state.flush()` is called. Eagerly-saved fields (visibility, alpha, animation override)
    // are unaffected. The unregister fn fires on SHUTDOWN below.
    this.snapshotFlushHookUnregister?.();
    this.snapshotFlushHookUnregister = registerSnapshotFlushHook(() => {
      this.flushRuntimeStateToGameState();
    });

    attachPostProcessingPlaceholder(this.cameras.main);
    syncBenneRuntimeHiDpiSceneMainCameras(this.game);

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
    for (const spawn of data.characters) {
      const defId = spawn.data.id;
      if (!this.characterJsonVisibleByDefId.has(defId)) {
        this.characterJsonVisibleByDefId.set(defId, spawn.visible !== false);
      }
      if (!this.characterJsonMovableByDefId.has(defId)) {
        this.characterJsonMovableByDefId.set(defId, spawn.data.movable !== false);
      }
    }
    data.characters.forEach((spawn) => this.spawnCharacter(data.room.id, spawn));
    this.updateRoomStackDepths();

    this.setupRoomCamera(roomW, roomH);
    this.applyPlayerCameraFollow(roomW, roomH);
    this.drawRoomDebugOverlays(data);

    const guisSorted = [...getAllGuiData()].sort((a, b) => a.id.localeCompare(b.id));
    const dialogChoiceGuiIds = new Set(getRegisteredDialogChoiceGuiIds());
    const nonDialogGuis = guisSorted.filter(
      (g) =>
        g.id !== SPEAKING_TEXT_GUI_ID &&
        g.id !== DISPLAY_TEXT_GUI_ID &&
        !dialogChoiceGuiIds.has(g.id),
    );
    const speakingTextGui = guisSorted.find((g) => g.id === SPEAKING_TEXT_GUI_ID);
    const displayTextGui = guisSorted.find((g) => g.id === DISPLAY_TEXT_GUI_ID);

    const genericGuiVisibilityOverride = this.game.registry.get(
      GENERIC_GUIS_INITIAL_VISIBILITY_REGISTRY_KEY,
    );
    const hasGenericGuiVisibilityOverride = typeof genericGuiVisibilityOverride === 'boolean';

    this.genericGuiOverlays = [];
    this.guiRuntimeByGuiId.clear();
    let stackIndex = 0;
    const inventoryPanelPointerContext = {
      roomId: data.room.id,
      isInputSuppressed: (): boolean => this.isInputSuppressed(),
      tryConsumeDialogClickToSkip: (pointer: Phaser.Input.Pointer): boolean =>
        this.tryConsumeScriptedDialogClickToSkip(pointer),
    };
    const isButtonClickSuppressed = (): boolean => this.isCutsceneActive();
    for (const gui of nonDialogGuis) {
      const built = buildGuiOverlay(this, gui, {
        /** Preview / cutscene override wins; otherwise each GUI's required `visible` boolean. */
        startVisible: hasGenericGuiVisibilityOverride ? genericGuiVisibilityOverride : gui.visible,
        depth: GUI_TEXT_OVERLAY_DEPTH + stackIndex * GUI_OVERLAY_DEPTH_STRIDE,
        inventoryPanelPointerContext,
        isButtonClickSuppressed,
        previewGuiAsepriteSheetJson: data.previewGuiAsepriteSheetJsonById?.[gui.id],
      });
      if (built) {
        this.genericGuiOverlays.push(built.handle);
        const guiScript = getGuiBenneScript(gui.id);
        if (guiScript) {
          const rt = built.createGuiRuntime((factory) => guiScript.queueInteraction(factory));
          this.guiRuntimeByGuiId.set(gui.id, rt);
          guiScript.notifyGuiBuilt(rt);
        }
      }
      stackIndex += 1;
    }

    const speakingTextBuilt = speakingTextGui
      ? buildGuiOverlay(this, speakingTextGui, {
          /** Speech UI is driven by {@link setDialogTextOverlay}, not the JSON `visible` flag at boot. */
          startVisible: false,
          depth: GUI_TEXT_OVERLAY_DEPTH + stackIndex * GUI_OVERLAY_DEPTH_STRIDE,
          inventoryPanelPointerContext,
          isButtonClickSuppressed,
          previewGuiAsepriteSheetJson: data.previewGuiAsepriteSheetJsonById?.[SPEAKING_TEXT_GUI_ID],
        })
      : null;
    this.dialogTextOverlay = speakingTextBuilt?.handle ?? null;
    if (speakingTextBuilt) {
      const speakingTextScript = getGuiBenneScript(SPEAKING_TEXT_GUI_ID);
      if (speakingTextScript) {
        const rt = speakingTextBuilt.createGuiRuntime((factory) =>
          speakingTextScript.queueInteraction(factory),
        );
        this.guiRuntimeByGuiId.set(SPEAKING_TEXT_GUI_ID, rt);
        speakingTextScript.notifyGuiBuilt(rt);
      }
    }

    stackIndex += 1;
    const displayTextBuilt = displayTextGui
      ? buildGuiOverlay(this, displayTextGui, {
          /** Display Text UI is driven by {@link setDisplayTextOverlay}, not the JSON `visible` flag at boot. */
          startVisible: false,
          depth: GUI_TEXT_OVERLAY_DEPTH + stackIndex * GUI_OVERLAY_DEPTH_STRIDE,
          inventoryPanelPointerContext,
          isButtonClickSuppressed,
          previewGuiAsepriteSheetJson: data.previewGuiAsepriteSheetJsonById?.[DISPLAY_TEXT_GUI_ID],
        })
      : null;
    this.displayTextOverlay = displayTextBuilt?.handle ?? null;
    if (displayTextBuilt) {
      const displayTextScript = getGuiBenneScript(DISPLAY_TEXT_GUI_ID);
      if (displayTextScript) {
        const rt = displayTextBuilt.createGuiRuntime((factory) =>
          displayTextScript.queueInteraction(factory),
        );
        this.guiRuntimeByGuiId.set(DISPLAY_TEXT_GUI_ID, rt);
        displayTextScript.notifyGuiBuilt(rt);
      }
    }

    stackIndex += 1;
    const noopDialogQueue = (factory: () => Promise<unknown>): void => {
      void factory().catch((err) => console.error('[Benne] dialog choice GUI queued step failed:', err));
    };
    for (const guiId of [...dialogChoiceGuiIds].sort((a, b) => a.localeCompare(b))) {
      const gui = guisSorted.find((g) => g.id === guiId);
      if (!gui) {
        continue;
      }
      const dChoice = GUI_TEXT_OVERLAY_DEPTH + stackIndex * GUI_OVERLAY_DEPTH_STRIDE;
      const choiceBuilt = buildGuiOverlay(this, gui, {
        startVisible: false,
        depth: dChoice,
        inventoryPanelPointerContext,
        isButtonClickSuppressed,
        previewGuiAsepriteSheetJson: data.previewGuiAsepriteSheetJsonById?.[gui.id],
      });
      stackIndex += 1;
      if (!choiceBuilt) {
        continue;
      }
      this.dialogChoiceInstallByGuiId.set(guiId, { built: choiceBuilt, guiData: gui, baseDepth: dChoice });
      const choiceScript = getGuiBenneScript(guiId);
      const rt = choiceBuilt.createGuiRuntime((factory) =>
        choiceScript ? choiceScript.queueInteraction(factory) : noopDialogQueue(factory),
      );
      this.dialogChoiceRuntimeByGuiId.set(guiId, rt);
      this.guiRuntimeByGuiId.set(guiId, rt);
      choiceScript?.notifyGuiBuilt(rt);
    }

    this.wireDialogChoiceUi();

    this.createScreenFadeOverlay();
    const startKind: BenneRoomStartKind =
      (this.game.registry.get(BENNE_ROOM_START_KIND_KEY) as BenneRoomStartKind | undefined) ?? 'boot';
    if (startKind === 'transition') {
      this.screenFadeRect?.setAlpha(1);
    }

    this.setupCustomGameCursor();
    this.setupRuntimeUiCameraIfNeeded();
    this.input.on('pointermove', this.onRoomPointerMove);
    gameEvents.on(GAME_STATE_INVENTORY_CHANGED_EVENT, this.syncVerbHoverScriptSurfaceAtActivePointer);

    // ─────────────────────────────────────────────────────────────
    // Bennescript: after props, characters, player, and camera exist
    // ─────────────────────────────────────────────────────────────
    tryGetRoomTransitionOrchestrator()
      ?.getHookRegistry()
      .clearPerRoomScriptHooksForRoomId(data.room.id);
    clearPlayFromRegistrationsForRoom(data.room.id);

    const roomScripts = getCallbacksForRoom(data.room.id);
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
    if (roomScripts.length > 0) {
      const ctx = createRoomScriptContext(gameEvents, data.room.id, this);
      this.registerBenneScriptCoreForReset(ctx.B);
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
        this.registerBenneScriptCoreForReset(ctx.B);
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
        this.registerBenneScriptCoreForReset(ctx.B);
        benneDisposers.push(() => ctx.B.dispose());
        try {
          registerFn(ctx);
          ctx.B.ensureDefaultInventoryUseAndGiveActivationAfterRegister();
        } catch (err) {
          console.error(`[Benne] Error in inventory script for ${itemId} in room ${data.room.id}:`, err);
        }
      }
    }

    const benneDispose = benneDisposers.length > 0 ? () => benneDisposers.forEach((d) => d()) : null;

    this.input.mouse?.disableContextMenu();

    this.scale.on('resize', this.onScaleResize, this);
    this.input.on('pointerdown', this.handleRoomPointerDown);

    this.game.registry.remove(BENNE_ROOM_START_KIND_KEY);
    const orch = tryGetRoomTransitionOrchestrator();
    if (orch) {
      void orch.onRoomSceneCreateComplete(this, startKind);
    } else {
      const mgr = resolveGameStateManager(this.game);
      const cur = mgr.getCurrentRoom();
      if (cur == null || cur.length === 0) {
        mgr.setCurrentRoom(this.roomData.id);
      }
      incrementRoomVisitCount(mgr, this.roomData.id);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.snapshotFlushHookUnregister?.();
      this.snapshotFlushHookUnregister = null;
      benneDispose?.();
      for (const d of this.dialogChoiceUiDisposers) {
        d();
      }
      this.dialogChoiceUiDisposers.length = 0;
      for (const { built } of this.dialogChoiceInstallByGuiId.values()) {
        built.handle.destroy();
      }
      this.dialogChoiceInstallByGuiId.clear();
      this.dialogChoiceRuntimeByGuiId.clear();
      this.dialogChoiceRowState.clear();
      this.activeDialogChoiceSession = null;
      // Detach verb HUD listeners and clear hover *before* destroying overlays — otherwise
      // `clearBenneVerbHoverContext` emits and `verbs.gui` refresh runs against destroyed BitmapText.
      getBenneVerbContextChangedEmitter().removeAllListeners(BENNE_VERB_CONTEXT_CHANGED_EVENT);
      clearBenneVerbHoverContext();
      for (const h of this.genericGuiOverlays) {
        h.destroy();
      }
      this.genericGuiOverlays = [];
      this.genericGuiVisibilityBeforeDialog = null;
      this.dialogTextOverlay?.destroy();
      this.dialogTextOverlay = null;
      this.displayTextOverlay?.destroy();
      this.displayTextOverlay = null;
      this.guiRuntimeByGuiId.clear();
      this.dialogChoiceInputSuppressionActive = false;
      this.scriptedDialogInputSuppressionDepth = 0;
      this.scriptedDialogClickToSkip = null;
      this.scale.off('resize', this.onScaleResize, this);
      this.input.off('pointerdown', this.handleRoomPointerDown);
      this.input.off('pointermove', this.onRoomPointerMove);
      gameEvents.off(GAME_STATE_INVENTORY_CHANGED_EVENT, this.syncVerbHoverScriptSurfaceAtActivePointer);
      this.teardownCustomGameCursor();
      if (this.screenFadeRect) {
        this.tweens.killTweensOf(this.screenFadeRect);
        this.screenFadeRect.destroy();
        this.screenFadeRect = null;
      }
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
      this.benneCoresForTransitionReset.length = 0;
    });
  }

  getCurrentRoomId(): string {
    return this.roomData.id;
  }

  /** Resolves the live {@link GuiRuntime} for an overlay **`guiId`** while this room is active. */
  tryGetGuiRuntime(guiId: string): GuiRuntime | null {
    const id = guiId.trim();
    if (id.length === 0) {
      return null;
    }
    return this.guiRuntimeByGuiId.get(id) ?? null;
  }

  registerBenneScriptCoreForReset(core: BenneScriptCore): void {
    this.benneCoresForTransitionReset.push(core);
  }

  getBenneScriptCoresForTransitionReset(): readonly BenneScriptCore[] {
    return this.benneCoresForTransitionReset;
  }

  /**
   * Await interaction tails for this room’s registered script surfaces plus global **`B`** (if any).
   * Room-transition **enter** hooks and **playFrom** run outside the verb **`subscribe`** path, so they do
   * not implicitly await {@link import('../scripting/BenneScriptCore.js').BenneScriptCore.prototype.waitForInteractionQueue};
   * the orchestrator calls this after those callbacks so **`B.inventory.add`** (without **`.now`**) and
   * similar queued steps apply before fade-in.
   */
  async waitForEnterPhaseBenneScriptQueues(): Promise<void> {
    const cores: BenneScriptCore[] = [...this.benneCoresForTransitionReset];
    const globalB = tryGetGlobalBenneScriptForRoomTransitions();
    if (globalB) {
      cores.push(globalB);
    }
    if (cores.length === 0) {
      return;
    }
    await Promise.all(cores.map((c) => c.waitForInteractionQueue()));
  }

  /**
   * Clears dialog, time-based script delays, and walk state before a room change (engine).
   */
  clearStateForRoomTransition(): void {
    this.interruptPlayerWalk();
    this.setScriptedDialogClickToSkip(null);
    this.setDialogTextOverlay({ visible: false });
    this.setDisplayTextOverlay({ visible: false });
    const activeDialog = getActiveDialogBenneScript();
    if (activeDialog) {
      endDialogSessionIfMatches(activeDialog);
    }
    this.scriptedDialogInputSuppressionDepth = 0;
    this.cutsceneDepth = 0;
    this.time.removeAllEvents();
  }

  /**
   * Pull live character feet world positions and prop authoring positions into the
   * {@link import('../gameState/GameStateManager.js').GameStateManager} so the next room load
   * (or save snapshot) restores them. Called from
   * {@link import('../gameState/snapshotFlushHooks.js').runSnapshotFlushHooks} via the hook
   * registered in {@link create} — i.e. on room-transition leave (see
   * {@link import('./RoomTransitionOrchestrator.js').RoomTransitionOrchestrator.prepareForLeave}),
   * inside {@link import('../gameState/GameStateManager.js').GameStateManager.getSnapshot}, and
   * on `B.state.flush()`.
   *
   * Position is **not** eagerly written on every walk tick — that is the whole point of this
   * method.
   */
  flushRuntimeStateToGameState(): void {
    const manager = resolveGameStateManager(this.game);
    const roomId = this.roomData.id;

    for (const [defId, sprite] of this.characterSpritesByDefId) {
      const feet = getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
      writeSavedCharacterPosition(manager, roomId, defId, feet);
    }

    for (const [propId, sprite] of this.propSpritesById) {
      writeSavedPropPosition(manager, roomId, propId, this.getPropAuthoringPosition(sprite));
    }
  }

  /**
   * Authoring (i.e. JSON-equivalent) world position for a prop sprite. Tight-placement props
   * store the original authored value in `benneRoomPropAuthoredX/Y`; pure parallax props store
   * theirs in {@link parallaxProps} `baseX / baseY`; everything else uses the live `sprite.x / y`.
   */
  private getPropAuthoringPosition(sprite: Phaser.GameObjects.Sprite): { x: number; y: number } {
    const tightX = sprite.getData('benneRoomPropAuthoredX');
    const tightY = sprite.getData('benneRoomPropAuthoredY');
    if (typeof tightX === 'number' && typeof tightY === 'number') {
      return { x: tightX, y: tightY };
    }
    const parallax = this.parallaxProps.find((p) => p.sprite === sprite);
    if (parallax) {
      return { x: parallax.baseX, y: parallax.baseY };
    }
    return { x: sprite.x, y: sprite.y };
  }

  private wireDialogChoiceUi(): void {
    const onStarted = (payload: unknown): void => {
      const p = payload as DialogStartedPayload;
      this.onDialogChoiceStarted(p);
    };
    const onStopped = (payload: unknown): void => {
      const p = payload as DialogStoppedPayload;
      this.onDialogChoiceStopped(p);
    };
    const onOptionEnabledChanged = (payload: unknown): void => {
      const p = payload as DialogOptionEnabledChangedPayload;
      this.onDialogOptionStateMaybeChanged(p);
    };
    const onVar = (payload: unknown): void => {
      this.onGameStateVariableMaybeRefreshDialogChoice(payload);
    };

    gameEvents.on(DIALOG_STARTED_EVENT, onStarted);
    gameEvents.on(DIALOG_STOPPED_EVENT, onStopped);
    gameEvents.on(DIALOG_OPTION_ENABLED_CHANGED_EVENT, onOptionEnabledChanged);
    gameEvents.on(GAME_STATE_VARIABLE_CHANGED_EVENT, onVar);

    const scrollHandlers: Array<{ guiId: string; off: () => void }> = [];
    const pickHandlers: Array<{ guiId: string; off: () => void }> = [];
    for (const guiId of this.dialogChoiceInstallByGuiId.keys()) {
      const onScrollUp = (): void => this.onDialogChoiceScroll(guiId, -1);
      const onScrollDown = (): void => this.onDialogChoiceScroll(guiId, 1);
      const eUp = guiButtonClickEventId(guiId, 'scrollUp');
      const eDown = guiButtonClickEventId(guiId, 'scrollDown');
      gameEvents.on(eUp, onScrollUp);
      gameEvents.on(eDown, onScrollDown);
      scrollHandlers.push(
        { guiId, off: () => gameEvents.off(eUp, onScrollUp) },
        { guiId, off: () => gameEvents.off(eDown, onScrollDown) },
      );

      const onPick = (pl: unknown): void => {
        const pay = pl as GuiAllButtonsClickPayload;
        this.onDialogChoiceOptionClicked(guiId, pay.buttonId);
      };
      const eAll = guiAllButtonsClickEventId(guiId);
      gameEvents.on(eAll, onPick);
      pickHandlers.push({ guiId, off: () => gameEvents.off(eAll, onPick) });
    }

    this.dialogChoiceUiDisposers.push(() => {
      gameEvents.off(DIALOG_STARTED_EVENT, onStarted);
      gameEvents.off(DIALOG_STOPPED_EVENT, onStopped);
      gameEvents.off(DIALOG_OPTION_ENABLED_CHANGED_EVENT, onOptionEnabledChanged);
      gameEvents.off(GAME_STATE_VARIABLE_CHANGED_EVENT, onVar);
      for (const { off } of scrollHandlers) {
        off();
      }
      for (const { off } of pickHandlers) {
        off();
      }
    });
  }

  private onDialogChoiceStarted(p: DialogStartedPayload): void {
    this.pushScriptedDialogInputSuppression();
    this.dialogChoiceInputSuppressionActive = true;
    this.activeDialogChoiceSession = { guiId: p.guiId, dialogId: p.dialogId, scrollOffset: 0 };
    const entry = this.dialogChoiceInstallByGuiId.get(p.guiId);
    if (!entry) {
      if (import.meta.env.DEV) {
        console.warn(
          `[Benne] Dialog "${p.dialogId}" uses guiId "${p.guiId}" but that GUI was not built — choice UI skipped.`,
        );
      }
      this.endDialogChoiceInputSuppressionIfActive();
      this.activeDialogChoiceSession = null;
      const orphan = getActiveDialogBenneScript();
      if (orphan) {
        endDialogSessionIfMatches(orphan);
      }
      return;
    }
    this.snapshotAndHideGenericGuisForDialog();
    entry.built.handle.setVisible(true);
    this.refreshDialogChoiceOverlay();
  }

  /**
   * True if any top-level object in the overlay is currently visible (author / script may have turned the HUD off).
   */
  private readGenericGuiOverlayVisibleHint(handle: GuiOverlayHandle): boolean {
    for (const go of handle.gameObjects) {
      const v = go as unknown as Phaser.GameObjects.Components.Visible | Phaser.GameObjects.GameObject;
      if ('visible' in v && (v as Phaser.GameObjects.Components.Visible).visible) {
        return true;
      }
    }
    return false;
  }

  /** Called when a choice dialog session successfully opens (after {@link DIALOG_STARTED_EVENT}). */
  private snapshotAndHideGenericGuisForDialog(): void {
    if (this.genericGuiVisibilityBeforeDialog !== null) {
      return;
    }
    const snap: boolean[] = [];
    for (const h of this.genericGuiOverlays) {
      snap.push(this.readGenericGuiOverlayVisibleHint(h));
      h.setVisible(false);
    }
    this.genericGuiVisibilityBeforeDialog = snap;
  }

  /** Restores generic GUI visibility from {@link genericGuiVisibilityBeforeDialog}. */
  private restoreGenericGuisAfterDialogSession(): void {
    const snap = this.genericGuiVisibilityBeforeDialog;
    if (snap === null) {
      return;
    }
    this.genericGuiVisibilityBeforeDialog = null;
    for (let i = 0; i < this.genericGuiOverlays.length; i++) {
      this.genericGuiOverlays[i]!.setVisible(snap[i] ?? false);
    }
  }

  private endDialogChoiceInputSuppressionIfActive(): void {
    if (!this.dialogChoiceInputSuppressionActive) {
      return;
    }
    this.dialogChoiceInputSuppressionActive = false;
    this.popScriptedDialogInputSuppression();
  }

  private onDialogChoiceStopped(_p: DialogStoppedPayload): void {
    this.restoreGenericGuisAfterDialogSession();
    this.endDialogChoiceInputSuppressionIfActive();
    this.activeDialogChoiceSession = null;
    this.dialogChoiceRowState.clear();
    for (const { built } of this.dialogChoiceInstallByGuiId.values()) {
      built.handle.setVisible(false);
    }
  }

  private onDialogOptionStateMaybeChanged(p: DialogOptionEnabledChangedPayload): void {
    if (!this.activeDialogChoiceSession || this.activeDialogChoiceSession.dialogId !== p.dialogId) {
      return;
    }
    this.refreshDialogChoiceOverlay();
  }

  private onGameStateVariableMaybeRefreshDialogChoice(payload: unknown): void {
    if (!this.activeDialogChoiceSession) {
      return;
    }
    const p = payload as GameStateVariableChangedPayload;
    const key = typeof p.key === 'string' ? p.key : '';
    const id = this.activeDialogChoiceSession.dialogId;
    if (!key.startsWith(`dialog:${id}:option:`)) {
      return;
    }
    this.refreshDialogChoiceOverlay();
  }

  private onDialogChoiceScroll(guiId: string, delta: number): void {
    if (!this.activeDialogChoiceSession || this.activeDialogChoiceSession.guiId !== guiId) {
      return;
    }
    const def = getDialogDefinition(this.activeDialogChoiceSession.dialogId);
    const entry = this.dialogChoiceInstallByGuiId.get(guiId);
    if (!def || !entry) {
      return;
    }
    const manager = resolveGameStateManager(this.game);
    const visibleOpts = def.options.filter((o) => readEffectiveDialogOptionEnabled(manager, def, o.id));
    const maxOffset = Math.max(0, visibleOpts.length - 1);
    const next = Math.max(0, Math.min(this.activeDialogChoiceSession.scrollOffset + delta, maxOffset));
    this.activeDialogChoiceSession.scrollOffset = next;
    this.refreshDialogChoiceOverlay();
  }

  private refreshDialogChoiceOverlay(): void {
    const session = this.activeDialogChoiceSession;
    if (!session) {
      return;
    }
    const entry = this.dialogChoiceInstallByGuiId.get(session.guiId);
    const rt = this.dialogChoiceRuntimeByGuiId.get(session.guiId);
    const def = getDialogDefinition(session.dialogId);
    if (!entry || !rt || !def) {
      return;
    }
    const gridCtrl = rt.getControl(DIALOG_CHOICE_GRID_ID);
    if (!gridCtrl) {
      return;
    }
    const gridContainer = gridCtrl.gameObject as Phaser.GameObjects.Container;
    const manager = resolveGameStateManager(this.game);
    const gridDef = entry.guiData.controls?.find(
      (c): c is GuiGridControl => c.type === 'grid' && c.id === DIALOG_CHOICE_GRID_ID,
    );
    const viewportAvailableHeightPx = getDialogChoiceAvailableHeightPx(
      gridDef,
      entry.guiData.y ?? 0,
      getInternalHeight(),
    );

    this.dialogChoiceRowState.hideTemplateRow(rt);
    const clampedOffset = this.dialogChoiceRowState.refresh({
      scene: this,
      gui: entry.guiData,
      baseDepth: entry.baseDepth,
      gridContainer,
      guiRuntime: rt,
      definition: def,
      manager,
      scrollOffset: session.scrollOffset,
      viewportAvailableHeightPx,
    });
    session.scrollOffset = clampedOffset;
    this.updateDialogChoiceScrollButtons(session.guiId, def, manager, entry.guiData);
  }

  private updateDialogChoiceScrollButtons(
    guiId: string,
    def: Dialog,
    manager: ReturnType<typeof resolveGameStateManager>,
    guiData: GuiData,
  ): void {
    const rt = this.dialogChoiceRuntimeByGuiId.get(guiId);
    if (!rt) {
      return;
    }
    const gridDef = guiData.controls?.find(
      (c): c is GuiGridControl => c.type === 'grid' && c.id === DIALOG_CHOICE_GRID_ID,
    );
    const buttonDef = guiData.controls?.find(
      (c): c is GuiButtonControl => c.type === 'button' && c.id === 'Dialog-Option',
    );
    const visibleOpts = def.options.filter((o) => readEffectiveDialogOptionEnabled(manager, def, o.id));
    const session = this.activeDialogChoiceSession;
    const offset = session?.scrollOffset ?? 0;

    const { needScroll, showUp, showDown } = getDialogChoiceScrollButtonState({
      scene: this,
      gridDef,
      buttonDef,
      controls: guiData.controls,
      visibleOptions: visibleOpts,
      scrollOffset: offset,
      guiRootY: guiData.y ?? 0,
      viewportBottomExclusivePx: getInternalHeight(),
    });

    const up = rt.getControl('scrollUp');
    const down = rt.getControl('scrollDown');
    if (!needScroll) {
      up?.setVisible(false);
      down?.setVisible(false);
      return;
    }
    up?.setVisible(showUp);
    down?.setVisible(showDown);
  }

  /**
   * Called when a **`whenChoice`** handler starts: hides the choice overlay so queued lines / walks cannot be
   * interrupted by activating another synthetic **`dc__*`** row. Paired with
   * {@link restoreDialogChoiceGuiAfterWhenChoiceDrain} after the handler’s interaction tail completes.
   */
  suppressDialogChoiceGuiForWhenChoice(guiId: string): void {
    if (!this.activeDialogChoiceSession || this.activeDialogChoiceSession.guiId !== guiId) {
      return;
    }
    const entry = this.dialogChoiceInstallByGuiId.get(guiId);
    entry?.built.handle.setVisible(false);
  }

  /**
   * Shows the dialog choice overlay again once **`whenChoice`** work finishes, unless the dialog session ended
   * or this room’s active choice session no longer matches **`dialogId`** / **`guiId`**.
   */
  restoreDialogChoiceGuiAfterWhenChoiceDrain(guiId: string, dialogId: string): void {
    const active = getActiveDialogBenneScript();
    if (!active || active.dialogId !== dialogId) {
      return;
    }
    const session = this.activeDialogChoiceSession;
    if (!session || session.guiId !== guiId || session.dialogId !== dialogId) {
      return;
    }
    const entry = this.dialogChoiceInstallByGuiId.get(guiId);
    if (!entry) {
      return;
    }
    entry.built.handle.setVisible(true);
    this.refreshDialogChoiceOverlay();
  }

  private onDialogChoiceOptionClicked(guiId: string, buttonId: string): void {
    if (!this.activeDialogChoiceSession || this.activeDialogChoiceSession.guiId !== guiId) {
      return;
    }
    if (!buttonId.startsWith('dc__')) {
      return;
    }
    const def = getDialogDefinition(this.activeDialogChoiceSession.dialogId);
    if (!def) {
      return;
    }
    const opt = def.options.find((o) => dialogChoiceSyntheticButtonId(o.id) === buttonId);
    if (!opt) {
      return;
    }
    const manager = resolveGameStateManager(this.game);
    manager.setVariable(
      dialogOptionUsedVariableKey(this.activeDialogChoiceSession.dialogId, opt.id),
      true,
    );
    this.refreshDialogChoiceOverlay();
  }

  private createScreenFadeOverlay(): void {
    const w = getInternalWidth();
    const h = getInternalHeight();
    const rect = this.add
      .rectangle(0, 0, w, h, BENNE_SCREEN_FADE_DEFAULT_COLOR, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0, 0)
      .setDepth(BENNE_SCREEN_FADE_OVERLAY_DEPTH)
      .setAlpha(0);
    this.screenFadeRect = rect;
  }

  /**
   * Full-screen fade layer: same object tweened by {@link queueScreenFadeToAlpha} and Bennescript
   * `B.fadeOut` / `B.fadeIn` — for a future room-transition orchestrator.
   */
  get screenFadeLayer(): Phaser.GameObjects.Rectangle | null {
    return this.screenFadeRect;
  }

  /**
   * @param toAlpha 0 = transparent, 1 = fully opaque. Kills any running fade tweens on the overlay first.
   * @param fillColor RGB (`0xRRGGBB`); the overlay fill is set before the tween; animation uses game object alpha.
   */
  queueScreenFadeToAlpha(
    toAlpha: number,
    durationSec: number = BENNE_SCREEN_FADE_DEFAULT_DURATION_SEC,
    fillColor: number = BENNE_SCREEN_FADE_DEFAULT_COLOR,
  ): Promise<void> {
    const rect = this.screenFadeRect;
    if (!rect) {
      return Promise.resolve();
    }
    this.tweens.killTweensOf(rect);
    const durMs = Math.max(0, durationSec * 1000);
    rect.setFillStyle(fillColor, 1);
    const a = Phaser.Math.Clamp(toAlpha, 0, 1);

    return new Promise((resolve) => {
      this.tweens.add({
        targets: rect,
        alpha: a,
        duration: durMs,
        ease: 'Linear',
        onComplete: () => {
          resolve();
        },
      });
    });
  }

  /**
   * Shows or hides every non-`speaking-text`, non-choice-dialog GUI overlay registered under `src/game/guis/**`.
   * Does not affect the `speaking-text` overlay or choice-dialog GUIs. During an active dialog session, the room
   * first snapshots per-overlay visibility and hides these; when the dialog ends, that snapshot is restored.
   * Any call while a dialog is open updates both the live visibility and the snapshot entry for each overlay
   * so restore matches the latest explicit state. Also used for preview toolbars and cutscene overrides.
   */
  setGenericGuisVisible(visible: boolean): void {
    const snap = this.genericGuiVisibilityBeforeDialog;
    for (let i = 0; i < this.genericGuiOverlays.length; i++) {
      const h = this.genericGuiOverlays[i]!;
      h.setVisible(visible);
      if (snap !== null) {
        snap[i] = visible;
      }
    }
  }

  /**
   * Shows or hides the `speaking-text` GUI line (`controls` text with `id: line` or the first text control).
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
          '[Benne] Bennescript `say` cannot show dialogue: no `speaking-text` GUI was loaded. ' +
            'Add `src/game/guis/speaking-text/speaking-text.gui.json` (see game templates or docs/architecture.md).',
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
   * Shows or hides the `display-text` GUI for Bennescript **`display`** / **`display.now`**.
   * Updates `text` + nine-slice sizing via {@link GuiOverlayHandle.setDisplayTextLayout}.
   */
  setDisplayTextOverlay(state: { visible: boolean; text?: string }): void {
    const h = this.displayTextOverlay;
    if (!h) {
      if (state.visible && !this.missingDisplayTextOverlayWarned) {
        this.missingDisplayTextOverlayWarned = true;
        console.warn(
          '[Benne] Bennescript `display` cannot show narration: no `display-text` GUI was loaded. ' +
            'Add `src/game/guis/display-text/display-text.gui.json` (see game templates or docs/architecture.md).',
        );
      }
      return;
    }
    if (!state.visible) {
      h.setVisible(false);
      return;
    }
    if (state.text !== undefined) {
      h.setDisplayTextLayout(state.text);
    }
    h.setVisible(true);
  }

  /**
   * Called when a timed Bennescript dialog line starts (including `say.now`). Paired with
   * {@link popScriptedDialogInputSuppression} when the line timer ends.
   */
  pushScriptedDialogInputSuppression(): void {
    this.scriptedDialogInputSuppressionDepth++;
    this.syncVerbHoverScriptSurface(this.input.activePointer);
  }

  popScriptedDialogInputSuppression(): void {
    this.scriptedDialogInputSuppressionDepth = Math.max(0, this.scriptedDialogInputSuppressionDepth - 1);
    this.syncVerbHoverScriptSurface(this.input.activePointer);
  }

  private isScriptedDialogInputSuppressed(): boolean {
    return this.scriptedDialogInputSuppressionDepth > 0;
  }

  /**
   * True while ANY scripted-dialog line OR cutscene is active — gates props, hotspots, characters,
   * inventory rows, hover descriptions, and background walks. GUI buttons are additionally gated
   * only when {@link isCutsceneActive} is true (they remain live during say-line suppression).
   */
  private isInputSuppressed(): boolean {
    return this.scriptedDialogInputSuppressionDepth > 0 || this.cutsceneDepth > 0;
  }

  /**
   * Increment the cutscene depth counter. While non-zero, all input is suppressed and the custom
   * cursor switches to the busy animation (or hidden). Called automatically by {@link BenneScriptCore}
   * `B.cutscene`, enter-room hooks, and `whenChoice` handlers.
   */
  pushCutscene(): void {
    this.cutsceneDepth++;
    this.lastCustomCursorVisualKey = null;
    this.refreshCustomCursor(this.input.activePointer);
    this.syncVerbHoverScriptSurface(this.input.activePointer);
  }

  /** Decrement the cutscene depth counter. When it reaches 0, normal input resumes. */
  popCutscene(): void {
    this.cutsceneDepth = Math.max(0, this.cutsceneDepth - 1);
    this.lastCustomCursorVisualKey = null;
    this.refreshCustomCursor(this.input.activePointer);
    this.syncVerbHoverScriptSurface(this.input.activePointer);
  }

  /** True while a cutscene is in progress (cutscene depth > 0). */
  isCutsceneActive(): boolean {
    return this.cutsceneDepth > 0;
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
    const cam = this.cameras.main;
    const view = cam.worldView;
    const vw = Math.max(1, view.width);
    const vh = Math.max(1, view.height);
    const sx = ((wx - view.x) / vw) * getInternalWidth();
    const sy = ((wy - view.y) / vh) * getInternalHeight();
    this.dialogOverlayScreenScratch.set(sx, sy);
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

  /** Spawned character definition ids (for script dialogue validation). */
  getSpawnedCharacterDefinitionIds(): readonly string[] {
    return Array.from(this.characterSpritesByDefId.keys());
  }

  /** Persisted base Aseprite tag (`B.prop(id).animation`); falls back to room JSON `tag`. */
  getPropScriptBaseAnimationTag(propId: string): string {
    const inst = this.getRoomPropInstance(propId);
    if (!inst) {
      return '';
    }
    const m = resolveGameStateManager(this.game);
    return readSavedPropBaseAnimationTag(m, this.roomData.id, propId, inst.tag);
  }

  /** Sets base prop animation (instant + saved). Unknown tags warn and no-op. */
  setPropScriptBaseAnimationTag(propId: string, tag: string): void {
    const inst = this.getRoomPropInstance(propId);
    const sprite = this.propSpritesById.get(propId);
    if (!inst || !sprite) {
      if (import.meta.env.DEV) {
        console.warn(
          `[Benne] setPropScriptBaseAnimationTag: prop "${propId}" not in room "${this.roomData.id}".`,
        );
      }
      return;
    }
    const phaserKey = roomPropPhaserAnimationKey(this.roomData.id, tag);
    if (!this.anims.exists(phaserKey)) {
      console.warn(`[Benne] Unknown prop animation tag "${tag}" for prop "${propId}"`);
      return;
    }
    writeSavedPropBaseAnimationTag(resolveGameStateManager(this.game), this.roomData.id, propId, tag);
    sprite.play(phaserKey);
  }

  /**
   * Temporary prop clip (not saved). Resolves when the clip completes (looping clips resolve next frame).
   * Then restores {@link getPropScriptBaseAnimationTag}.
   */
  playPropScriptAnimationOneShot(propId: string, tag: string): Promise<void> {
    const inst = this.getRoomPropInstance(propId);
    const sprite = this.propSpritesById.get(propId);
    if (!inst || !sprite) {
      return Promise.resolve();
    }
    const phaserKey = roomPropPhaserAnimationKey(this.roomData.id, tag);
    if (!this.anims.exists(phaserKey)) {
      console.warn(`[Benne] Unknown prop animation tag "${tag}" for prop "${propId}"`);
      return Promise.resolve();
    }
    sprite.play(phaserKey);
    return promiseWhenSpriteAnimationFinishes(sprite, phaserKey).then(() => {
      const baseAuthor = this.getPropScriptBaseAnimationTag(propId);
      const baseKey = roomPropPhaserAnimationKey(this.roomData.id, baseAuthor);
      if (this.anims.exists(baseKey)) {
        sprite.play(baseKey);
      }
    });
  }

  /** Persisted default GUI clip (`B.inventory(id).animation`); falls back to inventory JSON when unset. */
  getInventoryScriptDefaultAnimationTag(itemId: string): string {
    const def = getInventoryDefinition(itemId);
    if (!def) {
      return '';
    }
    return readEffectiveInventoryDefaultAnimationTag(resolveGameStateManager(this.game), def);
  }

  /**
   * Sets the inventory row’s default Aseprite tag (GUI icon). Immediate, not queued. Empty / whitespace clears the
   * save override (JSON default applies). Unknown tags warn and no-op when the atlas is loaded.
   */
  setInventoryScriptDefaultAnimationTag(itemId: string, tag: string): void {
    const def = getInventoryDefinition(itemId);
    if (!def) {
      if (import.meta.env.DEV) {
        console.warn(`[Benne] setInventoryScriptDefaultAnimationTag: unknown inventory id "${itemId}".`);
      }
      return;
    }
    const m = resolveGameStateManager(this.game);
    const t = tag.trim();
    if (t.length === 0) {
      m.clearVariable(inventoryDefaultAnimationVariableKey(itemId));
      return;
    }
    if (!this.inventoryAuthorAsepriteTagIsLoaded(def, t)) {
      console.warn(`[Benne] Unknown inventory animation tag "${t}" for item "${itemId}"`);
      return;
    }
    m.setVariable(inventoryDefaultAnimationVariableKey(itemId), t);
  }

  /** Effective cursor Aseprite tag for scripting reads; empty string when the armed cursor should use verb art. */
  getInventoryScriptCursorAnimationTag(itemId: string): string {
    const def = getInventoryDefinition(itemId);
    if (!def) {
      return '';
    }
    const m = resolveGameStateManager(this.game);
    return readEffectiveInventoryCursorAnimationTag(m, def) ?? '';
  }

  /**
   * Sets the armed cursor clip tag for this item. Immediate, not queued. Empty / whitespace clears the override
   * (JSON `cursorAnimation` applies when present).
   */
  setInventoryScriptCursorAnimationTag(itemId: string, tag: string): void {
    const def = getInventoryDefinition(itemId);
    if (!def) {
      if (import.meta.env.DEV) {
        console.warn(`[Benne] setInventoryScriptCursorAnimationTag: unknown inventory id "${itemId}".`);
      }
      return;
    }
    const m = resolveGameStateManager(this.game);
    const t = tag.trim();
    if (t.length === 0) {
      m.clearVariable(inventoryCursorAnimationVariableKey(itemId));
      return;
    }
    if (!this.inventoryAuthorAsepriteTagIsLoaded(def, t)) {
      console.warn(`[Benne] Unknown inventory cursor animation tag "${t}" for item "${itemId}"`);
      return;
    }
    m.setVariable(inventoryCursorAnimationVariableKey(itemId), t);
  }

  private inventoryAuthorAsepriteTagIsLoaded(def: InventoryItemData, tag: string): boolean {
    const mode = def.display?.aseprite;
    if (mode !== true && mode !== 'shared') {
      return false;
    }
    const textureKey = mode === 'shared' ? sharedInventoryTextureKey : getPerItemInventoryTextureKey(def.id);
    if (!this.textures.exists(textureKey)) {
      return false;
    }
    this.ensureAsepriteAnimsFromAtlasOnce(textureKey);
    const animKey = inventoryPhaserAnimationKeyForTag(def, tag);
    return this.anims.exists(animKey);
  }

  getCharacterScriptEffectiveAnimationTag(definitionId: string): string {
    const sprite = this.characterSpritesByDefId.get(definitionId);
    if (!sprite || !(sprite instanceof Phaser.GameObjects.Sprite)) {
      return '';
    }
    return getCharacterEffectiveAnimationTag(sprite);
  }

  /** Persists override + applies immediately. Pass `null` to clear override (same as {@link stopCharacterScriptAnimation}). */
  setCharacterScriptAnimationOverride(definitionId: string, tag: string | null): void {
    const sprite = this.characterSpritesByDefId.get(definitionId);
    if (!sprite || !(sprite instanceof Phaser.GameObjects.Sprite)) {
      return;
    }
    const m = resolveGameStateManager(this.game);
    writeSavedCharacterAnimationOverride(m, definitionId, tag);
    setCharacterAnimationOverrideTagOnSprite(sprite, tag);
    applyCharacterEffectiveAnimation(sprite);
  }

  /** Clears persisted override and returns to directional idle / walk rules. */
  stopCharacterScriptAnimation(definitionId: string): void {
    const sprite = this.characterSpritesByDefId.get(definitionId);
    if (!sprite || !(sprite instanceof Phaser.GameObjects.Sprite)) {
      return;
    }
    writeSavedCharacterAnimationOverride(resolveGameStateManager(this.game), definitionId, null);
    setCharacterAnimationOverrideTagOnSprite(sprite, null);
    applyCharacterEffectiveAnimation(sprite);
  }

  /** One-shot clip (not saved); then {@link applyCharacterEffectiveAnimation}. */
  playCharacterScriptAnimationOneShot(definitionId: string, tag: string): Promise<void> {
    const sprite = this.characterSpritesByDefId.get(definitionId);
    if (!sprite || !(sprite instanceof Phaser.GameObjects.Sprite) || !sprite.anims) {
      return Promise.resolve();
    }
    if (!sprite.anims.exists(tag)) {
      console.warn(`[Benne] Unknown animation tag "${tag}" for character "${definitionId}"`);
      return Promise.resolve();
    }
    playCharacterAnimation(sprite, tag);
    return promiseWhenSpriteAnimationFinishes(sprite, tag).then(() => {
      applyCharacterEffectiveAnimation(sprite);
    });
  }

  faceCharacterScriptDirection(definitionId: string, direction: CharacterFacingLetter): void {
    const sprite = this.characterSpritesByDefId.get(definitionId);
    if (!sprite || !(sprite instanceof Phaser.GameObjects.Sprite)) {
      return;
    }
    characterFaceLetterRespectingOverride(sprite, direction);
  }

  facePlayerScriptDirection(direction: CharacterFacingLetter): void {
    const pl = this.player;
    if (!pl) {
      return;
    }
    characterFaceLetterRespectingOverride(pl, direction);
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

  /**
   * Effective `B.prop(id).visible` — saved override (set by **`setPropScriptVisible`**) wins, then
   * the live sprite, then JSON `RoomPropInstance.visible`. Authors expect this to match what the
   * sprite is showing right now.
   */
  getPropScriptVisible(propId: string): boolean {
    const sprite = this.propSpritesById.get(propId);
    if (sprite) {
      return sprite.visible;
    }
    const inst = this.getRoomPropInstance(propId);
    const jsonDefault = inst?.visible !== false;
    const manager = resolveGameStateManager(this.game);
    return readSavedPropVisible(manager, this.roomData.id, propId, jsonDefault);
  }

  /**
   * Persist + apply visibility for one prop. The save survives room reloads; spawn re-applies it
   * via {@link readSavedPropVisible}. Backs **`B.prop(id).hide` / `show` / `visible = …` /
   * `visibleNow(…)`**.
   */
  setPropScriptVisible(propId: string, visible: boolean): void {
    writeSavedPropVisible(resolveGameStateManager(this.game), this.roomData.id, propId, visible);
    this.propSpritesById.get(propId)?.setVisible(visible);
  }

  /**
   * Effective `B.region(id).active` — saved override wins; falls back to the JSON `active` field
   * (`undefined` / omitted = `true`, explicit `false` = inactive).
   */
  getRegionScriptActive(regionId: string): boolean {
    const region = this.roomData.regions?.find((r) => r.id === regionId);
    const jsonDefault = region ? region.active !== false : true;
    return readSavedRegionActive(resolveGameStateManager(this.game), this.roomData.id, regionId, jsonDefault);
  }

  /**
   * Persist + immediately apply the `active` state for a region. Mutates the live `roomData.regions`
   * entry so region overlap tests (`resolveWinningRoomRegionIdAtFeet`, perspective scale, enter/exit
   * detection) pick it up without a room reload. Backs **`B.region(id).active = …`**.
   */
  setRegionScriptActive(regionId: string, active: boolean): void {
    writeSavedRegionActive(resolveGameStateManager(this.game), this.roomData.id, regionId, active);
    const region = this.roomData.regions?.find((r) => r.id === regionId);
    if (region) {
      region.active = active;
    }
  }

  /**
   * Re-apply saved `B.region(id).active` overrides to `roomData.regions` entries at room load.
   * Called at the top of {@link create} so that the live region data reflects any persisted state
   * before the first `update` pass or walkable-mesh build.
   */
  private restoreRegionActiveOverrides(): void {
    const regions = this.roomData?.regions;
    if (!regions || regions.length === 0) return;
    const manager = resolveGameStateManager(this.game);
    for (const region of regions) {
      const jsonDefault = region.active !== false;
      const saved = readSavedRegionActive(manager, this.roomData.id, region.id, jsonDefault);
      if (saved !== jsonDefault) {
        region.active = saved;
      }
    }
  }

  /**
   * Re-apply saved `B.hotspot(id).active` overrides to `roomData.hotspots` entries at room load.
   * Called in {@link create} before hotspot zones are spawned.
   */
  private restoreHotspotActiveOverrides(): void {
    const hotspots = this.roomData?.hotspots;
    if (!hotspots || hotspots.length === 0) return;
    const manager = resolveGameStateManager(this.game);
    for (const hotspot of hotspots) {
      const jsonDefault = hotspot.active !== false;
      const saved = readSavedHotspotActive(manager, this.roomData.id, hotspot.id, jsonDefault);
      if (saved !== jsonDefault) {
        hotspot.active = saved;
      }
    }
  }

  /**
   * Effective `B.hotspot(id).active` — saved override wins; falls back to the JSON `active` field
   * (`undefined` / omitted = `true`, explicit `false` = inactive). Unknown ids return **`false`**
   * (no hotspot row) and log once in DEV with the room’s hotspot id list.
   */
  getHotspotScriptActive(hotspotId: string): boolean {
    const hotspot = this.roomData.hotspots.find((h) => h.id === hotspotId);
    if (!hotspot) {
      this.warnIfUnknownHotspotScriptId(hotspotId);
      return false;
    }
    const jsonDefault = hotspot.active !== false;
    return readSavedHotspotActive(resolveGameStateManager(this.game), this.roomData.id, hotspotId, jsonDefault);
  }

  /**
   * Persist + immediately apply the `active` state for a hotspot. Mutates the live `roomData.hotspots`
   * entry and mounts or removes the Phaser input zone. Backs **`B.hotspot(id).active = …`**.
   * No-op when **`hotspotId`** is not in this room’s **`hotspots[]`** (DEV warns once per id per load).
   */
  setHotspotScriptActive(hotspotId: string, active: boolean): void {
    const hotspot = this.roomData.hotspots.find((h) => h.id === hotspotId);
    if (!hotspot) {
      this.warnIfUnknownHotspotScriptId(hotspotId);
      return;
    }
    writeSavedHotspotActive(resolveGameStateManager(this.game), this.roomData.id, hotspotId, active);
    hotspot.active = active;
    if (!active) {
      this.removeHotspotInteractiveZone(hotspotId);
      return;
    }
    const pts = hotspot.points;
    if (!pts || pts.length < 3) {
      return;
    }
    if (this.hotspotInteractiveZoneExists(hotspotId)) {
      return;
    }
    const vW = getInternalWidth();
    const vH = getInternalHeight();
    const roomW = this.roomData.size?.width ?? vW;
    const roomH = this.roomData.size?.height ?? vH;
    this.mountHotspotInteractiveZone(this.roomData.id, hotspot, roomW, roomH);
    this.updateRoomStackDepths();
  }

  private warnIfUnknownHotspotScriptId(hotspotId: string): void {
    if (!import.meta.env.DEV) {
      return;
    }
    if (this.unknownHotspotScriptIdsWarned.has(hotspotId)) {
      return;
    }
    this.unknownHotspotScriptIdsWarned.add(hotspotId);
    const ids = this.roomData.hotspots.map((h) => h.id).join(', ');
    console.warn(
      `[Benne] B.hotspot('${hotspotId}'): no hotspot with this id in room '${this.roomData.id}'. Known ids: ${ids || '(none)'} — ids are case-sensitive and must match *.room.json.`,
    );
  }

  /**
   * Teleport a prop's authoring origin to `point` (room space). For `tight` placement the
   * authored coords drive {@link syncBenneRoomPropTightWorldPosition}; for parallax the base
   * `(x, y)` drives the per-frame parallax tick; otherwise the live `sprite.x / y` is the
   * authoring origin and we set it directly.
   *
   * Position is **not** eagerly persisted here — it goes to game state on the next snapshot
   * flush, matching how character positions are tracked. Backs **`B.prop(id).moveTo`** /
   * **`moveTo.now`** / **`moveToNow`**.
   */
  movePropToNow(propId: string, point: { x: number; y: number }): void {
    const sprite = this.propSpritesById.get(propId);
    if (!sprite) {
      if (import.meta.env.DEV) {
        console.warn(
          `[Benne] movePropToNow: prop "${propId}" not in room "${this.roomData.id}".`,
        );
      }
      return;
    }

    const isTight = sprite.getData('benneRoomPropPlacement') === 'tight';
    if (isTight) {
      sprite.setData('benneRoomPropAuthoredX', point.x);
      sprite.setData('benneRoomPropAuthoredY', point.y);
      syncBenneRoomPropTightWorldPosition(sprite);
    } else {
      sprite.x = point.x;
      sprite.y = point.y;
    }

    const parallax = this.parallaxProps.find((p) => p.sprite === sprite);
    if (parallax) {
      parallax.baseX = sprite.x;
      parallax.baseY = sprite.y;
    }
  }

  /**
   * Effective `B.character(id).visible` — saved override wins, then the live sprite, then the
   * first room JSON placement default for this definition id.
   */
  getCharacterScriptVisible(definitionId: string): boolean {
    const sprite = this.getCharacterSprite(definitionId);
    if (sprite) {
      return sprite.visible;
    }
    const jsonDefault = this.characterJsonVisibleByDefId.get(definitionId) ?? true;
    const manager = resolveGameStateManager(this.game);
    return readSavedCharacterVisible(manager, definitionId, jsonDefault);
  }

  /**
   * Persist + apply visibility for one spawned character definition id. Survives room reloads;
   * spawn re-applies via {@link readSavedCharacterVisible}. Backs **`B.character(id).hide` / `show` /
   * `visible = …` / `visibleNow(…)`**.
   */
  setCharacterScriptVisible(definitionId: string, visible: boolean): void {
    writeSavedCharacterVisible(resolveGameStateManager(this.game), definitionId, visible);
    this.getCharacterSprite(definitionId)?.setVisible(visible);
  }

  /**
   * Effective movability for pathfind walking (`walkTo`, click-to-walk, verb walks). Saved script
   * override wins, else the first spawned definition’s {@link CharacterData.movable} default for this room.
   */
  getCharacterScriptMovable(definitionId: string): boolean {
    const jsonDefault = this.characterJsonMovableByDefId.get(definitionId) ?? true;
    const manager = resolveGameStateManager(this.game);
    return readSavedCharacterMovable(manager, definitionId, jsonDefault);
  }

  /** Persist movability for one character definition id (backs **`B.character` / `B.player` `.movable`**). */
  setCharacterScriptMovable(definitionId: string, movable: boolean): void {
    writeSavedCharacterMovable(resolveGameStateManager(this.game), definitionId, movable);
  }

  /**
   * Tween a prop sprite's alpha from `fromAlpha` to `toAlpha` over `durationSeconds`. Kills any
   * running fade tweens on the sprite first; clamps both alphas to `[0, 1]` and `durationSeconds`
   * to `>= 0`. Resolves when the tween completes (or immediately if the prop is not in this room).
   * Persists **`toAlpha`** to {@link GameStateManager} at call time so a save mid-fade or a room
   * reload restores the **intended final** alpha; spawn re-applies it via {@link readSavedPropAlpha}.
   * Backs **`B.prop(id).fade`** / **`fade.now`**.
   */
  fadePropScriptAlpha(
    propId: string,
    fromAlpha: number,
    toAlpha: number,
    durationSeconds: number,
  ): Promise<void> {
    writeSavedPropAlpha(resolveGameStateManager(this.game), this.roomData.id, propId, toAlpha);
    const sprite = this.propSpritesById.get(propId);
    if (!sprite) {
      return Promise.resolve();
    }
    return this.tweenSpriteAlphaFromTo(sprite, fromAlpha, toAlpha, durationSeconds);
  }

  /**
   * Tween a character sprite's alpha from `fromAlpha` to `toAlpha` over `durationSeconds`. Kills any
   * running fade tweens on the sprite first; clamps both alphas to `[0, 1]` and `durationSeconds`
   * to `>= 0`. Resolves when the tween completes (or immediately if the character is not spawned).
   * Persists **`toAlpha`** to {@link GameStateManager} at call time (global key per character id) so
   * a save mid-fade or a room reload restores the **intended final** alpha; spawn re-applies it via
   * {@link readSavedCharacterAlpha}. Backs **`B.character(id).fade`** / **`fade.now`**.
   */
  fadeCharacterScriptAlpha(
    definitionId: string,
    fromAlpha: number,
    toAlpha: number,
    durationSeconds: number,
  ): Promise<void> {
    writeSavedCharacterAlpha(resolveGameStateManager(this.game), definitionId, toAlpha);
    const sprite = this.characterSpritesByDefId.get(definitionId);
    if (!sprite) {
      return Promise.resolve();
    }
    return this.tweenSpriteAlphaFromTo(sprite, fromAlpha, toAlpha, durationSeconds);
  }

  private tweenSpriteAlphaFromTo(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    fromAlpha: number,
    toAlpha: number,
    durationSeconds: number,
  ): Promise<void> {
    this.tweens.killTweensOf(sprite);
    const from = Phaser.Math.Clamp(fromAlpha, 0, 1);
    const to = Phaser.Math.Clamp(toAlpha, 0, 1);
    sprite.setAlpha(from);
    const durMs = Math.max(0, durationSeconds * 1000);
    if (durMs === 0) {
      sprite.setAlpha(to);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.tweens.add({
        targets: sprite,
        alpha: to,
        duration: durMs,
        ease: 'Linear',
        onComplete: () => resolve(),
      });
    });
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
    const playerId = getStartingPlayerCharacterId();
    if (!this.getCharacterScriptMovable(playerId)) {
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
    const dest = this.resolveMovementTarget(target, feet);
    return this.walkPlayerToWorldPoint(dest.x, dest.y);
  }

  private applyFeetWorldWithRegionScale(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    feetLocal: CharacterFeetLocal,
    worldFeetX: number,
    worldFeetY: number,
  ): void {
    const perspective = computeRoomRegionPerspective(
      worldFeetX,
      worldFeetY,
      this.roomData.regions,
      getPerspectiveSettings(),
    );
    const s = perspective.characterScale;
    sprite.setScale(s, s);
    placeSpriteByFeet(sprite as Phaser.GameObjects.Sprite, feetLocal, worldFeetX, worldFeetY);
    applyCharacterSpriteRegionTintFromWinningRegion(sprite, perspective.winningRegion);
  }

  /**
   * Applies region perspective scale for characters that are not mid–feet-interpolating walk tween.
   */
  private syncIdleCharacterRegionScales(): void {
    for (const e of this.roomStackEntities) {
      if (e.kind !== 'character') {
        continue;
      }
      const sprite = e.sprite as Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
      if (sprite === this.player && this.playerMoveTween) {
        continue;
      }
      if (this.npcWalkTweens.has(sprite)) {
        continue;
      }
      const fw = getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
      const feetLocal = this.getSpriteFeetLocal(sprite as Phaser.GameObjects.Sprite);
      this.applyFeetWorldWithRegionScale(sprite, feetLocal, fw.x, fw.y);
    }
  }

  /**
   * Detects feet crossing region boundaries (same polygon + overlap winner as perspective scale).
   * Emits scoped bus ids consumed by **`B.region(id).whenEnter` / `whenExit`** in **`registerRoomScript`**.
   */
  private syncCharacterRegionEnterExit(): void {
    const roomId = this.roomData.id;
    const regions = this.roomData.regions;
    const playerCharacterId = getStartingPlayerCharacterId();

    if (!this.regionEnterExitSeeded) {
      for (const [characterId, sprite] of this.characterSpritesByDefId) {
        const feet = getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
        this.characterFeetWinningRegionId.set(
          characterId,
          resolveWinningRoomRegionIdAtFeet(feet.x, feet.y, regions),
        );
      }
      this.regionEnterExitSeeded = true;
      return;
    }

    for (const [characterId, sprite] of this.characterSpritesByDefId) {
      const feet = getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
      const next = resolveWinningRoomRegionIdAtFeet(feet.x, feet.y, regions);
      const prev = this.characterFeetWinningRegionId.has(characterId)
        ? (this.characterFeetWinningRegionId.get(characterId) ?? null)
        : null;

      if (prev === next) {
        continue;
      }

      this.characterFeetWinningRegionId.set(characterId, next);

      const base = {
        roomId,
        characterId,
        isPlayer: characterId === playerCharacterId,
        feetX: feet.x,
        feetY: feet.y,
      };

      if (prev != null && prev !== next) {
        gameEvents.emit(roomRegionExitEventId(roomId, prev), {
          ...base,
          regionId: prev,
        } satisfies RegionEnterExitContext);
      }
      if (next != null && next !== prev) {
        gameEvents.emit(roomRegionEnterEventId(roomId, next), {
          ...base,
          regionId: next,
        } satisfies RegionEnterExitContext);
      }
    }
  }

  /**
   * Instantly place the player’s **feet** at a resolved point (or named target), clamped to the
   * walkable mesh; updates **Idle** facing toward the movement delta, or toward the target when
   * the feet do not move.
   */
  movePlayerToNow(target: Point2 | string): void {
    const sprite = this.player;
    if (!sprite) {
      return;
    }
    this.stopPlayerMoveTween(false);
    const oldFeet = getCharacterWorldFeet(sprite);
    const raw = this.resolveMovementTarget(target, oldFeet);
    const polys = withNonWalkableRegionsAsHoles(this.roomData.walkable.polygons, this.roomData.regions);
    const clamped = clampWalkDestinationTowardClick(oldFeet.x, oldFeet.y, raw.x, raw.y, polys);
    const feetWorld = clamped ?? raw;
    const data = sprite.getData('character') as CharacterData | undefined;
    const feetLocal = data
      ? resolveCharacterFeetLocal(data, sprite)
      : { x: sprite.frame.width * 0.5, y: sprite.frame.height };
    this.applyFeetWorldWithRegionScale(sprite, feetLocal, feetWorld.x, feetWorld.y);
    const newFeet = getCharacterWorldFeet(sprite);
    this.applyScriptTeleportFacing(sprite, oldFeet, newFeet, target);
  }

  /**
   * Stops the current player walk (click-to-walk, walk-to-target, or script-queued tween), plays
   * Idle, and emits {@link PLAYER_WALK_STOP} with `interrupted`. Used when a verb or inventory
   * interaction begins so handlers do not run while the player is still moving to an old destination.
   */
  interruptPlayerWalk(): void {
    this.stopPlayerMoveTween(true);
  }

  /**
   * Stops click-to-walk / script walk for the character who is about to speak a **`say`** line so
   * movement does not overlap speech and the **Talk** directional clip can replace **Walk**.
   * Region / timer handlers do not go through verb dispatch (which already interrupts the player walk).
   */
  interruptCharacterWalkForScriptedSpeech(characterDefinitionId: string): void {
    if (characterDefinitionId === getStartingPlayerCharacterId()) {
      this.interruptPlayerWalk();
      return;
    }
    const sprite = this.characterSpritesByDefId.get(characterDefinitionId);
    if (!sprite) {
      return;
    }
    const tween = this.npcWalkTweens.get(sprite);
    if (tween) {
      tween.stop();
    }
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
    this.faceCharacterSpriteTowardMoveTarget(sprite, lookAtWorld, walkFallbackTarget);
  }

  /**
   * Shared facing logic for the player, NPCs, and script teleport. See {@link facePlayerTowardClicked}.
   */
  private faceCharacterSpriteTowardMoveTarget(
    sprite: DirectionalCharacterSprite,
    lookAtWorld: Point2 | null,
    walkFallbackTarget: Point2 | string | null,
  ): void {
    const feet = getCharacterWorldFeet(sprite);
    let toward: Point2 | undefined;
    if (lookAtWorld) {
      toward = lookAtWorld;
    } else if (walkFallbackTarget != null) {
      toward = this.resolveMovementTarget(walkFallbackTarget, feet);
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
    if (getCharacterAnimationOverrideTag(sprite)) {
      sprite.setData('facing', facing);
      return;
    }
    playDirectionalAnimation(sprite, 'Idle', facing);
  }

  private applyScriptTeleportFacing(
    sprite: DirectionalCharacterSprite,
    oldFeet: Point2,
    newFeet: Point2,
    target: Point2 | string,
  ): void {
    const dx = newFeet.x - oldFeet.x;
    const dy = newFeet.y - oldFeet.y;
    if (Math.hypot(dx, dy) >= 1e-2) {
      const facing = facingFromWorldDelta(dx, dy);
      if (!getCharacterAnimationOverrideTag(sprite)) {
        playDirectionalAnimation(sprite, 'Idle', facing);
      } else {
        sprite.setData('facing', facing);
      }
      return;
    }
    this.faceCharacterSpriteTowardMoveTarget(sprite, null, target);
  }

  /**
   * Walk a room character (by definition id) to an explicit point or a named target.
   */
  walkCharacterTo(definitionId: string, target: Point2 | string): Promise<void> {
    if (!this.getCharacterScriptMovable(definitionId)) {
      return Promise.resolve();
    }
    const sprite = this.characterSpritesByDefId.get(definitionId);
    if (!sprite) {
      return Promise.resolve();
    }
    const feet = getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
    const dest = this.resolveMovementTarget(target, feet);
    return this.walkCharacterToWorldPoint(sprite, dest.x, dest.y);
  }

  /**
   * Same as {@link movePlayerToNow} for a room NPC by character definition id.
   */
  moveCharacterToNow(definitionId: string, target: Point2 | string): void {
    const sprite = this.characterSpritesByDefId.get(definitionId);
    if (!sprite || !(sprite instanceof Phaser.GameObjects.Sprite)) {
      return;
    }
    const prev = this.npcWalkTweens.get(sprite);
    if (prev) {
      prev.stop();
      this.npcWalkTweens.delete(sprite);
    }
    const dSprite = sprite as DirectionalCharacterSprite;
    const oldFeet = getCharacterWorldFeet(sprite);
    const raw = this.resolveMovementTarget(target, oldFeet);
    const polys = withNonWalkableRegionsAsHoles(this.roomData.walkable.polygons, this.roomData.regions);
    const clamped = clampWalkDestinationTowardClick(oldFeet.x, oldFeet.y, raw.x, raw.y, polys);
    const feetWorld = clamped ?? raw;
    const data = sprite.getData('character') as CharacterData | undefined;
    const feetLocal = data
      ? resolveCharacterFeetLocal(data, sprite)
      : { x: sprite.frame.width * 0.5, y: sprite.frame.height };
    this.applyFeetWorldWithRegionScale(sprite, feetLocal, feetWorld.x, feetWorld.y);
    const newFeet = getCharacterWorldFeet(sprite);
    this.applyScriptTeleportFacing(dSprite, oldFeet, newFeet, target);
  }

  walkCharacterToWorldPoint(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    worldX: number,
    worldY: number,
  ): Promise<void> {
    const data = sprite.getData('character') as CharacterData | undefined;
    const id = data?.id;
    if (id && !this.getCharacterScriptMovable(id)) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.moveNpcToward(sprite, worldX, worldY, resolve);
    });
  }

  /**
   * Resolve a walk / teleport target in room space. String ids: prop → hotspot → character → `room.points`,
   * first match wins; unknown id warns once and returns `walkerFeet`.
   */
  resolveMovementTarget(target: Point2 | string, walkerFeet: Point2): Point2 {
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
    this.snapWalkingSpritesToPixelGrid();
    this.syncIdleCharacterRegionScales();
    this.syncCharacterRegionEnterExit();
    this.updateParallaxProps();
    this.updateRoomStackDepths();
    this.updatePathDebug();
  }

  /** Round walk tween targets each frame so scroll + Canvas draw stay pixel-stable (tween runs before this). */
  private snapWalkingSpritesToPixelGrid(): void {
    const snap = (go: { x: number; y: number }): void => {
      go.x = Math.round(go.x);
      go.y = Math.round(go.y);
    };
    if (this.playerMoveTween && this.player) {
      snap(this.player);
    }
    for (const sprite of this.npcWalkTweens.keys()) {
      snap(sprite);
    }
  }

  /** Re-sorts props, characters, and hotspot zones by `zIndex` and optional `baseline` rules. */
  private updateRoomStackDepths(): void {
    if (this.roomStackEntities.length === 0) {
      return;
    }
    const sorted = sortRoomStackEntities(this.roomStackEntities);
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
    registerOverlay(this.displayTextOverlay);
    for (const { built } of this.dialogChoiceInstallByGuiId.values()) {
      registerOverlay(built.handle);
    }
    if (this.screenFadeRect) {
      this.editorUiGuiObjects.add(this.screenFadeRect);
    }
    if (this.customCursorSprite) {
      this.editorUiGuiObjects.add(this.customCursorSprite);
    }

    main.ignore(Array.from(this.editorUiGuiObjects));
    const nonGui = this.children.list.filter((o) => !this.editorUiGuiObjects.has(o));
    if (nonGui.length > 0) {
      uiCam.ignore(nonGui);
    }

    const routeObjectToCameras = (obj: Phaser.GameObjects.GameObject): void => {
      if (this.isEditorUiGuiObject(obj)) {
        main.ignore(obj);
      } else {
        uiCam.ignore(obj);
      }
    };
    const onAdded = (obj: Phaser.GameObjects.GameObject): void => {
      // Runtime dialog rows are created first, then parented into a GUI grid container.
      // Defer classification by one frame so parentContainer ancestry is settled.
      const isRuntimeHiDpi = this.editorCameraMode === null &&
        this.game.registry.get(BENNE_RUNTIME_HI_DPI_WIRED_REGISTRY_KEY);
      if (isRuntimeHiDpi) {
        requestAnimationFrame(() => {
          if (!obj.scene) {
            return;
          }
          routeObjectToCameras(obj);
        });
        return;
      }
      routeObjectToCameras(obj);
    };
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
    this.editorUiChildListenerOff = () => {
      this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
    };
  }

  private isEditorUiGuiObject(obj: Phaser.GameObjects.GameObject): boolean {
    if (this.editorUiGuiObjects.has(obj)) {
      return true;
    }
    let parent = (obj as Phaser.GameObjects.GameObject & {
      parentContainer?: Phaser.GameObjects.Container | null;
    }).parentContainer;
    while (parent) {
      if (this.editorUiGuiObjects.has(parent)) {
        return true;
      }
      parent = (parent as Phaser.GameObjects.Container & {
        parentContainer?: Phaser.GameObjects.Container | null;
      }).parentContainer ?? null;
    }
    return false;
  }

  /** Keeps the editor UI camera's viewport and zoom aligned with the main camera. */
  private syncEditorUiCameraToMain(): void {
    const uiCam = this.editorUiCamera;
    if (!uiCam) {
      return;
    }
    const main = this.cameras.main;
    uiCam.setViewport(main.x, main.y, main.width, main.height);
    uiCam.setZoom(main.zoomX, main.zoomY);
    uiCam.setScroll(0, 0);
  }

  /**
   * Runtime (`Scale.NONE` + hi-DPI letterbox) uses the same dedicated UI camera strategy as
   * editor preview navigate mode so `scrollFactor: 0` overlays stay aligned without changing
   * the main world camera origin math.
   */
  private setupRuntimeUiCameraIfNeeded(): void {
    if (this.editorCameraMode !== null) {
      return;
    }
    if (!this.game.registry.get(BENNE_RUNTIME_HI_DPI_WIRED_REGISTRY_KEY)) {
      return;
    }
    this.ensureEditorUiCamera();
    this.syncEditorUiCameraToMain();
  }

  /** Called by `applyBenneRuntimeHiDpiCameras` after main camera layout updates. */
  syncRuntimeHiDpiUiCameraToMain(): void {
    if (this.editorCameraMode !== null || !this.editorUiCamera) {
      return;
    }
    if (!this.game.registry.get(BENNE_RUNTIME_HI_DPI_WIRED_REGISTRY_KEY)) {
      return;
    }
    this.syncEditorUiCameraToMain();
  }

  private readonly handleRoomPointerDown = (
    pointer: Phaser.Input.Pointer,
    /** Same list Phaser passes after {@link Phaser.Input.InputPlugin#sortGameObjects} + `topOnly` (when emitted from POINTER_DOWN). */
    phaserCurrentlyOver?: Phaser.GameObjects.GameObject[],
  ): void => {
    if (this.tryConsumeScriptedDialogClickToSkip(pointer)) {
      return;
    }
    if (this.isInputSuppressed()) {
      return;
    }

    const blockingHits =
      phaserCurrentlyOver !== undefined
        ? phaserCurrentlyOver
        : this.sortRoomPointerHitStack(pointer);
    if (blockingHits.length > 0) {
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
    const arriveCallback = this.walkArriveCallback;
    this.walkArriveCallback = null;
    this.currentPlayerPath = null;
    if (!this.playerMoveTween) {
      // During a cutscene the walk promise must still resolve so the interaction chain continues.
      if (this.cutsceneDepth > 0 && arriveCallback) {
        arriveCallback();
      }
      return;
    }
    const tween = this.playerMoveTween;
    this.playerMoveTween = null;
    tween.stop();
    if (emitStop && this.player) {
      applyCharacterEffectiveAnimation(this.player);
      gameEvents.emit(PLAYER_WALK_STOP, {
        roomId: this.roomData.id,
        reason: 'interrupted',
      } satisfies PlayerWalkStopPayload);
    }
    // During a cutscene, resolve the interrupted walk's promise so the interaction chain
    // can continue without hanging — player clicks are suppressed, so the only interruptions
    // are scripted (room transitions reset the tail separately).
    if (this.cutsceneDepth > 0 && arriveCallback) {
      arriveCallback();
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
    if (!this.getCharacterScriptMovable(getStartingPlayerCharacterId())) {
      onArrive?.();
      return;
    }

    const feetNow = getCharacterWorldFeet(sprite);
    const path = findWalkPath(
      feetNow,
      { x: destX, y: destY },
      withNonWalkableRegionsAsHoles(this.roomData.walkable.polygons, this.roomData.regions),
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
    const feetLocal = this.getSpriteFeetLocal(sprite);

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
    if (!getCharacterAnimationOverrideTag(sprite)) {
      playDirectionalAnimation(sprite, 'Walk', facing);
    } else {
      sprite.setData('facing', facing);
    }

    const feetStart = { ...feetNow };
    const legDx = leg.x - feetStart.x;
    const legDy = leg.y - feetStart.y;
    const legLen = distance;
    const regions = this.roomData.regions;
    let u = 0;
    let legCompletedNormally = false;

    const tick = { k: 0 };
    const moveTween = this.tweens.add({
      targets: tick,
      k: 1,
      duration: 86_400_000,
      ease: 'Linear',
      onUpdate: () => {
        if (legCompletedNormally || this.playerMoveTween !== moveTween) {
          return;
        }
        const dt = Math.min(0.1, this.game.loop.delta / 1000);
        const mult = computeRoomRegionPerspective(
          feetStart.x + legDx * u,
          feetStart.y + legDy * u,
          regions,
          getPerspectiveSettings(),
        ).walkSpeedMultiplier;
        u += (speed * mult * dt) / legLen;
        if (u >= 1) {
          legCompletedNormally = true;
          u = 1;
          this.applyFeetWorldWithRegionScale(sprite, feetLocal, leg.x, leg.y);
          moveTween.stop();
          return;
        }
        this.applyFeetWorldWithRegionScale(
          sprite,
          feetLocal,
          feetStart.x + legDx * u,
          feetStart.y + legDy * u,
        );
      },
      onStop: () => {
        if (legCompletedNormally) {
          if (this.playerMoveTween !== moveTween) {
            return;
          }
          this.playerMoveTween = null;
          this.applyFeetWorldWithRegionScale(sprite, feetLocal, leg.x, leg.y);
          if (legIndex + 1 < path.length) {
            this.beginPlayerWalkLeg(sprite, path, legIndex + 1);
          } else {
            this.finishPlayerWalk(sprite, facing);
          }
          return;
        }
        this.onPlayerWalkTweenStopped(moveTween);
      },
    });

    this.playerMoveTween = moveTween;
  }

  private finishPlayerWalk(sprite: DirectionalCharacterSprite, facing: CharacterFacing): void {
    this.currentPlayerPath = null;
    if (!getCharacterAnimationOverrideTag(sprite)) {
      playDirectionalAnimation(sprite, 'Idle', facing);
    } else {
      sprite.setData('facing', facing);
      applyCharacterEffectiveAnimation(sprite);
    }
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
      withNonWalkableRegionsAsHoles(this.roomData.walkable.polygons, this.roomData.regions),
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
    const feetLocal = this.getSpriteFeetLocal(sprite as Phaser.GameObjects.Sprite);

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
        if (!getCharacterAnimationOverrideTag(sprite as Phaser.GameObjects.Sprite)) {
          playDirectionalAnimation(sprite as DirectionalCharacterSprite, 'Idle', facing);
        } else {
          sprite.setData('facing', facing);
        }
      }
      onArrive?.();
      return;
    }

    const facing = facingFromWorldDelta(dx, dy);
    if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
      if (!getCharacterAnimationOverrideTag(sprite as Phaser.GameObjects.Sprite)) {
        playDirectionalAnimation(sprite as DirectionalCharacterSprite, 'Walk', facing);
      } else {
        sprite.setData('facing', facing);
      }
    }

    const feetStart = { ...feetNow };
    const legDx = leg.x - feetStart.x;
    const legDy = leg.y - feetStart.y;
    const legLen = distance;
    const regions = this.roomData.regions;
    let u = 0;
    let legCompletedNormally = false;

    const tick = { k: 0 };
    const moveTween = this.tweens.add({
      targets: tick,
      k: 1,
      duration: 86_400_000,
      ease: 'Linear',
      onUpdate: () => {
        if (legCompletedNormally || this.npcWalkTweens.get(sprite) !== moveTween) {
          return;
        }
        const dt = Math.min(0.1, this.game.loop.delta / 1000);
        const mult = computeRoomRegionPerspective(
          feetStart.x + legDx * u,
          feetStart.y + legDy * u,
          regions,
          getPerspectiveSettings(),
        ).walkSpeedMultiplier;
        u += (speed * mult * dt) / legLen;
        if (u >= 1) {
          legCompletedNormally = true;
          u = 1;
          this.applyFeetWorldWithRegionScale(sprite, feetLocal, leg.x, leg.y);
          moveTween.stop();
          return;
        }
        this.applyFeetWorldWithRegionScale(
          sprite,
          feetLocal,
          feetStart.x + legDx * u,
          feetStart.y + legDy * u,
        );
      },
      onStop: () => {
        if (this.npcWalkTweens.get(sprite) !== moveTween) {
          return;
        }
        if (legCompletedNormally) {
          this.npcWalkTweens.delete(sprite);
          this.applyFeetWorldWithRegionScale(sprite, feetLocal, leg.x, leg.y);
          if (legIndex + 1 < path.length) {
            this.beginNpcWalkLeg(sprite, path, legIndex + 1, onArrive);
            return;
          }
          if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
            if (!getCharacterAnimationOverrideTag(sprite as Phaser.GameObjects.Sprite)) {
              playDirectionalAnimation(sprite as DirectionalCharacterSprite, 'Idle', facing);
            } else {
              sprite.setData('facing', facing);
              applyCharacterEffectiveAnimation(sprite as Phaser.GameObjects.Sprite);
            }
          }
          onArrive?.();
          return;
        }
        this.npcWalkTweens.delete(sprite);
        if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
          if (!getCharacterAnimationOverrideTag(sprite as Phaser.GameObjects.Sprite)) {
            const idleFacing =
              (sprite.getData('facing') as CharacterFacing | undefined) ??
              resolveInitialIdleFacing(sprite as DirectionalCharacterSprite);
            playDirectionalAnimation(sprite as DirectionalCharacterSprite, 'Idle', idleFacing);
          } else {
            applyCharacterEffectiveAnimation(sprite as Phaser.GameObjects.Sprite);
          }
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
      applyCharacterEffectiveAnimation(this.player);
    }
    gameEvents.emit(PLAYER_WALK_STOP, {
      roomId: this.roomData.id,
      reason: 'interrupted',
    } satisfies PlayerWalkStopPayload);
  }

  private drawRoomDebugOverlays(data: RoomSceneStartData): void {
    const debug = getGameSettings().debug;
    if (!debug?.showWalkable && !debug?.showPropOutlines && !debug?.showRegionOutlines) {
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

    if (debug.showRegionOutlines) {
      const g = this.add.graphics();
      g.lineStyle(lineWidth, DEBUG_REGION_STROKE, 1);
      for (const region of this.roomData.regions ?? []) {
        if (region.active === false || region.points.length < 3) {
          continue;
        }
        const vecs = region.points.map((p) => new Phaser.Math.Vector2(p.x, p.y));
        g.strokePoints(vecs, true);
      }
      g.setDepth(DEBUG_OVERLAY_DEPTH + 1);
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
      g.setDepth(DEBUG_OVERLAY_DEPTH + 2);
    }

    if (debug.showWalkable) {
      // Shared Graphics reused every frame by updatePathDebug() — authoring-time visual feedback
      // for the pathfinding route around holes / concavities.
      this.debugPathGraphics = this.add.graphics();
      this.debugPathGraphics.setDepth(DEBUG_OVERLAY_DEPTH + 3);
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

    const mergedClips = mergeRoomPropAnimationClips(data.props, data.room.id);
    const sorted = [...data.props].sort((a, b) => (a.data.zIndex ?? 0) - (b.data.zIndex ?? 0));

    // Must use the scene AnimationManager (no `target` sprite). Passing a sprite registers clips only on
    // that sprite; other props would never get `play()` and would stay on atlas frame 0 (often untagged).
    const created = this.anims.createFromAseprite(textureKey);
    applyCharacterAnimationClips(created, mergedClips);

    const manager = resolveGameStateManager(this.game);
    for (const spawn of sorted) {
      // Saved authoring position (from a prior flush) overrides the room JSON `(x, y)` — same
      // pattern as `readSavedPropVisible` / `readSavedPropAlpha` below. Uses the prop's
      // authoring position (tight authored coords / parallax baseX,Y / sprite.x,y) so it
      // round-trips through `flushRuntimeStateToGameState`.
      const savedXY = readSavedPropPosition(manager, data.room.id, spawn.id);
      const spawnX = savedXY ? savedXY.x : spawn.x;
      const spawnY = savedXY ? savedXY.y : spawn.y;
      // Props render at their natural Aseprite frame dimensions. For full-room composite
      // sheets (the typical BENNE workflow) each frame already covers the full room width
      // and height, so no explicit setDisplaySize is needed.
      const sprite = this.add.sprite(spawnX, spawnY, textureKey).setOrigin(0, 0);
      const jsonVisible = spawn.data.visible !== false;
      const jsonAlpha = spawn.data.alpha ?? 1;
      sprite.setVisible(readSavedPropVisible(manager, data.room.id, spawn.id, jsonVisible));
      sprite.setAlpha(readSavedPropAlpha(manager, data.room.id, spawn.id, jsonAlpha));

      const baseAuthorTag = readSavedPropBaseAnimationTag(manager, data.room.id, spawn.id, spawn.tag);
      const basePhaserKey = roomPropPhaserAnimationKey(data.room.id, baseAuthorTag);
      if (!this.anims.exists(basePhaserKey)) {
        console.warn(`[Benne] Room prop '${spawn.id}' uses unknown Aseprite tag '${baseAuthorTag}'.`);
      } else {
        sprite.play(basePhaserKey);
      }

      if (import.meta.env.DEV) {
        warnDevIfAsepriteJsonMissingSpriteSourceSize(
          sprite.frame,
          `Room "${data.room.id}" prop "${spawn.id}"`,
        );
      }

      const placement = spawn.data.spritePlacement ?? 'canvas';
      if (placement === 'tight') {
        sprite.setData('benneRoomPropPlacement', 'tight');
        sprite.setData('benneRoomPropAuthoredX', spawnX);
        sprite.setData('benneRoomPropAuthoredY', spawnY);
        syncBenneRoomPropTightWorldPosition(sprite);
        wireBenneRoomPropTightPlacementAfterFrameChanges(sprite);
      }

      const pd = spawn.data.parallaxDepth;
      if (pd !== undefined && pd !== 1) {
        this.parallaxProps.push({
          sprite,
          baseX: sprite.x,
          baseY: sprite.y,
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

    // Props may start hidden (`visible: false`) and be shown later via `B.prop(id).show()` /
    // `setPropScriptVisible`. Interactive must still be registered: Phaser's hit test skips
    // objects that do not `willRender` (including invisible sprites), so hidden props stay
    // non-interactive until visibly shown.

    const pts = d.collider?.points;
    if (!pts || pts.length < 3) {
      console.warn(`[Benne] Clickable prop '${spawn.id}' needs a collider polygon (at least 3 points).`);
      return;
    }

    const flat = pts.flatMap((p) => [p.x - sprite.x, p.y - sprite.y]);
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
      if (this.isInputSuppressed()) {
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
    if (this.isInputSuppressed()) {
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

  private hotspotInteractiveZoneExists(hotspotId: string): boolean {
    for (const e of this.roomStackEntities) {
      if (e.kind !== 'hotspot') continue;
      const id = e.zone.getData('benneHotspotId') as string | undefined;
      if (id === hotspotId) {
        return true;
      }
    }
    return false;
  }

  private removeHotspotInteractiveZone(hotspotId: string): void {
    for (let i = this.roomStackEntities.length - 1; i >= 0; i--) {
      const e = this.roomStackEntities[i]!;
      if (e.kind !== 'hotspot') continue;
      const id = e.zone.getData('benneHotspotId') as string | undefined;
      if (id !== hotspotId) continue;
      this.roomStackEntities.splice(i, 1);
      e.zone.destroy();
      this.updateRoomStackDepths();
      return;
    }
  }

  /**
   * Spawns the polygon hit zone and stack entry for one active hotspot (caller ensures polygon
   * validity and that the hotspot should be interactive).
   */
  private mountHotspotInteractiveZone(
    roomId: string,
    hotspot: RoomHotspotData,
    roomW: number,
    roomH: number,
  ): void {
    const pts = hotspot.points;
    if (!pts || pts.length < 3) {
      return;
    }

    const onHotspotPointer = (pointer: Phaser.Input.Pointer): void => {
      if (this.tryConsumeScriptedDialogClickToSkip(pointer)) {
        return;
      }
      if (this.isInputSuppressed()) {
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
            manager.clearActiveVerb();
          }
          return;
        }
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

  private createHotspot(roomId: string, hotspot: RoomHotspotData, roomW: number, roomH: number): void {
    if (hotspot.active === false) {
      return;
    }

    const pts = hotspot.points;
    if (!pts || pts.length < 3) {
      return;
    }

    this.mountHotspotInteractiveZone(roomId, hotspot, roomW, roomH);
  }

  private spawnCharacter(roomId: string, spawn: RoomCharacterSpawn): void {
    if (spawn.loadKind === 'aseprite') {
      this.spawnAsepriteCharacter(roomId, spawn);
      return;
    }

    const sprite = this.add.image(0, 0, spawn.textureKey);
    const feet = resolveCharacterFeetLocal(spawn.data, sprite as Phaser.GameObjects.Sprite);
    const manager = resolveGameStateManager(this.game);
    // Saved feet world position (from a prior flush) overrides the room JSON `(x, y)` — same
    // pattern as `readSavedCharacterVisible` / `readSavedCharacterAlpha` below. Per-room key,
    // so the same character id appearing in two rooms doesn't clobber across rooms.
    const savedFeet = readSavedCharacterPosition(manager, roomId, spawn.data.id);
    const feetX = savedFeet ? savedFeet.x : spawn.x;
    const feetY = savedFeet ? savedFeet.y : spawn.y;
    this.applyFeetWorldWithRegionScale(sprite, feet, feetX, feetY);
    const jsonVisible = spawn.visible !== false;
    sprite.setVisible(readSavedCharacterVisible(manager, spawn.data.id, jsonVisible));
    sprite.setAlpha(readSavedCharacterAlpha(manager, spawn.data.id, 1));
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
    attachBenneCharacterPerspectiveRenderNodes(sprite);
    this.attachCharacterInteraction(roomId, spawn, sprite);
  }

  private spawnAsepriteCharacter(roomId: string, spawn: RoomCharacterSpawn): void {
    const sprite = this.add.sprite(0, 0, spawn.textureKey);
    const manager = resolveGameStateManager(this.game);
    const jsonVisible = spawn.visible !== false;
    sprite.setVisible(readSavedCharacterVisible(manager, spawn.data.id, jsonVisible));
    sprite.setAlpha(readSavedCharacterAlpha(manager, spawn.data.id, 1));
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
    const savedOverride = readSavedCharacterAnimationOverride(manager, spawn.data.id);
    if (savedOverride && sprite.anims.exists(savedOverride)) {
      setCharacterAnimationOverrideTagOnSprite(sprite, savedOverride);
      sprite.setData('facing', facing);
      playCharacterAnimation(sprite, savedOverride);
    } else {
      if (savedOverride && !sprite.anims.exists(savedOverride)) {
        writeSavedCharacterAnimationOverride(manager, spawn.data.id, null);
      }
      setCharacterAnimationOverrideTagOnSprite(sprite, null);
      playDirectionalAnimation(sprite, animBase, facing);
    }

    const feet = resolveCharacterFeetLocal(spawn.data, sprite);
    // Saved feet world position (from a prior flush) overrides room JSON `(x, y)`. Player
    // rooms with a `whenEnterRoom` that calls `B.player.moveTo.now('entry-point')` still
    // work — the spawn applies the saved position, then the enter hook teleports the player
    // to the entry, and the next flush records the new spot.
    const savedFeet = readSavedCharacterPosition(manager, roomId, spawn.data.id);
    const feetX = savedFeet ? savedFeet.x : spawn.x;
    const feetY = savedFeet ? savedFeet.y : spawn.y;
    this.applyFeetWorldWithRegionScale(sprite, feet, feetX, feetY);

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
    attachBenneCharacterPerspectiveRenderNodes(sprite);
    this.attachCharacterInteraction(roomId, spawn, sprite);
  }

  private attachCharacterInteraction(
    roomId: string,
    spawn: RoomCharacterSpawn,
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
  ): void {
    // Same as clickable props starting hidden (`visible: false`) and `B.character(id).hide()`:
    // register input anyway. Phaser only considers candidates that `willRender`, so invisible
    // spawns stay inert.

    if (!spawn.data.clickable) {
      return;
    }
    const handlers = getCharacterVerbHandlers(spawn.data);

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
      if (this.isInputSuppressed()) {
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
    const idleAuthor = cfg.idleAnimation.trim();
    const activeAuthor = cfg.activeAnimation.trim();
    const idleKey = cursorPhaserAnimationKey(idleAuthor);
    const activeKey = cursorPhaserAnimationKey(activeAuthor);

    const created = this.anims.createFromAseprite(CURSOR_TEXTURE_KEY);
    const remappedCursorAnimations: CharacterAnimationsConfig | undefined = cfg.animations
      ? Object.fromEntries(
          Object.entries(cfg.animations).map(([k, v]) => [cursorPhaserAnimationKey(k), v]),
        )
      : undefined;
    applyCharacterAnimationClips(created, remappedCursorAnimations);

    if (!this.anims.exists(idleKey) || !this.anims.exists(activeKey)) {
      console.warn(
        `[Benne] Custom cursor: sheet is missing idle "${idleAuthor}" and/or active "${activeAuthor}" animation — skipping.`,
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
    gameEvents.on(GAME_STATE_VARIABLE_CHANGED_EVENT, this.onVariableChangeForCustomCursor);
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
    gameEvents.off(GAME_STATE_VARIABLE_CHANGED_EVENT, this.onVariableChangeForCustomCursor);
    this.input.setDefaultCursor('default');
  }

  private ensureAsepriteAnimsFromAtlasOnce(textureKey: string): void {
    ensureAsepriteAtlasAnimationsRegisteredOnce(this, textureKey);
  }

  /**
   * When an inventory item is active and a cursor Aseprite tag resolves (JSON {@link InventoryItemData.cursorAnimation}
   * or a persisted scripting override), returns texture + Phaser animation key; otherwise `null` (verb cursor).
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
    const tag = readEffectiveInventoryCursorAnimationTag(manager, def)?.trim();
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

  private syncVerbHoverScriptSurface(pointer: Phaser.Input.Pointer): void {
    const t = this.resolveVerbHoverPointerContext(pointer);
    publishBenneVerbHoverContext(t?.description ?? null, t);
  }

  /** Hover target + description under the pointer for **`B.currentHoverDescription`** (skips GUI buttons like the verb bar). */
  private resolveVerbHoverPointerContext(pointer: Phaser.Input.Pointer): VerbHoverTarget | null {
    if (this.isInputSuppressed()) {
      return null;
    }
    const hits = this.sortRoomPointerHitStack(pointer);
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
        let description: string | null = null;
        if (fromDesc && fromDesc.length > 0) {
          description = fromDesc;
        } else {
          const fromName = inv.name?.trim();
          description = fromName && fromName.length > 0 ? fromName : null;
        }
        return { description, targetType: 'inventoryRow', itemId, ...verbHoverDefaultVerbPatch(inv) };
      }
      if (go.getData('benneHotspot') === true) {
        const hid = go.getData('benneHotspotId') as string | undefined;
        if (!hid) {
          return null;
        }
        const hs = this.roomData.hotspots.find((h) => h.id === hid);
        const d = hs?.description?.trim();
        const description = d && d.length > 0 ? d : null;
        return {
          description,
          targetType: 'hotspot',
          targetId: hid,
          ...verbHoverDefaultVerbPatch(hs ?? {}),
        };
      }
      const charData = go.getData('character') as CharacterData | undefined;
      if (charData) {
        if (go.getData('isPlayer') === true) {
          return null;
        }
        if (!charData.clickable) {
          continue;
        }
        const chDesc = charData.description?.trim();
        let description: string | null = null;
        if (chDesc && chDesc.length > 0) {
          description = chDesc;
        } else {
          const nm = charData.name?.trim();
          description = nm && nm.length > 0 ? nm : null;
        }
        return {
          description,
          targetType: 'character',
          targetId: charData.id,
          ...verbHoverDefaultVerbPatch(charData),
        };
      }
      for (const [propId, propSprite] of this.propSpritesById) {
        if (propSprite === o) {
          const trimmedOverride = this.propDescriptionOverrides.get(propId)?.trim();
          const p = this.roomData.props?.find((rp) => rp.id === propId);
          let description: string;
          if (trimmedOverride && trimmedOverride.length > 0) {
            description = trimmedOverride;
          } else {
            const pd = p?.description?.trim();
            description = pd && pd.length > 0 ? pd : propId;
          }
          return {
            description,
            targetType: 'prop',
            targetId: propId,
            ...verbHoverDefaultVerbPatch(p ?? {}),
          };
        }
      }
      continue;
    }
    return null;
  }

  /**
   * Align with {@link Phaser.Input.InputPlugin#sortGameObjects}: {@link Phaser.Input.InputPlugin#hitTestPointer}
   * returns overlaps in arbitrary order, while pointer dispatch uses render-list order so the top
   * drawable receives {@link Phaser.GameObjects.GameObject#pointerdown} first when `topOnly` is set.
   */
  private sortRoomPointerHitStack(pointer: Phaser.Input.Pointer): Phaser.GameObjects.GameObject[] {
    const hits = this.input.hitTestPointer(pointer);
    if (hits.length < 2) {
      return hits;
    }
    const sorted = [...hits];
    this.input.sortGameObjects(sorted, pointer);
    return sorted;
  }

  private refreshCustomCursor(pointer: Phaser.Input.Pointer): void {
    const sprite = this.customCursorSprite;
    if (!sprite || !sprite.scene) {
      return;
    }
    const settings = getGameSettings();
    // Editor UI cam: origin (0,0); scrollFactor-0 overlays use world ≈ (screen − viewport) / zoom + scroll.
    // getWorldPoint inverts matrixCombined and can disagree with that mapping vs main’s origin math.
    if (this.editorUiCamera) {
      const cam = this.editorUiCamera;
      this.customCursorWorldScratch.set(
        (pointer.x - cam.x) / cam.zoomX + cam.scrollX,
        (pointer.y - cam.y) / cam.zoomY + cam.scrollY,
      );
      applyGameCursorSpriteHotspot(sprite, this.customCursorWorldScratch, settings.cursor!);
    } else {
      applyGameCursorSpriteHotspot(sprite, pointer, settings.cursor!);
    }

    const cfg = settings.cursor!;
    const idleKey = cursorPhaserAnimationKey(cfg.idleAnimation.trim());
    const activeKey = cursorPhaserAnimationKey(cfg.activeAnimation.trim());

    // Cutscene: show busy animation if configured and exists, otherwise hide the cursor.
    if (this.cutsceneDepth > 0) {
      const busyAuthor = cfg.busyAnimation?.trim() ?? '';
      const busyKey = busyAuthor.length > 0 ? cursorPhaserAnimationKey(busyAuthor) : '';
      const hasBusy = busyKey.length > 0 && this.anims.exists(busyKey);
      const visualKey = hasBusy ? `busy|${busyKey}` : 'busy|hide';
      if (this.lastCustomCursorVisualKey !== visualKey) {
        this.lastCustomCursorVisualKey = visualKey;
        if (hasBusy) {
          sprite.setVisible(true);
          sprite.setTexture(CURSOR_TEXTURE_KEY);
          sprite.play(busyKey);
        } else {
          sprite.setVisible(false);
        }
      }
      return;
    }

    // Outside cutscene: restore visibility in case it was hidden.
    sprite.setVisible(true);

    const overClickable = this.resolvePointerVerbStyleActiveCursor(
      this.sortRoomPointerHitStack(pointer),
    );
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
   * Whether the verb-style cursor (idle vs active clip) should be **active**.
   * Walks hits top-first (sorted): during cutscene everything returns false; during scripted-dialog
   * suppression only, GUI / inventory still count as interactive; props / hotspots / clickable NPCs
   * do not flip to active while any input suppression is in effect.
   */
  private resolvePointerVerbStyleActiveCursor(hits: Phaser.GameObjects.GameObject[]): boolean {
    if (this.cutsceneDepth > 0) {
      return false;
    }
    const dialogSuppressed = this.isScriptedDialogInputSuppressed();
    for (const o of hits) {
      const go = o as Phaser.GameObjects.GameObject & { getData?: (key: string) => unknown };
      if (typeof go.getData === 'function') {
        if (go.getData('benneGuiButton') === true || go.getData('benneInventorySlot') === true) {
          return true;
        }
        if (go.getData('benneHotspot') === true) {
          return !dialogSuppressed;
        }
        const charData = go.getData('character') as CharacterData | undefined;
        if (charData && go.getData('isPlayer') !== true && charData.clickable) {
          return !dialogSuppressed;
        }
      }
      for (const propSprite of this.propSpritesById.values()) {
        if (propSprite === o) {
          return !dialogSuppressed;
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
