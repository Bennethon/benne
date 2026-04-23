import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import type { AnyInventoryUsedOnPayload } from '../events/inventoryOnVerbEvents.js';
import type { InventoryVerbInteractPayload } from '../events/inventoryVerbEvents.js';
import type { BenneScriptSayArgs, BenneScriptCore, BlockingWithNow } from './BenneScriptCore.js';

export type { AnyInventoryUsedOnPayload } from '../events/inventoryOnVerbEvents.js';

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
>;

export type InventoryWhenUseHandler =
  | (() => void)
  | ((p: InventoryVerbInteractPayload) => void);

/**
 * {@link import('./InventoryBenneScript.js').InventoryBenneScript.whenUse} — normal registration activates this
 * item for use-on-target after queued handler steps finish; **`doNotActivate`** opts out.
 */
export interface InventoryWhenUseRegistrar {
  (handler: InventoryWhenUseHandler): void;
  doNotActivate(handler: InventoryWhenUseHandler): void;
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
  hide(): void;
  show(): void;
  get visible(): boolean;
  set visible(v: boolean);
  get description(): string;
  set description(v: string);
}

/** Movement + animation + facing for the player. */
export interface BenneScriptPlayerFacade {
  walkTo: BlockingWithNow<[Point2 | string]>;
  /** Same as {@link import('./BenneScriptCore.js').BenneScriptCore.walkToClicked} on the owning script. */
  walkToClicked: BlockingWithNow<[]>;
  /** Same as {@link import('./BenneScriptCore.js').BenneScriptCore.faceClicked} on the owning script. */
  faceClicked: BlockingWithNow<[]>;
  playAnimation: BlockingWithNow<[string]>;
  say: BlockingWithNow<BenneScriptSayArgs>;
  face: BlockingWithNow<[CharacterFacingLetter]>;
}

/** Movement + animation + facing for an NPC. */
export interface BenneScriptCharacterFacade {
  walkTo: BlockingWithNow<[Point2 | string]>;
  playAnimation: BlockingWithNow<[string]>;
  say: BlockingWithNow<BenneScriptSayArgs>;
  face: BlockingWithNow<[CharacterFacingLetter]>;
}
