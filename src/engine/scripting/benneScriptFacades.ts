import type { CharacterFacingLetter } from '../../types/character.js';
import type { CharacterFollowOptions } from '../../types/characterFollow.js';
import type {
  CharacterId,
  DialogOptionId,
  ResolvableTargetId,
  RoomId,
  VerbTargetId,
} from '../../types/generated/benne-game-ids.js';
import type { Point2 } from '../../types/room.js';
import type { AnyInventoryUsedOnPayload } from '../events/inventoryOnVerbEvents.js';
import type { InventoryVerbInteractPayload } from '../events/inventoryVerbEvents.js';
import type { MusicPlayOptions, SoundPlayOptions } from '../sound/benneSoundTypes.js';
import type { BenneScriptCharacterInventoryNamespace } from './benneScriptGameStateApi.js';
import type { BenneScriptCore, BenneScriptSayDialogueHybrid, BlockingWithNow } from './BenneScriptCore.js';
import type { ControlFacade } from './GuiRuntime.js';
import type { RegionEnterExitContext } from '../../types/regionEnterExit.js';

export type { AnyInventoryUsedOnPayload } from '../events/inventoryOnVerbEvents.js';

/** `B.room` — `changeTo` / `changeToNow` and save-game room context from {@link import('../gameState/GameStateManager.js').GameStateManager}. */
/**
 * {@link import('./BenneScriptCore.js').BenneScriptCore.sound} — shared reference on `B`, nested facades, and GUIs.
 */
export interface BenneScriptSoundFacade {
  readonly play: BlockingWithNow<[string, SoundPlayOptions?]>;
  readonly playAndWait: BlockingWithNow<[string, SoundPlayOptions?]>;
  readonly playMusic: BlockingWithNow<[string, MusicPlayOptions?]>;
  readonly stop: BlockingWithNow<[string | undefined]>;
  readonly stopMusic: BlockingWithNow<[]>;
  setSfxVolume(volume: number): void;
  setMusicVolume(volume: number): void;
  getSfxVolume(): number;
  getMusicVolume(): number;
  isPlaying(key: string): boolean;
  isMusicPlaying(): boolean;
}

/**
 * {@link import('./BenneScriptCore.js').BenneScriptCore.speechSettings} — runtime speech prefs
 * (`speech:*` variables); getters/setters only, sync (not queued on interaction tail).
 */
export interface BenneScriptSpeechSettingsFacade {
  get clickToSkip(): boolean;
  set clickToSkip(v: boolean);
  get showText(): boolean;
  set showText(v: boolean);
  get msPerCharacter(): number;
  set msPerCharacter(v: number);
  get durationMultiplier(): number;
  set durationMultiplier(v: number);
  get minDurationMs(): number;
  set minDurationMs(v: number);
  get maxDurationMs(): number;
  set maxDurationMs(v: number);
  get defaultTalkOffset(): { x: number; y: number };
  set defaultTalkOffset(v: { x: number; y: number });
}

/**
 * {@link import('./BenneScriptCore.js').BenneScriptCore.camera} — script camera control
 * (focus, zoom, shake) for cutscenes and dramatic moments.
 */
export interface BenneScriptCameraFacade {
  readonly focus: BlockingWithNow<[Point2 | ResolvableTargetId, transitionSeconds?: number]>;
  readonly reset: BlockingWithNow<[transitionSeconds?: number]>;
  readonly setZoom: BlockingWithNow<[zoom: number, transitionSeconds?: number]>;
  readonly resetZoom: BlockingWithNow<[transitionSeconds?: number]>;
  readonly zoomTo: BlockingWithNow<
    [Point2 | ResolvableTargetId, zoom: number, transitionSeconds?: number]
  >;
  shake(intensity?: number, durationSeconds?: number, falloff?: boolean): void;
}

/**
 * {@link import('./BenneScriptCore.js').BenneScriptCore.dialogSettings} — runtime dialog prefs
 * (`dialog:*` variables); getters/setters only, sync (not queued on interaction tail).
 */
export interface BenneScriptDialogSettingsFacade {
  get choiceOptionsViewportHeightPx(): number | undefined;
  set choiceOptionsViewportHeightPx(v: number | undefined);
  get usedColor(): string | undefined;
  set usedColor(v: string | undefined);
}

export interface BenneScriptRoomFacade {
  readonly current: string;
  readonly last: string | null;
  /**
   * Persisted number of times the player has entered the **current** room (1 on first enter, 2 on the next, …).
   * `0` when there is no active manager or **`currentRoom`** is empty.
   */
  readonly visitCount: number;
  /** `true` when {@link visitCount} is `1` for the current room (first persisted enter). */
  readonly isFirstVisit: boolean;
  changeTo: BlockingWithNow<[RoomId]>;
  changeToNow(roomId: RoomId): void;
}

/**
 * Address a GUI overlay by **`*.gui.json` `id`** (**`B.gui('verbs').control('foo')`**).
 * **`control`** returns the live {@link import('./GuiRuntime.js').ControlFacade} (`button` **`.enabled`** / **`.setVisualState`**, **`checkbox`** **`.checked`** / **`.disabled`**, **`textInput`** **`.enabled`** / **`.text`** / **`.textNow`** / **`.focused`**, **`listBox`** **`.selectedIndex`** / **`.setRowText`**), or an inert noop facade when the overlay
 * is missing, **`id`** is blank, or the control is unknown (matching forgiving overlay behavior elsewhere).
 */
export interface BenneScriptGuiOverlayRef {
  control(controlId: string): ControlFacade;
  show(): void;
  hide(): void;
}

/**
 * Active verb + active inventory item helpers present on every {@link BenneScriptCore} subclass (`B` in any script).
 */
export type BenneScriptSharedSelectionApi = Pick<
  BenneScriptCore,
  | 'setActiveVerb'
  | 'getActiveVerb'
  | 'clearActiveVerb'
  | 'setActiveInventory'
  | 'getActiveInventoryItemId'
  | 'clearActiveInventory'
  | 'activeVerb'
  | 'activeInventory'
  | 'onVerbContextChanged'
  | 'onSpeechSettingsChanged'
  | 'currentHoverDescription'
  | 'currentHoverTarget'
  | 'room'
  | 'sound'
  | 'camera'
  | 'speechSettings'
  | 'dialogSettings'
> & {
  readonly fadeOut: BenneScriptCore['fadeOut'];
  readonly fadeIn: BenneScriptCore['fadeIn'];
};

export type InventoryWhenUseHandler =
  | (() => void)
  | ((p: InventoryVerbInteractPayload) => void);

/**
 * {@link import('./InventoryBenneScript.js').InventoryBenneScript.whenUse} — runs after **use** is dispatched;
 * the item still arms for use-on-target after queued steps unless every handler used **`doNotActivate`**.
 */
export interface InventoryWhenUseRegistrar {
  (handler: InventoryWhenUseHandler): void;
  doNotActivate(handler: InventoryWhenUseHandler): void;
}

/** Same payload shape as {@link InventoryWhenUseHandler} — inventory-row **give** dispatch. */
export type InventoryWhenGiveHandler = InventoryWhenUseHandler;

/**
 * {@link import('./InventoryBenneScript.js').InventoryBenneScript.whenGive} — runs after **give** is dispatched;
 * the item still arms for use-on-target after queued steps unless every handler used **`doNotActivate`**.
 */
export interface InventoryWhenGiveRegistrar {
  (handler: InventoryWhenGiveHandler): void;
  doNotActivate(handler: InventoryWhenGiveHandler): void;
}

/** Return `false` to run global `whenInventoryOnVerbTargetUnhandled` (see global script). */
export type InventoryWhenUsedOnPayloadHandler =
  | ((p: AnyInventoryUsedOnPayload) => void | false)
  | (() => void);

/**
 * {@link import('./BenneScript.js').BenneScript.whenInventoryUsedOn} — drop policy after tail unless **`doNotClear`**;
 * **`return false`** from the payload handler delegates to **`B.whenInventoryOnVerbTargetUnhandled`** (no duplicated fallback line).
 */
export interface RoomInventoryUsedOnRegistrar {
  (
    targetId: VerbTargetId,
    handler: InventoryWhenUsedOnPayloadHandler,
    options?: { doNotClear?: boolean },
  ): void;
  doNotClear(
    targetId: VerbTargetId,
    handler: InventoryWhenUsedOnPayloadHandler,
  ): void;
}

/** Enter / exit hooks for one room region (`BenneScript.region`). */
export interface BenneScriptRegionFacade {
  /** Whether this region is active. Inactive regions are ignored by overlap tests, enter/exit detection, perspective scale, and character tint. Setter is immediate (not queued). */
  get active(): boolean;
  set active(v: boolean);
  whenEnter(handler: (() => void) | ((ctx: RegionEnterExitContext) => void)): void;
  whenExit(handler: (() => void) | ((ctx: RegionEnterExitContext) => void)): void;
}

/** Active flag for one room hotspot (`BenneScript.hotspot`). Ids are case-sensitive and must match `hotspots[].id`. */
export interface BenneScriptHotspotFacade {
  /**
   * Whether this hotspot is interactive (polygon hit-test, hover, verbs). Setter is immediate
   * (not queued). Does not change {@link import('../scenes/RoomScene.js').RoomScene.resolveMovementTarget}
   * for string ids — movement resolution still finds the hotspot row.
   */
  get active(): boolean;
  set active(v: boolean);
}

/** Visibility + description overrides for one prop (`BenneScript.prop`). */
export interface BenneScriptPropFacade {
  readonly sound: BenneScriptSoundFacade;
  hide: BlockingWithNow<[]>;
  show: BlockingWithNow<[]>;
  get visible(): boolean;
  /** Queued on the interaction tail (same ordering as {@link animation}). */
  set visible(v: boolean);
  /** Script visibility immediately (skips interaction tail). */
  visibleNow(v: boolean): void;
  get description(): string;
  set description(v: string);
  /** Persisted base Aseprite tag; falls back to room JSON default when unset in save state. */
  get animation(): string;
  /** Queues persist + sprite update on the interaction tail (same ordering as {@link playAnimation}). */
  set animation(tag: string);
  /** Persist + sprite update immediately (skips interaction tail). */
  animationNow(tag: string): void;
  /** One-shot clip (not saved); restores {@link animation} when the clip ends. */
  playAnimation: BlockingWithNow<[string]>;
  /**
   * Tween the prop sprite's alpha from `fromAlpha` to `toAlpha` over `durationSeconds`.
   * Kills any running fade tweens on the sprite first; alphas clamp to `[0, 1]` and duration to `>= 0`.
   * **Blocking** form queues on the interaction tail and waits for the tween to complete; **`fade.now`**
   * starts the same tween without blocking subsequent script lines. Alpha is **not** persisted across room loads.
   */
  fade: BlockingWithNow<[fromAlpha: number, toAlpha: number, durationSeconds: number]>;
  /**
   * Teleport the prop's authoring position to a `Point2` in room space (top-left for canvas
   * placement, the authored origin for `tight` placement, or the parallax base for parallax
   * props). No tween. Position is **not** eagerly persisted on the call — it goes to game
   * state on the next snapshot flush (room-leave, `getSnapshot`, or `B.state.flush()`),
   * matching how character positions are tracked.
   *
   * **Blocking** form queues on the interaction tail (same ordering as {@link visible} /
   * {@link animation}); **`moveTo.now`** / {@link moveToNow} apply immediately.
   *
   * Only `Point2` is accepted — string id resolution doesn't translate to a meaningful prop
   * origin (props don't have feet / stand-points the way characters do).
   */
  moveTo: BlockingWithNow<[Point2]>;
  /** Same as `moveTo.now` — immediate teleport, skips the queue. */
  moveToNow(point: Point2): void;
}

/** Movement + animation + facing for the player. */
export interface BenneScriptPlayerFacade {
  readonly sound: BenneScriptSoundFacade;
  /** Character definition id currently controlled as the player. */
  readonly id: CharacterId;
  /** Switch player control to another spawned character, updating camera follow and active inventory ownership. */
  switchTo: BlockingWithNow<[CharacterId]>;
  /** Same as `switchTo.now` — immediate control handoff, skips the queue. */
  switchToNow(characterId: CharacterId): void;
  walkTo: BlockingWithNow<[Point2 | ResolvableTargetId]>;
  /**
   * Teleport feet to a resolved point (clamped to walkable); updates **Idle** facing. Queued on the
   * interaction tail — use {@link walkTo} for pathfind walking.
   */
  moveTo: BlockingWithNow<[Point2 | ResolvableTargetId]>;
  /** Same as `moveTo.now` — immediate teleport, skips the queue. */
  moveToNow: (target: Point2 | ResolvableTargetId) => void;
  /** Same as {@link import('./BenneScriptCore.js').BenneScriptCore.walkToClicked} on the owning script. */
  walkToClicked: BlockingWithNow<[]>;
  /** Same as {@link import('./BenneScriptCore.js').BenneScriptCore.faceClicked} on the owning script. */
  faceClicked: BlockingWithNow<[]>;
  /** Effective clip: persisted override if any, else current directional idle / walk / talk tag. */
  get animation(): string;
  /** Queues override + save on the interaction tail; `null` clears. {@link playAnimation} does not persist. */
  set animation(tag: string | null);
  /** Override + save immediately (skips interaction tail); `null` clears. */
  animationNow(tag: string | null): void;
  /** One-shot (not saved); then directional idle or override. */
  playAnimation: BlockingWithNow<[string]>;
  /** Clears persisted override + returns to directional idle (always immediate). */
  stopAnimation(): void;
  say: BenneScriptSayDialogueHybrid;
  face: BlockingWithNow<[CharacterFacingLetter]>;
  /**
   * When false, pathfind walking (`walkTo`, `walkToClicked`, verb walks) is ignored; `moveTo` still teleports.
   * Queued setter; persists under `` `character:<id>:movable` `` (saved override over the JSON **`movable`** default from **`*.character.json`**).
   */
  get movable(): boolean;
  set movable(v: boolean);
  /**
   * Starts persistent following of another character id or the special string **`"player"`** (resolved at runtime).
   * Idempotent for the same target; updates saved options when called again. Queues on the interaction tail.
   */
  startFollowingCharacter(
    targetId: CharacterId | 'player',
    options?: CharacterFollowOptions,
  ): void;
  /** Clears persisted follow state. Queues on the interaction tail. */
  stopFollowingCharacter(): void;
  /** True when a follow target is saved in game state. */
  readonly isFollowing: boolean;
  /** Persisted target id (`"player"` or a character definition id), or `null`. */
  readonly followingTarget: CharacterId | 'player' | null;
  /** Active player's bag (same as {@link BenneScriptInventoryNamespace} quantity helpers). */
  readonly inventory: BenneScriptCharacterInventoryNamespace;
  /**
   * Fixed world/room-space bottom-center for this character's speaking-text GUI (highest precedence).
   * Persists under `` `character:<startingPlayerId>:speechPosition` ``; bypasses talkPoint and
   * `defaultTalkOffset`. Queued vs **`.now`**.
   */
  setSpeechPosition: BlockingWithNow<[x: number, y: number]>;
  /**
   * Canvas-pixel offset applied after default talk anchor + `defaultTalkOffset` when no absolute
   * position is set. Persists under `` `character:<startingPlayerId>:speechOffset` ``.
   */
  setSpeechOffset: BlockingWithNow<[x: number, y: number]>;
  /** Clears both speech position and offset overrides. Queued vs **`.now`**. */
  resetSpeechPosition: BlockingWithNow<[]>;
}

/** Movement + animation + facing for an NPC. */
export interface BenneScriptCharacterFacade {
  readonly sound: BenneScriptSoundFacade;
  walkTo: BlockingWithNow<[Point2 | ResolvableTargetId]>;
  /** Teleport (see {@link BenneScriptPlayerFacade.moveTo}). */
  moveTo: BlockingWithNow<[Point2 | ResolvableTargetId]>;
  moveToNow: (target: Point2 | ResolvableTargetId) => void;
  hide: BlockingWithNow<[]>;
  show: BlockingWithNow<[]>;
  get visible(): boolean;
  /** Queued on the interaction tail (same ordering as {@link animation}). */
  set visible(v: boolean);
  /** Script visibility immediately (skips interaction tail). */
  visibleNow(v: boolean): void;
  get animation(): string;
  /** Queues override + save on the interaction tail; `null` clears. */
  set animation(tag: string | null);
  /** Override + save immediately (skips interaction tail); `null` clears. */
  animationNow(tag: string | null): void;
  playAnimation: BlockingWithNow<[string]>;
  stopAnimation(): void;
  say: BenneScriptSayDialogueHybrid;
  face: BlockingWithNow<[CharacterFacingLetter]>;
  /**
   * Keeps this character’s **Idle** facing toward another spawned character’s feet while either moves;
   * re-aim uses a random delay in **[`minWaitTime`, `maxWaitTime`]** seconds (defaults **0.2** / **0.4**)
   * after feet settle. Queues on the interaction tail. No-op when the observer or target has no live
   * sprite in the active room, or when ids are equal. Replaces any prior lock for this observer.
   */
  startFacingCharacter(character: CharacterId, minWaitTime?: number, maxWaitTime?: number): void;
  /** Clears {@link startFacingCharacter} for this observer. Queues on the interaction tail. */
  stopFacingCharacter(): void;
  /**
   * Tween the character sprite's alpha from `fromAlpha` to `toAlpha` over `durationSeconds`.
   * Kills any running fade tweens on the sprite first; alphas clamp to `[0, 1]` and duration to `>= 0`.
   * **Blocking** form queues on the interaction tail and waits for the tween to complete; **`fade.now`**
   * starts the same tween without blocking subsequent script lines. Alpha is **not** persisted across room loads.
   */
  fade: BlockingWithNow<[fromAlpha: number, toAlpha: number, durationSeconds: number]>;
  /**
   * When false, pathfind walking (`walkTo`, verb walks) is ignored; `moveTo` still teleports.
   * Queued setter; persists under `` `character:<id>:movable` `` (saved override over the JSON **`movable`** default from **`*.character.json`**).
   */
  get movable(): boolean;
  set movable(v: boolean);
  /**
   * When false, the NPC is not hit-tested (no hover, verbs, or inventory-on-target).
   * Queued setter; persists under `` `character:<id>:clickable` `` (saved override over JSON **`clickable`** default from **`*.character.json`**).
   */
  get clickable(): boolean;
  set clickable(v: boolean);
  /**
   * Starts persistent following of another character id or **`"player"`** (see {@link BenneScriptPlayerFacade.startFollowingCharacter}).
   * Queues on the interaction tail.
   */
  startFollowingCharacter(
    targetId: CharacterId | 'player',
    options?: CharacterFollowOptions,
  ): void;
  /** Clears persisted follow state. Queues on the interaction tail. */
  stopFollowingCharacter(): void;
  readonly isFollowing: boolean;
  readonly followingTarget: CharacterId | 'player' | null;
  /** This character's bag (`B.inventory` targets the active player only). */
  readonly inventory: BenneScriptCharacterInventoryNamespace;
  /**
   * Fixed world/room-space bottom-center for this character's speaking-text GUI (highest precedence).
   * Persists under `` `character:<characterId>:speechPosition` ``; bypasses talkPoint and
   * `defaultTalkOffset`. Queued vs **`.now`**.
   */
  setSpeechPosition: BlockingWithNow<[x: number, y: number]>;
  /**
   * Canvas-pixel offset applied after default talk anchor + `defaultTalkOffset` when no absolute
   * position is set. Persists under `` `character:<characterId>:speechOffset` ``.
   */
  setSpeechOffset: BlockingWithNow<[x: number, y: number]>;
  /** Clears both speech position and offset overrides. Queued vs **`.now`**. */
  resetSpeechPosition: BlockingWithNow<[]>;
}

/**
 * Per-item inventory scripting surface from **`B.inventory(itemId)`** (same persistence keys as runtime GUI / cursor).
 * **`animation`** / **`cursorAnimation`** setters queue on the owning **`B`** interaction tail when the facade is
 * constructed with a queue (room / character / inventory / global scripts); **`…Now`** applies immediately.
 * Empty string clears the save override for that field.
 */
/**
 * SCUMM-style dialog control from **`B.dialog(dialogId)`** on any script context, or on {@link import('./DialogBenneScript.js').DialogBenneScript}
 * while a session is active. **`start`** / **`stop`** manage the session; **`optionOn`** / **`optionOff`** write option
 * enabled state (see {@link import('../dialog/dialogOptionVariables.js').dialogOptionEnabledVariableKey}).
 */
export interface BenneScriptDialogCommandSurface {
  start: BlockingWithNow<[]>;
  stop: BlockingWithNow<[]>;
  optionOn: BlockingWithNow<[optionId: DialogOptionId]>;
  optionOff: BlockingWithNow<[optionId: DialogOptionId]>;
}

export interface BenneScriptInventoryItemFacade {
  /** Aseprite tag for the inventory row icon (`defaultAnimation`); falls back to JSON when unset in save state. */
  get animation(): string;
  /** Queues icon tag + persistence on the interaction tail (same ordering as {@link BenneScriptPlayerFacade.animation}). */
  set animation(tag: string);
  /** Apply icon tag + persistence immediately (skips interaction tail). */
  animationNow(tag: string): void;
  /** Tag used when this item is the armed use-on-target cursor (`cursorAnimation`); empty when none. */
  get cursorAnimation(): string;
  /** Queues cursor tag + persistence on the interaction tail. */
  set cursorAnimation(tag: string);
  /** Apply cursor tag + persistence immediately (skips interaction tail). */
  cursorAnimationNow(tag: string): void;
}
