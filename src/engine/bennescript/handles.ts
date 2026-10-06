import * as Phaser from 'phaser';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { getRoomVisitCount, setRoomVisitCount } from '../gameState/roomVisitState.js';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry.js';
import { isRoomTransitionInProgress, tryGetRoomTransitionOrchestrator } from '../scenes/roomTransitionGlobals.js';
import { createLazyBenneScriptInventoryNamespace } from '../scripting/benneScriptGameStateApi.js';
import type { ControlFacade } from '../scripting/GuiRuntime.js';
import type { ScriptedSayLineOptions } from '../scripting/scriptedSpeech.js';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { CharacterFollowOptions } from '../../types/characterFollow.js';
import type { Point2 } from '../../types/room.js';
import { tryGetBenneSoundManager } from '../sound/benneSoundRegistry.js';
import type { MusicPlayOptions, SoundPlayOptions } from '../sound/benneSoundTypes.js';
import type { VideoPlayOptions } from '../video/benneVideoTypes.js';
import {
  activeRoomScene,
  characterOps,
  faceCharacter,
  inventoryOf,
  roomFor,
  sayTask,
  walkCharacterTask,
  warnOnce,
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
  registerCharacterVerbHandler,
  registerCharacterVerbItemHandler,
  registerFallbackAnyVerb,
  registerFallbackItemUnhandled,
  registerFallbackVerb,
  registerFallbackVerbItem,
  type FallbackTarget,
} from './globalHandlers.js';
import {
  guiRuntime,
  registerGuiChange,
  registerGuiClick,
  registerGuiHover,
  registerGuiLifecycleHandler,
  registerGuiSelect,
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

export type { FallbackTarget };

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
  readonly id: string;

  constructor(roomId: string | null, kind: TargetKind, id: string) {
    this.roomId = roomId;
    this.kind = kind;
    this.id = id;
  }

  /** One handler for one or several verbs (`cleaningStuff.on(['use', 'take'], …)`). */
  on(verbs: V | readonly V[], handler: StepHandler): void {
    for (const verb of verbList(verbs)) {
      if (this.roomId == null) {
        registerCharacterVerbHandler(this.id, verb, handler);
      } else {
        registerVerbHandler(this.roomId, this, verb, handler);
      }
    }
  }

  /** `verb` with `item` on this target. Generated item-verb methods (`onUseItem`) call this. */
  onVerbItem(verb: V, item: ItemRef, handler: StepHandler): void {
    if (this.roomId == null) {
      registerCharacterVerbItemHandler(this.id, verb, item.id, handler);
    } else {
      registerVerbItemHandler(this.roomId, this, verb, item.id, handler);
    }
  }

  /** `item` with any item verb on this target. */
  onItem(item: ItemRef, handler: StepHandler): void {
    if (this.roomId == null) {
      registerCharacterVerbItemHandler(this.id, null, item.id, handler);
    } else {
      registerVerbItemHandler(this.roomId, this, null, item.id, handler);
    }
  }

  /** Any item without a handler of its own, any item verb, on this target. */
  onAnyItem(handler: (item: ItemRef, verb: { readonly id: V }) => void): void {
    if (this.roomId == null) {
      warnOnce(`anyItem:${this.id}`, `characters.${this.id}.onAnyItem only works in a room script — ignored.`);
      return;
    }
    registerAnyItemHandler(this.roomId, this, handler);
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

export class PropHandle<V extends string = string, Anim extends string = string> extends ClickableHandle<V> {
  constructor(roomId: string, id: string) {
    super(roomId, 'prop', id);
  }

  get visible(): boolean {
    return activeRoomScene()?.getPropScriptVisible(this.id) ?? false;
  }

  set visible(value: boolean) {
    roomFor(`${this.id}.visible`)?.setPropScriptVisible(this.id, value);
  }

  hide(): void {
    this.visible = false;
  }

  show(): void {
    this.visible = true;
  }

  /** When false, the prop can't be hovered or clicked. Saved. */
  get clickable(): boolean {
    return activeRoomScene()?.getPropScriptClickable(this.id) ?? false;
  }

  set clickable(value: boolean) {
    roomFor(`${this.id}.clickable`)?.setPropScriptClickable(this.id, value);
  }

  /** The hover / verb-line name. Saved. */
  get description(): string {
    return activeRoomScene()?.getPropScriptDescription(this.id) ?? '';
  }

  set description(value: string) {
    roomFor(`${this.id}.description`)?.setPropScriptDescription(this.id, value);
  }

  /** The prop's base (looping) animation tag. Setting it is instant and saved (§4.10). */
  get animation(): Anim {
    return (activeRoomScene()?.getPropScriptBaseAnimationTag(this.id) ?? '') as Anim;
  }

  set animation(tag: Anim) {
    roomFor(`${this.id}.animation`)?.setPropScriptBaseAnimationTag(this.id, tag);
  }

  /** One-shot animation; waits for it to finish, then returns to the base animation. */
  readonly play = timed((tag: Anim): Task => {
    const scene = roomFor(`${this.id}.play`);
    return scene ? new Task(scene.playPropScriptAnimationOneShot(this.id, tag)) : Task.resolved();
  });

  /** Fades to `alpha` (0–1) over `seconds`. Waits. The end alpha is saved. */
  readonly fade = timed((alpha: number, seconds: number): Task => {
    const scene = roomFor(`${this.id}.fade`);
    if (!scene) {
      return Task.resolved();
    }
    const from = scene.getPropSprite(this.id)?.alpha ?? 1;
    return new Task(scene.fadePropScriptAlpha(this.id, from, alpha, seconds));
  });

  /** Teleports to room pixels (instant). */
  moveTo(point: Point2): void {
    roomFor(`${this.id}.moveTo`)?.movePropToNow(this.id, point);
  }

  /** Moves to room pixels over `seconds`. Waits. */
  readonly slideTo = timed((point: Point2, seconds: number): Task => slidePropTask(this.id, point, seconds));
}

export class HotspotHandle<V extends string = string> extends ClickableHandle<V> {
  constructor(roomId: string, id: string) {
    super(roomId, 'hotspot', id);
  }

  /** When false, the hotspot can't be hovered or clicked. Saved. */
  get active(): boolean {
    return activeRoomScene()?.getHotspotScriptActive(this.id) ?? false;
  }

  set active(value: boolean) {
    roomFor(`${this.id}.active`)?.setHotspotScriptActive(this.id, value);
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
    return activeRoomScene()?.getHotspotScriptDescription(this.id) ?? '';
  }

  set description(value: string) {
    roomFor(`${this.id}.description`)?.setHotspotScriptDescription(this.id, value);
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

  face(direction: CharacterFacingLetter): void {
    faceCharacter(this.id, direction);
  }

  /** One-shot animation; waits for it to finish, then returns to the base animation. */
  readonly play = timed((tag: Anim): Task => characterOps.play(this.id, tag));

  /** Fades to `alpha` (0–1) over `seconds`. Waits. */
  readonly fade = timed((alpha: number, seconds: number): Task => characterOps.fade(this.id, alpha, seconds));

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

  get visible(): boolean {
    return characterOps.getVisible(this.id);
  }

  set visible(value: boolean) {
    characterOps.setVisible(this.id, value);
  }

  show(): void {
    this.visible = true;
  }

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

  stopFollowing(): void {
    characterOps.stopFollowing(this.id);
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
  readonly id: V;
  readonly label: string;
  readonly preposition: string | null;
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

  get isActive(): boolean {
    return tryGetActiveGameStateManager()?.getActiveVerb() === this.id;
  }
}

/** `fallbacks` in `@game`: global handlers for verbs nothing else handled (§4.17). */
export class FallbacksHandle<V extends string = string> {
  on(verb: V, handler: StepHandler): void {
    registerFallbackVerb(verb, handler);
  }

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
}

// ─── Room places ─────────────────────────────────────────────────────────────

/** A named point in a room (`points.x`): a walk target. */
export class PointHandle {
  readonly roomId: string;
  readonly id: string;

  constructor(roomId: string, id: string) {
    this.roomId = roomId;
    this.id = id;
  }
}

/** A region in a room (`regions.x`). */
export class RegionHandle {
  readonly roomId: string;
  readonly id: string;

  constructor(roomId: string, id: string) {
    this.roomId = roomId;
    this.id = id;
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
    return activeRoomScene()?.getRegionScriptActive(this.id) ?? false;
  }

  set active(value: boolean) {
    roomFor(`regions.${this.id}.active`)?.setRegionScriptActive(this.id, value);
  }
}

/** A walkable polygon in a room (`walkables.x`). */
export class WalkableHandle {
  readonly roomId: string;
  readonly id: string;

  constructor(roomId: string, id: string) {
    this.roomId = roomId;
    this.id = id;
  }

  /** Inactive walkable polygons can't be walked on. Saved. */
  get active(): boolean {
    return activeRoomScene()?.getWalkableScriptActive(this.id) ?? false;
  }

  set active(value: boolean) {
    roomFor(`walkables.${this.id}.active`)?.setWalkableScriptActive(this.id, value);
  }
}

// ─── Rooms ───────────────────────────────────────────────────────────────────

export class RoomHandle {
  readonly id: string;

  constructor(id: string) {
    this.id = id;
    registerRoomHandle(this);
  }

  /** Before the fade-in: invisible setup. The fade-in waits for it. */
  onEnter(handler: StepHandler): void {
    registerRoomLifecycleHandler(this.id, 'enter', handler);
  }

  /** After the fade-in: visible entrances, cutscenes. */
  onEnterAfterFade(handler: StepHandler): void {
    registerRoomLifecycleHandler(this.id, 'enterAfterFade', handler);
  }

  onLeave(handler: StepHandler): void {
    registerRoomLifecycleHandler(this.id, 'leave', handler);
  }

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

  get isFirstVisit(): boolean {
    return this.visitCount === 1;
  }

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

export class ItemHandle<V extends string = string, Anim extends string = string> implements ItemRef {
  private readonly facade = () =>
    createLazyBenneScriptInventoryNamespace(() => tryGetActiveGameStateManager(), activeRoomScene)(this.id);

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
    return this.facade().animation as Anim;
  }

  set animation(tag: Anim) {
    this.facade().animationNow(tag);
  }

  /** The cursor animation while this item is armed. Setting it is instant and saved. */
  get cursorAnimation(): string {
    return this.facade().cursorAnimation;
  }

  set cursorAnimation(tag: string) {
    this.facade().cursorAnimationNow(tag);
  }

  /** The hover / verb-line name. Saved. */
  get description(): string {
    return this.facade().description;
  }

  set description(value: string) {
    this.facade().description = value;
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

  /** `verb` with another item on this one. Generated item-verb methods (`onUseItem`) call this. */
  onVerbItem(verb: V, item: ItemRef, handler: StepHandler): void {
    registerItemComboHandler(this.id, verb, item.id, handler);
  }

  /** Any item verb with `item` on this one. */
  onItem(item: ItemRef, handler: StepHandler): void {
    registerItemComboHandler(this.id, null, item.id, handler);
  }

  /** Same as {@link onItem}; reads better for item-on-item (decision 9). */
  onCombine(item: ItemRef, handler: StepHandler): void {
    this.onItem(item, handler);
  }

  /** Any other item without a handler of its own, any item verb, on this one. */
  onAnyItem(handler: (item: ItemRef, verb: { readonly id: V }) => void): void {
    registerItemAnyComboHandler(this.id, handler);
  }
}

// ─── Dialogs ─────────────────────────────────────────────────────────────────

export class DialogOptionHandle {
  readonly dialogId: string;
  readonly id: string;

  constructor(dialogId: string, id: string) {
    this.dialogId = dialogId;
    this.id = id;
  }

  on(): void {
    setDialogOptionEnabled(this.dialogId, this.id, true);
  }

  off(): void {
    setDialogOptionEnabled(this.dialogId, this.id, false);
  }

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
  readonly id: string;
  readonly options: { readonly [K in keyof Options]: DialogOptionHandle };

  /** `options` maps handle names to option ids (`{ dirtyDishes: 'dirty dishes' }`). */
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
    this.control('text')?.textNow(value);
  }

  get alpha(): number {
    return (this.object?.alpha as number | undefined) ?? 1;
  }

  set alpha(value: number) {
    this.control('alpha')?.setAlpha(value);
  }

  get visible(): boolean {
    return (this.object?.visible as boolean | undefined) ?? false;
  }

  set visible(value: boolean) {
    this.control('visible')?.setVisible(value);
  }

  get x(): number {
    return (this.object?.x as number | undefined) ?? 0;
  }

  set x(value: number) {
    this.control('x')?.setX(value);
  }

  get y(): number {
    return (this.object?.y as number | undefined) ?? 0;
  }

  set y(value: number) {
    this.control('y')?.setY(value);
  }

  /** Buttons and text inputs. */
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
    this.control('selectedIndex')?.selectedIndexNow(index);
  }

  /** List boxes. */
  setRowText(index: number, text: string): void {
    this.control('setRowText')?.setRowTextNow(index, text);
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

  onMouseEnter(handler: StepHandler): void {
    registerGuiHover(this.guiId, this.id, false, handler);
  }

  onMouseLeave(handler: StepHandler): void {
    registerGuiHover(this.guiId, this.id, true, handler);
  }
}

export class GuiHandle<Controls extends Record<string, string> = Record<string, string>> {
  readonly id: string;
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

  show(): void {
    setGuiVisible(this.id, true);
  }

  hide(): void {
    setGuiVisible(this.id, false);
  }

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

  onShow(handler: StepHandler): void {
    registerGuiLifecycleHandler(this.id, 'show', handler);
  }

  onHide(handler: StepHandler): void {
    registerGuiLifecycleHandler(this.id, 'hide', handler);
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

  stop(): void {
    soundManager()?.stopSfx(this.id);
  }
}

export class MusicHandle {
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

/** A video under `assets/videos/` (`video.x`). */
export class VideoHandle {
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

  stop(): void {
    roomFor(`video.${this.id}.stop`)?.stopRoomVideo();
  }
}

// ─── Flags and variables ─────────────────────────────────────────────────────

/** A flag with options, for {@link defineFlags}. */
export interface FlagSpec {
  readonly default: boolean;
  /** The key in the game state (and saves), when it differs from the flag's name (§4.7). */
  readonly saveKey?: string;
}

/** `escapedCloset: flag(false, { saveKey: 'escaped closet' })` */
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
