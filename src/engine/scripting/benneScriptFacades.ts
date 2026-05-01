import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import type { AnyInventoryUsedOnPayload } from '../events/inventoryOnVerbEvents.js';
import type { InventoryVerbInteractPayload } from '../events/inventoryVerbEvents.js';
import type { BenneScriptCore, BenneScriptSayDialogueHybrid, BlockingWithNow } from './BenneScriptCore.js';
import type { ControlFacade } from './GuiRuntime.js';

export type { AnyInventoryUsedOnPayload } from '../events/inventoryOnVerbEvents.js';

/** `B.room` — `changeTo` / `changeToNow` and save-game room context from {@link import('../gameState/GameStateManager.js').GameStateManager}. */
export interface BenneScriptRoomFacade {
  readonly current: string;
  readonly last: string | null;
  changeTo: BlockingWithNow<[string]>;
  changeToNow(roomId: string): void;
}

/**
 * Address a GUI overlay by **`*.gui.json` `id`** (**`B.gui('verbs').control('foo')`**).
 * **`control`** returns the live {@link import('./GuiRuntime.js').ControlFacade}, or an inert noop facade when the overlay
 * is missing, **`id`** is blank, or the control is unknown (matching forgiving overlay behavior elsewhere).
 */
export interface BenneScriptGuiOverlayRef {
  control(controlId: string): ControlFacade;
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
  | 'currentHoverDescription'
  | 'currentHoverTarget'
  | 'room'
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

/** {@link import('./BenneScript.js').BenneScript.whenInventoryUsedOn} — default clears active inventory after queued steps. */
export interface RoomInventoryUsedOnRegistrar {
  (
    targetId: string,
    handler: ((p: AnyInventoryUsedOnPayload) => void) | (() => void),
    options?: { doNotClear?: boolean },
  ): void;
  doNotClear(
    targetId: string,
    handler: ((p: AnyInventoryUsedOnPayload) => void) | (() => void),
  ): void;
}

/** Visibility + description overrides for one prop (`BenneScript.prop`). */
export interface BenneScriptPropFacade {
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
}

/** Movement + animation + facing for the player. */
export interface BenneScriptPlayerFacade {
  walkTo: BlockingWithNow<[Point2 | string]>;
  /**
   * Teleport feet to a resolved point (clamped to walkable); updates **Idle** facing. Queued on the
   * interaction tail — use {@link walkTo} for pathfind walking.
   */
  moveTo: BlockingWithNow<[Point2 | string]>;
  /** Same as `moveTo.now` — immediate teleport, skips the queue. */
  moveToNow: (target: Point2 | string) => void;
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
}

/** Movement + animation + facing for an NPC. */
export interface BenneScriptCharacterFacade {
  walkTo: BlockingWithNow<[Point2 | string]>;
  /** Teleport (see {@link BenneScriptPlayerFacade.moveTo}). */
  moveTo: BlockingWithNow<[Point2 | string]>;
  moveToNow: (target: Point2 | string) => void;
  get animation(): string;
  /** Queues override + save on the interaction tail; `null` clears. */
  set animation(tag: string | null);
  /** Override + save immediately (skips interaction tail); `null` clears. */
  animationNow(tag: string | null): void;
  playAnimation: BlockingWithNow<[string]>;
  stopAnimation(): void;
  say: BenneScriptSayDialogueHybrid;
  face: BlockingWithNow<[CharacterFacingLetter]>;
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
  optionOn: BlockingWithNow<[optionId: string]>;
  optionOff: BlockingWithNow<[optionId: string]>;
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
