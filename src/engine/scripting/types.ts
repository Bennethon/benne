import type * as Phaser from 'phaser';
import type { RoomScene } from '../scenes/RoomScene.js';
import type { BenneScript } from './BenneScript.js';
import type { CharacterBenneScript } from './CharacterBenneScript.js';
import type { InventoryBenneScript } from './InventoryBenneScript.js';
import type { GlobalBenneScript } from './GlobalBenneScript.js';
import type { GuiBenneScript } from './GuiBenneScript.js';
import type { BenneScriptSharedSelectionApi } from './benneScriptFacades.js';

export type {
  AnyInventoryUsedOnPayload,
  BenneScriptSharedSelectionApi,
  InventoryWhenGiveHandler,
  InventoryWhenGiveRegistrar,
  InventoryWhenUseHandler,
  InventoryWhenUseRegistrar,
  RoomInventoryUsedOnRegistrar,
} from './benneScriptFacades.js';

export interface RoomScriptContext {
  /**
   * Main authoring facade (`whenLookAt`, `B.player.walkTo`, …).
   * String ids for verb sugar (prop → hotspot → character), `walkTo`, and prop-only helpers are documented in the **module comment** at the top of `BenneScript.ts`.
   * Includes {@link BenneScriptSharedSelectionApi} (`setActiveVerb`, `setActiveInventory`, …) from {@link import('./BenneScriptCore.js').BenneScriptCore} and tagged **`B.say`**…`` / **`B.say.now`**…`` (PowerQuest-style dialogue blocks).
   */
  readonly B: BenneScript & BenneScriptSharedSelectionApi;

  /** Raw access (advanced use only) */
  readonly events: Phaser.Events.EventEmitter;
  readonly roomId: string;
  readonly roomScene: RoomScene;

  // Convenience re-exports so you can write `onProp` directly inside the callback
  onProp: BenneScript['onProp'];
  whenLookAt: BenneScript['whenLookAt'];
  whenUse: BenneScript['whenUse'];
  whenPickUp: BenneScript['whenPickUp'];
  whenGive: BenneScript['whenGive'];
  whenPush: BenneScript['whenPush'];
  whenPull: BenneScript['whenPull'];
  whenOpen: BenneScript['whenOpen'];
  whenClose: BenneScript['whenClose'];
  whenVerb: BenneScript['whenVerb'];
  whenTalkTo: BenneScript['whenTalkTo'];
  readonly whenInventoryUsedOn: BenneScript['whenInventoryUsedOn'];
}

/** Context passed to each `registerCharacterScript` callback when that character is spawned in the active room. */
export interface CharacterScriptContext {
  /** Self-only verb sugar (`whenLookAt(() => …)`); uses `characterVerbEventId` only. */
  readonly B: CharacterBenneScript & BenneScriptSharedSelectionApi;
  readonly events: Phaser.Events.EventEmitter;
  readonly characterId: string;
  readonly roomId: string;
  readonly roomScene: RoomScene;
  readonly whenInventoryUsedOn: CharacterBenneScript['whenInventoryUsedOn'];
}

/** Context passed to each `registerInventoryScript` callback when a room is active. */
export interface InventoryScriptContext {
  /**
   * Item-scoped verb sugar (`whenLookAt`, …); subscribes to room + global inventory verb ids.
   * **`B.whenUse`** / **`B.whenGive`** add optional behavior; both verbs still arm this item for use-on-target after
   * queued steps unless **`doNotActivate`** was used for every handler on that verb.
   */
  readonly B: InventoryBenneScript & BenneScriptSharedSelectionApi;
  readonly events: Phaser.Events.EventEmitter;
  readonly itemId: string;
  readonly roomId: string;
  readonly roomScene: RoomScene;
  readonly whenInventoryUsedOn: InventoryBenneScript['whenInventoryUsedOn'];
}

/** Passed to each `registerGlobalScript` callback from {@link import('./wireBenneGlobalScripts.js').wireBenneGlobalScripts}. */
export interface GlobalScriptContext {
  readonly B: GlobalBenneScript & BenneScriptSharedSelectionApi;
  readonly events: Phaser.Events.EventEmitter;
  readonly game: Phaser.Game;
}

/** Passed to each `registerGuiScript` callback when content is registered. */
export interface GuiScriptContext {
  readonly B: GuiBenneScript & BenneScriptSharedSelectionApi;
  readonly events: Phaser.Events.EventEmitter;
  readonly guiId: string;
}