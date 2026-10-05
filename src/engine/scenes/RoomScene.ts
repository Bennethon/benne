import * as Phaser from 'phaser';
import {
  attachDirectionalAnimationApi,
  CHARACTER_FACING_UNIT,
  facingFromWorldDelta,
  offsetWorldByCharacterFacing,
  playDirectionalAnimation,
  resolveInitialIdleFacing,
  resolveSpawnIdleFacing,
  type CharacterFacing,
  type DirectionalCharacterSprite,
} from '../directionalCharacterAnimation';
import { gameEvents } from '../events/EventBus';
import {
  GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT,
  GAME_STATE_ACTIVE_PLAYER_CHARACTER_CHANGED_EVENT,
  GAME_STATE_ACTIVE_VERB_CHANGED_EVENT,
  GAME_STATE_INVENTORY_CHANGED_EVENT,
  GAME_STATE_VARIABLE_CHANGED_EVENT,
  type GameStateActivePlayerCharacterChangedPayload,
  type GameStateVariableChangedPayload,
} from '../../types/gameState';
import { cursorPhaserAnimationKey, roomPropPhaserAnimationKey } from '../../game/boot/asepritePhaserAnimationKeys';
import {
  getPerItemInventoryTextureKey,
  inventoryPhaserAnimationKeyForTag,
  sharedInventoryTextureKey,
} from '../../game/boot/inventoryAseprite';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry';
import {
  inventoryCursorAnimationVariableKey,
  inventoryDefaultAnimationVariableKey,
  readEffectiveInventoryCursorAnimationTag,
  readEffectiveInventoryDefaultAnimationTag,
  readEffectiveInventoryDescription,
  writeSavedInventoryDescription,
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
  applyPersistedCharacterFollowFromScript,
  BENNE_FOLLOW_SPEED_MULT_KEY,
  BENNE_FOLLOW_WALK_PURPOSE_KEY,
  characterFaceLetterRespectingOverride,
  clearSavedCharacterFollowState,
  getCharacterAnimationOverrideTag,
  getCharacterEffectiveAnimationTag,
  promiseWhenSpriteAnimationFinishes,
  readSavedCharacterAlpha,
  readSavedCharacterAnimationOverride,
  readSavedCharacterFollowEffectiveOptions,
  readSavedCharacterFollowingTarget,
  readSavedCharacterClickable,
  readSavedCharacterDescription,
  readSavedCharacterMovable,
  readSavedCharacterPosition,
  readSavedCharacterSpeechOffset,
  readSavedCharacterSpeechPosition,
  readSavedCharacterVisible,
  readSavedPropAlpha,
  readSavedPropBaseAnimationTag,
  readSavedPropClickable,
  readSavedPropPosition,
  readSavedPropVisible,
  readSavedHotspotActive,
  readSavedHotspotDescription,
  readSavedPropDescription,
  readSavedRegionActive,
  readSavedWalkableActive,
  writeSavedCharacterDescription,
  writeSavedHotspotActive,
  writeSavedHotspotDescription,
  writeSavedPropDescription,
  writeSavedRegionActive,
  writeSavedWalkableActive,
  setCharacterAnimationOverrideTagOnSprite,
  writeSavedCharacterAlpha,
  writeSavedCharacterAnimationOverride,
  writeSavedCharacterClickable,
  writeSavedCharacterMovable,
  writeSavedCharacterPosition,
  writeSavedCharacterSpeechOffset,
  writeSavedCharacterSpeechPosition,
  writeSavedCharacterVisible,
  clearSavedCharacterSpeechPosition,
  writeSavedPropAlpha,
  writeSavedPropBaseAnimationTag,
  writeSavedPropClickable,
  writeSavedPropPosition,
  writeSavedPropVisible,
} from '../benneAnimationRuntime';
import { registerSnapshotFlushHook } from '../gameState/snapshotFlushHooks';
import type { CharacterFacingLetter } from '../../types/character';
import {
  getCameraSettings,
  getCutscenesSkippable,
  getDialogSettings,
  getGameSettings,
  getPerspectiveSettings,
  getSpeechSettings,
} from '../ConfigManager';
import {
  applyGameCursorSpriteHotspot,
  CURSOR_TEXTURE_KEY,
  isBenneGameCursorAsepriteEnabled,
} from '../../game/boot/cursorAseprite';
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
  BENNE_RUNTIME_HI_DPI_CAM_ZOOM_REGISTRY_KEY,
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
import { BENNE_USER_INPUT_DISABLED_REGISTRY_KEY } from '../input/userInputDisabledRegistry';
import { incrementRoomVisitCount } from '../gameState/roomVisitState';
import { getInternalHeight, getInternalWidth, SCENE_ROOM } from '../../game/boot/constants';
import type { CharacterAnimationsConfig } from '../../types/character';
import type { CharacterData } from '../../types/character';
import type { CharacterFollowOptions } from '../../types/characterFollow';
import type { CutsceneOptions } from '../../types/cutscene';
import type { InventoryItemData } from '../../types/inventory';
import type { VerbHoverTarget } from '../../types/verbContext';
import type { Point2, RoomData, RoomHotspotData, RoomPropInstance, WalkablePolygon } from '../../types/room';
import type { GuiButtonControl, GuiData, GuiGridControl } from '../../types/gui';
import type { RoomCharacterSpawn, RoomPropSpawn, RoomSceneStartData } from './BootScene';
import { createRoomScriptContext } from '../scripting/RoomScriptContext.js';
import { createCharacterScriptContext } from '../scripting/CharacterScriptContext.js';
import { createInventoryScriptContext } from '../scripting/InventoryScriptContext.js';
import type { CharacterScriptContext, InventoryScriptContext, UpdateContext } from '@engine/scripting/types.js';
import { getCallbacksForRoom } from '../scripting/registerRoomScript.js';
import { runGlobalBenneScriptOnUpdateHandlers } from '../scripting/benneScriptOnUpdateRegistry.js';
import {
  buildGuiOverlay,
  type BuildGuiOverlayOptions,
  GUI_OVERLAY_DEPTH_STRIDE,
  GUI_TEXT_OVERLAY_DEPTH,
  hasAnyVisibleModal,
  isGuiDepthBehindVisibleModal,
  type GuiOverlayHandle,
  type ModalGuiDepthEntry,
} from '../gui/buildGuiOverlay';
import { sortGuisForOverlayStack } from '../gui/guiStackOrder';
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
  advanceDialogChoiceScrollTopPx,
  measureDialogChoiceOptionsLayout,
  resolveDialogChoiceOptionWordWrapMaxPx,
  resolveDialogChoiceViewportHeightPx,
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
  BENNE_SPEECH_SETTINGS_CHANGED_EVENT,
  getBenneSpeechSettingsChangedEmitter,
} from '../scripting/benneSpeechSettingsScriptSurface.js';
import {
  BENNE_VERB_CONTEXT_CHANGED_EVENT,
  clearBenneVerbHoverContext,
  getBenneVerbContextChangedEmitter,
  publishBenneVerbHoverContext,
} from '../scripting/benneVerbContextScriptSurface.js';
import { DIALOG_CHOICE_OPTIONS_VIEWPORT_HEIGHT_PX_VARIABLE } from '../dialog/dialogGameState.js';
import type { GuiRuntime } from '../scripting/GuiRuntime.js';
import {
  BENNE_SCREEN_FADE_DEFAULT_COLOR,
  BENNE_SCREEN_FADE_DEFAULT_DURATION_SEC,
  BENNE_SCREEN_FADE_OVERLAY_DEPTH,
  SPEAKING_TEXT_OVERLAY_DEPTH,
} from './roomScreenFadeConstants';
import { ROOM_VIDEO_LAYER_DEPTH } from './roomVideoConstants';
import { benneVideoCacheKey } from '../video/benneVideoCacheKeys.js';
import { BENNE_VIDEO_ENDED_EVENT } from '../video/benneVideoEvents.js';
import type { VideoPlayOptions } from '../video/benneVideoTypes.js';
import { getGuiBenneScript } from '../scripting/registerGuiScript.js';
import type { BenneScriptCore } from '../scripting/BenneScriptCore.js';
import {
  tryGetGlobalBenneScriptForRoomTransitions,
  tryGetRoomTransitionOrchestrator,
} from './roomTransitionGlobals.js';
import { clearPlayFromRegistrationsForRoom } from '../scripting/devPlayFromRegistry.js';
import { currentInteraction, type InteractionActivity } from '../interaction/interactionActivity.js';
import { BENNE_ROOM_START_KIND_KEY, type BenneRoomStartKind } from './roomStartKindConstants.js';
import { getAllGuiData } from '../../game/boot/loadGuiData';
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
 * Optional `Phaser.Game.registry` key: when set to a boolean, acts as the BENNE room preview **Show GUIs**
 * master switch. Generic HUD overlays start at `registryValue && gui.visible` (and the same AND applies in
 * {@link setGenericGuisVisible}). Unset (the default) preserves per-GUI JSON `visible` only (`false` hides at
 * load; `true` shows).
 */
const GENERIC_GUIS_INITIAL_VISIBILITY_REGISTRY_KEY = 'benneRoomSceneGenericGuisVisible';

/** Ignore walk clicks when already within this many pixels of the target. */
const MIN_WALK_DISTANCE_PX = 6;

/**
 * Leader overlap slack for follow snap (see {@link updateCharacterFollowers} idle-leader handling).
 */
const FOLLOW_STOP_TOOCLOSE_SLACK_PX = 2;

/**
 * After the leader stops: if follower feet are still within this many pixels of the leader’s
 * feet, nudge them outward (leader-stop snap), so offset‑0 follow does not stack sprites.
 */
const FOLLOW_STOP_MIN_LEADER_CLEARANCE_PX = 18;

/** If feet–feet distance drops by more than this vs last frame, treat the leader as approaching (suppress follow walks). */
const FOLLOW_LEADER_APPROACH_EPS_PX = 2;

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

  /** Active player Aseprite sprite; null if the active character is absent or image-only in the room. */
  player: DirectionalCharacterSprite | null = null;

  /**
   * Tracks the current editor camera mode so the camera can be reconfigured when the
   * panel resizes (`Scale.RESIZE` fires a resize event). Null = game runtime (no editor).
   */
  private editorCameraMode: 'navigate' | 'edit' | null = null;

  /** Letterbox / fit-room display zoom from editor mode or hi-DPI layout (excludes script gameplay zoom). */
  private editorDisplayBaseZoom = 1;

  /** When true, player follow is suspended until {@link queueCameraReset}. */
  private scriptCameraFocusActive = false;

  /**
   * World point of the active script focus. Hi-DPI layout resets scroll after enter hooks;
   * this is reapplied in {@link syncRuntimeHiDpiUiCameraToMain} so the fade-in does not
   * reveal the clamped right edge of a wide room.
   */
  private scriptCameraFocusPoint: Point2 | null = null;

  /** Gameplay zoom multiplier on top of display zoom (`1` = room default). */
  private scriptGameplayZoom = 1;

  private scriptCameraZoomTween: Phaser.Tweens.Tween | null = null;

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

  /** Walkable mesh strokes (`debug.showWalkable`). Cleared and restroked when `B.walkable(id).active` changes. */
  private debugWalkableOuterGraphics: Phaser.GameObjects.Graphics | null = null;
  private debugWalkableHoleGraphics: Phaser.GameObjects.Graphics | null = null;

  /** Fired once when a walk tween completes successfully (instant walks may call it without a tween). */
  private walkArriveCallback: (() => void) | null = null;
  /** Interaction waiting on {@link walkArriveCallback}; ended if the walk is dropped (see `interactionActivity.ts`). */
  private walkArriveInteraction: InteractionActivity | null = null;

  /** Bennescript cores active for this `RoomScene` (reset interaction tails before leave / transition). */
  private benneCoresForTransitionReset: BenneScriptCore[] = [];

  /** Room **`B.onUpdate`** handlers for this scene (cleared on shutdown). */
  private benneScriptRoomOnUpdateHandlers: Array<(ctx: UpdateContext) => void> = [];

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
  /** Definition JSON default for `CharacterData.clickable` (first spawn in this room wins). */
  private characterJsonClickableByDefId = new Map<string, boolean>();
  /** `CharacterData.speechColor` per definition id (first spawn wins); used by `setDialogTextOverlay`. */
  private characterSpeechColorByDefId = new Map<string, string>();

  /** Active scripted walks for non-player characters (by sprite identity). */
  private npcWalkTweens = new Map<
    Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    Phaser.Tweens.Tween
  >();

  /**
   * When false, the character-follow driver does not issue walks (used until enter-room hooks
   * and their queued Bennescript have finished — see {@link setCharacterFollowBehaviorEnabled}).
   */
  private characterFollowBehaviorEnabled = false;

  /** Last follow stand goal per follower (world pixels); avoids jittery micro-repaths. */
  private characterFollowLastGoalByFollowerId = new Map<string, Point2>();

  /** Last frame’s “leader is mid–pathfind walk” flag per follower (for follow snap / interrupt). */
  private characterFollowPrevLeaderWalkingByFollowerId = new Map<string, boolean>();

  /** Last frame’s follower→leader feet distance (world px) for “leader approaching” suppression. */
  private characterFollowPrevDistToLeaderByFollowerId = new Map<string, number>();

  /**
   * `B.character(observer).startFacingCharacter(target)` — observer keeps turning toward target’s
   * feet after short random delays when either character’s feet move.
   */
  private characterFaceTowardCharacterLocks = new Map<
    string,
    {
      targetDefId: string;
      minWaitSec: number;
      maxWaitSec: number;
      refObsFeet: Point2;
      refTgtFeet: Point2;
      pendingTimer: Phaser.Time.TimerEvent | null;
      /** Incremented whenever a new delayed callback is armed so stale callbacks no-op. */
      scheduleGen: number;
    }
  >();

  private static readonly CHARACTER_FACE_TOWARD_MOVE_EPS = 0.35;

  /** String ids that already triggered `walkTo` resolution warnings (warn once per id per room load). */
  private unresolvedWalkTargetIdsWarned = new Set<string>();

  private unresolvedCameraTargetIdsWarned = new Set<string>();

  /** `B.hotspot(id)` with an id not in `roomData.hotspots` — warn once per id per room load. */
  private unknownHotspotScriptIdsWarned = new Set<string>();

  /** `B.walkable(id)` with an id not in `walkable.polygons` — warn once per id per room load. */
  private unknownWalkableScriptIdsWarned = new Set<string>();

  /** `activeCursorOverride` tags that are missing on the game cursor sheet — warn once per tag per room load. */
  private unknownActiveCursorOverrideTagsWarned = new Set<string>();

  /**
   * Unregister handle for the snapshot flush hook installed in {@link create} and torn down on
   * {@link Phaser.Scenes.Events.SHUTDOWN}. Null when no hook is registered (preview / pre-create).
   */
  private snapshotFlushHookUnregister: (() => void) | null = null;

  /**
   * Full-screen fade (above HUD, choice, and display-text GUIs; below Speaking Text and the
   * custom pointer). Tweened by {@link queueScreenFadeToAlpha} (`B.fadeOut` / `B.fadeIn`).
   * Null only before `create` or after shutdown.
   */
  private screenFadeRect: Phaser.GameObjects.Rectangle | null = null;

  /**
   * Single-slot cinematic video layer (`B.video`). Created hidden in {@link create} (no source) and
   * reused across `play` calls; renders at {@link ROOM_VIDEO_LAYER_DEPTH} (above room art, below all
   * GUIs). Null only before `create` or after shutdown.
   */
  private roomVideo: Phaser.GameObjects.Video | null = null;

  /** Black letterbox backdrop behind {@link roomVideo}; visible only while a video is playing. */
  private roomVideoBackdrop: Phaser.GameObjects.Rectangle | null = null;

  /** Stem key of the video currently loaded into {@link roomVideo}, or null when idle. */
  private roomVideoActiveKey: string | null = null;

  /** `options.onComplete` for the current playback, called once on end/stop. */
  private roomVideoOnComplete: (() => void) | null = null;

  /** Whether the active video should stop on the next primary click/tap. */
  private roomVideoClickToSkip = false;

  /** Resolvers for outstanding `playAndWait` promises on the current playback. */
  private roomVideoCompleteResolvers: Array<() => void> = [];

  /** Dedupes missing-video-cache warnings for `B.video.play` (once per stem per room `create`). */
  private missingVideoKeysWarned = new Set<string>();

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

  /**
   * Parallel to {@link genericGuiOverlays}: each overlay's authored `GuiData.visible` at build time. Used by
   * the room preview **Show GUIs** toggle ({@link setGenericGuisVisible} ANDs the toolbar flag with these values).
   */
  private genericGuiOverlayJsonVisible: boolean[] = [];

  /** Latest live overlay handle per `guiId` for whole-overlay visibility control (`B.gui('id').show()` / `.hide()`). */
  private guiOverlayHandleByGuiId = new Map<string, GuiOverlayHandle>();

  /** Latest {@link GuiRuntime} per overlay id for **`B.gui(…)`** on GUI scripts (generic + speaking-text + choice GUIs). */
  private guiRuntimeByGuiId = new Map<string, GuiRuntime>();

  /**
   * Parallel to {@link genericGuiOverlays}: each overlay’s effective visibility before the active dialog session hid
   * them. `null` when no dialog is open.
   */
  private genericGuiVisibilityBeforeDialog: boolean[] | null = null;

  /**
   * Parallel to {@link genericGuiOverlays}: each overlay’s effective visibility before a cinematic video
   * ({@link startRoomVideo}) hid them. `null` when no video is playing. Tracked separately from
   * {@link genericGuiVisibilityBeforeDialog} so video and dialog snapshots never clobber each other.
   */
  private genericGuiVisibilityBeforeVideo: boolean[] | null = null;

  /** Visible modal overlays (`GuiData.modal`) for depth-based pointer blocking. */
  private modalGuiEntries: ModalGuiDepthEntry[] = [];

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
  private activeDialogChoiceSession: { guiId: string; dialogId: string; scrollTopPx: number } | null = null;
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
   * Reference-counted cutscene stack (one entry per {@link pushCutscene}). While non-empty ALL
   * pointer input (props, hotspots, characters, GUI buttons, inventory rows, background walks,
   * hover descriptions) is suppressed. Only the click-to-skip scripted-dialog path remains live.
   * Each entry records whether that cutscene opted out of ESC skipping; an unskippable entry
   * anywhere in the stack locks the whole nest. Emptied on room transitions.
   */
  private readonly cutsceneStack: Array<{ skippable: boolean }> = [];

  /**
   * True while an ESC skip is fast-forwarding the cutscene: every remaining queued Bennescript step
   * still runs, but timed steps (waits, say lines, walks, fades, camera transitions, sound, video)
   * complete instantly at their final value so the end state matches a cutscene that played out.
   * Cleared when the cutscene stack empties or on a room transition.
   */
  private cutsceneSkipFastForwardActive = false;

  /**
   * In-flight blocking script steps that know how to finish themselves at their final state when
   * the player skips (timers fire now, tweens jump to their end value, walks teleport to the walk
   * destination). Registered while the step runs via {@link registerCutsceneSkipFinisher}, drained
   * by {@link requestCutsceneSkip}.
   */
  private readonly cutsceneSkipFinishers = new Set<() => void>();

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
  private readonly onRoomKeyDown = (event: KeyboardEvent): void => {
    if (this.isUserInputDisabled()) {
      return;
    }
    if (event.key !== 'Escape') {
      return;
    }
    // A skippable cutscene wins over the video handler: skipping fast-forwards the whole cutscene,
    // which stops any video playing inside it as part of finishing the in-flight step.
    if (this.canSkipActiveCutscene()) {
      event.preventDefault();
      event.stopPropagation();
      this.requestCutsceneSkip();
      return;
    }
    if (!this.isRoomVideoPlaying()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.stopRoomVideo();
  };
  private readonly onCustomGameStateForCursor = (): void => {
    this.lastCustomCursorVisualKey = null;
    this.refreshCustomCursor(this.input.activePointer);
  };
  private readonly onActivePlayerCharacterChanged = (
    payload: GameStateActivePlayerCharacterChangedPayload,
  ): void => {
    this.applyActivePlayerCharacterBinding(payload.characterId);
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
    this.debugWalkableOuterGraphics = null;
    this.debugWalkableHoleGraphics = null;
    this.parallaxProps = [];
    this.roomStackEntities = [];
    this.propSpritesById.clear();
    this.characterSpritesByDefId.clear();
    this.characterJsonVisibleByDefId.clear();
    this.characterJsonMovableByDefId.clear();
    this.characterJsonClickableByDefId.clear();
    this.characterSpeechColorByDefId.clear();
    this.npcWalkTweens.clear();
    this.cutsceneSkipFinishers.clear();
    this.characterFollowBehaviorEnabled = false;
    this.characterFollowLastGoalByFollowerId.clear();
    this.characterFollowPrevLeaderWalkingByFollowerId.clear();
    this.characterFollowPrevDistToLeaderByFollowerId.clear();
    this.clearCharacterFaceTowardCharacterLocks();
    this.characterFeetWinningRegionId.clear();
    this.regionEnterExitSeeded = false;
    this.restoreRegionActiveOverrides();
    this.restoreHotspotActiveOverrides();
    this.restoreWalkableActiveOverrides();
    this.unresolvedWalkTargetIdsWarned.clear();
    this.unresolvedCameraTargetIdsWarned.clear();
    this.unknownHotspotScriptIdsWarned.clear();
    this.unknownWalkableScriptIdsWarned.clear();
    this.unknownActiveCursorOverrideTagsWarned.clear();
    this.missingDialogTextOverlaySayWarned = false;
    this.missingDisplayTextOverlayWarned = false;
    this.genericGuiVisibilityBeforeDialog = null;
    this.genericGuiVisibilityBeforeVideo = null;
    this.modalGuiEntries = [];
    this.benneCoresForTransitionReset.length = 0;
    this.benneScriptRoomOnUpdateHandlers.length = 0;

    // Pull-up character/prop positions whenever a snapshot is taken, the room is left, or
    // `B.state.flush()` is called. Eagerly-saved fields (visibility, alpha, animation override)
    // are unaffected. The unregister fn fires on SHUTDOWN below.
    this.snapshotFlushHookUnregister?.();
    this.snapshotFlushHookUnregister = registerSnapshotFlushHook(() => {
      this.flushRuntimeStateToGameState();
    });

    attachPostProcessingPlaceholder(this.cameras.main);
    // Script focus does not survive a room restart (the scene instance is reused).
    this.scriptCameraFocusActive = false;
    this.scriptCameraFocusPoint = null;
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
      if (!this.characterJsonClickableByDefId.has(defId)) {
        this.characterJsonClickableByDefId.set(defId, spawn.data.clickable === true);
      }
      if (!this.characterSpeechColorByDefId.has(defId) && spawn.data.speechColor) {
        this.characterSpeechColorByDefId.set(defId, spawn.data.speechColor);
      }
    }
    data.characters.forEach((spawn) => this.spawnCharacter(data.room.id, spawn));
    this.applyActivePlayerCharacterBinding();
    this.updateRoomStackDepths();

    this.setupRoomCamera(roomW, roomH);
    this.applyPlayerCameraFollow(roomW, roomH);
    this.drawRoomDebugOverlays(data);

    const dialogChoiceGuiIds = new Set(getRegisteredDialogChoiceGuiIds());
    const guisForStack = sortGuisForOverlayStack(getAllGuiData());

    const genericGuiVisibilityOverride = this.game.registry.get(
      GENERIC_GUIS_INITIAL_VISIBILITY_REGISTRY_KEY,
    );
    const hasGenericGuiVisibilityOverride = typeof genericGuiVisibilityOverride === 'boolean';

    this.genericGuiOverlays = [];
    this.genericGuiOverlayJsonVisible = [];
    this.guiOverlayHandleByGuiId.clear();
    this.guiRuntimeByGuiId.clear();
    this.dialogTextOverlay = null;
    this.displayTextOverlay = null;
    this.dialogChoiceInstallByGuiId.clear();
    this.dialogChoiceRuntimeByGuiId.clear();
    let stackIndex = 0;
    const inventoryPanelPointerContext = {
      roomId: data.room.id,
      isInputSuppressed: (): boolean => this.isPlayerPointerBlocked(),
      tryConsumeDialogClickToSkip: (pointer: Phaser.Input.Pointer): boolean =>
        this.tryConsumeRoomVideoOrScriptedDialogClickToSkip(pointer),
    };
    const isButtonClickSuppressed = (): boolean =>
      this.isCutsceneActive() || this.isRoomVideoPlaying() || this.isUserInputDisabled();
    const noopDialogQueue = (factory: () => Promise<unknown>): void => {
      void factory().catch((err) => console.error('[Benne] dialog choice GUI queued step failed:', err));
    };
    for (const gui of guisForStack) {
      const isSpeakingText = gui.id === SPEAKING_TEXT_GUI_ID;
      const isDisplayText = gui.id === DISPLAY_TEXT_GUI_ID;
      const isChoiceDialog = dialogChoiceGuiIds.has(gui.id);
      const isGenericHud = !isSpeakingText && !isDisplayText && !isChoiceDialog;

      const stackDepth = GUI_TEXT_OVERLAY_DEPTH + stackIndex * GUI_OVERLAY_DEPTH_STRIDE;
      const guiDepth = isSpeakingText ? SPEAKING_TEXT_OVERLAY_DEPTH : stackDepth;
      const guiStartVisible =
        isSpeakingText || isDisplayText || isChoiceDialog
          ? false
          : hasGenericGuiVisibilityOverride
            ? genericGuiVisibilityOverride && gui.visible
            : gui.visible;

      const built = buildGuiOverlay(
        this,
        gui,
        this.makeGuiOverlayBuildOptions(guiDepth, {
          startVisible: guiStartVisible,
          inventoryPanelPointerContext,
          isButtonClickSuppressed,
          previewGuiAsepriteSheetJson: data.previewGuiAsepriteSheetJsonById?.[gui.id],
        }),
      );
      stackIndex += 1;
      if (!built) {
        continue;
      }

      this.registerModalGuiOverlay(gui, guiDepth, built.handle, guiStartVisible);
      this.guiOverlayHandleByGuiId.set(gui.id, built.handle);

      if (isSpeakingText) {
        this.dialogTextOverlay = built.handle;
        const speakingTextScript = getGuiBenneScript(SPEAKING_TEXT_GUI_ID);
        if (speakingTextScript) {
          const rt = built.createGuiRuntime((factory) =>
            speakingTextScript.queueInteraction(factory),
          );
          this.guiRuntimeByGuiId.set(SPEAKING_TEXT_GUI_ID, rt);
          speakingTextScript.notifyGuiBuilt(rt);
        }
      } else if (isDisplayText) {
        this.displayTextOverlay = built.handle;
        const displayTextScript = getGuiBenneScript(DISPLAY_TEXT_GUI_ID);
        if (displayTextScript) {
          const rt = built.createGuiRuntime((factory) =>
            displayTextScript.queueInteraction(factory),
          );
          this.guiRuntimeByGuiId.set(DISPLAY_TEXT_GUI_ID, rt);
          displayTextScript.notifyGuiBuilt(rt);
        }
      } else if (isChoiceDialog) {
        this.dialogChoiceInstallByGuiId.set(gui.id, {
          built,
          guiData: gui,
          baseDepth: guiDepth,
        });
        const choiceScript = getGuiBenneScript(gui.id);
        const rt = built.createGuiRuntime((factory) =>
          choiceScript ? choiceScript.queueInteraction(factory) : noopDialogQueue(factory),
        );
        this.dialogChoiceRuntimeByGuiId.set(gui.id, rt);
        this.guiRuntimeByGuiId.set(gui.id, rt);
        choiceScript?.notifyGuiBuilt(rt);
      } else if (isGenericHud) {
        this.genericGuiOverlays.push(built.handle);
        this.genericGuiOverlayJsonVisible.push(gui.visible);
        const guiScript = getGuiBenneScript(gui.id);
        if (guiScript) {
          const rt = built.createGuiRuntime((factory) => guiScript.queueInteraction(factory));
          this.guiRuntimeByGuiId.set(gui.id, rt);
          guiScript.notifyGuiBuilt(rt);
        }
      }
    }

    this.wireDialogChoiceUi();

    this.createRoomVideoLayer();
    this.createScreenFadeOverlay();
    const startKind: BenneRoomStartKind =
      (this.game.registry.get(BENNE_ROOM_START_KIND_KEY) as BenneRoomStartKind | undefined) ?? 'boot';
    if (startKind === 'transition' || startKind === 'load') {
      this.screenFadeRect?.setAlpha(1);
    }

    this.setupCustomGameCursor();
    this.applyUserInputCursorLock();
    this.setupRuntimeUiCameraIfNeeded();
    this.input.on('pointermove', this.onRoomPointerMove);
    gameEvents.on(GAME_STATE_INVENTORY_CHANGED_EVENT, this.syncVerbHoverScriptSurfaceAtActivePointer);
    gameEvents.on(GAME_STATE_ACTIVE_PLAYER_CHARACTER_CHANGED_EVENT, this.onActivePlayerCharacterChanged);

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
    this.input.keyboard?.on('keydown', this.onRoomKeyDown);

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
      this.benneScriptRoomOnUpdateHandlers.length = 0;
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
      getBenneSpeechSettingsChangedEmitter().removeAllListeners(BENNE_SPEECH_SETTINGS_CHANGED_EVENT);
      clearBenneVerbHoverContext();
      for (const h of this.genericGuiOverlays) {
        h.destroy();
      }
      this.genericGuiOverlays = [];
      this.genericGuiOverlayJsonVisible = [];
      this.genericGuiVisibilityBeforeDialog = null;
      this.genericGuiVisibilityBeforeVideo = null;
      this.modalGuiEntries = [];
      this.dialogTextOverlay?.destroy();
      this.dialogTextOverlay = null;
      this.displayTextOverlay?.destroy();
      this.displayTextOverlay = null;
      this.guiOverlayHandleByGuiId.clear();
      this.guiRuntimeByGuiId.clear();
      this.dialogChoiceInputSuppressionActive = false;
      this.scriptedDialogInputSuppressionDepth = 0;
      this.scriptedDialogClickToSkip = null;
      this.scale.off('resize', this.onScaleResize, this);
      this.input.off('pointerdown', this.handleRoomPointerDown);
      this.input.off('pointermove', this.onRoomPointerMove);
      this.input.keyboard?.off('keydown', this.onRoomKeyDown);
      gameEvents.off(GAME_STATE_INVENTORY_CHANGED_EVENT, this.syncVerbHoverScriptSurfaceAtActivePointer);
      gameEvents.off(GAME_STATE_ACTIVE_PLAYER_CHARACTER_CHANGED_EVENT, this.onActivePlayerCharacterChanged);
      this.teardownCustomGameCursor();
      if (this.screenFadeRect) {
        this.tweens.killTweensOf(this.screenFadeRect);
        this.screenFadeRect.destroy();
        this.screenFadeRect = null;
      }
      this.teardownRoomVideoLayer();
      this.missingVideoKeysWarned.clear();
      this.editorUiChildListenerOff?.();
      this.editorUiChildListenerOff = null;
      this.editorUiGuiObjects.clear();
      this.editorUiCamera = null;
      this.stopPlayerMoveTween(true);
      for (const t of this.npcWalkTweens.values()) {
        t.stop();
      }
      this.npcWalkTweens.clear();
      this.clearCharacterFaceTowardCharacterLocks();
      this.debugPathGraphics = null;
      this.debugWalkableOuterGraphics = null;
      this.debugWalkableHoleGraphics = null;
      this.benneCoresForTransitionReset.length = 0;
    });
  }

  getCurrentRoomId(): string {
    return this.roomData.id;
  }

  getActivePlayerCharacterId(): string {
    return resolveGameStateManager(this.game).getActivePlayerCharacterId();
  }

  private reapplyPlayerCameraFollow(): void {
    if (this.scriptCameraFocusActive) {
      return;
    }
    this.cameras.main.stopFollow();
    const vW = getInternalWidth();
    const vH = getInternalHeight();
    const roomW = this.roomData.size?.width ?? vW;
    const roomH = this.roomData.size?.height ?? vH;
    this.applyPlayerCameraFollow(roomW, roomH);
  }

  private applyActivePlayerCharacterBinding(characterId = this.getActivePlayerCharacterId()): void {
    const previousPlayer = this.player;
    const next = this.characterSpritesByDefId.get(characterId);
    if (previousPlayer && next !== previousPlayer && this.playerMoveTween) {
      this.stopPlayerMoveTween(true);
    }
    if (previousPlayer) {
      previousPlayer.setData('isPlayer', false);
    }

    this.player = next instanceof Phaser.GameObjects.Sprite
      ? (next as DirectionalCharacterSprite)
      : null;
    if (next) {
      next.setData('isPlayer', true);
    }

    if (next && next !== previousPlayer) {
      const npcTween = this.npcWalkTweens.get(next);
      if (npcTween) {
        npcTween.stop();
        this.npcWalkTweens.delete(next);
      }
      this.clearBenneFollowWalkSpriteData(next);
    }

    this.reapplyPlayerCameraFollow();
    this.characterFollowLastGoalByFollowerId.delete(characterId);
    this.characterFollowPrevLeaderWalkingByFollowerId.clear();
    this.characterFollowPrevDistToLeaderByFollowerId.clear();
    this.syncVerbHoverScriptSurfaceAtActivePointer();
    this.lastCustomCursorVisualKey = null;
    this.refreshCustomCursor(this.input.activePointer);
  }

  switchPlayerCharacter(characterId: string): void {
    const id = characterId.trim();
    if (id.length === 0) {
      if (import.meta.env.DEV) {
        console.warn('[Benne] B.player.switchTo: empty character id — ignored.');
      }
      return;
    }
    if (!this.characterSpritesByDefId.has(id)) {
      if (import.meta.env.DEV) {
        console.warn(
          `[Benne] B.player.switchTo("${id}"): character is not spawned in room "${this.roomData.id}" — ignored.`,
        );
      }
      return;
    }
    const manager = resolveGameStateManager(this.game);
    manager.setActivePlayerCharacterId(id);
    if (manager.getActivePlayerCharacterId() === id) {
      this.applyActivePlayerCharacterBinding(id);
    }
  }

  /**
   * Registers a room-script **`B.onUpdate`** handler; returns unregister for {@link BenneScriptCore.dispose}.
   */
  registerBenneScriptOnUpdateHandler(handler: (ctx: UpdateContext) => void): () => void {
    this.benneScriptRoomOnUpdateHandlers.push(handler);
    return () => {
      const i = this.benneScriptRoomOnUpdateHandlers.indexOf(handler);
      if (i >= 0) {
        this.benneScriptRoomOnUpdateHandlers.splice(i, 1);
      }
    };
  }

  private invokeBenneScriptOnUpdateHandlers(deltaSeconds: number): void {
    const ctx: UpdateContext = { deltaSeconds, roomId: this.roomData.id };
    const roomSnapshot = [...this.benneScriptRoomOnUpdateHandlers];
    for (let i = 0; i < roomSnapshot.length; i += 1) {
      try {
        roomSnapshot[i]!(ctx);
      } catch (e) {
        console.error(`[Benne] B.onUpdate (room) handler #${i} failed:`, e);
      }
    }
    runGlobalBenneScriptOnUpdateHandlers(ctx);
  }

  /** Resolves the live {@link GuiRuntime} for an overlay **`guiId`** while this room is active. */
  tryGetGuiRuntime(guiId: string): GuiRuntime | null {
    const id = guiId.trim();
    if (id.length === 0) {
      return null;
    }
    return this.guiRuntimeByGuiId.get(id) ?? null;
  }

  /** Resolves the live {@link GuiOverlayHandle} for an overlay **`guiId`** while this room is active. */
  tryGetGuiOverlayHandle(guiId: string): GuiOverlayHandle | null {
    const id = guiId.trim();
    if (id.length === 0) {
      return null;
    }
    return this.guiOverlayHandleByGuiId.get(id) ?? null;
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
    this.stopRoomVideo();
    this.scriptedDialogInputSuppressionDepth = 0;
    this.cutsceneStack.length = 0;
    this.cutsceneSkipFastForwardActive = false;
    // Steps from the old room can never finish now; their finishers would outlive the scene.
    this.cutsceneSkipFinishers.clear();
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
    const onDialogSettingsChanged = (): void => {
      if (this.activeDialogChoiceSession) {
        this.refreshDialogChoiceOverlay();
      }
    };

    gameEvents.on(DIALOG_STARTED_EVENT, onStarted);
    gameEvents.on(DIALOG_STOPPED_EVENT, onStopped);
    gameEvents.on(DIALOG_OPTION_ENABLED_CHANGED_EVENT, onOptionEnabledChanged);
    gameEvents.on(GAME_STATE_VARIABLE_CHANGED_EVENT, onVar);
    getBenneSpeechSettingsChangedEmitter().on(BENNE_SPEECH_SETTINGS_CHANGED_EVENT, onDialogSettingsChanged);

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
      getBenneSpeechSettingsChangedEmitter().off(
        BENNE_SPEECH_SETTINGS_CHANGED_EVENT,
        onDialogSettingsChanged,
      );
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
    this.activeDialogChoiceSession = { guiId: p.guiId, dialogId: p.dialogId, scrollTopPx: 0 };
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
   * Overlay-level visibility for dialog snapshot/restore ({@link GuiOverlayHandle.gameObjects}[0] is `guiContentRoot`).
   */
  private readGenericGuiOverlayVisibleHint(handle: GuiOverlayHandle): boolean {
    const root = handle.gameObjects[0];
    if (!root || !('visible' in root)) {
      return false;
    }
    return Boolean((root as unknown as Phaser.GameObjects.Components.Visible).visible);
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

  /**
   * Hides every generic HUD overlay (verbs, menus, etc.) while a cinematic video plays, snapshotting
   * their effective visibility so {@link restoreGenericGuisAfterVideo} can put them back. The reserved
   * Speaking Text / Display Text overlays are **not** in {@link genericGuiOverlays}, so they keep showing
   * over the video as normal. No-op if a video snapshot is already held.
   */
  private snapshotAndHideGenericGuisForVideo(): void {
    if (this.genericGuiVisibilityBeforeVideo !== null) {
      return;
    }
    const snap: boolean[] = [];
    for (const h of this.genericGuiOverlays) {
      snap.push(this.readGenericGuiOverlayVisibleHint(h));
      h.setVisible(false);
    }
    this.genericGuiVisibilityBeforeVideo = snap;
  }

  /** Restores generic GUI visibility from {@link genericGuiVisibilityBeforeVideo} (video end / stop / teardown). */
  private restoreGenericGuisAfterVideo(): void {
    const snap = this.genericGuiVisibilityBeforeVideo;
    if (snap === null) {
      return;
    }
    this.genericGuiVisibilityBeforeVideo = null;
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
    if (
      key === DIALOG_CHOICE_OPTIONS_VIEWPORT_HEIGHT_PX_VARIABLE ||
      key.startsWith(`dialog:${id}:option:`)
    ) {
      this.refreshDialogChoiceOverlay();
    }
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
    const gridDef = entry.guiData.controls?.find(
      (c): c is GuiGridControl => c.type === 'grid' && c.id === DIALOG_CHOICE_GRID_ID,
    );
    const buttonDef = entry.guiData.controls?.find(
      (c): c is GuiButtonControl => c.type === 'button' && c.id === 'Dialog-Option',
    );
    if (!buttonDef) {
      return;
    }
    const manager = resolveGameStateManager(this.game);
    const visibleOpts = def.options.filter((o) => readEffectiveDialogOptionEnabled(manager, def, o.id));
    const maxViewportHeightPx = resolveDialogChoiceViewportHeightPx(
      entry.guiData,
      getDialogSettings(manager),
    );
    const viewportH = getDialogChoiceAvailableHeightPx(
      gridDef,
      entry.guiData.y ?? 0,
      getInternalHeight(),
      maxViewportHeightPx,
    );
    const optionButtonWidthPx = Math.max(1, Math.round(buttonDef.width));
    const wrapPx = resolveDialogChoiceOptionWordWrapMaxPx(buttonDef, optionButtonWidthPx);
    const { layouts } = measureDialogChoiceOptionsLayout({
      scene: this,
      gridDef,
      buttonDef,
      controls: entry.guiData.controls,
      visibleOptions: visibleOpts,
      wrapInnerWidth: wrapPx,
    });
    this.activeDialogChoiceSession.scrollTopPx = advanceDialogChoiceScrollTopPx(
      this.activeDialogChoiceSession.scrollTopPx,
      delta,
      layouts,
      viewportH,
    );
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
    const dialogSettings = getDialogSettings(manager);
    const maxViewportHeightPx = resolveDialogChoiceViewportHeightPx(
      entry.guiData,
      dialogSettings,
    );
    const viewportAvailableHeightPx = getDialogChoiceAvailableHeightPx(
      gridDef,
      entry.guiData.y ?? 0,
      getInternalHeight(),
      maxViewportHeightPx,
    );

    this.dialogChoiceRowState.hideTemplateRow(rt);
    const clampedScrollTopPx = this.dialogChoiceRowState.refresh({
      scene: this,
      gui: entry.guiData,
      baseDepth: entry.baseDepth,
      gridContainer,
      guiRuntime: rt,
      definition: def,
      manager,
      scrollTopPx: session.scrollTopPx,
      viewportAvailableHeightPx,
      dialogSettings,
    });
    session.scrollTopPx = clampedScrollTopPx;
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
    const scrollTopPx = session?.scrollTopPx ?? 0;
    const maxViewportHeightPx = resolveDialogChoiceViewportHeightPx(
      guiData,
      getDialogSettings(manager),
    );

    const { needScroll, showUp, showDown } = getDialogChoiceScrollButtonState({
      scene: this,
      gridDef,
      buttonDef,
      controls: guiData.controls,
      visibleOptions: visibleOpts,
      scrollTopPx,
      guiRootY: guiData.y ?? 0,
      viewportBottomExclusivePx: getInternalHeight(),
      maxViewportHeightPx,
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
   *
   * When `popWhenChoiceCutscene` is true, pops the cutscene {@link DialogBenneScript.whenChoice} pushed on
   * **this** room. That pop waits until this method actually finishes (list shown, or the session already
   * gone) so a skip click cannot walk while the list is still hidden. Pass false when the cutscene was
   * pushed on a different room that has already been popped.
   */
  restoreDialogChoiceGuiAfterWhenChoiceDrain(
    guiId: string,
    dialogId: string,
    popWhenChoiceCutscene = true,
  ): void {
    // A click-to-skip finishes speech on pointerdown, while GUI buttons activate on
    // pointerup. Keep the choices hidden — and the whenChoice cutscene up — until that same
    // press is released so it cannot also walk or activate whichever option appears beneath
    // the stationary pointer.
    if (this.input.activePointer.leftButtonDown()) {
      this.input.once('pointerup', () => {
        this.restoreDialogChoiceGuiAfterWhenChoiceDrain(guiId, dialogId, popWhenChoiceCutscene);
      });
      return;
    }

    if (popWhenChoiceCutscene) {
      this.popCutscene();
    }

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
   * Creates the (hidden) single-slot cinematic video layer + black letterbox backdrop. Both are
   * screen-fixed (`scrollFactor 0`) at {@link ROOM_VIDEO_LAYER_DEPTH} so they sit above room art and
   * below every GUI overlay (Speaking Text / Display Text always draw on top). The {@link Phaser.GameObjects.Video}
   * starts without a source and is fed via {@link startRoomVideo}; mirrors the screen-fade lifecycle.
   */
  private createRoomVideoLayer(): void {
    const w = getInternalWidth();
    const h = getInternalHeight();
    const backdrop = this.add
      .rectangle(0, 0, w, h, 0x000000, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0, 0)
      .setDepth(ROOM_VIDEO_LAYER_DEPTH - 1)
      .setVisible(false);
    this.roomVideoBackdrop = backdrop;

    const video = this.add
      .video(w / 2, h / 2)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0, 0)
      .setDepth(ROOM_VIDEO_LAYER_DEPTH)
      .setVisible(false);
    video.on(Phaser.GameObjects.Events.VIDEO_PLAY, () => this.onRoomVideoPlay());
    video.on(Phaser.GameObjects.Events.VIDEO_COMPLETE, () => this.finalizeRoomVideo(true));
    video.on(Phaser.GameObjects.Events.VIDEO_STOP, () => this.finalizeRoomVideo(true));
    this.roomVideo = video;
  }

  /** Crisp nearest-neighbor + letterbox fit to the internal resolution once the frame is ready. */
  private onRoomVideoPlay(): void {
    const video = this.roomVideo;
    if (!video) {
      return;
    }
    video.videoTexture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const nativeW = video.width;
    const nativeH = video.height;
    if (nativeW > 0 && nativeH > 0) {
      const scale = Math.min(getInternalWidth() / nativeW, getInternalHeight() / nativeH);
      video.setDisplaySize(nativeW * scale, nativeH * scale);
    }
    video.setPosition(getInternalWidth() / 2, getInternalHeight() / 2);
  }

  /**
   * Starts cinematic playback of the bundled video stem `key`. Single-slot: any video already playing
   * is stopped first. Returns a handle whose `whenComplete` resolves when the video ends or is stopped
   * (used by `B.video.playAndWait`). Missing / disabled cache → DEV warn-once + already-resolved handle.
   */
  startRoomVideo(key: string, options?: VideoPlayOptions): { whenComplete: Promise<void> } {
    const video = this.roomVideo;
    const cacheKey = benneVideoCacheKey(key);
    if (!video || !this.cache.video.has(cacheKey)) {
      if (import.meta.env.DEV && !this.missingVideoKeysWarned.has(key)) {
        this.missingVideoKeysWarned.add(key);
        console.warn(
          `[Benne] B.video.play('${key}'): no bundled video found (expected src/game/assets/videos/${key}.{mp4,webm}) — ignored.`,
        );
      }
      return { whenComplete: Promise.resolve() };
    }

    // Skipping a cutscene skips the cinematics inside it: the video never starts, but scripts
    // waiting on it still continue and `onComplete` / the ended event still fire.
    if (this.cutsceneSkipFastForwardActive) {
      options?.onComplete?.();
      gameEvents.emit(BENNE_VIDEO_ENDED_EVENT, { key });
      return { whenComplete: Promise.resolve() };
    }

    // Replace any in-flight video (resolves the previous playback's waiters via finalizeRoomVideo).
    if (this.roomVideoActiveKey !== null) {
      video.stop();
    }

    const masterVolume = Phaser.Math.Clamp(getGameSettings().audio.masterVolume, 0, 1);
    const optVolume = options?.volume === undefined ? 1 : Phaser.Math.Clamp(options.volume, 0, 1);
    const loop = options?.loop === true;

    this.roomVideoActiveKey = key;
    this.roomVideoOnComplete = options?.onComplete ?? null;
    this.roomVideoClickToSkip = options?.clickToSkip === true;

    // Hide HUD GUIs (verbs/menus/dialog) for the cinematic; Speaking/Display Text overlays are not in
    // `genericGuiOverlays`, so they keep working over the video. Restored in `finalizeRoomVideo`.
    this.snapshotAndHideGenericGuisForVideo();
    this.lastCustomCursorVisualKey = null;
    this.refreshCustomCursor(this.input.activePointer);
    this.syncVerbHoverScriptSurface(this.input.activePointer);

    video
      .setVisible(true)
      .setLoop(loop)
      .setVolume(masterVolume * optVolume);
    this.roomVideoBackdrop?.setVisible(true);
    video.load(cacheKey);
    video.play(loop);

    return {
      whenComplete: new Promise<void>((resolve) => {
        this.roomVideoCompleteResolvers.push(resolve);
      }),
    };
  }

  /** Resolves outstanding `playAndWait` waiters, fires `onComplete`, emits the ended event, and hides the layer. */
  private finalizeRoomVideo(emitEvent: boolean): void {
    const key = this.roomVideoActiveKey;
    if (key === null) {
      return;
    }
    const resolvers = this.roomVideoCompleteResolvers;
    const onComplete = this.roomVideoOnComplete;
    this.roomVideoActiveKey = null;
    this.roomVideoOnComplete = null;
    this.roomVideoClickToSkip = false;
    this.roomVideoCompleteResolvers = [];

    this.roomVideo?.setVisible(false);
    this.roomVideoBackdrop?.setVisible(false);
    this.restoreGenericGuisAfterVideo();
    this.lastCustomCursorVisualKey = null;
    this.refreshCustomCursor(this.input.activePointer);
    this.syncVerbHoverScriptSurface(this.input.activePointer);

    for (const resolve of resolvers) {
      resolve();
    }
    onComplete?.();
    if (emitEvent) {
      gameEvents.emit(BENNE_VIDEO_ENDED_EVENT, { key });
    }
  }

  /** Stops the active cinematic video (resolves `playAndWait` waiters); no-op when idle. */
  stopRoomVideo(): void {
    if (this.roomVideoActiveKey === null) {
      return;
    }
    // `stop()` emits VIDEO_STOP → finalizeRoomVideo handles waiters / cleanup.
    this.roomVideo?.stop();
  }

  /** Pauses the active cinematic video (no-op when idle). */
  pauseRoomVideo(): void {
    if (this.roomVideoActiveKey === null) {
      return;
    }
    this.roomVideo?.setPaused(true);
  }

  /** Resumes a paused cinematic video (no-op when idle). */
  resumeRoomVideo(): void {
    if (this.roomVideoActiveKey === null) {
      return;
    }
    this.roomVideo?.setPaused(false);
  }

  /** Seeks the active cinematic video to `seconds` from its start (no-op when idle). */
  seekRoomVideo(seconds: number): void {
    if (this.roomVideoActiveKey === null) {
      return;
    }
    this.roomVideo?.setCurrentTime(Math.max(0, seconds));
  }

  /** True while a cinematic video is loaded and playing/paused. */
  isRoomVideoPlaying(): boolean {
    return this.roomVideoActiveKey !== null;
  }

  /** Stops playback and destroys the video layer game objects (called on transition + shutdown). */
  private teardownRoomVideoLayer(): void {
    // Resolve any waiters without re-emitting (teardown, not a natural end) before destroying objects.
    if (this.roomVideoActiveKey !== null) {
      this.roomVideo?.stop(false);
      this.finalizeRoomVideo(false);
    }
    if (this.roomVideo) {
      this.roomVideo.destroy();
      this.roomVideo = null;
    }
    if (this.roomVideoBackdrop) {
      this.roomVideoBackdrop.destroy();
      this.roomVideoBackdrop = null;
    }
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

    if (this.cutsceneSkipFastForwardActive) {
      rect.setAlpha(a);
      return Promise.resolve();
    }

    return this.runSkippableStep(
      (done) => {
        this.tweens.add({
          targets: rect,
          alpha: a,
          duration: durMs,
          ease: 'Linear',
          onComplete: done,
        });
      },
      (done) => {
        this.tweens.killTweensOf(rect);
        rect.setAlpha(a);
        done();
      },
    );
  }

  /**
   * Shows or hides every non-`speaking-text`, non-choice-dialog GUI overlay registered under `src/game/guis/**`.
   * Does not affect the `speaking-text` overlay or choice-dialog GUIs. During an active dialog session, the room
   * first snapshots per-overlay visibility and hides these; when the dialog ends, that snapshot is restored.
   * Any call while a dialog is open updates both the live visibility and the snapshot entry for each overlay
   * so restore matches the latest explicit state. Room preview ANDs `visible` with each overlay's JSON
   * `GuiData.visible` ({@link genericGuiOverlayJsonVisible}); cutscene callers without the preview registry use a
   * single boolean for every generic overlay.
   */
  setGenericGuisVisible(visible: boolean): void {
    const snap = this.genericGuiVisibilityBeforeDialog;
    const previewOverride = this.game.registry.get(GENERIC_GUIS_INITIAL_VISIBILITY_REGISTRY_KEY);
    const hasPreviewOverride = typeof previewOverride === 'boolean';
    for (let i = 0; i < this.genericGuiOverlays.length; i++) {
      const h = this.genericGuiOverlays[i]!;
      const nextVisible = hasPreviewOverride
        ? visible && (this.genericGuiOverlayJsonVisible[i] ?? false)
        : visible;
      h.setVisible(nextVisible);
      if (snap !== null) {
        snap[i] = nextVisible;
      }
    }
  }

  /**
   * Shows or hides the `speaking-text` GUI line (`controls` text with `id: line` or the first text control).
   * With `talkCharacterDefinitionId`, places the line so its **bottom-center** sits on the resolved speech
   * anchor projected into GUI space (see {@link resolveSpeechOverlayScreenPosition}), including wrapped height.
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
    const speech = getSpeechSettings(resolveGameStateManager(this.game));
    if (!state.visible) {
      h.setPrimaryTextColor(undefined);
      h.resetPrimaryScreenPosition();
      h.setVisible(false);
      return;
    }
    if (state.text !== undefined && speech.showText) {
      h.setPrimaryText(state.text);
    }
    if (!speech.showText) {
      return;
    }
    const id = state.talkCharacterDefinitionId;
    if (id) {
      h.setPrimaryTextColor(this.characterSpeechColorByDefId.get(id));
      const screenPos = this.resolveSpeechOverlayScreenPosition(id, speech);
      if (screenPos) {
        h.setPrimaryScreenPositionBottomCenter(screenPos.x, screenPos.y);
      } else {
        h.resetPrimaryScreenPosition();
      }
    } else {
      h.setPrimaryTextColor(undefined);
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

  private isBusyCursorActive(): boolean {
    return this.isCutsceneActive() || this.isRoomVideoPlaying();
  }

  /**
   * True while a choice dialog is open, a scripted-dialog line, cutscene, or room video is active.
   * Gates props, hotspots, characters, inventory rows, hover descriptions, and background walks.
   * The dialog-session check is separate from {@link scriptedDialogInputSuppressionDepth}: ending a
   * `say` line pops that counter and must not unlock the floor while options are still hidden.
   * GUI buttons are additionally gated only when {@link isCutsceneActive} or video playback is true
   * (they remain live during say-line suppression and while a choice list is on screen).
   */
  private isInputSuppressed(): boolean {
    return (
      this.scriptedDialogInputSuppressionDepth > 0 ||
      this.activeDialogChoiceSession != null ||
      getActiveDialogBenneScript() != null ||
      this.isCutsceneActive() ||
      this.isRoomVideoPlaying()
    );
  }

  /** True while `B.disableUserInput` is set. Survives room changes; not part of save snapshots. */
  private isUserInputDisabled(): boolean {
    return this.game.registry.get(BENNE_USER_INPUT_DISABLED_REGISTRY_KEY) === true;
  }

  /**
   * World clicks, inventory rows, and hover. Separate from {@link isInputSuppressed} so NPC follow
   * (`pauseDuringCutscene`) keeps moving while the player is locked out.
   */
  private isPlayerPointerBlocked(): boolean {
    return this.isInputSuppressed() || this.isUserInputDisabled();
  }

  /**
   * Applies `B.disableUserInput`. Writes the game registry (so the next room stays locked) and
   * refreshes the cursor and hover line immediately.
   */
  setUserInputDisabled(disabled: boolean): void {
    this.game.registry.set(BENNE_USER_INPUT_DISABLED_REGISTRY_KEY, disabled);
    this.lastCustomCursorVisualKey = null;
    this.applyUserInputCursorLock();
    this.refreshCustomCursor(this.input.activePointer);
    this.syncVerbHoverScriptSurface(this.input.activePointer);
  }

  /** Hide the OS cursor while input is locked, including hand cursors on clickable objects. */
  private applyUserInputCursorLock(): void {
    const canvas = this.game.canvas;
    if (!canvas) {
      return;
    }
    if (this.isUserInputDisabled()) {
      canvas.style.setProperty('cursor', 'none', 'important');
      return;
    }
    canvas.style.removeProperty('cursor');
    if (this.customCursorSprite) {
      this.input.setDefaultCursor('none');
    } else {
      this.input.setDefaultCursor('default');
    }
  }

  /**
   * Push a cutscene onto the stack. While the stack is non-empty, all input is suppressed and the
   * custom cursor switches to the busy animation (or hidden). Called automatically by
   * {@link BenneScriptCore} `B.cutscene`, enter-room hooks, and `whenChoice` handlers.
   *
   * @param options `skippable: false` opts this cutscene out of ESC skipping even when
   * `game-config.json` `cutscenesSkippable` is true. Defaults to skippable.
   */
  pushCutscene(options?: CutsceneOptions): void {
    this.cutsceneStack.push({ skippable: options?.skippable !== false });
    this.lastCustomCursorVisualKey = null;
    this.refreshCustomCursor(this.input.activePointer);
    this.syncVerbHoverScriptSurface(this.input.activePointer);
  }

  /** Pop the innermost cutscene. When the stack empties, normal input (and skip state) resumes. */
  popCutscene(): void {
    this.cutsceneStack.pop();
    if (this.cutsceneStack.length === 0) {
      this.cutsceneSkipFastForwardActive = false;
    }
    this.lastCustomCursorVisualKey = null;
    this.refreshCustomCursor(this.input.activePointer);
    this.syncVerbHoverScriptSurface(this.input.activePointer);
  }

  /** True while a cutscene is in progress. */
  isCutsceneActive(): boolean {
    return this.cutsceneStack.length > 0;
  }

  /**
   * True when ESC should skip the active cutscene: a cutscene is running, `game-config.json`
   * `cutscenesSkippable` is not false, every entry on the stack is skippable, and a skip is not
   * already in flight.
   */
  canSkipActiveCutscene(): boolean {
    if (this.cutsceneStack.length === 0 || this.cutsceneSkipFastForwardActive) {
      return false;
    }
    if (!getCutscenesSkippable()) {
      return false;
    }
    return this.cutsceneStack.every((entry) => entry.skippable);
  }

  /**
   * True while a skip is fast-forwarding the cutscene. Timed engine primitives (waits, say lines,
   * walks, fades, camera transitions, sound, video) check this and complete instantly at their
   * final value instead of animating, so the skipped cutscene produces the same state it would
   * have produced had it played normally.
   */
  isCutsceneSkipFastForwarding(): boolean {
    return this.cutsceneSkipFastForwardActive;
  }

  /**
   * Registers `finish` to run if the player skips the cutscene while this step is in flight.
   * `finish` must leave the step in the state it would have reached had it played out, then
   * resolve the step's promise. Returns the unregister function — call it when the step ends
   * normally.
   */
  registerCutsceneSkipFinisher(finish: () => void): () => void {
    this.cutsceneSkipFinishers.add(finish);
    return () => {
      this.cutsceneSkipFinishers.delete(finish);
    };
  }

  /**
   * Runs a blocking step that an ESC skip can cut short. `start` receives a `done` callback that
   * settles the step; `finishNow` runs instead when the player skips mid-step and must apply the
   * step's end state before calling `done`. Whichever fires first wins.
   */
  private runSkippableStep(
    start: (done: () => void) => void,
    finishNow: (done: () => void) => void,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      let settled = false;
      let unregister: (() => void) | null = null;
      const done = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        unregister?.();
        unregister = null;
        resolve();
      };
      unregister = this.registerCutsceneSkipFinisher(() => {
        unregister = null;
        if (!settled) {
          finishNow(done);
        }
      });
      start(done);
    });
  }

  /**
   * Fast-forwards the active cutscene to its end state (ESC). The step that is currently running
   * is finished at its final value here; every step still queued behind it runs instantly because
   * the timed primitives check {@link isCutsceneSkipFastForwarding}. No step is dropped, so the
   * flags, inventory, positions, and room the cutscene would have produced all still happen.
   */
  requestCutsceneSkip(): void {
    if (!this.canSkipActiveCutscene()) {
      return;
    }
    this.cutsceneSkipFastForwardActive = true;

    this.fastForwardPlayerWalkForSkip();

    const pending = [...this.cutsceneSkipFinishers];
    this.cutsceneSkipFinishers.clear();
    for (const finish of pending) {
      try {
        finish();
      } catch (e) {
        console.error('[Benne] cutscene skip: step finisher failed:', e);
      }
    }

    this.stopRoomVideo();

    this.lastCustomCursorVisualKey = null;
    this.refreshCustomCursor(this.input.activePointer);
  }

  /**
   * Teleports the player to the end of the active walk path and resolves the walk promise as if
   * they had walked the whole way (facing taken from the final leg), so a skipped cutscene leaves
   * the player exactly where the walk would have put them.
   */
  private fastForwardPlayerWalkForSkip(): void {
    const sprite = this.player;
    const path = this.currentPlayerPath;
    if (!sprite || !path || path.length === 0) {
      return;
    }
    const final = path[path.length - 1]!;
    const prev = path.length >= 2 ? path[path.length - 2]! : getCharacterWorldFeet(sprite);
    const facing = facingFromWorldDelta(final.x - prev.x, final.y - prev.y);
    // Clearing the field first makes the running leg tween's onUpdate / onStop guards bail out,
    // so only finishPlayerWalk below resolves the walk.
    const tween = this.playerMoveTween;
    this.playerMoveTween = null;
    tween?.stop();
    this.applyFeetWorldWithRegionScale(sprite, this.getSpriteFeetLocal(sprite), final.x, final.y);
    this.finishPlayerWalk(sprite, facing);
  }

  /**
   * Same as {@link fastForwardPlayerWalkForSkip} for a non-player character walk; `arrive` is the
   * walk's own completion callback (also unregisters the skip finisher).
   */
  private fastForwardNpcWalkForSkip(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    path: readonly Point2[],
    arrive: () => void,
  ): void {
    if (path.length === 0) {
      arrive();
      return;
    }
    const final = path[path.length - 1]!;
    const prev =
      path.length >= 2 ? path[path.length - 2]! : getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
    const facing = facingFromWorldDelta(final.x - prev.x, final.y - prev.y);
    // Dropping the map entry first makes the running leg tween's onStop guard bail out.
    const tween = this.npcWalkTweens.get(sprite);
    this.npcWalkTweens.delete(sprite);
    tween?.stop();
    this.applyFeetWorldWithRegionScale(sprite, this.getSpriteFeetLocal(sprite), final.x, final.y);
    if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
      if (!getCharacterAnimationOverrideTag(sprite)) {
        playDirectionalAnimation(sprite as DirectionalCharacterSprite, 'Idle', facing);
      } else {
        sprite.setData('facing', facing);
        applyCharacterEffectiveAnimation(sprite);
      }
    }
    arrive();
  }

  private makeGuiOverlayBuildOptions(
    depth: number,
    rest: Omit<BuildGuiOverlayOptions, 'depth' | 'isBehindVisibleModal'>,
  ): BuildGuiOverlayOptions {
    return {
      ...rest,
      depth,
      isBehindVisibleModal: () => isGuiDepthBehindVisibleModal(depth, this.modalGuiEntries),
    };
  }

  /**
   * Tracks overlay visibility for {@link GuiData.modal} GUIs so {@link isGuiDepthBehindVisibleModal} stays accurate.
   */
  private registerModalGuiOverlay(
    gui: GuiData,
    depth: number,
    handle: GuiOverlayHandle,
    startVisible: boolean,
  ): void {
    if (gui.modal !== true) {
      return;
    }
    let overlayVisible = startVisible;
    const originalSetVisible = handle.setVisible.bind(handle);
    handle.setVisible = (visible: boolean) => {
      overlayVisible = visible;
      originalSetVisible(visible);
    };
    this.modalGuiEntries.push({ depth, isVisible: () => overlayVisible });
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

  /** True while a left click would be consumed by click-to-skip (a speech line, Display Text, or a scripted hook). */
  hasScriptedDialogClickToSkip(): boolean {
    return this.scriptedDialogClickToSkip != null;
  }

  /**
   * Read-only view for dev/test hooks (`src/engine/testing`): the game object that receives
   * pointer input for a click target id, resolved like scripts do (props → hotspots → characters).
   */
  getClickTargetObjectForTesting(
    targetId: string,
  ): { type: 'prop' | 'hotspot' | 'character'; object: Phaser.GameObjects.GameObject } | null {
    const prop = this.propSpritesById.get(targetId);
    if (prop) {
      return { type: 'prop', object: prop };
    }
    for (const e of this.roomStackEntities) {
      if (e.kind === 'hotspot' && e.zone.getData('benneHotspotId') === targetId) {
        return { type: 'hotspot', object: e.zone };
      }
    }
    const character = this.characterSpritesByDefId.get(targetId);
    return character ? { type: 'character', object: character } : null;
  }

  /** Read-only view for dev/test hooks: what is currently holding up player input. */
  getInputStateForTesting(): {
    roomId: string;
    pointerBlocked: boolean;
    cutscene: boolean;
    dialogChoice: { dialogId: string; guiId: string } | null;
    modalGuiVisible: boolean;
    playerWalking: boolean;
  } {
    return {
      roomId: this.roomData.id,
      pointerBlocked: this.isPlayerPointerBlocked(),
      cutscene: this.isCutsceneActive(),
      dialogChoice: this.activeDialogChoiceSession
        ? { dialogId: this.activeDialogChoiceSession.dialogId, guiId: this.activeDialogChoiceSession.guiId }
        : null,
      modalGuiVisible: hasAnyVisibleModal(this.modalGuiEntries),
      playerWalking: this.playerMoveTween != null,
    };
  }

  /** Read-only view for dev/test hooks: authored room data (points, regions). */
  getRoomDataForTesting(): RoomData {
    return this.roomData;
  }

  private tryConsumeRoomVideoClickToSkip(pointer: Phaser.Input.Pointer): boolean {
    if (!this.roomVideoClickToSkip || !this.isRoomVideoPlaying()) {
      return false;
    }
    if (!pointer.leftButtonDown()) {
      return false;
    }
    this.stopRoomVideo();
    return true;
  }

  private tryConsumeRoomVideoOrScriptedDialogClickToSkip(pointer: Phaser.Input.Pointer): boolean {
    return this.tryConsumeRoomVideoClickToSkip(pointer) || this.tryConsumeScriptedDialogClickToSkip(pointer);
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

  /**
   * Resolves canvas-pixel bottom-center for the speaking-text GUI for one speaker id.
   * Precedence: saved absolute world position → default talk anchor + global/defaultTalkOffset + saved offset.
   */
  private resolveSpeechOverlayScreenPosition(
    definitionId: string,
    speech: ReturnType<typeof getSpeechSettings>,
  ): Point2 | null {
    const manager = resolveGameStateManager(this.game);
    const abs = readSavedCharacterSpeechPosition(manager, definitionId);
    if (abs) {
      return this.worldPointToDialogOverlayScreen(abs.x, abs.y);
    }
    const anchor = this.getTalkAnchorWorldForCharacterDefinition(definitionId);
    if (!anchor) {
      return null;
    }
    const p = this.worldPointToDialogOverlayScreen(anchor.x, anchor.y);
    const off = readSavedCharacterSpeechOffset(manager, definitionId);
    return {
      x: p.x + speech.defaultTalkOffset.x + (off?.x ?? 0),
      y: p.y + speech.defaultTalkOffset.y + (off?.y ?? 0),
    };
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

  /** Sprite for a specific room spawn row (`RoomCharacterInstance.instanceId`). */
  getCharacterSpriteByInstanceId(
    instanceId: string,
  ): Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | undefined {
    for (const e of this.roomStackEntities) {
      if (e.kind === 'character' && e.sprite.getData('instanceId') === instanceId) {
        return e.sprite;
      }
    }
    return undefined;
  }

  /**
   * Editor/preview: place a spawned character's **feet** at room-space `(x, y)` and re-apply region scale.
   */
  placeCharacterFeetNow(instanceId: string, worldFeetX: number, worldFeetY: number): void {
    const sprite = this.getCharacterSpriteByInstanceId(instanceId);
    if (!sprite) {
      return;
    }
    const data = sprite.getData('character') as CharacterData | undefined;
    const feetLocal = data
      ? resolveCharacterFeetLocal(data, sprite as Phaser.GameObjects.Sprite)
      : { x: sprite.frame.width * 0.5, y: sprite.frame.height };
    this.applyFeetWorldWithRegionScale(sprite, feetLocal, worldFeetX, worldFeetY);
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
    let restored = false;
    const restoreBaseOnce = (): void => {
      if (restored) {
        return;
      }
      restored = true;
      const baseAuthor = this.getPropScriptBaseAnimationTag(propId);
      const baseKey = roomPropPhaserAnimationKey(this.roomData.id, baseAuthor);
      if (this.anims.exists(baseKey)) {
        sprite.play(baseKey);
      }
    };
    // Skipping lands on the clip's end state: the base animation, without playing the one-shot.
    if (this.cutsceneSkipFastForwardActive) {
      restoreBaseOnce();
      return Promise.resolve();
    }
    sprite.play(phaserKey);
    return this.runSkippableStep(
      (done) => {
        void promiseWhenSpriteAnimationFinishes(sprite, phaserKey).then(() => {
          restoreBaseOnce();
          done();
        });
      },
      (done) => {
        restoreBaseOnce();
        done();
      },
    );
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

  /** Effective `B.inventory(id).description` — saved override (including empty) wins, else JSON. */
  getInventoryScriptDescription(itemId: string): string {
    const def = getInventoryDefinition(itemId);
    if (!def) {
      return '';
    }
    return readEffectiveInventoryDescription(resolveGameStateManager(this.game), def);
  }

  /**
   * Persist `B.inventory(id).description`. Survives room reloads and save/load. Unknown ids no-op
   * (DEV warns). Refreshes the verb hover line so the new text shows without a pointer move.
   */
  setInventoryScriptDescription(itemId: string, value: string): void {
    const def = getInventoryDefinition(itemId);
    if (!def) {
      if (import.meta.env.DEV) {
        console.warn(`[Benne] setInventoryScriptDescription: unknown inventory id "${itemId}".`);
      }
      return;
    }
    writeSavedInventoryDescription(resolveGameStateManager(this.game), itemId, value);
    this.syncVerbHoverScriptSurfaceAtActivePointer();
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
    let restored = false;
    const restoreEffectiveOnce = (): void => {
      if (restored) {
        return;
      }
      restored = true;
      applyCharacterEffectiveAnimation(sprite);
    };
    // Skipping lands on the clip's end state without playing the one-shot.
    if (this.cutsceneSkipFastForwardActive) {
      restoreEffectiveOnce();
      return Promise.resolve();
    }
    playCharacterAnimation(sprite, tag);
    return this.runSkippableStep(
      (done) => {
        void promiseWhenSpriteAnimationFinishes(sprite, tag).then(() => {
          restoreEffectiveOnce();
          done();
        });
      },
      (done) => {
        restoreEffectiveOnce();
        done();
      },
    );
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

  /**
   * Bennescript **`B.character(observer).startFacingCharacter(target, …)`** — keeps the observer’s
   * **Idle** facing toward the target’s feet; when either character’s feet move, a new random delay
   * in **[minWaitSeconds, maxWaitSeconds]** runs before the next turn (defaults **0.2** / **0.4**).
   */
  startCharacterFacingCharacter(
    observerDefinitionId: string,
    targetDefinitionId: string,
    minWaitSeconds = 0.2,
    maxWaitSeconds = 0.4,
  ): void {
    if (observerDefinitionId === targetDefinitionId) {
      return;
    }
    let minSec = Math.max(0, minWaitSeconds);
    let maxSec = Math.max(0, maxWaitSeconds);
    if (minSec > maxSec) {
      const swap = minSec;
      minSec = maxSec;
      maxSec = swap;
    }
    this.stopCharacterFacingCharacter(observerDefinitionId);
    const obsSprite = this.characterSpritesByDefId.get(observerDefinitionId);
    const tgtSprite = this.characterSpritesByDefId.get(targetDefinitionId);
    if (!(obsSprite instanceof Phaser.GameObjects.Sprite) || !(tgtSprite instanceof Phaser.GameObjects.Sprite)) {
      return;
    }
    const oFeet = getCharacterWorldFeet(obsSprite);
    const tFeet = getCharacterWorldFeet(tgtSprite);
    this.characterFaceTowardCharacterLocks.set(observerDefinitionId, {
      targetDefId: targetDefinitionId,
      minWaitSec: minSec,
      maxWaitSec: maxSec,
      refObsFeet: { x: oFeet.x, y: oFeet.y },
      refTgtFeet: { x: tFeet.x, y: tFeet.y },
      pendingTimer: null,
      scheduleGen: 0,
    });
    this.armCharacterFaceTowardDelayedTurn(observerDefinitionId);
  }

  /** Bennescript **`B.character(observer).stopFacingCharacter()`**. */
  stopCharacterFacingCharacter(observerDefinitionId: string): void {
    const entry = this.characterFaceTowardCharacterLocks.get(observerDefinitionId);
    if (entry) {
      entry.pendingTimer?.remove(false);
      entry.pendingTimer = null;
    }
    this.characterFaceTowardCharacterLocks.delete(observerDefinitionId);
  }

  private clearCharacterFaceTowardCharacterLocks(): void {
    for (const entry of this.characterFaceTowardCharacterLocks.values()) {
      entry.pendingTimer?.remove(false);
      entry.pendingTimer = null;
    }
    this.characterFaceTowardCharacterLocks.clear();
  }

  private randomFaceTowardDelayMs(entry: { minWaitSec: number; maxWaitSec: number }): number {
    const span = entry.maxWaitSec - entry.minWaitSec;
    const seconds = entry.minWaitSec + Math.random() * span;
    return Math.max(0, seconds) * 1000;
  }

  private armCharacterFaceTowardDelayedTurn(observerDefinitionId: string): void {
    const entry = this.characterFaceTowardCharacterLocks.get(observerDefinitionId);
    if (!entry) {
      return;
    }
    entry.pendingTimer?.remove(false);
    entry.scheduleGen += 1;
    const expectedGen = entry.scheduleGen;
    const delayMs = this.randomFaceTowardDelayMs(entry);
    entry.pendingTimer = this.time.delayedCall(delayMs, () => {
      entry.pendingTimer = null;
      const still = this.characterFaceTowardCharacterLocks.get(observerDefinitionId);
      if (still !== entry || still.scheduleGen !== expectedGen) {
        return;
      }
      const obsSprite = this.characterSpritesByDefId.get(observerDefinitionId);
      const tgtSprite = this.characterSpritesByDefId.get(still.targetDefId);
      if (!(obsSprite instanceof Phaser.GameObjects.Sprite) || !(tgtSprite instanceof Phaser.GameObjects.Sprite)) {
        this.characterFaceTowardCharacterLocks.delete(observerDefinitionId);
        return;
      }
      const tgtFeet = getCharacterWorldFeet(tgtSprite);
      this.applyCharacterSpriteFaceTowardWorldFeet(obsSprite, tgtFeet);
      const oAfter = getCharacterWorldFeet(obsSprite);
      still.refObsFeet.x = oAfter.x;
      still.refObsFeet.y = oAfter.y;
      still.refTgtFeet.x = tgtFeet.x;
      still.refTgtFeet.y = tgtFeet.y;
    });
  }

  private applyCharacterSpriteFaceTowardWorldFeet(
    observer: Phaser.GameObjects.Sprite,
    targetFeet: Point2,
  ): void {
    const feet = getCharacterWorldFeet(observer);
    const dx = targetFeet.x - feet.x;
    const dy = targetFeet.y - feet.y;
    if (Math.hypot(dx, dy) < 1e-2) {
      return;
    }
    const facing = facingFromWorldDelta(dx, dy);
    if (getCharacterAnimationOverrideTag(observer)) {
      observer.setData('facing', facing);
      return;
    }
    playDirectionalAnimation(observer, 'Idle', facing);
  }

  private updateCharacterFaceTowardCharacterLocks(): void {
    if (this.characterFaceTowardCharacterLocks.size === 0) {
      return;
    }
    const eps = RoomScene.CHARACTER_FACE_TOWARD_MOVE_EPS;
    for (const [observerId, entry] of [...this.characterFaceTowardCharacterLocks]) {
      const obsSprite = this.characterSpritesByDefId.get(observerId);
      const tgtSprite = this.characterSpritesByDefId.get(entry.targetDefId);
      if (!(obsSprite instanceof Phaser.GameObjects.Sprite) || !(tgtSprite instanceof Phaser.GameObjects.Sprite)) {
        this.stopCharacterFacingCharacter(observerId);
        continue;
      }
      const oFeet = getCharacterWorldFeet(obsSprite);
      const tFeet = getCharacterWorldFeet(tgtSprite);
      const obsMoved =
        Math.hypot(oFeet.x - entry.refObsFeet.x, oFeet.y - entry.refObsFeet.y) > eps;
      const tgtMoved =
        Math.hypot(tFeet.x - entry.refTgtFeet.x, tFeet.y - entry.refTgtFeet.y) > eps;
      if (obsMoved || tgtMoved) {
        entry.refObsFeet.x = oFeet.x;
        entry.refObsFeet.y = oFeet.y;
        entry.refTgtFeet.x = tFeet.x;
        entry.refTgtFeet.y = tFeet.y;
        this.armCharacterFaceTowardDelayedTurn(observerId);
      }
    }
  }

  /**
   * Enables follow walks after `whenEnterRoom` / `whenEnterAnyRoom` (and queued steps) have run.
   * Called from {@link RoomTransitionOrchestrator.onRoomSceneCreateComplete} before room fade-in.
   */
  setCharacterFollowBehaviorEnabled(enabled: boolean): void {
    this.characterFollowBehaviorEnabled = enabled;
  }

  private clearBenneFollowWalkSpriteData(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  ): void {
    sprite.setData(BENNE_FOLLOW_SPEED_MULT_KEY, undefined);
    sprite.setData(BENNE_FOLLOW_WALK_PURPOSE_KEY, undefined);
  }

  /** Bennescript `B.character(id).startFollowingCharacter` / `B.player.startFollowingCharacter`. */
  startCharacterFollowingCharacter(
    followerDefinitionId: string,
    targetIdRaw: string,
    options?: CharacterFollowOptions | null,
  ): void {
    const manager = resolveGameStateManager(this.game);
    if (!applyPersistedCharacterFollowFromScript(manager, followerDefinitionId, targetIdRaw, options)) {
      return;
    }
    this.characterFollowLastGoalByFollowerId.delete(followerDefinitionId);
    this.characterFollowPrevLeaderWalkingByFollowerId.delete(followerDefinitionId);
    this.characterFollowPrevDistToLeaderByFollowerId.delete(followerDefinitionId);
  }

  /** Bennescript `B.character(id).stopFollowingCharacter` / `B.player.stopFollowingCharacter`. */
  stopCharacterFollowingCharacter(followerDefinitionId: string): void {
    const manager = resolveGameStateManager(this.game);
    clearSavedCharacterFollowState(manager, followerDefinitionId);
    this.characterFollowLastGoalByFollowerId.delete(followerDefinitionId);
    this.characterFollowPrevLeaderWalkingByFollowerId.delete(followerDefinitionId);
    this.characterFollowPrevDistToLeaderByFollowerId.delete(followerDefinitionId);
    this.interruptFollowWalkIfPurposeMatches(followerDefinitionId, 'follow');
  }

  /** Stops the current NPC or player walk only when it was issued by the follow driver. */
  private interruptFollowWalkIfPurposeMatches(followerDefinitionId: string, purpose: string): void {
    if (followerDefinitionId === this.getActivePlayerCharacterId()) {
      const pl = this.player;
      if (!pl || this.playerMoveTween == null) {
        return;
      }
      if (pl.getData(BENNE_FOLLOW_WALK_PURPOSE_KEY) !== purpose) {
        return;
      }
      this.clearBenneFollowWalkSpriteData(pl);
      this.stopPlayerMoveTween(true);
      return;
    }
    const sprite = this.characterSpritesByDefId.get(followerDefinitionId);
    if (!sprite) {
      return;
    }
    if (sprite.getData(BENNE_FOLLOW_WALK_PURPOSE_KEY) !== purpose) {
      return;
    }
    this.clearBenneFollowWalkSpriteData(sprite);
    const tw = this.npcWalkTweens.get(sprite);
    if (tw) {
      tw.stop();
      this.npcWalkTweens.delete(sprite);
    }
  }

  /**
   * Walkable-clamped feet position as far as practical from **`leaderFeet`** near a ring of radius
   * **`clearancePx`**: tries several directions from the leader (follower-ward, then octants) so a
   * tight mesh clamp does not leave the follower stacked on the leader.
   */
  private resolveFollowStopFeetClearOfLeader(
    followerFeet: Point2,
    leaderFeet: Point2,
    leaderFacing: CharacterFacing,
    clearancePx: number,
    polys: readonly WalkablePolygon[],
  ): Point2 {
    const base =
      Math.hypot(followerFeet.x - leaderFeet.x, followerFeet.y - leaderFeet.y) < 3
        ? Math.atan2(
            -CHARACTER_FACING_UNIT[leaderFacing][1],
            -CHARACTER_FACING_UNIT[leaderFacing][0],
          )
        : Math.atan2(followerFeet.y - leaderFeet.y, followerFeet.x - leaderFeet.x);
    let best: Point2 | null = null;
    let bestD = -1;
    for (let i = 0; i < 8; i++) {
      const a = base + (i * Math.PI) / 4;
      const gx = leaderFeet.x + Math.cos(a) * clearancePx;
      const gy = leaderFeet.y + Math.sin(a) * clearancePx;
      const c =
        clampWalkDestinationTowardClick(followerFeet.x, followerFeet.y, gx, gy, polys) ??
        ({ x: gx, y: gy } satisfies Point2);
      const d = Math.hypot(c.x - leaderFeet.x, c.y - leaderFeet.y);
      if (d > bestD) {
        bestD = d;
        best = c;
      }
    }
    return best ?? followerFeet;
  }

  /**
   * Ends an in-progress follow tween by snapping feet to **`dest`** (already walkable-clamped).
   * Used after leader-stop interrupt when nudging the follower off the leader’s feet.
   */
  private finishFollowWalkSnapFeetToDest(
    followerId: string,
    followerSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    dest: Point2,
    isPlayerFollower: boolean,
  ): void {
    this.clearBenneFollowWalkSpriteData(followerSprite);
    if (isPlayerFollower && this.player) {
      this.movePlayerToNow(dest);
      this.characterFollowLastGoalByFollowerId.set(followerId, { x: dest.x, y: dest.y });
      return;
    }
    if (followerSprite instanceof Phaser.GameObjects.Sprite) {
      this.moveCharacterToNow(followerId, dest);
      this.characterFollowLastGoalByFollowerId.set(followerId, { x: dest.x, y: dest.y });
      return;
    }
    const tw = this.npcWalkTweens.get(followerSprite);
    if (tw) {
      tw.stop();
      this.npcWalkTweens.delete(followerSprite);
    }
    const feetNow = getCharacterWorldFeet(followerSprite as Phaser.GameObjects.Sprite);
    const polys = withNonWalkableRegionsAsHoles(this.roomData.walkable.polygons, this.roomData.regions);
    const clamped = clampWalkDestinationTowardClick(feetNow.x, feetNow.y, dest.x, dest.y, polys);
    const feetWorld = clamped ?? dest;
    const feetLocal = this.getSpriteFeetLocal(followerSprite as Phaser.GameObjects.Sprite);
    this.applyFeetWorldWithRegionScale(followerSprite, feetLocal, feetWorld.x, feetWorld.y);
    this.characterFollowLastGoalByFollowerId.set(followerId, { x: feetWorld.x, y: feetWorld.y });
  }

  private updateCharacterFollowers(): void {
    if (!this.characterFollowBehaviorEnabled) {
      return;
    }
    const manager = resolveGameStateManager(this.game);
    const polys = withNonWalkableRegionsAsHoles(this.roomData.walkable.polygons, this.roomData.regions);
    const playerId = this.getActivePlayerCharacterId();

    for (const followerId of this.characterSpritesByDefId.keys()) {
      const targetRaw = readSavedCharacterFollowingTarget(manager, followerId);
      if (!targetRaw) {
        this.characterFollowPrevLeaderWalkingByFollowerId.delete(followerId);
        this.characterFollowPrevDistToLeaderByFollowerId.delete(followerId);
        continue;
      }
      const targetDef = targetRaw === 'player' ? playerId : targetRaw;
      if (targetDef === followerId) {
        this.characterFollowPrevLeaderWalkingByFollowerId.delete(followerId);
        this.characterFollowPrevDistToLeaderByFollowerId.delete(followerId);
        continue;
      }
      const followerSprite = this.characterSpritesByDefId.get(followerId);
      const targetSprite = this.characterSpritesByDefId.get(targetDef);
      if (!followerSprite || !targetSprite) {
        this.characterFollowPrevLeaderWalkingByFollowerId.delete(followerId);
        this.characterFollowPrevDistToLeaderByFollowerId.delete(followerId);
        continue;
      }
      if (!this.getCharacterScriptMovable(followerId)) {
        this.characterFollowPrevLeaderWalkingByFollowerId.delete(followerId);
        this.characterFollowPrevDistToLeaderByFollowerId.delete(followerId);
        continue;
      }

      const followerFeet = getCharacterWorldFeet(followerSprite as Phaser.GameObjects.Sprite);
      const targetFeet = getCharacterWorldFeet(targetSprite as Phaser.GameObjects.Sprite);
      const distToTarget = Math.hypot(followerFeet.x - targetFeet.x, followerFeet.y - targetFeet.y);

      const opts = readSavedCharacterFollowEffectiveOptions(manager, followerId);
      const targetWalking =
        targetDef === playerId
          ? this.playerMoveTween != null
          : this.npcWalkTweens.has(targetSprite);
      if (opts.pauseDuringCutscene && this.isInputSuppressed()) {
        this.characterFollowPrevLeaderWalkingByFollowerId.set(followerId, targetWalking);
        this.characterFollowPrevDistToLeaderByFollowerId.set(followerId, distToTarget);
        continue;
      }

      const isPlayerFollower = followerId === playerId;
      const walking = isPlayerFollower
        ? this.playerMoveTween != null
        : this.npcWalkTweens.has(followerSprite);

      const tgtFacing =
        (targetSprite.getData('facing') as CharacterFacing | undefined) ??
        (targetSprite instanceof Phaser.GameObjects.Sprite
          ? resolveInitialIdleFacing(targetSprite as Phaser.GameObjects.Sprite)
          : 'D');
      const wOff = offsetWorldByCharacterFacing(tgtFacing, opts.offset);
      const goalX = targetFeet.x + wOff.x;
      const goalY = targetFeet.y + wOff.y;

      const clamped = clampWalkDestinationTowardClick(
        followerFeet.x,
        followerFeet.y,
        goalX,
        goalY,
        polys,
      );
      const dest = clamped ?? { x: goalX, y: goalY };
      const dGoal = Math.hypot(dest.x - followerFeet.x, dest.y - followerFeet.y);

      const followPurpose = followerSprite.getData(BENNE_FOLLOW_WALK_PURPOSE_KEY) === 'follow';
      const prevDistToLeader = this.characterFollowPrevDistToLeaderByFollowerId.get(followerId);
      const leaderApproaching =
        prevDistToLeader !== undefined &&
        distToTarget < prevDistToLeader - FOLLOW_LEADER_APPROACH_EPS_PX;

      // Leader is closing the gap — stop chasing a stale stand goal (no retreat shuffle).
      if (walking && followPurpose && leaderApproaching) {
        this.interruptFollowWalkIfPurposeMatches(followerId, 'follow');
        this.characterFollowLastGoalByFollowerId.delete(followerId);
        this.characterFollowPrevLeaderWalkingByFollowerId.set(followerId, targetWalking);
        this.characterFollowPrevDistToLeaderByFollowerId.set(followerId, distToTarget);
        continue;
      }

      const prevLeaderWalking =
        this.characterFollowPrevLeaderWalkingByFollowerId.get(followerId) ?? false;
      const leaderJustStopped = prevLeaderWalking && !targetWalking;

      // Leader stopped walking: interrupt any active follow leg, then nudge if feet are still too
      // close (must not require followPurpose — tween `.finally` clears purpose before we run).
      if (leaderJustStopped) {
        if (walking && followPurpose) {
          this.interruptFollowWalkIfPurposeMatches(followerId, 'follow');
          this.characterFollowLastGoalByFollowerId.delete(followerId);
        }
        const feetAfterStop = getCharacterWorldFeet(
          followerSprite as Phaser.GameObjects.Sprite,
        );
        const distAfter = Math.hypot(
          feetAfterStop.x - targetFeet.x,
          feetAfterStop.y - targetFeet.y,
        );
        const clearancePx = Math.max(FOLLOW_STOP_MIN_LEADER_CLEARANCE_PX, opts.minDistance);
        if (distAfter < clearancePx - FOLLOW_STOP_TOOCLOSE_SLACK_PX) {
          const safe = this.resolveFollowStopFeetClearOfLeader(
            feetAfterStop,
            targetFeet,
            tgtFacing,
            clearancePx,
            polys,
          );
          this.finishFollowWalkSnapFeetToDest(
            followerId,
            followerSprite,
            safe,
            isPlayerFollower,
          );
        }
        const feetPrev = getCharacterWorldFeet(followerSprite as Phaser.GameObjects.Sprite);
        const distPrev = Math.hypot(feetPrev.x - targetFeet.x, feetPrev.y - targetFeet.y);
        this.characterFollowPrevLeaderWalkingByFollowerId.set(followerId, targetWalking);
        this.characterFollowPrevDistToLeaderByFollowerId.set(followerId, distPrev);
        continue;
      }

      // Idle leader: stay put when already close or when stand goal has not drifted past repathThreshold.
      const leaderIdleComfort =
        !targetWalking &&
        (distToTarget <= opts.minDistance ||
          (distToTarget > opts.minDistance && dGoal <= opts.repathThreshold));

      const needsWalk =
        !walking &&
        !leaderIdleComfort &&
        !leaderApproaching &&
        distToTarget > opts.minDistance &&
        dGoal > opts.repathThreshold &&
        dGoal > MIN_WALK_DISTANCE_PX;
      if (needsWalk) {
        const last = this.characterFollowLastGoalByFollowerId.get(followerId);
        const goalMovedMuch = !last || Math.hypot(last.x - dest.x, last.y - dest.y) > 8;
        if (goalMovedMuch) {
          followerSprite.setData(BENNE_FOLLOW_SPEED_MULT_KEY, opts.speedMultiplier);
          followerSprite.setData(BENNE_FOLLOW_WALK_PURPOSE_KEY, 'follow');
          const clear = (): void => this.clearBenneFollowWalkSpriteData(followerSprite);
          if (isPlayerFollower && followerSprite === this.player) {
            void this.walkPlayerToWorldPoint(dest.x, dest.y).finally(clear);
          } else {
            void this.walkCharacterToWorldPoint(followerSprite, dest.x, dest.y).finally(clear);
          }
          this.characterFollowLastGoalByFollowerId.set(followerId, { x: dest.x, y: dest.y });
        }
      } else if (
        !walking &&
        opts.faceTargetWhenIdle &&
        !this.characterFaceTowardCharacterLocks.has(followerId) &&
        followerSprite instanceof Phaser.GameObjects.Sprite &&
        followerSprite.anims
      ) {
        this.applyCharacterSpriteFaceTowardWorldFeet(followerSprite, targetFeet);
      }

      this.characterFollowPrevLeaderWalkingByFollowerId.set(followerId, targetWalking);
      this.characterFollowPrevDistToLeaderByFollowerId.set(followerId, distToTarget);
    }
  }

  /**
   * Effective `B.prop(id).description` — saved override (including empty) wins, else room JSON.
   */
  getPropScriptDescription(propId: string): string {
    const jsonDefault = this.getRoomPropInstance(propId)?.description ?? '';
    return readSavedPropDescription(
      resolveGameStateManager(this.game),
      this.roomData.id,
      propId,
      jsonDefault,
    );
  }

  /**
   * Persist `B.prop(id).description`. Survives room reloads and save/load. Refreshes the verb hover
   * line so the new text shows without requiring a pointer move.
   */
  setPropScriptDescription(propId: string, value: string): void {
    writeSavedPropDescription(resolveGameStateManager(this.game), this.roomData.id, propId, value);
    this.syncVerbHoverScriptSurfaceAtActivePointer();
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
   * Effective clickability for prop pointer hit-test (hover, verbs, inventory-on-target). Saved script
   * override wins, else JSON {@link RoomPropInstance.clickable} (`true` only when the field is
   * explicitly `true`). Unknown ids fall back to **`false`**.
   */
  getPropScriptClickable(propId: string): boolean {
    const inst = this.getRoomPropInstance(propId);
    const jsonDefault = inst?.clickable === true;
    const manager = resolveGameStateManager(this.game);
    return readSavedPropClickable(manager, this.roomData.id, propId, jsonDefault);
  }

  /**
   * Persist + apply clickability for one prop. Survives room reloads; spawn re-applies via
   * {@link readSavedPropClickable}. Backs **`B.prop(id).clickable`**. Enabling needs an authored
   * collider (≥3 points); missing collider is persisted but not attached (warn in attach).
   * **`walkTo('id')`** / movement resolution is **not** gated.
   */
  setPropScriptClickable(propId: string, clickable: boolean): void {
    writeSavedPropClickable(resolveGameStateManager(this.game), this.roomData.id, propId, clickable);
    const sprite = this.propSpritesById.get(propId);
    if (!sprite) {
      return;
    }
    if (!clickable) {
      if (sprite.input) {
        sprite.disableInteractive();
      }
      return;
    }
    if (sprite.getData('bennePropInteractionAttached') === true) {
      if (sprite.input && !sprite.input.enabled) {
        sprite.setInteractive();
      }
      return;
    }
    const inst = this.getRoomPropInstance(propId);
    if (!inst) {
      return;
    }
    const spawnStub: RoomPropSpawn = {
      id: propId,
      textureKey: sprite.texture.key,
      tag: inst.tag,
      x: sprite.x,
      y: sprite.y,
      data: inst,
    };
    this.attachPropInteraction(this.roomData.id, spawnStub, sprite);
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
   * Effective `B.walkable(id).active` — saved override wins; falls back to the JSON `active` field
   * (`undefined` / omitted = `true`, explicit `false` = inactive). Unknown ids return **`false`**
   * and log once in DEV with this room’s walkable polygon id list.
   */
  getWalkableScriptActive(walkableId: string): boolean {
    const poly = this.roomData.walkable.polygons.find((p) => p.id === walkableId);
    if (!poly) {
      this.warnIfUnknownWalkableScriptId(walkableId);
      return false;
    }
    const jsonDefault = poly.active !== false;
    return readSavedWalkableActive(
      resolveGameStateManager(this.game),
      this.roomData.id,
      walkableId,
      jsonDefault,
    );
  }

  /**
   * Persist + immediately apply the `active` state for a walkable polygon. Mutates the live
   * `roomData.walkable.polygons` entry so walk tests, clamping, and pathfinding pick it up
   * without a room reload. Backs **`B.walkable(id).active = …`**. No-op when **`walkableId`**
   * is not in this room’s **`walkable.polygons[]`** (DEV warns once per id per load).
   */
  setWalkableScriptActive(walkableId: string, active: boolean): void {
    const poly = this.roomData.walkable.polygons.find((p) => p.id === walkableId);
    if (!poly) {
      this.warnIfUnknownWalkableScriptId(walkableId);
      return;
    }
    writeSavedWalkableActive(resolveGameStateManager(this.game), this.roomData.id, walkableId, active);
    poly.active = active;
    this.redrawWalkableDebugStrokes();
  }

  /**
   * Re-apply saved `B.walkable(id).active` overrides to `roomData.walkable.polygons` at room load.
   * Called at the top of {@link create} so the live mesh matches persisted state before the first
   * walk query or debug stroke.
   */
  private restoreWalkableActiveOverrides(): void {
    const polygons = this.roomData?.walkable?.polygons;
    if (!polygons || polygons.length === 0) return;
    const manager = resolveGameStateManager(this.game);
    for (const poly of polygons) {
      const jsonDefault = poly.active !== false;
      const saved = readSavedWalkableActive(manager, this.roomData.id, poly.id, jsonDefault);
      if (saved !== jsonDefault) {
        poly.active = saved;
      }
    }
  }

  private warnIfUnknownWalkableScriptId(walkableId: string): void {
    if (!import.meta.env.DEV) {
      return;
    }
    if (this.unknownWalkableScriptIdsWarned.has(walkableId)) {
      return;
    }
    this.unknownWalkableScriptIdsWarned.add(walkableId);
    const ids = this.roomData.walkable.polygons.map((p) => p.id).join(', ');
    console.warn(
      `[Benne] B.walkable('${walkableId}'): no walkable polygon with this id in room '${this.roomData.id}'. Known ids: ${ids || '(none)'} — ids are case-sensitive and must match *.room.json.`,
    );
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

  /**
   * Effective `B.hotspot(id).description` — saved override (including empty) wins, else JSON.
   * Unknown ids return **`''`** and log once in DEV.
   */
  getHotspotScriptDescription(hotspotId: string): string {
    const hotspot = this.roomData.hotspots.find((h) => h.id === hotspotId);
    if (!hotspot) {
      this.warnIfUnknownHotspotScriptId(hotspotId);
      return '';
    }
    return readSavedHotspotDescription(
      resolveGameStateManager(this.game),
      this.roomData.id,
      hotspotId,
      hotspot.description ?? '',
    );
  }

  /**
   * Persist `B.hotspot(id).description`. Survives room reloads and save/load. Unknown ids no-op
   * (DEV warns once). Refreshes the verb hover line so the new text shows without a pointer move.
   */
  setHotspotScriptDescription(hotspotId: string, value: string): void {
    const hotspot = this.roomData.hotspots.find((h) => h.id === hotspotId);
    if (!hotspot) {
      this.warnIfUnknownHotspotScriptId(hotspotId);
      return;
    }
    writeSavedHotspotDescription(
      resolveGameStateManager(this.game),
      this.roomData.id,
      hotspotId,
      value,
    );
    this.syncVerbHoverScriptSurfaceAtActivePointer();
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
   * Effective clickability for NPC pointer hit-test (hover, verbs, inventory-on-target). Saved script
   * override wins, else the first spawned definition’s {@link CharacterData.clickable} default for this room.
   */
  getCharacterScriptClickable(definitionId: string): boolean {
    const jsonDefault = this.characterJsonClickableByDefId.get(definitionId) ?? true;
    const manager = resolveGameStateManager(this.game);
    return readSavedCharacterClickable(manager, definitionId, jsonDefault);
  }

  /**
   * Persist + apply clickability for one character definition id. Survives room reloads;
   * spawn re-applies via {@link readSavedCharacterClickable}. Backs **`B.character(id).clickable`**.
   */
  setCharacterScriptClickable(definitionId: string, clickable: boolean): void {
    writeSavedCharacterClickable(resolveGameStateManager(this.game), definitionId, clickable);
    const sprite = this.characterSpritesByDefId.get(definitionId);
    if (!sprite) {
      return;
    }
    if (!clickable) {
      if (sprite.input) {
        sprite.disableInteractive();
      }
      return;
    }
    if (sprite.getData('benneCharacterInteractionAttached') === true) {
      if (sprite.input && !sprite.input.enabled) {
        sprite.setInteractive();
      }
      return;
    }
    const charData = sprite.getData('character') as CharacterData | undefined;
    const instanceId = sprite.getData('instanceId') as string | undefined;
    if (!charData || !instanceId) {
      return;
    }
    const spawnStub: RoomCharacterSpawn = {
      instanceId,
      x: 0,
      y: 0,
      data: charData,
      loadKind: 'aseprite',
      textureKey: '',
    };
    this.attachCharacterInteraction(this.roomData.id, spawnStub, sprite);
  }

  /**
   * Effective `B.character(id).description` — saved override (including empty) wins, else
   * {@link CharacterData.description} from the spawned sprite, else `''`.
   */
  getCharacterScriptDescription(definitionId: string): string {
    const sprite = this.getCharacterSprite(definitionId);
    const charData = sprite?.getData('character') as CharacterData | undefined;
    const jsonDefault = charData?.description ?? '';
    return readSavedCharacterDescription(
      resolveGameStateManager(this.game),
      definitionId,
      jsonDefault,
    );
  }

  /**
   * Persist `B.character(id).description`. Survives room reloads and save/load. Refreshes the verb
   * hover line so the new text shows without requiring a pointer move.
   */
  setCharacterScriptDescription(definitionId: string, value: string): void {
    writeSavedCharacterDescription(resolveGameStateManager(this.game), definitionId, value);
    this.syncVerbHoverScriptSurfaceAtActivePointer();
  }

  /** Persist absolute world speech GUI position (backs **`setSpeechPosition`**). */
  setCharacterScriptSpeechPosition(definitionId: string, x: number, y: number): void {
    writeSavedCharacterSpeechPosition(resolveGameStateManager(this.game), definitionId, { x, y });
  }

  /** Persist canvas-pixel speech GUI offset after default placement (backs **`setSpeechOffset`**). */
  setCharacterScriptSpeechOffset(definitionId: string, x: number, y: number): void {
    writeSavedCharacterSpeechOffset(resolveGameStateManager(this.game), definitionId, { x, y });
  }

  /** Clears saved speech position and offset overrides (backs **`resetSpeechPosition`**). */
  resetCharacterScriptSpeechPosition(definitionId: string): void {
    clearSavedCharacterSpeechPosition(resolveGameStateManager(this.game), definitionId);
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
    if (durMs === 0 || this.cutsceneSkipFastForwardActive) {
      sprite.setAlpha(to);
      return Promise.resolve();
    }
    return this.runSkippableStep(
      (done) => {
        this.tweens.add({
          targets: sprite,
          alpha: to,
          duration: durMs,
          ease: 'Linear',
          onComplete: done,
        });
      },
      (done) => {
        this.tweens.killTweensOf(sprite);
        sprite.setAlpha(to);
        done();
      },
    );
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
    const playerId = this.getActivePlayerCharacterId();
    if (!this.getCharacterScriptMovable(playerId)) {
      return Promise.resolve();
    }
    const interaction = currentInteraction();
    return new Promise((resolve) => {
      this.movePlayerToward(worldX, worldY, resolve);
      if (this.walkArriveCallback === resolve) {
        this.walkArriveInteraction = interaction;
      }
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
    applyCharacterSpriteRegionTintFromWinningRegion(sprite, perspective.tintRegion);
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
    const playerCharacterId = this.getActivePlayerCharacterId();

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
    if (characterDefinitionId === this.getActivePlayerCharacterId()) {
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

  /**
   * Resolve a camera focus / zoom target in room space. String ids: prop → hotspot → character →
   * `room.points`. Props and hotspots use **`lookAtPoint`** (not **`walkToPoint`**); characters use
   * **`talkPoint`** in frame space when set, else world feet.
   */
  resolveCameraFocusTarget(target: Point2 | string, refPoint: Point2): Point2 {
    if (typeof target !== 'string') {
      return { x: target.x, y: target.y };
    }
    const id = target;

    const propInst = this.getRoomPropInstance(id);
    if (propInst) {
      if (propInst.lookAtPoint) {
        return { x: propInst.lookAtPoint.x, y: propInst.lookAtPoint.y };
      }
      const colliderPts = propInst.collider?.points;
      if (colliderPts && colliderPts.length >= 3) {
        const onPoly = closestPointInOrOnSimplePolygon(refPoint.x, refPoint.y, colliderPts);
        if (onPoly) {
          return onPoly;
        }
      }
      const propSprite = this.propSpritesById.get(id);
      if (propSprite) {
        const f = propSprite.frame;
        return { x: propSprite.x + f.width * 0.5, y: propSprite.y + f.height * 0.5 };
      }
      return refPoint;
    }

    const hotspot = this.roomData.hotspots.find((h) => h.id === id);
    if (hotspot) {
      if (hotspot.lookAtPoint) {
        return { x: hotspot.lookAtPoint.x, y: hotspot.lookAtPoint.y };
      }
      const hp = hotspot.points;
      if (hp.length >= 3) {
        const c = polygonRingCentroid(hp);
        if (c) {
          return c;
        }
      }
      return refPoint;
    }

    const charSprite = this.characterSpritesByDefId.get(id);
    if (charSprite) {
      const data = charSprite.getData('character') as CharacterData | undefined;
      if (data?.talkPoint) {
        return {
          x: charSprite.x + data.talkPoint.x,
          y: charSprite.y + data.talkPoint.y,
        };
      }
      return getCharacterWorldFeet(charSprite as Phaser.GameObjects.Sprite);
    }

    const namedPoint = this.roomData.points?.find((p) => p.id === id);
    if (namedPoint) {
      return { x: namedPoint.x, y: namedPoint.y };
    }

    if (!this.unresolvedCameraTargetIdsWarned.has(id)) {
      this.unresolvedCameraTargetIdsWarned.add(id);
      console.warn(`[Benne] camera: unresolved target "${id}"`);
    }
    return refPoint;
  }

  private resolveCameraFocusWorldPoint(target: Point2 | string): Point2 {
    const refPoint = this.player
      ? getCharacterWorldFeet(this.player)
      : this.cameras.main.getWorldPoint(
          this.cameras.main.centerX,
          this.cameras.main.centerY,
        );
    return this.resolveCameraFocusTarget(target, refPoint);
  }

  private clampScriptGameplayZoom(zoom: number): number {
    const { minZoom, maxZoom } = getCameraSettings();
    return Phaser.Math.Clamp(zoom, minZoom, maxZoom);
  }

  /** `undefined` → config `defaultTransitionSeconds`; explicit `0` → instant. */
  private resolveCameraTransitionSeconds(transitionSeconds?: number): number {
    if (transitionSeconds !== undefined) {
      return Math.max(0, transitionSeconds);
    }
    return getCameraSettings().defaultTransitionSeconds;
  }

  private resolvePlayerCameraCenterPoint(): Point2 | null {
    if (!this.player) {
      return null;
    }
    return getCharacterWorldFeet(this.player);
  }

  private finishCameraReset(): void {
    this.scriptCameraFocusActive = false;
    this.scriptCameraFocusPoint = null;
    const vW = getInternalWidth();
    const vH = getInternalHeight();
    const roomW = this.roomData.size?.width ?? vW;
    const roomH = this.roomData.size?.height ?? vH;
    this.applyPlayerCameraFollow(roomW, roomH);
  }

  private resolveDisplayCameraZoom(): number {
    if (this.editorCameraMode !== null) {
      return this.editorDisplayBaseZoom;
    }
    const registryZoom = this.game.registry.get(BENNE_RUNTIME_HI_DPI_CAM_ZOOM_REGISTRY_KEY);
    if (typeof registryZoom === 'number' && Number.isFinite(registryZoom) && registryZoom > 0) {
      return registryZoom;
    }
    const cam = this.cameras.main;
    const gameplay = Math.max(this.scriptGameplayZoom, 0.001);
    return cam.zoom / gameplay;
  }

  /** Applies `displayZoom × scriptGameplayZoom` and keeps the UI camera matched. */
  private applyScriptCameraZoom(): void {
    const displayZoom = this.resolveDisplayCameraZoom();
    this.cameras.main.setZoom(displayZoom * this.scriptGameplayZoom);
    this.syncEditorUiCameraToMain();
  }

  private killScriptCameraPan(): void {
    const cam = this.cameras.main as Phaser.Cameras.Scene2D.Camera & {
      panEffect?: { reset: () => void; isRunning?: boolean };
    };
    cam.panEffect?.reset();
  }

  private killScriptCameraZoomTween(): void {
    if (this.scriptCameraZoomTween) {
      this.scriptCameraZoomTween.stop();
      this.scriptCameraZoomTween = null;
    }
  }

  private queueCameraPan(worldX: number, worldY: number, transitionSeconds?: number): Promise<void> {
    const cam = this.cameras.main;
    this.killScriptCameraPan();
    const durMs = this.cutsceneSkipFastForwardActive
      ? 0
      : Math.max(0, (transitionSeconds ?? 0) * 1000);
    if (durMs <= 0) {
      cam.centerOn(worldX, worldY);
      return Promise.resolve();
    }
    let onPanComplete: (() => void) | null = null;
    return this.runSkippableStep(
      (done) => {
        onPanComplete = (): void => {
          cam.off(Phaser.Cameras.Scene2D.Events.PAN_COMPLETE, onPanComplete!);
          onPanComplete = null;
          done();
        };
        cam.once(Phaser.Cameras.Scene2D.Events.PAN_COMPLETE, onPanComplete);
        cam.pan(worldX, worldY, durMs, 'Linear', true);
      },
      (done) => {
        if (onPanComplete) {
          cam.off(Phaser.Cameras.Scene2D.Events.PAN_COMPLETE, onPanComplete);
          onPanComplete = null;
        }
        this.killScriptCameraPan();
        cam.centerOn(worldX, worldY);
        done();
      },
    );
  }

  private queueCameraGameplayZoomTo(targetZoom: number, transitionSeconds?: number): Promise<void> {
    const clamped = this.clampScriptGameplayZoom(targetZoom);
    this.killScriptCameraZoomTween();
    const durMs = this.cutsceneSkipFastForwardActive
      ? 0
      : Math.max(0, (transitionSeconds ?? 0) * 1000);
    if (durMs <= 0) {
      this.scriptGameplayZoom = clamped;
      this.applyScriptCameraZoom();
      return Promise.resolve();
    }
    const from = this.scriptGameplayZoom;
    const state = { z: from };
    return this.runSkippableStep(
      (done) => {
        this.scriptCameraZoomTween = this.tweens.add({
          targets: state,
          z: clamped,
          duration: durMs,
          ease: 'Linear',
          onUpdate: () => {
            this.scriptGameplayZoom = state.z;
            this.applyScriptCameraZoom();
          },
          onComplete: () => {
            this.scriptGameplayZoom = clamped;
            this.applyScriptCameraZoom();
            this.scriptCameraZoomTween = null;
            done();
          },
        });
      },
      (done) => {
        this.killScriptCameraZoomTween();
        this.scriptGameplayZoom = clamped;
        this.applyScriptCameraZoom();
        done();
      },
    );
  }

  /**
   * Centers the camera on a world point or resolved target; suspends player follow until
   * {@link queueCameraReset}.
   */
  queueCameraFocus(target: Point2 | string, transitionSeconds?: number): Promise<void> {
    const cam = this.cameras.main;
    cam.stopFollow();
    this.scriptCameraFocusActive = true;
    const point = this.resolveCameraFocusWorldPoint(target);
    this.scriptCameraFocusPoint = { x: point.x, y: point.y };
    return this.queueCameraPan(point.x, point.y, transitionSeconds);
  }

  /** Clears script focus and gameplay zoom, restoring default player follow. */
  queueCameraReset(transitionSeconds?: number): Promise<void> {
    const durSec = this.cutsceneSkipFastForwardActive
      ? 0
      : this.resolveCameraTransitionSeconds(transitionSeconds);
    this.killScriptCameraPan();
    this.killScriptCameraZoomTween();

    if (durSec <= 0) {
      this.cameras.main.resetFX();
      this.scriptGameplayZoom = 1;
      this.applyScriptCameraZoom();
      this.finishCameraReset();
      return Promise.resolve();
    }

    const cam = this.cameras.main;
    cam.stopFollow();
    const playerCenter = this.resolvePlayerCameraCenterPoint();
    const tasks: Promise<void>[] = [this.queueCameraGameplayZoomTo(1, durSec)];
    if (playerCenter) {
      tasks.push(this.queueCameraPan(playerCenter.x, playerCenter.y, durSec));
    }

    return Promise.all(tasks).then(() => {
      cam.resetFX();
      this.finishCameraReset();
    });
  }

  /** Sets the gameplay zoom multiplier (`1` = room default). */
  queueCameraSetZoom(zoom: number, transitionSeconds?: number): Promise<void> {
    return this.queueCameraGameplayZoomTo(zoom, transitionSeconds);
  }

  /** Returns gameplay zoom to room default (`1`). */
  queueCameraResetZoom(transitionSeconds?: number): Promise<void> {
    return this.queueCameraGameplayZoomTo(1, transitionSeconds);
  }

  /** Focuses on a target and sets zoom in parallel with a shared transition time. */
  queueCameraZoomTo(
    target: Point2 | string,
    zoom: number,
    transitionSeconds?: number,
  ): Promise<void> {
    const cam = this.cameras.main;
    cam.stopFollow();
    this.scriptCameraFocusActive = true;
    const point = this.resolveCameraFocusWorldPoint(target);
    this.scriptCameraFocusPoint = { x: point.x, y: point.y };
    return Promise.all([
      this.queueCameraPan(point.x, point.y, transitionSeconds),
      this.queueCameraGameplayZoomTo(zoom, transitionSeconds),
    ]).then(() => undefined);
  }

  /** Fire-and-forget screen shake; does not participate in the Bennescript interaction queue. */
  cameraShake(intensity?: number, durationSeconds?: number, falloff?: boolean): void {
    const defaults = getCameraSettings().shake;
    const shakeIntensity = intensity ?? defaults.intensity;
    const durationMs = Math.max(0, (durationSeconds ?? defaults.durationSeconds) * 1000);
    const useFalloff = falloff ?? defaults.falloff;
    const cam = this.cameras.main as Phaser.Cameras.Scene2D.Camera & {
      shakeEffect?: { intensity: Phaser.Math.Vector2 };
    };
    if (durationMs <= 0 || shakeIntensity <= 0) {
      return;
    }
    if (useFalloff) {
      cam.shake(
        durationMs,
        shakeIntensity,
        true,
        (_camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
          const scaled = shakeIntensity * (1 - progress);
          cam.shakeEffect?.intensity.set(scaled);
        },
        this,
      );
    } else {
      cam.shake(durationMs, shakeIntensity, true);
    }
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
    if (this.scriptCameraFocusActive) {
      return;
    }
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
    this.updateCharacterFaceTowardCharacterLocks();
    this.updateCharacterFollowers();
    this.syncIdleCharacterRegionScales();
    this.syncCharacterRegionEnterExit();
    this.updateParallaxProps();
    this.updateRoomStackDepths();
    this.updatePathDebug();
    this.invokeBenneScriptOnUpdateHandlers(this.game.loop.delta / 1000);
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
      this.editorDisplayBaseZoom = scale;

      const sb = this.roomData.scrollBounds;
      cam.setBounds(
        sb?.x ?? 0,
        sb?.y ?? 0,
        sb?.width ?? roomW,
        sb?.height ?? roomH,
      );

      if (!this.scriptCameraFocusActive && this.player && (roomW > gameW || roomH > gameH)) {
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
      this.editorDisplayBaseZoom = zoom;

      // Room bounds — Phaser's clampX/Y will position the room at the canvas top-left.
      cam.setBounds(0, 0, roomW, roomH);
      cam.scrollX = 0;
      cam.scrollY = 0;
    }

    this.applyScriptCameraZoom();
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
    if (this.roomVideoBackdrop) {
      this.editorUiGuiObjects.add(this.roomVideoBackdrop);
    }
    if (this.roomVideo) {
      this.editorUiGuiObjects.add(this.roomVideo);
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
    if (!this.game.registry.get(BENNE_RUNTIME_HI_DPI_WIRED_REGISTRY_KEY)) {
      return;
    }
    this.applyScriptCameraZoom();
    this.reapplyCameraAfterHiDpiLayout();
  }

  /**
   * `applyBenneRuntimeHiDpiCameras` sets scroll to 0 after changing the viewport. On a wide
   * room that scroll clamps to the far right once follow has been stopped. Restore the script
   * focus point, or player follow, before the next paint.
   */
  private reapplyCameraAfterHiDpiLayout(): void {
    const cam = this.cameras.main;
    if (this.scriptCameraFocusActive && this.scriptCameraFocusPoint) {
      cam.stopFollow();
      cam.centerOn(this.scriptCameraFocusPoint.x, this.scriptCameraFocusPoint.y);
      return;
    }
    const vW = getInternalWidth();
    const vH = getInternalHeight();
    this.applyPlayerCameraFollow(
      this.roomData.size?.width ?? vW,
      this.roomData.size?.height ?? vH,
    );
  }

  private readonly handleRoomPointerDown = (
    pointer: Phaser.Input.Pointer,
    /** Same list Phaser passes after {@link Phaser.Input.InputPlugin#sortGameObjects} + `topOnly` (when emitted from POINTER_DOWN). */
    phaserCurrentlyOver?: Phaser.GameObjects.GameObject[],
  ): void => {
    if (this.tryConsumeRoomVideoOrScriptedDialogClickToSkip(pointer)) {
      return;
    }
    if (this.isPlayerPointerBlocked()) {
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
    const arriveInteraction = this.walkArriveInteraction;
    this.walkArriveCallback = null;
    this.walkArriveInteraction = null;
    this.currentPlayerPath = null;
    // Outside a cutscene a dropped walk never resolves, so whatever was waiting on it is abandoned.
    if (arriveCallback && !this.isCutsceneActive()) {
      arriveInteraction?.end();
    }
    if (!this.playerMoveTween) {
      // During a cutscene the walk promise must still resolve so the interaction chain continues.
      if (this.isCutsceneActive() && arriveCallback) {
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
    if (this.isCutsceneActive() && arriveCallback) {
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
    if (!this.getCharacterScriptMovable(this.getActivePlayerCharacterId())) {
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

    // Skipping a cutscene still emits the same walk start / stop pair; the player just arrives
    // at the end of the path immediately instead of tweening along it.
    if (this.cutsceneSkipFastForwardActive) {
      this.fastForwardPlayerWalkForSkip();
      return;
    }

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
    const followMultRaw = sprite.getData(BENNE_FOLLOW_SPEED_MULT_KEY) as number | undefined;
    const followMult =
      typeof followMultRaw === 'number' && Number.isFinite(followMultRaw) && followMultRaw > 0
        ? followMultRaw
        : 1;
    const speed = (typeof walkSpeed === 'number' && walkSpeed > 0 ? walkSpeed : 88) * followMult;
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
    this.walkArriveInteraction = null;
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

    // Every terminal branch of the walk (arrived, interrupted, skipped) runs `arrive` exactly once,
    // so the skip finisher is always unregistered with it.
    let unregisterSkipFinisher: (() => void) | null = null;
    const arrive = (): void => {
      unregisterSkipFinisher?.();
      unregisterSkipFinisher = null;
      onArrive?.();
    };
    unregisterSkipFinisher = this.registerCutsceneSkipFinisher(() => {
      unregisterSkipFinisher = null;
      this.fastForwardNpcWalkForSkip(sprite, path, arrive);
    });

    if (this.cutsceneSkipFastForwardActive) {
      this.fastForwardNpcWalkForSkip(sprite, path, arrive);
      return;
    }

    this.beginNpcWalkLeg(sprite, path, 0, arrive);
  }

  private beginNpcWalkLeg(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    path: readonly Point2[],
    legIndex: number,
    onArrive?: () => void,
  ): void {
    const walkSpeed = sprite.getData('walkSpeed') as number | undefined;
    const followMultRaw = sprite.getData(BENNE_FOLLOW_SPEED_MULT_KEY) as number | undefined;
    const followMult =
      typeof followMultRaw === 'number' && Number.isFinite(followMultRaw) && followMultRaw > 0
        ? followMultRaw
        : 1;
    const speed = (typeof walkSpeed === 'number' && walkSpeed > 0 ? walkSpeed : 88) * followMult;
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
        onArrive?.();
        return;
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
      this.debugWalkableOuterGraphics = this.add.graphics();
      this.debugWalkableHoleGraphics = this.add.graphics();
      this.debugWalkableOuterGraphics.setDepth(DEBUG_OVERLAY_DEPTH);
      this.debugWalkableHoleGraphics.setDepth(DEBUG_OVERLAY_DEPTH);
      this.redrawWalkableDebugStrokes();
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
   * Restroke active walkable outers and holes. No-op when `debug.showWalkable` did not create
   * the overlay graphics. Called from {@link drawRoomDebugOverlays} and when
   * **`B.walkable(id).active`** changes.
   */
  private redrawWalkableDebugStrokes(): void {
    const gOuter = this.debugWalkableOuterGraphics;
    const gHoles = this.debugWalkableHoleGraphics;
    if (!gOuter || !gHoles) {
      return;
    }
    const lineWidth = 1;
    gOuter.clear();
    gHoles.clear();
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
    if (!this.getPropScriptClickable(spawn.id)) {
      return;
    }
    this.attachPropInteraction(roomId, spawn, sprite);
  }

  /**
   * Registers collider hit-test + pointerdown for one prop. Caller ensures the prop should be
   * interactive (JSON/script clickable). Props may start hidden (`visible: false`) and be shown
   * later via `B.prop(id).show()` / `setPropScriptVisible`. Interactive must still be registered:
   * Phaser's hit test skips objects that do not `willRender` (including invisible sprites), so
   * hidden props stay non-interactive until visibly shown.
   */
  private attachPropInteraction(
    roomId: string,
    spawn: RoomPropSpawn,
    sprite: Phaser.GameObjects.Sprite,
  ): void {
    if (sprite.getData('bennePropInteractionAttached') === true) {
      return;
    }

    const pts = spawn.data.collider?.points;
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
      if (this.tryConsumeRoomVideoOrScriptedDialogClickToSkip(pointer)) {
        return;
      }
      if (this.isPlayerPointerBlocked()) {
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
    sprite.setData('bennePropInteractionAttached', true);
  }

  /**
   * Dispatches the **look** verb on this prop (same as a primary-button look click). Does not move or rotate the player.
   */
  tryBeginPropLook(roomId: string, spawn: RoomPropSpawn): void {
    this.emitPropVerbInteraction(roomId, spawn, 'look');
  }

  private resolvePropDescriptionForDispatch(spawn: RoomPropSpawn): string | undefined {
    return this.getPropScriptDescription(spawn.id);
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
      if (this.tryConsumeRoomVideoOrScriptedDialogClickToSkip(pointer)) {
        return;
      }
      if (this.isPlayerPointerBlocked()) {
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
            description: this.getHotspotScriptDescription(hotspot.id),
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
        description: this.getHotspotScriptDescription(hotspot.id),
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
    const isPlayer = spawn.data.id === this.getActivePlayerCharacterId();
    sprite.setData('isPlayer', isPlayer);
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
    const isPlayer = spawn.data.id === this.getActivePlayerCharacterId();
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

    if (sprite.getData('benneCharacterInteractionAttached') === true) {
      return;
    }
    if (!this.getCharacterScriptClickable(spawn.data.id)) {
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
      if (this.tryConsumeRoomVideoOrScriptedDialogClickToSkip(pointer)) {
        return;
      }
      if (this.isPlayerPointerBlocked()) {
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
            description: this.getCharacterScriptDescription(d.id),
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
        description: this.getCharacterScriptDescription(d.id),
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
    sprite.setData('benneCharacterInteractionAttached', true);
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
    if (this.isPlayerPointerBlocked() || hasAnyVisibleModal(this.modalGuiEntries)) {
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
        const fromDesc = this.getInventoryScriptDescription(itemId).trim();
        let description: string | null = null;
        if (fromDesc.length > 0) {
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
        const d = this.getHotspotScriptDescription(hid).trim();
        const description = d.length > 0 ? d : null;
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
        if (!this.getCharacterScriptClickable(charData.id)) {
          continue;
        }
        const chDesc = this.getCharacterScriptDescription(charData.id).trim();
        let description: string | null = null;
        if (chDesc.length > 0) {
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
          const trimmedOverride = this.getPropScriptDescription(propId).trim();
          const p = this.roomData.props?.find((rp) => rp.id === propId);
          let description: string;
          if (trimmedOverride.length > 0) {
            description = trimmedOverride;
          } else {
            description = propId;
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
    const defaultActiveAuthor = cfg.activeAnimation.trim();

    // B.disableUserInput hides the pointer entirely (ahead of the cutscene busy cursor).
    if (this.isUserInputDisabled()) {
      const visualKey = 'input-lock|hide';
      if (this.lastCustomCursorVisualKey !== visualKey) {
        this.lastCustomCursorVisualKey = visualKey;
        sprite.setVisible(false);
      }
      return;
    }

    // Cutscenes and videos show busy animation if configured and exists, otherwise hide the cursor.
    if (this.isBusyCursorActive()) {
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

    const hover = this.resolvePointerVerbStyleHoverCursor(this.sortRoomPointerHitStack(pointer));
    // Active inventory cursor clips take precedence regardless of hover target.
    const invClip = this.tryActiveInventoryCursorClip();
    const resolvedActiveAuthor = invClip
      ? defaultActiveAuthor
      : hover.useActiveVerbCursor
        ? this.resolveGameCursorActiveAuthorFromOptionalOverride(hover.overrideAuthor) || defaultActiveAuthor
        : defaultActiveAuthor;
    const activeKey = cursorPhaserAnimationKey(resolvedActiveAuthor);
    const visualKey = invClip
      ? `inv|${invClip.textureKey}|${invClip.animKey}`
      : hover.useActiveVerbCursor
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
    if (!hover.useActiveVerbCursor) {
      sprite.setTexture(CURSOR_TEXTURE_KEY);
      sprite.play(idleKey);
      return;
    }
    sprite.setTexture(CURSOR_TEXTURE_KEY);
    sprite.play(activeKey);
  }

  /**
   * When `authorTag` is a non-empty cursor-sheet tag that exists on this scene, returns the trimmed
   * author tag; otherwise returns empty string (caller falls back to `game-config.json` `cursor.activeAnimation`).
   */
  private resolveGameCursorActiveAuthorFromOptionalOverride(authorTag: string): string {
    const t = authorTag.trim();
    if (t.length === 0) {
      return '';
    }
    const key = cursorPhaserAnimationKey(t);
    if (this.anims.exists(key)) {
      return t;
    }
    if (import.meta.env.DEV && !this.unknownActiveCursorOverrideTagsWarned.has(t)) {
      this.unknownActiveCursorOverrideTagsWarned.add(t);
      console.warn(
        `[Benne] activeCursorOverride "${t}" is not a frame tag on the game cursor sheet — using cursor.activeAnimation.`,
      );
    }
    return '';
  }

  /**
   * Walks hits top-first (sorted): GUI / inventory slots request the active verb cursor; room
   * hotspots / clickable props / clickable NPCs do so unless scripted-dialog input suppression is on.
   * {@link overrideAuthor} is the raw JSON `activeCursorOverride` for that room target (may be empty).
   */
  private resolvePointerVerbStyleHoverCursor(hits: Phaser.GameObjects.GameObject[]): {
    useActiveVerbCursor: boolean;
    overrideAuthor: string;
  } {
    if (this.isBusyCursorActive()) {
      return { useActiveVerbCursor: false, overrideAuthor: '' };
    }
    const dialogSuppressed = this.isScriptedDialogInputSuppressed();
    for (const o of hits) {
      const go = o as Phaser.GameObjects.GameObject & { getData?: (key: string) => unknown };
      if (typeof go.getData === 'function') {
        if (go.getData('benneGuiButton') === true || go.getData('benneInventorySlot') === true) {
          return { useActiveVerbCursor: true, overrideAuthor: '' };
        }
        if (go.getData('benneHotspot') === true) {
          if (dialogSuppressed) {
            return { useActiveVerbCursor: false, overrideAuthor: '' };
          }
          const hid = go.getData('benneHotspotId') as string | undefined;
          const hs = hid ? this.roomData.hotspots.find((h) => h.id === hid) : undefined;
          const raw = hs?.activeCursorOverride;
          return {
            useActiveVerbCursor: true,
            overrideAuthor: typeof raw === 'string' ? raw.trim() : '',
          };
        }
        const charData = go.getData('character') as CharacterData | undefined;
        if (
          charData &&
          go.getData('isPlayer') !== true &&
          this.getCharacterScriptClickable(charData.id)
        ) {
          if (dialogSuppressed) {
            return { useActiveVerbCursor: false, overrideAuthor: '' };
          }
          const raw = charData.activeCursorOverride;
          return {
            useActiveVerbCursor: true,
            overrideAuthor: typeof raw === 'string' ? raw.trim() : '',
          };
        }
      }
      let propHitThisObject = false;
      for (const [propId, propSprite] of this.propSpritesById) {
        if (propSprite === o) {
          propHitThisObject = true;
          if (dialogSuppressed) {
            return { useActiveVerbCursor: false, overrideAuthor: '' };
          }
          if (this.getPropScriptClickable(propId)) {
            const row = this.roomData.props?.find((p) => p.id === propId);
            const raw = row?.activeCursorOverride;
            return {
              useActiveVerbCursor: true,
              overrideAuthor: typeof raw === 'string' ? raw.trim() : '',
            };
          }
          break;
        }
      }
      if (propHitThisObject) {
        continue;
      }
    }
    return { useActiveVerbCursor: false, overrideAuthor: '' };
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
