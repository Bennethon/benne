import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { getRoomVisitCount } from '../gameState/roomVisitState.js';
import { tryGetRoomTransitionOrchestrator } from '../scenes/roomTransitionGlobals.js';
import { createLazyBenneScriptInventoryNamespace } from '../scripting/benneScriptGameStateApi.js';
import type { ScriptedSayLineOptions } from '../scripting/scriptedSpeech.js';
import type { CharacterFacingLetter } from '../../types/character.js';
import { tryGetBenneSoundManager } from '../sound/benneSoundRegistry.js';
import type { MusicPlayOptions, SoundPlayOptions } from '../sound/benneSoundTypes.js';
import {
  activeRoomScene,
  faceCharacter,
  sayTask,
  walkCharacterTask,
  type ItemRef,
  type WalkTarget,
} from './actions.js';
import {
  endDialog,
  isDialogOptionEnabled,
  registerChoiceHandler,
  setDialogOptionEnabled,
  startDialog,
} from './dialogs.js';
import { endHandler } from './interactionContext.js';
import { timed, type Task } from './task.js';
import {
  registerRoomLifecycleHandler,
  registerVerbHandler,
  registerVerbItemHandler,
  type TargetKind,
} from './roomHandlers.js';

/**
 * Handle objects for content. The handle generator (`scripts/lib/generateGameHandles.mjs`) creates
 * them in `@game` and the per-room / dialog / GUI `.ids` modules (§7). The engine knows no verb
 * names: handles are generic over the game's `VerbId`, and the generated modules add the per-verb
 * methods (`onLook`, `onUseItem`, …) with {@link withVerbMethods} (§8.4).
 */

/** A handler body as the author writes it. The transform makes it async. */
export type StepHandler = () => void;

const warned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (!import.meta.env.DEV || warned.has(key)) {
    return;
  }
  warned.add(key);
  console.warn(`[Benne] ${message}`);
}

/** Generated API whose runtime arrives with the full handle API (refactor Phase 4). */
function notYet(what: string): void {
  warnOnce(`not-yet:${what}`, `${what} is not implemented yet — the handler will not run.`);
}

// ─── Clickables ──────────────────────────────────────────────────────────────

/**
 * A prop, hotspot or character: things the player clicks. Room `.ids` modules create them with
 * their room id; `characters.x` in `@game` has none (character-script scope, §4.9).
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
    for (const verb of typeof verbs === 'string' ? [verbs] : (verbs as readonly V[])) {
      if (this.roomId == null) {
        notYet(`characters.${this.id}.on("${verb}") outside a room script`);
        continue;
      }
      registerVerbHandler(this.roomId, this, verb, handler);
    }
  }

  /** `verb` with `item` on this target. Generated item-verb methods (`onUseItem`) call this. */
  onVerbItem(verb: V, item: ItemRef, handler: StepHandler): void {
    if (this.roomId == null) {
      notYet(`characters.${this.id} item handlers outside a room script`);
      return;
    }
    registerVerbItemHandler(this.roomId, this, verb, item.id, handler);
  }
}

export class PropHandle<V extends string = string, Anim extends string = string> extends ClickableHandle<V> {
  constructor(roomId: string, id: string) {
    super(roomId, 'prop', id);
  }

  get visible(): boolean {
    return activeRoomScene()?.getPropScriptVisible(this.id) ?? false;
  }

  set visible(value: boolean) {
    const scene = activeRoomScene();
    if (!scene) {
      warnOnce('prop:no-room', `${this.id}.visible: no active room — ignored.`);
      return;
    }
    scene.setPropScriptVisible(this.id, value);
  }

  hide(): void {
    this.visible = false;
  }

  show(): void {
    this.visible = true;
  }

  /** The prop's base (looping) animation tag. Setting it is instant and saved (§4.10). */
  get animation(): Anim {
    return (activeRoomScene()?.getPropScriptBaseAnimationTag(this.id) ?? '') as Anim;
  }

  set animation(tag: Anim) {
    const scene = activeRoomScene();
    if (!scene) {
      warnOnce('prop:no-room', `${this.id}.animation: no active room — ignored.`);
      return;
    }
    scene.setPropScriptBaseAnimationTag(this.id, tag);
  }
}

export class HotspotHandle<V extends string = string> extends ClickableHandle<V> {
  constructor(roomId: string, id: string) {
    super(roomId, 'hotspot', id);
  }
}

export class CharacterHandle<V extends string = string, Anim extends string = string> extends ClickableHandle<V> {
  constructor(roomId: string | null, id: string) {
    super(roomId, 'character', id);
  }

  /** One speech line from this character. Waits; `.now` doesn't. Same as a `Name: "…"` label. */
  readonly say = timed((text: string, options?: ScriptedSayLineOptions): Task => sayTask(this.id, text, options));

  /** Walks to a point, a named point or a thing's walk-to point. Waits; `.now` doesn't. */
  readonly walkTo = timed((target: WalkTarget): Task => walkCharacterTask(this.id, target));

  face(direction: CharacterFacingLetter): void {
    faceCharacter(this.id, direction);
  }

  /** Animation override (instant, saved); the effective animation when read (§4.10). */
  get animation(): Anim {
    return (activeRoomScene()?.getCharacterScriptEffectiveAnimationTag(this.id) ?? '') as Anim;
  }

  set animation(tag: Anim) {
    const scene = activeRoomScene();
    if (!scene) {
      warnOnce('character:no-room', `${this.id}.animation: no active room — ignored.`);
      return;
    }
    scene.setCharacterScriptAnimationOverride(this.id, tag);
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
}

/**
 * Adds `on<Verb>` (and `on<Verb>Item` for item verbs) for each configured verb (§8.2). The method
 * names come from the generator, so the engine and the generated types can't disagree.
 */
export function withVerbMethods<H, M>(handle: H, verbs: readonly VerbSpec[]): H & M {
  const target = handle as unknown as VerbRegistrar;
  const methods: Record<string, unknown> = {};
  for (const verb of verbs) {
    methods[verb.method] = (handler: StepHandler) => target.on(verb.id, handler);
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

/** The thing a fallback item handler was used on. */
export interface FallbackTarget {
  readonly id: string;
}

/** `fallbacks` in `@game`: global handlers for verbs nothing else handled (§4.17). */
export class FallbacksHandle<V extends string = string> {
  on(verb: V, _handler: StepHandler): void {
    notYet(`fallbacks.on("${verb}")`);
  }

  onVerbItem(verb: V, _handler: (item: ItemRef, target: FallbackTarget) => void): void {
    notYet(`fallbacks item handler for "${verb}"`);
  }

  /** Any verb nothing else handled. */
  onAnyVerb(_handler: StepHandler): void {
    notYet('fallbacks.onAnyVerb');
  }

  /** Any item use nothing else handled. */
  onItemUnhandled(_handler: (item: ItemRef, target: FallbackTarget) => void): void {
    notYet('fallbacks.onItemUnhandled');
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
}

/** A walkable polygon in a room (`walkables.x`). */
export class WalkableHandle {
  readonly roomId: string;
  readonly id: string;

  constructor(roomId: string, id: string) {
    this.roomId = roomId;
    this.id = id;
  }
}

// ─── Rooms ───────────────────────────────────────────────────────────────────

export class RoomHandle {
  readonly id: string;

  constructor(id: string) {
    this.id = id;
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

  get visitCount(): number {
    const m = tryGetActiveGameStateManager();
    return m ? getRoomVisitCount(m, this.id) : 0;
  }

  get isFirstVisit(): boolean {
    return this.visitCount === 1;
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
  }

  /** The item's icon animation. Setting it is instant and saved. */
  get animation(): Anim {
    return this.facade().animation as Anim;
  }

  set animation(tag: Anim) {
    this.facade().animation = tag;
  }

  /** `verb` used on this item's inventory row. Generated verb methods (`onLook`) call this. */
  on(verb: V | readonly V[], _handler: StepHandler): void {
    notYet(`items.${this.id}.on(${JSON.stringify(verb)})`);
  }

  /** `verb` with another item on this one. Generated item-verb methods (`onUseItem`) call this. */
  onVerbItem(verb: V, item: ItemRef, _handler: StepHandler): void {
    notYet(`items.${this.id} "${verb}" with ${item.id}`);
  }

  /** Any item verb with `item` on this one. */
  onItem(item: ItemRef, _handler: StepHandler): void {
    notYet(`items.${this.id}.onItem(${item.id})`);
  }

  /** Same as {@link onItem}; reads better for item-on-item (decision 9). */
  onCombine(item: ItemRef, handler: StepHandler): void {
    this.onItem(item, handler);
  }

  /** Any item, any item verb, on this one. */
  onAnyItem(_handler: (item: ItemRef, verb: V) => void): void {
    notYet(`items.${this.id}.onAnyItem`);
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
}

// ─── GUIs ────────────────────────────────────────────────────────────────────

/** A GUI control (`guis.x.controls.y`, or flat in the GUI's own `.ids` module). */
export class GuiControlHandle {
  readonly guiId: string;
  readonly id: string;

  constructor(guiId: string, id: string) {
    this.guiId = guiId;
    this.id = id;
  }
}

export class GuiHandle<Controls extends Record<string, string> = Record<string, string>> {
  readonly id: string;
  readonly controls: { readonly [K in keyof Controls]: GuiControlHandle };

  /** `controls` maps handle names to control ids (`{ takeBtn: 'TakeBtn' }`). */
  constructor(id: string, controls: Controls) {
    this.id = id;
    const handles: Record<string, GuiControlHandle> = {};
    for (const [name, controlId] of Object.entries(controls)) {
      handles[name] = new GuiControlHandle(id, controlId);
    }
    this.controls = handles as { readonly [K in keyof Controls]: GuiControlHandle };
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
}

/** A video under `assets/videos/` (`video.x`). */
export class VideoHandle {
  readonly id: string;

  constructor(id: string) {
    this.id = id;
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
