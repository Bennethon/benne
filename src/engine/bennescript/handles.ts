import type { GameVerbId } from '../../types/generated/benne-game-ids.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { getRoomVisitCount } from '../gameState/roomVisitState.js';
import { tryGetRoomTransitionOrchestrator } from '../scenes/roomTransitionGlobals.js';
import { createLazyBenneScriptInventoryNamespace } from '../scripting/benneScriptGameStateApi.js';
import { createBenneScriptDialogAccessor, openDialogSessionForId } from '../scripting/DialogBenneScript.js';
import type { ScriptedSayLineOptions } from '../scripting/scriptedSpeech.js';
import { tryGetBenneSoundManager } from '../sound/benneSoundRegistry.js';
import type { MusicPlayOptions, SoundPlayOptions } from '../sound/benneSoundTypes.js';
import { activeRoomScene, sayTask, type ItemRef } from './actions.js';
import { endHandler } from './interactionContext.js';
import {
  registerRoomLifecycleHandler,
  registerVerbHandler,
  registerVerbItemHandler,
  type TargetKind,
} from './roomHandlers.js';

/**
 * Handle objects for content. In Phase 1 they are created by hand in `*.ids.ts` / `game.ids.ts`;
 * Phase 3 generates those modules from the content JSON (§7). Only what the café needs exists.
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

// ─── Clickables ──────────────────────────────────────────────────────────────

/** A prop, hotspot or character in one room: things the player clicks. */
export class ClickableHandle {
  readonly roomId: string;
  readonly kind: TargetKind;
  readonly id: string;

  constructor(roomId: string, kind: TargetKind, id: string) {
    this.roomId = roomId;
    this.kind = kind;
    this.id = id;
  }

  /** One handler for one or several verbs (`cleaningStuff.on(['use', 'take'], …)`). */
  on(verbs: GameVerbId | readonly GameVerbId[], handler: StepHandler): void {
    for (const verb of typeof verbs === 'string' ? [verbs] : verbs) {
      registerVerbHandler(this.roomId, this, verb, handler);
    }
  }

  /** `verb` with `item` on this target. Generated verb methods (`onUseItem`) call this. */
  onVerbItem(verb: GameVerbId, item: ItemRef, handler: StepHandler): void {
    registerVerbItemHandler(this.roomId, this, verb, item.id, handler);
  }
}

export class PropHandle extends ClickableHandle {
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
}

export class HotspotHandle extends ClickableHandle {
  constructor(roomId: string, id: string) {
    super(roomId, 'hotspot', id);
  }
}

export class CharacterHandle extends ClickableHandle {
  constructor(roomId: string, id: string) {
    super(roomId, 'character', id);
  }

  /** One speech line from this character. Waits. Same as a `Name: "…"` label. */
  say(text: string, options?: ScriptedSayLineOptions): void {
    return sayTask(this.id, text, options) as unknown as void;
  }
}

/** A verb from `game-config.json`, as the generated verb methods need it. */
export interface VerbSpec {
  readonly id: GameVerbId;
  readonly usesItem?: boolean;
}

function pascal(id: string): string {
  return id
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Adds `on<Verb>` (and `on<Verb>Item` for item verbs) for each configured verb (§8.2). The
 * engine itself knows no verb names; the game's ids module supplies the list and the types.
 */
export function withVerbMethods<H extends ClickableHandle, M>(handle: H, verbs: readonly VerbSpec[]): H & M {
  const methods: Record<string, unknown> = {};
  for (const verb of verbs) {
    methods[`on${pascal(verb.id)}`] = (handler: StepHandler) => handle.on(verb.id, handler);
    if (verb.usesItem) {
      methods[`on${pascal(verb.id)}Item`] = (item: ItemRef, handler: StepHandler) =>
        handle.onVerbItem(verb.id, item, handler);
    }
  }
  return Object.assign(handle, methods) as H & M;
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

export class ItemHandle<Anim extends string = string> implements ItemRef {
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
}

// ─── Dialogs ─────────────────────────────────────────────────────────────────

function dialogCommands(dialogId: string) {
  const game = tryGetActiveBenneGame();
  const manager = tryGetActiveGameStateManager();
  if (!game || !manager) {
    return null;
  }
  return createBenneScriptDialogAccessor(manager, game, () => {})(dialogId as never);
}

export class DialogOptionHandle {
  readonly dialogId: string;
  readonly id: string;

  constructor(dialogId: string, id: string) {
    this.dialogId = dialogId;
    this.id = id;
  }

  on(): void {
    dialogCommands(this.dialogId)?.optionOn.now(this.id);
  }

  off(): void {
    dialogCommands(this.dialogId)?.optionOff.now(this.id);
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
   * Opens the conversation. Phase 1 keeps today's behaviour (does not wait for it to end);
   * waiting is decision 3, Phase 2.
   */
  start(): void {
    const game = tryGetActiveBenneGame();
    if (!game) {
      warnOnce('dialog:no-game', `dialogs.${this.id}.start(): the game is not running — ignored.`);
      return;
    }
    openDialogSessionForId(game, this.id as never);
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

// ─── Flags ───────────────────────────────────────────────────────────────────

/**
 * Declares the game's flags with defaults (§4.7). Reads and writes go straight to the game state
 * at that line. Phase 1 stores each flag under its own name, which matches the keys AI
 * Apocalypse's old scripts use for the café's flags.
 */
export function defineFlags<T extends Record<string, boolean>>(defaults: T): { -readonly [K in keyof T]: boolean } {
  const flags = {} as { -readonly [K in keyof T]: boolean };
  for (const [key, fallback] of Object.entries(defaults)) {
    Object.defineProperty(flags, key, {
      enumerable: true,
      get: () => {
        const value = tryGetActiveGameStateManager()?.getFlag(key);
        return typeof value === 'boolean' ? value : fallback;
      },
      set: (value: boolean) => {
        const m = tryGetActiveGameStateManager();
        if (!m) {
          warnOnce(`flag:${key}`, `flags.${key}: the game is not running — ignored.`);
          return;
        }
        m.setFlag(key, value === true);
      },
    });
  }
  return flags;
}
