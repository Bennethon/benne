import * as Phaser from 'phaser';
import {
  readSavedHotspotActive,
  readSavedHotspotDescription,
  readSavedPropAlpha,
  readSavedPropBaseAnimationTag,
  readSavedPropClickable,
  readSavedPropDescription,
  readSavedPropVisible,
  readSavedRegionActive,
  readSavedWalkableActive,
  writeSavedHotspotActive,
  writeSavedHotspotDescription,
  writeSavedPropAlpha,
  writeSavedPropBaseAnimationTag,
  writeSavedPropClickable,
  writeSavedPropDescription,
  writeSavedPropPosition,
  writeSavedPropVisible,
  writeSavedRegionActive,
  writeSavedWalkableActive,
} from '../benneAnimationRuntime.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { getRoomVisitCount, setRoomVisitCount } from '../gameState/roomVisitState.js';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry.js';
import { isRoomTransitionInProgress, tryGetRoomTransitionOrchestrator } from '../scenes/roomTransitionGlobals.js';
import {
  inventoryCursorAnimationVariableKey,
  inventoryDefaultAnimationVariableKey,
  readEffectiveInventoryCursorAnimationTag,
  readEffectiveInventoryDefaultAnimationTag,
  readEffectiveInventoryDescription,
  writeSavedInventoryDescription,
} from '../inventory/inventoryScriptingAnimations.js';
import type { ControlFacade } from '../gui/GuiRuntime.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import type { ScriptedSayLineOptions } from './speech.js';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { CutsceneOptions } from '../../types/cutscene.js';
import type { CharacterFollowOptions } from '../../types/characterFollow.js';
import type { Point2 } from '../../types/room.js';
import { tryGetBenneSoundManager } from '../sound/benneSoundRegistry.js';
import type { MusicPlayOptions, SoundPlayOptions } from '../sound/benneSoundTypes.js';
import type { VideoPlayOptions } from '../video/benneVideoTypes.js';
import {
  activeRoomScene,
  characterOps,
  faceCharacterTask,
  inventoryOf,
  readLiveOrSaved,
  roomFor,
  sayTask,
  walkCharacterTask,
  warnOnce,
  writeLiveOrSaved,
  type FacingOptions,
  type Inventory,
  type ItemRef,
  type WalkTarget,
} from './actions.js';
import {
  endDialog,
  isDialogOptionEnabled,
  registerChoiceHandler,
  registerDialogStartHandler,
  setDialogOptionEnabled,
  startDialog,
} from './dialogs.js';
import {
  registerCharacterAnyItemHandler,
  registerCharacterVerbHandler,
  registerCharacterVerbItemHandler,
  registerFallbackAnyVerb,
  registerFallbackItemUnhandled,
  registerFallbackUnhandled,
  registerFallbackVerb,
  registerFallbackVerbItem,
  type FallbackTarget,
  type ItemHandlerOptions,
} from './globalHandlers.js';
import {
  guiRuntime,
  registerGuiChange,
  registerGuiActivate,
  registerGuiAnyClick,
  registerGuiClick,
  registerGuiHover,
  registerGuiLifecycleHandler,
  registerGuiSelect,
  registerGuiSubmit,
  setGuiVisible,
  tweenControl,
} from './guis.js';
import { endHandler } from './interactionContext.js';
import {
  registerItemAnyComboHandler,
  registerItemComboHandler,
  registerItemVerbHandler,
} from './itemHandlers.js';
import {
  lookupRoomHandle,
  registerCharacterHandle,
  registerItemHandle,
  registerRoomHandle,
  registerVerbHandle,
} from './registry.js';
import {
  registerAnyItemHandler,
  registerRegionHandler,
  registerRoomLifecycleHandler,
  registerVerbHandler,
  registerVerbItemHandler,
  type TargetKind,
} from './roomHandlers.js';
import { Task, timed } from './task.js';

/**
 * Handle objects for content. The handle generator (`scripts/lib/generateGameHandles.mjs`) creates
 * them in `@game` and the per-room / dialog / GUI `.ids` modules (§7). The engine knows no verb
 * names: handles are generic over the game's `VerbId`, and the generated modules add the per-verb
 * methods (`onLook`, `onUseItem`, …) with {@link withVerbMethods} (§8.4).
 */

/** A handler body as the author writes it. The transform makes it async. */
export type StepHandler = () => void;

export type { FallbackTarget, ItemHandlerOptions };

function verbList<V extends string>(verbs: V | readonly V[]): readonly V[] {
  return typeof verbs === 'string' ? [verbs] : verbs;
}

// ─── Clickables ──────────────────────────────────────────────────────────────

/**
 * A prop, hotspot or character: things the player clicks. Room `.ids` modules create them with
 * their room id; `characters.x` in `@game` has none, so its handlers belong to the character
 * script and apply wherever the character is spawned (§4.9).
 */
export class ClickableHandle<V extends string = string> {
  readonly roomId: string | null;
  readonly kind: TargetKind;
  /** The content ID from the room or character JSON. */
  readonly id: string;

  constructor(roomId: string | null, kind: TargetKind, id: string) {
    this.roomId = roomId;
    this.kind = kind;
    this.id = id;
  }

  /** One handler for one or several verbs (`door.on(['open', 'use'], …)`). */
  on(verbs: V | readonly V[], handler: StepHandler): void {
    for (const verb of verbList(verbs)) {
      if (this.roomId == null) {
        registerCharacterVerbHandler(this.id, verb, handler);
      } else {
        registerVerbHandler(this.roomId, this, verb, handler);
      }
    }
  }

  /**
   * `verb` with `item` on this target. Generated item-verb methods (`onUseItem`) call this.
   * `{ doNotClear: true }` keeps the item armed afterwards, whatever the drop policy says.
   */
  onVerbItem(verb: V, item: ItemRef, handler: StepHandler, options?: ItemHandlerOptions): void {
    if (this.roomId == null) {
      registerCharacterVerbItemHandler(this.id, verb, item.id, handler, options);
    } else {
      registerVerbItemHandler(this.roomId, this, verb, item.id, handler, options);
    }
  }

  /** `item` with any item verb on this target. */
  onItem(item: ItemRef, handler: StepHandler, options?: ItemHandlerOptions): void {
    if (this.roomId == null) {
      registerCharacterVerbItemHandler(this.id, null, item.id, handler, options);
    } else {
      registerVerbItemHandler(this.roomId, this, null, item.id, handler, options);
    }
  }

  /**
   * Any item without a handler of its own, any item verb, on this target. On `characters.x` (a
   * character script) it applies in every room, after the room's own item handlers.
   */
  onAnyItem(handler: (item: ItemRef, verb: { readonly id: V }) => void, options?: ItemHandlerOptions): void {
    if (this.roomId == null) {
      registerCharacterAnyItemHandler(this.id, handler, options);
    } else {
      registerAnyItemHandler(this.roomId, this, handler, options);
    }
  }
}

/** Starts a tween on a prop's position, persisting each step through `movePropToNow`. */
function slidePropTask(propId: string, to: Point2, seconds: number): Task {
  const scene = roomFor('slideTo');
  const sprite = scene?.getPropSprite(propId);
  if (!scene || !sprite) {
    return Task.resolved();
  }
  const tight = sprite.getData('benneRoomPropPlacement') === 'tight';
  const from = {
    x: tight ? (sprite.getData('benneRoomPropAuthoredX') as number) : sprite.x,
    y: tight ? (sprite.getData('benneRoomPropAuthoredY') as number) : sprite.y,
  };
  if (seconds <= 0 || scene.isCutsceneSkipFastForwarding()) {
    scene.movePropToNow(propId, to);
    return Task.resolved();
  }
  let tween: Phaser.Tweens.Tween | null = null;
  const end = () => scene.movePropToNow(propId, to);
  const done = new Promise<void>((resolve) => {
    const pos = { ...from };
    tween = scene.tweens.add({
      targets: pos,
      x: to.x,
      y: to.y,
      duration: seconds * 1000,
      ease: 'Sine.easeInOut',
      onUpdate: () => scene.movePropToNow(propId, pos),
      onComplete: () => {
        end();
        resolve();
      },
    });
  });
  return new Task(done, {
    finishNow: () => {
      tween?.stop();
      end();
    },
    cancel: () => tween?.stop(),
  });
}

/**
 * The active room scene when it is `roomId` (a prop's or hotspot's own room). With `warnAs`, warns
 * (DEV, once) when it isn't.
 */
function ownRoomScene(roomId: string | null, warnAs?: string): RoomScene | undefined {
  const scene = activeRoomScene();
  if (scene && scene.getCurrentRoomId() === roomId) {
    return scene;
  }
  if (warnAs) {
    warnOnce(`${warnAs}:other-room`, `${warnAs}: only works in room "${roomId}" — ignored.`);
  }
  return undefined;
}

/**
 * What a prop is in its room JSON, for reading it from another room. The generator passes the
 * fields that differ from the defaults (shown, not clickable, opaque, no description, tag = ID).
 */
export interface PropDefaults {
  readonly visible?: boolean;
  readonly clickable?: boolean;
  readonly alpha?: number;
  readonly description?: string;
  readonly tag?: string;
}

/** What a hotspot is in its room JSON (see {@link PropDefaults}): active, no description by default. */
export interface HotspotDefaults {
  readonly active?: boolean;
  readonly description?: string;
}

/**
 * A prop. Its state lives in its own room: in that room, reads and writes go through the scene;
 * from anywhere else they read and write the room's saved state, which the room applies when it
 * loads. Actions that need the sprite (`play`) only work in the prop's room.
 */
export class PropHandle<V extends string = string, Anim extends string = string> extends ClickableHandle<V> {
  private readonly authored: PropDefaults;

  constructor(roomId: string, id: string, authored: PropDefaults = {}) {
    super(roomId, 'prop', id);
    this.authored = authored;
  }

  /** Hidden props aren't drawn or clickable. Instant, saved. */
  get visible(): boolean {
    const scene = this.ownRoom();
    return readLiveOrSaved(
      scene && (() => scene.getPropScriptVisible(this.id)),
      (m) => readSavedPropVisible(m, this.roomId!, this.id, this.authored.visible !== false),
      this.authored.visible !== false,
    );
  }

  set visible(value: boolean) {
    const scene = this.ownRoom();
    writeLiveOrSaved(
      `${this.id}.visible`,
      scene && (() => scene.setPropScriptVisible(this.id, value)),
      (m) => writeSavedPropVisible(m, this.roomId!, this.id, value),
    );
  }

  /** Same as `visible = false`. */
  hide(): void {
    this.visible = false;
  }

  /** Same as `visible = true`. */
  show(): void {
    this.visible = true;
  }

  /** When false, the prop can't be hovered or clicked. Saved. */
  get clickable(): boolean {
    const scene = this.ownRoom();
    return readLiveOrSaved(
      scene && (() => scene.getPropScriptClickable(this.id)),
      (m) => readSavedPropClickable(m, this.roomId!, this.id, this.authored.clickable === true),
      this.authored.clickable === true,
    );
  }

  set clickable(value: boolean) {
    const scene = this.ownRoom();
    writeLiveOrSaved(
      `${this.id}.clickable`,
      scene && (() => scene.setPropScriptClickable(this.id, value)),
      (m) => writeSavedPropClickable(m, this.roomId!, this.id, value),
    );
  }

  /** The hover / verb-line name. Saved. */
  get description(): string {
    const scene = this.ownRoom();
    return readLiveOrSaved(
      scene && (() => scene.getPropScriptDescription(this.id)),
      (m) => readSavedPropDescription(m, this.roomId!, this.id, this.authored.description ?? ''),
      this.authored.description ?? '',
    );
  }

  set description(value: string) {
    const scene = this.ownRoom();
    writeLiveOrSaved(
      `${this.id}.description`,
      scene && (() => scene.setPropScriptDescription(this.id, value)),
      (m) => writeSavedPropDescription(m, this.roomId!, this.id, value),
    );
  }

  /**
   * The prop's base (looping) animation tag. Setting it is instant and saved (§4.10). From another
   * room the tag is saved without checking it (the room's sheet isn't loaded).
   */
  get animation(): Anim {
    const scene = this.ownRoom();
    const authored = this.authored.tag ?? this.id;
    return readLiveOrSaved(
      scene && (() => scene.getPropScriptBaseAnimationTag(this.id)),
      (m) => readSavedPropBaseAnimationTag(m, this.roomId!, this.id, authored),
      authored,
    ) as Anim;
  }

  set animation(tag: Anim) {
    const scene = this.ownRoom();
    writeLiveOrSaved(
      `${this.id}.animation`,
      scene && (() => scene.setPropScriptBaseAnimationTag(this.id, tag)),
      (m) => writeSavedPropBaseAnimationTag(m, this.roomId!, this.id, tag),
    );
  }

  /** One-shot animation; waits for it to finish, then returns to the base animation. Its room only. */
  readonly play = timed((tag: Anim): Task => {
    const scene = this.ownRoom(`${this.id}.play`);
    return scene ? new Task(scene.playPropScriptAnimationOneShot(this.id, tag)) : Task.resolved();
  });

  /** Fades to `alpha` (0–1) over `seconds`. Waits. The end alpha is saved; from another room, at once. */
  readonly fade = timed((alpha: number, seconds: number): Task => {
    const scene = this.ownRoom();
    if (!scene) {
      this.alpha = alpha;
      return Task.resolved();
    }
    const from = scene.getPropSprite(this.id)?.alpha ?? 1;
    return new Task(scene.fadePropScriptAlpha(this.id, from, alpha, seconds));
  });

  /**
   * Opacity, 0–1. Setting it is instant (it stops a running `fade`) and saved. Outside the prop's
   * room it reads and writes the saved value (the room JSON's when none is saved).
   */
  get alpha(): number {
    const sprite = this.ownRoom()?.getPropSprite(this.id);
    const authored = this.authored.alpha ?? 1;
    return readLiveOrSaved(
      sprite && (() => sprite.alpha),
      (m) => readSavedPropAlpha(m, this.roomId!, this.id, authored),
      authored,
    );
  }

  set alpha(value: number) {
    const scene = this.ownRoom();
    writeLiveOrSaved(
      `${this.id}.alpha`,
      scene && (() => void scene.fadePropScriptAlpha(this.id, value, value, 0)),
      (m) => writeSavedPropAlpha(m, this.roomId!, this.id, value),
    );
  }

  /** Teleports to room pixels (instant). From another room, the position is saved for it. */
  moveTo(point: Point2): void {
    const scene = this.ownRoom();
    writeLiveOrSaved(
      `${this.id}.moveTo`,
      scene && (() => scene.movePropToNow(this.id, point)),
      (m) => writeSavedPropPosition(m, this.roomId!, this.id, point),
    );
  }

  /** Moves to room pixels over `seconds`. Waits. From another room, it moves there at once. */
  readonly slideTo = timed((point: Point2, seconds: number): Task => {
    if (!this.ownRoom()) {
      this.moveTo(point);
      return Task.resolved();
    }
    return slidePropTask(this.id, point, seconds);
  });

  /**
   * The active room scene when it is this prop's room. With `warnAs`, warns (DEV, once) when it
   * isn't, for actions that can't be saved for later.
   */
  private ownRoom(warnAs?: string): RoomScene | undefined {
    return ownRoomScene(this.roomId, warnAs);
  }
}

/**
 * A hotspot. Like a prop, its state lives in its own room: from another room, reads and writes go
 * to that room's saved state.
 */
export class HotspotHandle<V extends string = string> extends ClickableHandle<V> {
  private readonly authored: HotspotDefaults;

  constructor(roomId: string, id: string, authored: HotspotDefaults = {}) {
    super(roomId, 'hotspot', id);
    this.authored = authored;
  }

  /** When false, the hotspot can't be hovered or clicked. Saved. */
  get active(): boolean {
    const scene = ownRoomScene(this.roomId);
    return readLiveOrSaved(
      scene && (() => scene.getHotspotScriptActive(this.id)),
      (m) => readSavedHotspotActive(m, this.roomId!, this.id, this.authored.active !== false),
      this.authored.active !== false,
    );
  }

  set active(value: boolean) {
    const scene = ownRoomScene(this.roomId);
    writeLiveOrSaved(
      `${this.id}.active`,
      scene && (() => scene.setHotspotScriptActive(this.id, value)),
      (m) => writeSavedHotspotActive(m, this.roomId!, this.id, value),
    );
  }

  /** Same as {@link active}. */
  get clickable(): boolean {
    return this.active;
  }

  set clickable(value: boolean) {
    this.active = value;
  }

  /** The hover / verb-line name. Saved. */
  get description(): string {
    const scene = ownRoomScene(this.roomId);
    return readLiveOrSaved(
      scene && (() => scene.getHotspotScriptDescription(this.id)),
      (m) => readSavedHotspotDescription(m, this.roomId!, this.id, this.authored.description ?? ''),
      this.authored.description ?? '',
    );
  }

  set description(value: string) {
    const scene = ownRoomScene(this.roomId);
    writeLiveOrSaved(
      `${this.id}.description`,
      scene && (() => scene.setHotspotScriptDescription(this.id, value)),
      (m) => writeSavedHotspotDescription(m, this.roomId!, this.id, value),
    );
  }
}

export class CharacterHandle<V extends string = string, Anim extends string = string> extends ClickableHandle<V> {
  constructor(roomId: string | null, id: string) {
    super(roomId, 'character', id);
    registerCharacterHandle(roomId, this);
  }

  /** True when this is the character the player controls. */
  get isPlayer(): boolean {
    const scene = activeRoomScene();
    const playerId = scene?.getActivePlayerCharacterId() ?? tryGetActiveGameStateManager()?.getActivePlayerCharacterId();
    return playerId === this.id;
  }

  /** One speech line from this character. Waits; `.now` doesn't. Same as a `Name: "…"` label. */
  readonly say = timed((text: string, options?: ScriptedSayLineOptions): Task => sayTask(this.id, text, options));

  /** Walks to a point, a named point or a thing's walk-to point. Waits; `.now` doesn't. */
  readonly walkTo = timed((target: WalkTarget): Task => walkCharacterTask(this.id, target));

  /** Teleports (instant). */
  moveTo(target: WalkTarget): void {
    characterOps.moveTo(this.id, target);
  }

  /** Stops a walk where the character is now. */
  stopWalking(): void {
    characterOps.stopWalking(this.id);
  }

  /** Feet position in room pixels. */
  get position(): Point2 {
    return characterOps.position(this.id);
  }

  /** Turns to `'U'`, `'D'`, `'L'` or `'R'` (completions insert the quotes). Waits for the turn; `.now` doesn't. */
  readonly face = timed((direction: CharacterFacingLetter): Task => faceCharacterTask(this.id, direction));

  /** The direction the character faces. Read it in `onUpdate`, where `face` can't start (§4.18). */
  get facing(): CharacterFacingLetter {
    return characterOps.facing(this.id);
  }

  /** One-shot animation; waits for it to finish, then returns to the base animation. */
  readonly play = timed((tag: Anim): Task => characterOps.play(this.id, tag));

  /** Fades to `alpha` (0–1) over `seconds`. Waits. */
  readonly fade = timed((alpha: number, seconds: number): Task => characterOps.fade(this.id, alpha, seconds));

  /** Opacity, 0–1. Setting it is instant (it stops a running `fade`) and saved. */
  get alpha(): number {
    return characterOps.getAlpha(this.id);
  }

  set alpha(value: number) {
    characterOps.setAlpha(this.id, value);
  }

  /** Animation override (instant, saved); the effective animation when read (§4.10). */
  get animation(): Anim {
    return characterOps.getAnimation(this.id) as Anim;
  }

  set animation(tag: Anim) {
    characterOps.setAnimation(this.id, tag);
  }

  /** Back to directional idle. */
  stopAnimation(): void {
    characterOps.stopAnimation(this.id);
  }

  /** Hidden characters aren't drawn or clickable. Instant, saved. */
  get visible(): boolean {
    return characterOps.getVisible(this.id);
  }

  set visible(value: boolean) {
    characterOps.setVisible(this.id, value);
  }

  /** Same as `visible = true`. */
  show(): void {
    this.visible = true;
  }

  /** Same as `visible = false`. */
  hide(): void {
    this.visible = false;
  }

  /** When false, walks are ignored; `moveTo` still works. Saved. */
  get movable(): boolean {
    return characterOps.getMovable(this.id);
  }

  set movable(value: boolean) {
    characterOps.setMovable(this.id, value);
  }

  /** When false, the character can't be hovered or clicked. Saved. */
  get clickable(): boolean {
    return characterOps.getClickable(this.id);
  }

  set clickable(value: boolean) {
    characterOps.setClickable(this.id, value);
  }

  /** The hover / verb-line name. Saved. */
  get description(): string {
    return characterOps.getDescription(this.id);
  }

  set description(value: string) {
    characterOps.setDescription(this.id, value);
  }

  /** Follows `target` (another character, or the player by default) around the room. Saved. */
  startFollowing(target?: { readonly id: string }, options?: CharacterFollowOptions): void {
    characterOps.startFollowing(this.id, target ?? null, options);
  }

  /** Stops following (`startFollowing`). */
  stopFollowing(): void {
    characterOps.stopFollowing(this.id);
  }

  /**
   * Keeps turning to face `target` (the player by default) whenever either of them moves, after a
   * short random delay. Not saved. Use it for "keep looking at", which `face` in `onUpdate` can't do.
   */
  startFacing(target?: { readonly id: string }, options?: FacingOptions): void {
    characterOps.startFacing(this.id, target ?? null, options);
  }

  /** Stops turning toward its target (`startFacing`). */
  stopFacing(): void {
    characterOps.stopFacing(this.id);
  }

  /** True while following someone (`startFollowing`). */
  get isFollowing(): boolean {
    return characterOps.followingTarget(this.id) != null;
  }

  /** The character (or `player`) being followed, or `null`. */
  get followingTarget(): { readonly id: string } | null {
    return characterOps.followingTarget(this.id);
  }

  /**
   * Where this character's speech lines appear, in room pixels (bottom centre), instead of above
   * its talk point. `null` goes back to the talk point. Saved.
   */
  get speechPosition(): Point2 | null {
    return characterOps.getSpeechPoint(this.id, 'position');
  }

  set speechPosition(point: Point2 | null) {
    characterOps.setSpeechPoint(this.id, 'position', point);
  }

  /** Extra offset of this character's speech lines, in game canvas pixels. `null` clears it. Saved. */
  get speechOffset(): Point2 | null {
    return characterOps.getSpeechPoint(this.id, 'offset');
  }

  set speechOffset(offset: Point2 | null) {
    characterOps.setSpeechPoint(this.id, 'offset', offset);
  }

  /** Clears both {@link speechPosition} and {@link speechOffset}. */
  resetSpeechPosition(): void {
    characterOps.resetSpeechPosition(this.id);
  }

  /** This character's own bag (§4.6). */
  get inventory(): Inventory {
    return inventoryOf(this.id);
  }
}

/** A verb from `game-config.json`, as the generator writes it into `@game` (§8.2). */
export interface VerbSpec<V extends string = string> {
  readonly id: V;
  readonly label: string;
  readonly preposition: string | null;
  /** Arms the selected inventory item and is used on a target (decision 7). */
  readonly usesItem: boolean;
  /** `on<Verb>` */
  readonly method: string;
  /** `on<Verb>Item`, for `usesItem` verbs. */
  readonly itemMethod: string | null;
}

/** What {@link withVerbMethods} needs: the generic registration methods every verb method forwards to. */
interface VerbRegistrar {
  on(verb: string, handler: StepHandler): void;
  onVerbItem(verb: string, ...args: never[]): void;
  /** Items only: `on<Verb>.doNotActivate(…)` for item verbs (§4.6). */
  onWithoutArming?(verb: string, handler: StepHandler): void;
}

/**
 * Adds `on<Verb>` (and `on<Verb>Item` for item verbs) for each configured verb (§8.2). The method
 * names come from the generator, so the engine and the generated types can't disagree. On item
 * handles, item verbs also get `on<Verb>.doNotActivate(…)`.
 */
export function withVerbMethods<H, M>(handle: H, verbs: readonly VerbSpec[]): H & M {
  const target = handle as unknown as VerbRegistrar;
  const methods: Record<string, unknown> = {};
  for (const verb of verbs) {
    const on = (handler: StepHandler) => target.on(verb.id, handler);
    methods[verb.method] =
      verb.usesItem && target.onWithoutArming
        ? Object.assign(on, { doNotActivate: (handler: StepHandler) => target.onWithoutArming!(verb.id, handler) })
        : on;
    if (verb.itemMethod) {
      methods[verb.itemMethod] = (...args: never[]) => target.onVerbItem(verb.id, ...args);
    }
  }
  return Object.assign(handle as object, methods) as H & M;
}

/** A verb, as `verbs.<id>` in `@game`. */
export class VerbHandle<V extends string = string> {
  /** The verb's ID in `game-config.json`. */
  readonly id: V;
  /** The verb bar's text (`'Look at'`). */
  readonly label: string;
  /** `'with'` in "Use knife with bread", or `null`. */
  readonly preposition: string | null;
  /** True for verbs that use an inventory item on a target (`usesItem` in the config). */
  readonly usesItem: boolean;

  constructor(spec: VerbSpec<V>) {
    this.id = spec.id;
    this.label = spec.label;
    this.preposition = spec.preposition;
    this.usesItem = spec.usesItem;
    registerVerbHandle(this);
  }

  /** Makes this the active verb, as clicking its button in a verb bar does. */
  select(): void {
    const m = tryGetActiveGameStateManager();
    if (!m) {
      warnOnce('verb:select', `verbs.${this.id}.select(): the game is not running — ignored.`);
      return;
    }
    m.setActiveVerb(this.id);
  }

  /** True while this is the armed verb. */
  get isActive(): boolean {
    return tryGetActiveGameStateManager()?.getActiveVerb() === this.id;
  }
}

/** `fallbacks` in `@game`: global handlers for verbs nothing else handled (§4.17). */
export class FallbacksHandle<V extends string = string> {
  /** Fallback for one verb. The generated `fallbacks.on<Verb>` methods call this. */
  on(verb: V, handler: StepHandler): void {
    registerFallbackVerb(verb, handler);
  }

  /** Fallback for one item verb. The generated `fallbacks.on<Verb>Item` methods call this. */
  onVerbItem(verb: V, handler: (item: ItemRef, target: FallbackTarget) => void): void {
    registerFallbackVerbItem(verb, handler);
  }

  /** Any verb nothing else handled, when it has no `on<Verb>` fallback. */
  onAnyVerb(handler: StepHandler): void {
    registerFallbackAnyVerb(handler);
  }

  /** Any item use nothing else handled, when its verb has no `on<Verb>Item` fallback. */
  onItemUnhandled(handler: (item: ItemRef, target: FallbackTarget) => void): void {
    registerFallbackItemUnhandled(handler);
  }

  /**
   * The last tier: a verb nothing handled, not even {@link onAnyVerb}. Handy as a DEV diagnostic
   * (`if (import.meta.env.DEV) console.info(…)`).
   */
  onUnhandled(handler: (verb: { readonly id: V }, target: FallbackTarget) => void): void {
    registerFallbackUnhandled(handler);
  }
}

// ─── Room places ─────────────────────────────────────────────────────────────

/** A named point in a room (`points.x`): a walk target. */
export class PointHandle {
  readonly roomId: string;
  /** The point's ID in the room JSON. */
  readonly id: string;

  constructor(roomId: string, id: string) {
    this.roomId = roomId;
    this.id = id;
  }
}

/** What a region or walkable polygon is in its room JSON (see {@link PropDefaults}): active by default. */
export interface PlaceDefaults {
  readonly active?: boolean;
}

/**
 * A region in a room (`regions.x`). Like a prop, its state lives in its own room: from another
 * room, `active` reads and writes that room's saved state.
 */
export class RegionHandle {
  readonly roomId: string;
  /** The region's ID in the room JSON. */
  readonly id: string;
  private readonly authored: PlaceDefaults;

  constructor(roomId: string, id: string, authored: PlaceDefaults = {}) {
    this.roomId = roomId;
    this.id = id;
    this.authored = authored;
  }

  /** Runs when a character's feet enter the region. `who` is that character's handle. */
  onEnter(handler: (who: CharacterHandle) => void): void {
    registerRegionHandler(this.roomId, this.id, false, handler);
  }

  /** Runs when a character's feet leave the region. */
  onExit(handler: (who: CharacterHandle) => void): void {
    registerRegionHandler(this.roomId, this.id, true, handler);
  }

  /** Inactive regions don't fire and don't block walking. Saved. */
  get active(): boolean {
    const scene = ownRoomScene(this.roomId);
    return readLiveOrSaved(
      scene && (() => scene.getRegionScriptActive(this.id)),
      (m) => readSavedRegionActive(m, this.roomId, this.id, this.authored.active !== false),
      this.authored.active !== false,
    );
  }

  set active(value: boolean) {
    const scene = ownRoomScene(this.roomId);
    writeLiveOrSaved(
      `regions.${this.id}.active`,
      scene && (() => scene.setRegionScriptActive(this.id, value)),
      (m) => writeSavedRegionActive(m, this.roomId, this.id, value),
    );
  }
}

/**
 * A walkable polygon in a room (`walkables.x`). Like a region, its state lives in its own room:
 * from another room, `active` reads and writes that room's saved state.
 */
export class WalkableHandle {
  readonly roomId: string;
  /** The walkable polygon's ID in the room JSON. */
  readonly id: string;
  private readonly authored: PlaceDefaults;

  constructor(roomId: string, id: string, authored: PlaceDefaults = {}) {
    this.roomId = roomId;
    this.id = id;
    this.authored = authored;
  }

  /** Inactive walkable polygons can't be walked on. Saved. */
  get active(): boolean {
    const scene = ownRoomScene(this.roomId);
    return readLiveOrSaved(
      scene && (() => scene.getWalkableScriptActive(this.id)),
      (m) => readSavedWalkableActive(m, this.roomId, this.id, this.authored.active !== false),
      this.authored.active !== false,
    );
  }

  set active(value: boolean) {
    const scene = ownRoomScene(this.roomId);
    writeLiveOrSaved(
      `walkables.${this.id}.active`,
      scene && (() => scene.setWalkableScriptActive(this.id, value)),
      (m) => writeSavedWalkableActive(m, this.roomId, this.id, value),
    );
  }
}

// ─── Rooms ───────────────────────────────────────────────────────────────────

export class RoomHandle {
  /** The room's ID (`'apartment'`). */
  readonly id: string;

  constructor(id: string) {
    this.id = id;
    registerRoomHandle(this);
  }

  /**
   * Before the fade-in: invisible setup. The fade-in waits for it. Like every enter hook it runs
   * as a cutscene; `{ skippable: false }` keeps ESC from skipping it.
   */
  onEnter(handler: StepHandler, options?: CutsceneOptions): void {
    registerRoomLifecycleHandler(this.id, 'enter', handler, options);
  }

  /** After the fade-in: visible entrances, cutscenes. `{ skippable: false }` keeps ESC from skipping it. */
  onEnterAfterFade(handler: StepHandler, options?: CutsceneOptions): void {
    registerRoomLifecycleHandler(this.id, 'enterAfterFade', handler, options);
  }

  /** Each time the player leaves this room, before the next room loads. */
  onLeave(handler: StepHandler): void {
    registerRoomLifecycleHandler(this.id, 'leave', handler);
  }

  /** When a save loads into this room. The enter hooks don't run on a load, so restore what they would have set up here. */
  onLoaded(handler: StepHandler): void {
    registerRoomLifecycleHandler(this.id, 'loaded', handler);
  }

  /** How many times the player has entered this room, including now. Settable (Play From). */
  get visitCount(): number {
    const m = tryGetActiveGameStateManager();
    return m ? getRoomVisitCount(m, this.id) : 0;
  }

  set visitCount(count: number) {
    const m = tryGetActiveGameStateManager();
    if (m) {
      setRoomVisitCount(m, this.id, count);
    }
  }

  /** True on the first visit (`visitCount === 1`). */
  get isFirstVisit(): boolean {
    return this.visitCount === 1;
  }

  /** True once the player has been here. */
  get hasVisited(): boolean {
    return this.visitCount > 0;
  }

  /**
   * The room the player was in before the current one (`null` at the start). Settable, for Play
   * From setups that pretend the player came from somewhere.
   */
  get last(): RoomHandle | null {
    return lookupRoomHandle<RoomHandle>(tryGetActiveGameStateManager()?.getLastRoom());
  }

  set last(room: RoomHandle | null) {
    tryGetActiveGameStateManager()?.setLastRoom(room?.id ?? null);
  }

  /** True when the player came here from `room`. */
  cameFrom(room: { readonly id: string }): boolean {
    return tryGetActiveGameStateManager()?.getLastRoom() === room.id;
  }

  /** Starts the transition to this room and ends the handler (§4.4). */
  goTo(): never {
    const orch = tryGetRoomTransitionOrchestrator();
    if (orch) {
      void orch.changeTo(this.id, false);
    } else {
      warnOnce('goTo:no-orchestrator', `rooms.${this.id}.goTo(): no room transitions here (preview?) — ignored.`);
    }
    return endHandler();
  }
}

// ─── Inventory items ─────────────────────────────────────────────────────────

/**
 * Writes an item's saved animation / cursor / description: through the active room, which also
 * refreshes the inventory GUI and cursor, else straight into the game state.
 */
function writeItemState(
  itemId: string,
  what: string,
  viaRoom: (scene: NonNullable<ReturnType<typeof activeRoomScene>>) => void,
  viaState: (m: NonNullable<ReturnType<typeof tryGetActiveGameStateManager>>) => void,
): void {
  const scene = activeRoomScene();
  if (scene) {
    viaRoom(scene);
    return;
  }
  const m = tryGetActiveGameStateManager();
  if (!getInventoryDefinition(itemId) || !m) {
    warnOnce(`items.${itemId}.${what}`, `items.${itemId}.${what}: unknown item or the game is not running — ignored.`);
    return;
  }
  viaState(m);
}

function setOrClearVariable(m: NonNullable<ReturnType<typeof tryGetActiveGameStateManager>>, key: string, tag: string): void {
  const t = tag.trim();
  if (t.length === 0) {
    m.clearVariable(key);
  } else {
    m.setVariable(key, t);
  }
}

export class ItemHandle<V extends string = string, Anim extends string = string> implements ItemRef {
  /** The item's ID in its JSON. */
  readonly id: string;

  constructor(id: string) {
    this.id = id;
    registerItemHandle(this);
  }

  /** The item's display name from its JSON. */
  get name(): string {
    return getInventoryDefinition(this.id)?.name ?? this.id;
  }

  /** The item's icon animation. Setting it is instant and saved. */
  get animation(): Anim {
    const def = getInventoryDefinition(this.id);
    const m = tryGetActiveGameStateManager();
    if (!def) {
      return '' as Anim;
    }
    return (m ? readEffectiveInventoryDefaultAnimationTag(m, def) : (def.defaultAnimation ?? '')) as Anim;
  }

  set animation(tag: Anim) {
    writeItemState(
      this.id,
      'animation',
      (scene) => scene.setInventoryScriptDefaultAnimationTag(this.id, tag),
      (m) => setOrClearVariable(m, inventoryDefaultAnimationVariableKey(this.id), tag),
    );
  }

  /** The cursor animation while this item is armed. Setting it is instant and saved. */
  get cursorAnimation(): string {
    const def = getInventoryDefinition(this.id);
    const m = tryGetActiveGameStateManager();
    if (!def) {
      return '';
    }
    return m ? (readEffectiveInventoryCursorAnimationTag(m, def) ?? '') : (def.cursorAnimation?.trim() ?? '');
  }

  set cursorAnimation(tag: string) {
    writeItemState(
      this.id,
      'cursorAnimation',
      (scene) => scene.setInventoryScriptCursorAnimationTag(this.id, tag),
      (m) => setOrClearVariable(m, inventoryCursorAnimationVariableKey(this.id), tag),
    );
  }

  /** The hover / verb-line name. Saved. */
  get description(): string {
    const def = getInventoryDefinition(this.id);
    const m = tryGetActiveGameStateManager();
    if (!def) {
      return '';
    }
    return m ? readEffectiveInventoryDescription(m, def) : (def.description ?? '');
  }

  set description(value: string) {
    writeItemState(
      this.id,
      'description',
      (scene) => scene.setInventoryScriptDescription(this.id, value),
      (m) => writeSavedInventoryDescription(m, this.id, value),
    );
  }

  /** `verb` used on this item's inventory row. Generated verb methods (`onLook`) call this. */
  on(verbs: V | readonly V[], handler: StepHandler): void {
    for (const verb of verbList(verbs)) {
      registerItemVerbHandler(this.id, verb, handler);
    }
  }

  /** Item verbs only: like {@link on}, but the item is not armed afterwards (`onUse.doNotActivate`). */
  onWithoutArming(verb: V, handler: StepHandler): void {
    registerItemVerbHandler(this.id, verb, handler, false);
  }

  /**
   * `verb` with another item on this one. Generated item-verb methods (`onUseItem`) call this.
   * `{ doNotClear: true }` keeps the other item armed afterwards, whatever the drop policy says.
   */
  onVerbItem(verb: V, item: ItemRef, handler: StepHandler, options?: ItemHandlerOptions): void {
    registerItemComboHandler(this.id, verb, item.id, handler, options);
  }

  /** Any item verb with `item` on this one. */
  onItem(item: ItemRef, handler: StepHandler, options?: ItemHandlerOptions): void {
    registerItemComboHandler(this.id, null, item.id, handler, options);
  }

  /** Same as {@link onItem}; reads better for item-on-item (decision 9). */
  onCombine(item: ItemRef, handler: StepHandler, options?: ItemHandlerOptions): void {
    this.onItem(item, handler, options);
  }

  /** Any other item without a handler of its own, any item verb, on this one. */
  onAnyItem(handler: (item: ItemRef, verb: { readonly id: V }) => void, options?: ItemHandlerOptions): void {
    registerItemAnyComboHandler(this.id, handler, options);
  }
}

// ─── Dialogs ─────────────────────────────────────────────────────────────────

export class DialogOptionHandle {
  readonly dialogId: string;
  /** The option's ID in the dialog JSON. */
  readonly id: string;

  constructor(dialogId: string, id: string) {
    this.dialogId = dialogId;
    this.id = id;
  }

  /** Shows the option in the choice list. Saved. */
  on(): void {
    setDialogOptionEnabled(this.dialogId, this.id, true);
  }

  /** Hides the option from the choice list. Saved. */
  off(): void {
    setDialogOptionEnabled(this.dialogId, this.id, false);
  }

  /** True while the option is shown. */
  get enabled(): boolean {
    return isDialogOptionEnabled(this.dialogId, this.id);
  }

  /** Runs when the player chooses this option, after the player says its text. */
  onChoose(handler: StepHandler): void {
    registerChoiceHandler(this.dialogId, this.id, handler, false);
  }

  /** Same as {@link onChoose}, and turns the option off once chosen. */
  onChooseOnce(handler: StepHandler): void {
    registerChoiceHandler(this.dialogId, this.id, handler, true);
  }
}

export class DialogHandle<Options extends Record<string, string> = Record<string, string>> {
  /** The dialog's ID. */
  readonly id: string;
  /** This dialog's options by handle name (`dialogs.chatwithpenny.options.greeting`). */
  readonly options: { readonly [K in keyof Options]: DialogOptionHandle };

  /** `options` maps handle names to option ids (`{ whatAboutTheKey: 'what about the key' }`). */
  constructor(id: string, options: Options) {
    this.id = id;
    const handles: Record<string, DialogOptionHandle> = {};
    for (const [name, optionId] of Object.entries(options)) {
      handles[name] = new DialogOptionHandle(id, optionId);
    }
    this.options = handles as { readonly [K in keyof Options]: DialogOptionHandle };
  }

  /**
   * Opens the conversation and waits until it ends (decision 3). Started from a choice handler, it
   * is a sub-dialog: its parent comes back when it ends. `.now` opens it without waiting.
   */
  readonly start = timed((): Task => startDialog(this.id));

  /** Ends this conversation (back to the parent, if it is a sub-dialog) and ends the handler. */
  end(): never {
    return endDialog(this.id);
  }

  /** Runs each time the conversation opens, before the player picks: set up which options show. */
  onStart(handler: StepHandler): void {
    registerDialogStartHandler(this.id, handler);
  }
}

// ─── GUIs ────────────────────────────────────────────────────────────────────

/** A GUI control (`guis.x.controls.y`, or flat in the GUI's own `.ids` module). */
export class GuiControlHandle {
  readonly guiId: string;
  /** The control's ID in the GUI JSON. */
  readonly id: string;
  private readonly resolve: () => ControlFacade | null;

  /** `controlId` `null` is the GUI's whole packed content (`gui.root`). */
  constructor(guiId: string, controlId: string | null) {
    this.guiId = guiId;
    this.id = controlId ?? '';
    this.resolve = () => {
      const rt = guiRuntime(guiId);
      const c = (controlId == null ? rt?.root : rt?.getControl(controlId)) ?? null;
      // A room being left has destroyed its GUI objects (a destroyed object has no scene).
      return c?.gameObject.scene ? c : null;
    };
  }

  private control(what: string): ControlFacade | null {
    const c = this.resolve();
    const game = tryGetActiveBenneGame();
    if (!c && !(game && isRoomTransitionInProgress(game))) {
      warnOnce(`gui:${this.guiId}:${this.id}:${what}`, `guis.${this.guiId} control "${this.id}".${what}: not in the active room — ignored.`);
    }
    return c;
  }

  private get object(): (Phaser.GameObjects.GameObject & Record<string, unknown>) | null {
    return (this.resolve()?.gameObject as Phaser.GameObjects.GameObject & Record<string, unknown>) ?? null;
  }

  /** Text controls: the shown text. */
  get text(): string {
    return this.resolve()?.text ?? '';
  }

  set text(value: string) {
    const c = this.control('text');
    if (c) {
      c.text = value;
    }
  }

  /** Opacity, 0–1. Instant. */
  get alpha(): number {
    return (this.object?.alpha as number | undefined) ?? 1;
  }

  set alpha(value: number) {
    this.control('alpha')?.setAlpha(value);
  }

  /** Whether the control is shown. Instant. */
  get visible(): boolean {
    return (this.object?.visible as boolean | undefined) ?? false;
  }

  set visible(value: boolean) {
    this.control('visible')?.setVisible(value);
  }

  /** Position in GUI pixels. Instant. */
  get x(): number {
    return (this.object?.x as number | undefined) ?? 0;
  }

  set x(value: number) {
    this.control('x')?.setX(value);
  }

  /** Position in GUI pixels. Instant. */
  get y(): number {
    return (this.object?.y as number | undefined) ?? 0;
  }

  set y(value: number) {
    this.control('y')?.setY(value);
  }

  /** Buttons, text inputs and checkboxes. A disabled control ignores the pointer and looks disabled. */
  get enabled(): boolean {
    return this.resolve()?.enabled ?? false;
  }

  set enabled(value: boolean) {
    const c = this.control('enabled');
    if (c) {
      c.enabled = value;
    }
  }

  /** Sliders. Setting it doesn't fire `onChange`. */
  get value(): number {
    return this.resolve()?.value ?? 0;
  }

  set value(value: number) {
    this.control('value')?.setValue(value);
  }

  /** Checkboxes. Setting it doesn't fire `onChange`. */
  get checked(): boolean {
    return this.resolve()?.checked ?? false;
  }

  set checked(value: boolean) {
    const c = this.control('checked');
    if (c) {
      c.checked = value;
    }
  }

  /** List boxes. */
  get selectedIndex(): number {
    return this.resolve()?.selectedIndex ?? -1;
  }

  set selectedIndex(index: number) {
    const c = this.control('selectedIndex');
    if (c) {
      c.selectedIndex = index;
    }
  }

  /** List boxes. */
  setRowText(index: number, text: string): void {
    this.control('setRowText')?.setRowText(index, text);
  }

  /** List boxes: how many rows the list has. */
  get rowCount(): number {
    return this.resolve()?.rowCount ?? 0;
  }

  /** Text inputs: whether the input has the keyboard. Setting it focuses or blurs it. */
  get focused(): boolean {
    return this.resolve()?.focused ?? false;
  }

  set focused(value: boolean) {
    const c = this.control('focused');
    if (c) {
      c.focused = value;
    }
  }

  /** Buttons: force `'normal'`, `'hover'`, `'pressed'` or `'disabled'` looks. `'normal'` gives control back to the pointer. */
  set visualState(state: string) {
    this.control('visualState')?.setVisualState(state);
  }

  /** Fades to `alpha` over `seconds`. Waits. With `clickToSkip`, a click finishes it at once. */
  readonly fadeTo = timed((alpha: number, seconds: number, options: { clickToSkip?: boolean } = {}): Task => {
    const c = this.control('fadeTo');
    return c ? tweenControl(c, { alpha }, seconds, options) : Task.resolved();
  });

  /** Tweens numeric properties (`{ y: -800 }`) over `seconds`. Waits. */
  readonly tweenTo = timed(
    (props: Record<string, number>, seconds: number, ease?: string, options: { clickToSkip?: boolean } = {}): Task => {
      const c = this.control('tweenTo');
      return c ? tweenControl(c, props, seconds, { ...options, ease }) : Task.resolved();
    },
  );

  /** Buttons. Sequenced, but doesn't block gameplay (§4.15). */
  onClick(handler: StepHandler): void {
    registerGuiClick(this.guiId, this.id, handler);
  }

  /** Sliders (number), text inputs (text) and checkboxes (checked). Runs immediately. */
  onChange(handler: (value: never) => void): void {
    registerGuiChange(this.guiId, this.id, handler);
  }

  /** List boxes: the selected row changed. Runs immediately. */
  onSelect(handler: (index: number) => void): void {
    registerGuiSelect(this.guiId, this.id, handler);
  }

  /** List boxes: a row was activated (double-click, or Enter on the selected row). Sequenced, like {@link onClick}. */
  onActivate(handler: (index: number) => void): void {
    registerGuiActivate(this.guiId, this.id, handler);
  }

  /** Text inputs: the player pressed Enter. `text` is the input's text. Sequenced, like {@link onClick}. */
  onSubmit(handler: (text: string) => void): void {
    registerGuiSubmit(this.guiId, this.id, handler);
  }

  /** The pointer moved onto the control. Runs immediately, outside the gameplay lock. */
  onMouseEnter(handler: StepHandler): void {
    registerGuiHover(this.guiId, this.id, false, handler);
  }

  /** The pointer left the control. Runs immediately, outside the gameplay lock. */
  onMouseLeave(handler: StepHandler): void {
    registerGuiHover(this.guiId, this.id, true, handler);
  }
}

export class GuiHandle<Controls extends Record<string, string> = Record<string, string>> {
  /** The GUI's ID. */
  readonly id: string;
  /** This GUI's controls by handle name (`guis.saveMenu.controls.saveBtn`). */
  readonly controls: { readonly [K in keyof Controls]: GuiControlHandle };
  /** The GUI's packed content as one control: move or tween it to move the whole GUI. */
  readonly root: GuiControlHandle;

  /** `controls` maps handle names to control ids (`{ takeBtn: 'TakeBtn' }`). */
  constructor(id: string, controls: Controls) {
    this.id = id;
    const handles: Record<string, GuiControlHandle> = {};
    for (const [name, controlId] of Object.entries(controls)) {
      handles[name] = new GuiControlHandle(id, controlId);
    }
    this.controls = handles as { readonly [K in keyof Controls]: GuiControlHandle };
    this.root = new GuiControlHandle(id, null);
  }

  /** Shows the GUI (instant) and runs its `onShow` handlers. */
  show(): void {
    setGuiVisible(this.id, true);
  }

  /** Hides the GUI (instant) and runs its `onHide` handlers. */
  hide(): void {
    setGuiVisible(this.id, false);
  }

  /** Whether the GUI is shown. Setting it is the same as `show()` / `hide()`. */
  get visible(): boolean {
    return this.root.visible;
  }

  set visible(value: boolean) {
    setGuiVisible(this.id, value);
  }

  /** Shows the GUI and fades it in over `seconds`. Waits. */
  readonly fadeIn = timed((seconds: number = 0.5): Task => {
    this.root.alpha = 0;
    this.show();
    return this.root.fadeTo.now(1, seconds);
  });

  /** Fades the GUI out over `seconds`, then hides it. Waits. */
  readonly fadeOut = timed((seconds: number = 0.5): Task => {
    const fade = this.root.fadeTo.now(0, seconds);
    return new Task(
      fade.promise.then(() => {
        this.hide();
        this.root.alpha = 1;
      }),
      { finishNow: () => fade.finishNow(), cancel: () => fade.cancel() },
    );
  });

  /** Each time the GUI is built (once per room). */
  onBuilt(handler: StepHandler): void {
    registerGuiLifecycleHandler(this.id, 'built', handler);
  }

  /** Each time a script shows the GUI. */
  onShow(handler: StepHandler): void {
    registerGuiLifecycleHandler(this.id, 'show', handler);
  }

  /** Each time a script hides the GUI. */
  onHide(handler: StepHandler): void {
    registerGuiLifecycleHandler(this.id, 'hide', handler);
  }

  /**
   * Any button in this GUI, once the button's own `onClick` is over (not when that handler ended
   * with `goTo`, `saves.load` or `dialog.end`). `button` is its control handle.
   */
  onAnyClick(handler: (button: GuiControlHandle) => void): void {
    registerGuiAnyClick(this.id, (controlId) => this.controlHandle(controlId), handler);
  }

  /** The handle for a control id: the generated one, or a new one for controls built at runtime (dialog rows). */
  private controlHandle(controlId: string): GuiControlHandle {
    for (const handle of Object.values(this.controls)) {
      if (handle.id === controlId) {
        return handle;
      }
    }
    return new GuiControlHandle(this.id, controlId);
  }
}

// ─── Sound and music ─────────────────────────────────────────────────────────

function soundManager() {
  const game = tryGetActiveBenneGame();
  return game ? tryGetBenneSoundManager(game) : null;
}

function warnPlaybackFailed(what: string) {
  return (err: unknown) => {
    if (import.meta.env.DEV) {
      console.warn(`[Benne] ${what} failed.`, err);
    }
  };
}

export class SfxHandle {
  /** The sound's file name, without the extension. */
  readonly id: string;

  constructor(id: string) {
    this.id = id;
  }

  /** Starts the sound and continues. A skipped cutscene plays no one-shot sounds. */
  play(options?: SoundPlayOptions): void {
    if (activeRoomScene()?.isCutsceneSkipFastForwarding()) {
      return;
    }
    soundManager()?.playSfx(this.id, options).catch(warnPlaybackFailed(`sfx.${this.id}.play()`));
  }

  /** Plays the sound and waits until it ends. */
  readonly playAndWait = timed((options?: SoundPlayOptions): Task => {
    const sm = soundManager();
    if (!sm || activeRoomScene()?.isCutsceneSkipFastForwarding()) {
      return Task.resolved();
    }
    const id = this.id;
    return new Task(sm.playSfxAndWait(id, options).catch(warnPlaybackFailed(`sfx.${id}.playAndWait()`)), {
      cancel: () => sm.stopSfx(id),
      finishNow: () => sm.stopSfx(id),
    });
  });

  /** Stops this sound. */
  stop(): void {
    soundManager()?.stopSfx(this.id);
  }

  /** True while this sound plays. */
  get isPlaying(): boolean {
    return soundManager()?.isSfxPlaying(this.id) ?? false;
  }
}

/** What `sfx` adds next to its sounds. The generator reserves this name. */
export interface SfxControls {
  /** Stops every playing sound effect. */
  stopAll(): void;
}

/** `sfx` in `@game`: the sounds plus {@link SfxControls}. */
export function withSfxControls<T extends Record<string, SfxHandle>>(sounds: T): T & SfxControls {
  return Object.assign({ ...sounds }, {
    stopAll(): void {
      soundManager()?.stopSfx();
    },
  });
}

export class MusicHandle {
  /** The track's file name, without the extension. */
  readonly id: string;

  constructor(id: string) {
    this.id = id;
  }

  /** Starts (crossfades to) this track and continues. */
  play(options?: MusicPlayOptions): void {
    const skipping = activeRoomScene()?.isCutsceneSkipFastForwarding() === true;
    soundManager()
      ?.playMusic(this.id, skipping ? { ...options, fadeSeconds: 0 } : options)
      .catch(warnPlaybackFailed(`music.${this.id}.play()`));
  }

  /** True while this track is the one playing. */
  get isPlaying(): boolean {
    const sm = soundManager();
    return sm != null && sm.isMusicPlaying() && sm.getCurrentMusicId() === this.id;
  }
}

/** What `music` adds next to its tracks (§4.11). The generator reserves these names. */
export interface MusicControls<T> {
  /** Stops the music. */
  stop(): void;
  /** True while any track plays. */
  readonly isPlaying: boolean;
  /** The track playing now, or `null`. */
  readonly current: T | null;
}

/** `music` in `@game`: the tracks plus {@link MusicControls}. */
export function withMusicControls<T extends Record<string, MusicHandle>>(tracks: T): T & MusicControls<T[keyof T]> {
  const controls = {
    stop(): void {
      soundManager()?.stopMusic();
    },
    get isPlaying(): boolean {
      return soundManager()?.isMusicPlaying() ?? false;
    },
    get current(): T[keyof T] | null {
      const id = soundManager()?.getCurrentMusicId();
      return (Object.values(tracks).find((t) => t.id === id) as T[keyof T] | undefined) ?? null;
    },
  };
  return Object.defineProperties({ ...tracks }, Object.getOwnPropertyDescriptors(controls)) as T &
    MusicControls<T[keyof T]>;
}

/**
 * A video under `assets/videos/` (`video.x`). `VideoPlayOptions`: `loop`, `volume` (0–1),
 * `clickToSkip`, `ignoreCameraZoom` (fill the screen even while the camera is zoomed in) and
 * `onComplete`.
 */
export class VideoHandle {
  /** The video's file name, without the extension. */
  readonly id: string;

  constructor(id: string) {
    this.id = id;
  }

  /** Starts the video and continues. */
  play(options?: VideoPlayOptions): void {
    roomFor(`video.${this.id}.play`)?.startRoomVideo(this.id, options);
  }

  /** Plays the video and waits until it ends. */
  readonly playAndWait = timed((options?: VideoPlayOptions): Task => {
    const scene = roomFor(`video.${this.id}.playAndWait`);
    if (!scene || scene.isCutsceneSkipFastForwarding()) {
      return Task.resolved();
    }
    const playing = scene.startRoomVideo(this.id, options);
    return new Task(playing.whenComplete, { finishNow: () => scene.stopRoomVideo(), cancel: () => scene.stopRoomVideo() });
  });

  /** Stops this video, if it is the one playing. */
  stop(): void {
    roomFor(`video.${this.id}.stop`)?.stopRoomVideo();
  }

  /** True while this video is the one playing. */
  get isPlaying(): boolean {
    const scene = activeRoomScene();
    return scene != null && scene.isRoomVideoPlaying() && scene.getRoomVideoKey() === this.id;
  }
}

/**
 * What `video` adds next to its videos (§4.11). A room shows one video at a time, so these act on
 * whichever is playing. The generator reserves these names.
 */
export interface VideoControls<T> {
  /** Pauses the playing video. */
  pause(): void;
  /** Resumes a paused video. */
  resume(): void;
  /** Jumps to `seconds` into the playing video. */
  seek(seconds: number): void;
  /** Stops the playing video. */
  stop(): void;
  /** True while a video plays (paused counts as playing). */
  readonly isPlaying: boolean;
  /** The video playing now, or `null`. */
  readonly current: T | null;
}

/** `video` in `@game`: the videos plus {@link VideoControls}. */
export function withVideoControls<T extends Record<string, VideoHandle>>(videos: T): T & VideoControls<T[keyof T]> {
  const controls = {
    pause(): void {
      roomFor('video.pause')?.pauseRoomVideo();
    },
    resume(): void {
      roomFor('video.resume')?.resumeRoomVideo();
    },
    seek(seconds: number): void {
      roomFor('video.seek')?.seekRoomVideo(seconds);
    },
    stop(): void {
      roomFor('video.stop')?.stopRoomVideo();
    },
    get isPlaying(): boolean {
      return activeRoomScene()?.isRoomVideoPlaying() ?? false;
    },
    get current(): T[keyof T] | null {
      const scene = activeRoomScene();
      const key = scene?.isRoomVideoPlaying() ? scene.getRoomVideoKey() : null;
      return (Object.values(videos).find((v) => v.id === key) as T[keyof T] | undefined) ?? null;
    },
  };
  return Object.defineProperties({ ...videos }, Object.getOwnPropertyDescriptors(controls)) as T &
    VideoControls<T[keyof T]>;
}

// ─── Flags and variables ─────────────────────────────────────────────────────

/** A flag with options, for {@link defineFlags}. */
export interface FlagSpec {
  readonly default: boolean;
  /** The key in the game state (and saves), when it differs from the flag's name (§4.7). */
  readonly saveKey?: string;
}

/** `unlockedDoor: flag(false, { saveKey: 'unlocked door' })` */
export function flag(defaultValue: boolean, options: { saveKey?: string } = {}): FlagSpec {
  return { default: defaultValue, saveKey: options.saveKey };
}

function noGame(what: string): void {
  warnOnce(`state:${what}`, `${what}: the game is not running — ignored.`);
}

/**
 * Declares the game's flags with defaults, in `src/game/state.ts` (§4.7). Reads and writes go
 * straight to the game state at that line. Each flag is stored under its name, or its `saveKey`.
 */
export function defineFlags<T extends Record<string, boolean | FlagSpec>>(defaults: T): { -readonly [K in keyof T]: boolean } {
  const flags = {} as { -readonly [K in keyof T]: boolean };
  for (const [name, spec] of Object.entries(defaults)) {
    const fallback = typeof spec === 'boolean' ? spec : spec.default;
    const key = typeof spec === 'boolean' ? name : (spec.saveKey ?? name);
    Object.defineProperty(flags, name, {
      enumerable: true,
      get: () => {
        const value = tryGetActiveGameStateManager()?.getFlag(key);
        return typeof value === 'boolean' ? value : fallback;
      },
      set: (value: boolean) => {
        const m = tryGetActiveGameStateManager();
        if (!m) {
          noGame(`flags.${name}`);
          return;
        }
        m.setFlag(key, value === true);
      },
    });
  }
  return flags;
}

/** What a variable can hold: JSON-compatible values only, so saves stay safe (§4.7). */
export type VarValue = string | number | boolean | null | readonly VarValue[] | { readonly [key: string]: VarValue };

/**
 * Declares the game's variables with defaults, in `src/game/state.ts` (§4.7). Reads and writes go
 * straight to the game state. An array or object default is copied into the state the first
 * time it is read, so changing it in place is saved too.
 */
export function defineVars<T extends Record<string, VarValue>>(defaults: T): { -readonly [K in keyof T]: T[K] } {
  const vars = {} as { -readonly [K in keyof T]: T[K] };
  for (const [name, fallback] of Object.entries(defaults)) {
    Object.defineProperty(vars, name, {
      enumerable: true,
      get: () => {
        const m = tryGetActiveGameStateManager();
        if (m?.hasVariable(name)) {
          return m.getVariable(name);
        }
        if (m && fallback !== null && typeof fallback === 'object') {
          const copy = structuredClone(fallback);
          m.setVariable(name, copy);
          return copy;
        }
        return fallback;
      },
      set: (value: VarValue) => {
        const m = tryGetActiveGameStateManager();
        if (!m) {
          noGame(`vars.${name}`);
          return;
        }
        m.setVariable(name, value);
      },
    });
  }
  return vars;
}
