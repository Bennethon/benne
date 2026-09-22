import * as Phaser from 'phaser';
import type {
  CharacterVerbInteractPayload,
  RoomHotspotInteractPayload,
  RoomPropInteractPayload,
} from '../events/propInteractionEvents.js';
import type { GivePropInteractPayload } from './benneScriptPayloads.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { registerPlayFromForRoom } from './devPlayFromRegistry.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import {
  globalInventoryOnCharacterAnySourceEventId,
  globalInventoryOnHotspotAnySourceEventId,
  globalInventoryOnPropAnySourceEventId,
  roomInventoryOnCharacterAnySourceEventId,
  roomInventoryOnHotspotAnySourceEventId,
  roomInventoryOnPropAnySourceEventId,
} from '../events/inventoryOnVerbEvents.js';
import {
  characterVerbEventId,
  roomCharacterVerbEventId,
  roomHotspotVerbEventId,
  roomPropVerbEventId,
} from '../events/verbInteractionEvents.js';
import type {
  BenneScriptDialogCommandSurface,
  BenneScriptHotspotFacade,
  BenneScriptPlayerFacade,
  BenneScriptPropFacade,
  BenneScriptRegionFacade,
  InventoryWhenUsedOnPayloadHandler,
  RoomInventoryUsedOnRegistrar,
} from './benneScriptFacades.js';
import { BenneScriptCore } from './BenneScriptCore.js';
import {
  createBenneScriptHotspotFacade,
  createBenneScriptPropFacade,
  createBenneScriptRegionActiveFacade,
} from './benneScriptRoomEntityApi.js';
import {
  createBenneScriptGameStateNamespace,
  createBenneScriptInventoryNamespace,
  type BenneScriptGameStateNamespace,
  type BenneScriptInventoryNamespace,
} from './benneScriptGameStateApi.js';
import { createBenneScriptDialogAccessor } from './DialogBenneScript.js';
import { tryGetGlobalRoomHookRegistry } from '../scenes/roomHookRegistrySingleton.js';
import type { CutsceneOptions } from '../../types/cutscene.js';
import type { RoomTransitionContext } from '../../types/roomTransition.js';
import type { RegionEnterExitContext } from '../../types/regionEnterExit.js';
import type {
  DialogId,
  GameVerbId,
  HotspotId,
  InventoryItemId,
  PropId,
  RegionId,
  VerbTargetId,
} from '../../types/generated/benne-game-ids.js';
import type { UpdateContext } from './types.js';
import { roomRegionEnterEventId, roomRegionExitEventId } from '../events/regionEnterExitEvents.js';

export type {
  AnyInventoryUsedOnPayload,
  BenneScriptCharacterFacade,
  BenneScriptDialogCommandSurface,
  BenneScriptHotspotFacade,
  BenneScriptInventoryItemFacade,
  BenneScriptRegionActiveFacade,
  BenneScriptPlayerFacade,
  BenneScriptPropFacade,
  BenneScriptRegionFacade,
  BenneScriptRoomFacade,
  BenneScriptSoundFacade,
  BenneScriptSharedSelectionApi,
  InventoryWhenGiveHandler,
  InventoryWhenGiveRegistrar,
  InventoryWhenUsedOnPayloadHandler,
  InventoryWhenUseHandler,
  InventoryWhenUseRegistrar,
  RoomInventoryUsedOnRegistrar,
} from './benneScriptFacades.js';
export type { CharacterFollowOptions } from '../../types/characterFollow.js';
export type {
  BenneScriptSayArgs,
  BenneScriptSayLineOptions,
  BenneScriptSayDialogueTagged,
  BenneScriptSayDialogueHybrid,
  BenneSayDialogueScope,
  BlockingWithNow,
} from './BenneScriptCore.js';
export type { MusicPlayOptions, SoundPlayOptions } from '../sound/benneSoundTypes.js';
export { withNow } from './BenneScriptCore.js';

/**
 * # Bennescript — valid string ids for this room
 *
 * Use ids that match **this room’s** `*.room.json` and placed characters, so handlers and movement resolve correctly.
 *
 * | Kind | Where it comes from |
 * |------|---------------------|
 * | **`whenLookAt`**, **`whenUse`**, **`whenTalkTo`**, **`whenPickUp`**, **`whenPush`**, **`whenPull`**, **`whenOpen`**, **`whenClose`**, **`whenVerb`** | One **`targetId`** per room: **prop** (`props[].id`) → **hotspot** (`hotspots[].id`) → **character** (`CharacterData.id` spawned here, including the player). Optional **`(p: any)`** payload — shape depends on which kind matched; see **`registerVerbForTarget`**. Character verb payloads may include **world** **`walkToPoint`** / **`talkPoint`** when authored in **`*.character.json`**. |
 * | **`whenGive`** | **`targetId`** is the receiving **prop** only (`props[].id`; inventory **`itemId`** is separate). |
 * | **`onProp`**, **`B.prop(id)`** | **`props[].id`** only (explicit prop wiring). |
 * | **`walkTo` / `walkTo.now`** on **`B.player`** or **`B.character('…')`** | Pathfind **Walk**; **Unified target string** (first match): **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** → **`points[].id`**, or **`{ x, y }`** in **room pixels**. **`walkTo.now`** does not block the queue. No-op when **`movable`** is **`false`** (see **`*.character.json`** **`movable`** and **`B.player` / `B.character(id).movable`**). |
 * | **`moveTo` / `moveTo.now`** / **`moveToNow`** | Instantly place **feet** at the resolved point (clamped to walkable) and update **Idle** facing — not a walk. **`moveTo`** queues on the interaction tail; **`moveTo.now`** and **`moveToNow`** run immediately. |
 * | **`walkToClicked` / `walkToClicked.now`** on **`B`**, **`B.player`**, or global **`B`** | Inside a verb handler, walks the player to the **clicked** prop / hotspot / character (same resolution as **`walkTo`** for that id), then faces like **`faceClicked`** after the walk completes. No room target for pure inventory-row verbs (one-time dev warn). |
 * | **`faceClicked` / `faceClicked.now`** on **`B`**, **`B.player`**, or global **`B`** | Uses payload **`lookAtPoint`** for props/hotspots when present; for **characters**, faces that character’s **feet**; otherwise falls back to the walk stand point (see {@link RoomScene.facePlayerTowardClicked}). Same dev warnings as **`walkToClicked`** when there is no target or no room. |
 * | **`B.fadeOut` / `B.fadeIn`**, **`.now`** | Full-screen fade over the room and all GUI overlays; optional duration (default **0.35** s) and **`0xRRGGBB` color** (default black). Queues on the interaction tail except **`.now`**. |
 * | **`playAnimation(tag)`** / **`playAnimation.now`** | One-shot Aseprite tag (not saved); then **directional idle** or **persisted** `animation` override. Same idea for **`B.prop(id).playAnimation`**, which restores that prop’s saved **base** `animation`. |
 * | **`animation` / `animation =`**, **`animationNow(...)`** | Setters queue on the **interaction tail** (order with **`walkTo`** / **`say`** / **`playAnimation`**); **`animationNow`** applies persist + sprite **immediately**. Props: persisted base tag. Characters / player: effective get; set / **`animationNow`** accept **`string \| null`** (`null` clears). **`stopAnimation()`** (characters / player) clears override + save, always immediate. |
 * | **`face(direction)`** | One of **`CharacterFacingLetter`**: `'L' \| 'R' \| 'U' \| 'D' \| 'UL' \| 'UR' \| 'DL' \| 'DR'`. |
 * | **`startFacingCharacter` / `stopFacingCharacter`** on **`B.character('…')`** | **`startFacingCharacter(targetCharacterId, minWaitTime?, maxWaitTime?)`** keeps the NPC’s **Idle** facing toward the other character’s **feet**; when either’s feet move, a new random delay in **[`minWaitTime`, `maxWaitTime`]** seconds (defaults **0.2** / **0.4**) runs before turning again. **`stopFacingCharacter()`** clears it. Both queue on the interaction tail; routed through **`RoomScene.startCharacterFacingCharacter` / `stopCharacterFacingCharacter`**. |
 * | **`B.character(id)`** | **`CharacterData.id`** for a character **placed in this room**. |
 * | **`B.region(id).whenEnter` / `whenExit`**, **`B.whenEnterRegion` / `whenExitRegion`** | **`regions[].id`** in this room’s JSON. Feet crossing uses the same **last-wins** active polygon test as perspective scale (**`resolveWinningRoomRegionIdAtFeet`**). Handlers wire through **`subscribe`** (interaction queue + verb click context rules, like **`whenLookAt`**). Payload: **`RegionEnterExitContext`**. |
 * | **`B.onUpdate`** | Non-blocking per-frame hook (**`UpdateContext`**: **`deltaSeconds`**, **`roomId`**). Runs after engine **`RoomScene.update`** work; **not** on the interaction tail; **no** **`.now`**. Cleaned up when the room script’s **`B`** is disposed (room unload). Global **`B.onUpdate`** runs after room handlers. |
 * | **`B.hotspot(id).active`** / **`.clickable`** / **`.description`** | **`hotspots[].id`** (case-sensitive, exact JSON match) — get/set persisted **active** (immediate, not queued). **`.clickable`** is an alias of **`.active`**. **`.description`** is the hover / verb-line label (immediate; persists `` `room:<roomId>:hotspot:<id>:description` ``). Mounts or removes the polygon input zone; **`resolveMovementTarget`** still resolves inactive hotspot ids. Unknown id: **`.active`** getter **`false`**, **`.description`** getter **`''`**, setter no-op, DEV warn once per room load. |
 * | **`B.say` / `B.say.now`** | Tagged **`B.say`**…``: PowerQuest-style block — lines **`Speaker: text`** (`Player` any case → protagonist id; other names match spawned character ids **case-insensitively**). Blank lines and **`//`** comments ignored; unknown speakers throw. Queues each line; **`B.say.now`**… skips the interaction tail (see implementation notes in **`BenneScriptCore`**). |
 * | **`B.display` / `B.display.now`** | Narration via **`display-text`** GUI — **`B.display('…')`** blocks until the player clicks to dismiss (no timer). Same interaction-tail rules as **`B.wait`** / **`say`**; **`.now`** skips the tail. |
 * | **`say` / `say.now`** on **`B.player`** or **`B.character('…')`** | Same dialog overlay as **`B.say`**, plus string form **`B.player.say('…')`**. Scoped tagged blocks: each line is that character (optional **`Player:`** prefix); mismatched **`Name:`** throws (compared **case-insensitively** to the scoped character). Optional second argument **`{ clickToSkip: false \| true }`** on string calls. |
 * | **`B.playFrom('…', () => { … })`** | **Dev / tooling** — named starting-state for this room; runs once before **`whenEnterAnyRoom`** / **`whenEnterRoom`** on **`boot`** or editor **`preview`** when **`globalThis.__BENNE_PLAY_FROM_NAME`** matches (BENNE Play). Skipped on in-game **`changeTo`** (`transition`). |
 * | **`B.inventory.add` / `remove`**, **`.now`** | **`GameStateManager`** quantity mutations. Blocking form **queues** on the interaction tail; **`.now`** applies immediately. **`has`**, **`quantityOf`**, **`items`**, **`clearInventory`** stay synchronous. |
 * | **`B.inventory('id').animation`**, **`cursorAnimation`** (getter / setter) | **Getters**: effective tags (JSON **`defaultAnimation`** / **`cursorAnimation`** ± save overrides — **`''`** when no armed cursor clip). **Setters**: persisted in **`GameStateManager`** variables; **queue** on the interaction tail (same as **`B.player.animation`**); **`animationNow`** / **`cursorAnimationNow`** apply immediately. Setter **empty string** clears that field’s override (JSON applies). |
 * | **`B.inventory('id').description`** | Hover / verb-line label. Immediate (not queued). Persists `` `inventory:<itemId>:description` `` over JSON **`description`**. Empty string is stored as empty (does **not** clear to JSON). |
 * | **`B.prop(id).hide` / `show`**, **`.now`**, **`visible`**, **`visibleNow`** | Script visibility overrides. **`hide` / `show` / `visible =`** queue on the interaction tail; **`.now`** / **`visibleNow`** apply immediately. |
 * | **`B.prop(id).clickable`** | When **`false`**, the prop is not hit-tested (no hover, verbs, or inventory-on-target). Setter queues like **`visible`**; persists `` `room:<roomId>:prop:<id>:clickable` `` over JSON **`clickable`**. Enabling needs a collider (≥3 points). **`walkTo('id')`** is **not** gated. |
 * | **`B.prop(id).description`** | Hover / verb-line label. Immediate (not queued). Persists `` `room:<roomId>:prop:<id>:description` `` over JSON **`description`**. |
 * | **`B.character(id).hide` / `show`**, **`.now`**, **`visible`**, **`visibleNow`** | Same as props: persisted script visibility (global per character definition id); **`hide` / `show` / `visible =`** queue; **`.now`** / **`visibleNow`** immediate. |
 * | **`movable` / `movable =`** on **`B.player`** or **`B.character('…')`** | When **`false`**, pathfind walks are ignored (including **`walkToClicked`** and click-to-walk); **`moveTo`** still teleports. Setter queues on the interaction tail; persists **`character:<id>:movable`** over the JSON default from **`*.character.json`**. |
 * | **`B.prop(id).fade(from, to, durationSeconds)`** / **`.now`**, **`B.character(id).fade(...)`** / **`.now`** | Sprite alpha tween (linear ease) from **`fromAlpha`** to **`toAlpha`** over **`durationSeconds`**; alphas clamp to **`[0, 1]`**. Blocking form queues on the interaction tail and waits for completion; **`fade.now`** starts immediately. **`toAlpha`** is persisted (**`room:…:prop:…:alpha`** / **`character:…:alpha`**). |
 *
 * Aliased sugar (**`whenLookAt`**, **`whenUse`**, …) maps to **`game-config.json`** verb ids via **`VERB_ALIAS_CANDIDATES`** in `BenneScriptCore`. **`whenVerb`** uses an exact verb id.
 *
 * String id parameters use generated unions from **`src/types/generated/benne-game-ids.d.ts`** (regenerate with **`npm run generate:game-ids`**).
 */

const noopBenneScriptRegionFacade: BenneScriptRegionFacade = {
  get active() { return true; },
  set active(_v: boolean) {},
  whenEnter(): void {},
  whenExit(): void {},
};

/**
 * High-level API passed as **`B`** in the `registerRoomScript` callback. Chains async steps (walk, delays) in order; use **`await`** only if you expose promises yourself.
 *
 * @see The module comment above for which string ids to use with each method.
 */
export class BenneScript extends BenneScriptCore {
  private static unresolvedTargetVerbWarnings = new Set<string>();
  private static unresolvedInventoryOnTargetWarnings = new Set<string>();

  private roomId: string;
  private roomScene: RoomScene;

  /** Cross-room flags and variables (see `GameStateManager`). */
  readonly state: BenneScriptGameStateNamespace;
  /** Item quantities; survives room loads (see `GameStateManager`). */
  readonly inventory: BenneScriptInventoryNamespace;

  /** SCUMM-style dialog session control (`*.dialog.json` + `registerDialogScript`). */
  readonly dialog: (dialogId: DialogId) => BenneScriptDialogCommandSurface;

  /**
   * Register a handler for "inventory used on target" clicks for this room. Whether the active
   * inventory selection is dropped (active inventory + active verb both cleared) after the handler
   * runs follows {@link import('../verbs/dispatchInventoryOnVerbTarget.js').shouldDropActiveInventoryOnUse}
   * (per-item **`dropWhenUsed`** → global **`dropWhenInventoryUsed`** → default **`false`**), unless you
   * **`return false`** from the payload handler — that re-emits the global **`whenInventoryOnVerbTargetUnhandled`**
   * path and skips this subscription’s drop-after-tail so the global script owns clearing.
   * **`doNotClear`** is a per-handler hard opt-out: the active inventory always stays armed after
   * this handler's queued steps regardless of policy.
   */
  readonly whenInventoryUsedOn: RoomInventoryUsedOnRegistrar;

  constructor(events: Phaser.Events.EventEmitter, roomId: string, roomScene: RoomScene) {
    super(events, () => roomScene.time, () => roomScene);
    this.roomId = roomId;
    this.roomScene = roomScene;
    const manager = resolveGameStateManager(roomScene.game);
    this.state = createBenneScriptGameStateNamespace(manager);
    this.inventory = createBenneScriptInventoryNamespace(manager, () => this.roomScene, (factory) =>
      this.chain(factory),
    );
    this.dialog = createBenneScriptDialogAccessor(manager, roomScene.game, (factory) => this.chain(factory));
    this.whenInventoryUsedOn = Object.assign(
      (
        targetId: VerbTargetId,
        handler: InventoryWhenUsedOnPayloadHandler,
        options?: { doNotClear?: boolean },
      ) => {
        this.registerInventoryUsedOnForTarget(targetId, handler, options?.doNotClear === true);
      },
      {
        doNotClear: (targetId: VerbTargetId, handler: InventoryWhenUsedOnPayloadHandler) => {
          this.registerInventoryUsedOnForTarget(targetId, handler, true);
        },
      },
    ) as RoomInventoryUsedOnRegistrar;
  }

  protected acquireOnUpdateSubscription(handler: (ctx: UpdateContext) => void): () => void {
    return this.roomScene.registerBenneScriptOnUpdateHandler(handler);
  }

  /**
   * Subscribe to a **prop** verb event for this room (**prop id only**). Prefer **`when*`** / **`whenVerb`** for prop → hotspot → character resolution.
   *
   * @param propId - **`props[].id`** in this room’s `.room.json`.
   * @param verbId - Verb id from **`game-config.json`** `verbs[]` (dispatch is listener-first).
   * @param handler - Receives {@link RoomPropInteractPayload} when the handler accepts a parameter.
   *
   * @example
   * B.onProp('desk', 'look', () => console.log('looked'));
   * B.onProp('desk', 'use', (p) => console.log(p.propId));
   */
  onProp(
    propId: PropId,
    verbId: GameVerbId,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    const eventId = roomPropVerbEventId(this.roomId, propId, verbId);
    this.subscribe(eventId, (payload) => {
      const p = payload as RoomPropInteractPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: RoomPropInteractPayload) => void)(p);
      }
    });
  }

  /**
   * Subscribe to a **hotspot** verb event for this room (hotspot id only). Prefer **`when*`** / **`whenVerb`** for automatic resolution.
   */
  private onHotspot(
    hotspotId: string,
    verbId: string,
    handler: ((payload: RoomHotspotInteractPayload) => void) | (() => void),
  ): void {
    const eventId = roomHotspotVerbEventId(this.roomId, hotspotId, verbId);
    this.subscribe(eventId, (payload) => {
      const p = payload as RoomHotspotInteractPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: RoomHotspotInteractPayload) => void)(p);
      }
    });
  }

  /**
   * Subscribes to **both** room-scoped and character-global verb events for a **character** target.
   * Used only when {@link registerVerbForTarget} resolves **`targetId`** to a spawned character — not for props or hotspots.
   *
   * Handlers use **`(p: any)`** for the same reason as {@link registerVerbForTarget}.
   */
  private subscribeCharacterVerb(
    characterId: string,
    verbId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    const inner = (payload: unknown) => {
      const p = payload as CharacterVerbInteractPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: any) => void)(p);
      }
    };
    this.subscribe(roomCharacterVerbEventId(this.roomId, characterId, verbId), inner);
    this.subscribe(characterVerbEventId(characterId, verbId), inner);
  }

  /**
   * Registers **`handler`** for **`verbId`** on **`targetId`** by resolving the target in order:
   *
   * 1. **Prop** — if `props[]` has this id: single room event via {@link onProp}.
   * 2. **Hotspot** — else if `hotspots[]` has this id: single room event via {@link onHotspot}.
   * 3. **Character** — else if a character with this **definition id** is spawned in the room: {@link subscribeCharacterVerb}
   *    (room + character-global events, matching **`dispatchVerbInteraction`** for characters).
   *
   * If nothing matches, calls {@link warnNoVerbTarget} once per (`roomId`, `targetId`, `verbId`).
   *
   * Handlers use **`(p: any)`** so one API can cover prop, hotspot, and character payloads without a public exported union;
   * use **`onProp`** or types from **`propInteractionEvents`** when you want strict typing.
   */
  private registerVerbForTarget(
    verbId: GameVerbId,
    targetId: VerbTargetId,
    handler: ((p: any) => void) | (() => void),
  ): void {
    if (this.roomScene.getRoomPropInstance(targetId)) {
      this.onProp(
        targetId,
        verbId,
        handler as ((payload: RoomPropInteractPayload) => void) | (() => void),
      );
      return;
    }
    if (this.roomScene.getRoomHotspotInstance(targetId)) {
      this.onHotspot(
        targetId,
        verbId,
        handler as ((payload: RoomHotspotInteractPayload) => void) | (() => void),
      );
      return;
    }
    if (this.roomScene.getCharacterSprite(targetId)) {
      this.subscribeCharacterVerb(targetId, verbId, handler);
      return;
    }
    this.warnNoVerbTarget(targetId, verbId);
  }

  private warnNoVerbTarget(targetId: string, verbId: string): void {
    const key = `${this.roomId}:${targetId}:${verbId}`;
    if (BenneScript.unresolvedTargetVerbWarnings.has(key)) {
      return;
    }
    BenneScript.unresolvedTargetVerbWarnings.add(key);
    console.warn(
      `[Benne] No prop, hotspot, or character found with id '${targetId}' for verb '${verbId}' in room '${this.roomId}'. Handler was not registered.`,
    );
  }

  private warnNoInventoryOnTarget(targetId: string): void {
    const key = `${this.roomId}:${targetId}:inventoryOn`;
    if (BenneScript.unresolvedInventoryOnTargetWarnings.has(key)) {
      return;
    }
    BenneScript.unresolvedInventoryOnTargetWarnings.add(key);
    console.warn(
      `[Benne] No prop, hotspot, or character found with id '${targetId}' for whenInventoryUsedOn in room '${this.roomId}'. Handler was not registered.`,
    );
  }

  private registerInventoryUsedOnForTarget(
    targetId: VerbTargetId,
    handler: InventoryWhenUsedOnPayloadHandler,
    doNotClear: boolean,
  ): void {
    if (this.roomScene.getRoomPropInstance(targetId)) {
      this.subscribeInventoryUsedOnTargetEvents(
        roomInventoryOnPropAnySourceEventId(this.roomId, targetId),
        globalInventoryOnPropAnySourceEventId(targetId),
        handler,
        doNotClear,
      );
      return;
    }
    if (this.roomScene.getRoomHotspotInstance(targetId)) {
      this.subscribeInventoryUsedOnTargetEvents(
        roomInventoryOnHotspotAnySourceEventId(this.roomId, targetId),
        globalInventoryOnHotspotAnySourceEventId(targetId),
        handler,
        doNotClear,
      );
      return;
    }
    if (this.roomScene.getCharacterSprite(targetId)) {
      this.subscribeInventoryUsedOnTargetEvents(
        roomInventoryOnCharacterAnySourceEventId(this.roomId, targetId),
        globalInventoryOnCharacterAnySourceEventId(targetId),
        handler,
        doNotClear,
      );
      return;
    }
    this.warnNoInventoryOnTarget(targetId);
  }

  /** Like {@link onProp} but passes a transformed payload (e.g. {@link whenGive}). */
  private onPropMapped<P>(
    propId: string,
    verbId: string,
    handler: ((payload: P) => void) | (() => void),
    map: (base: RoomPropInteractPayload) => P,
  ): void {
    const eventId = roomPropVerbEventId(this.roomId, propId, verbId);
    this.subscribe(eventId, (payload) => {
      const base = payload as RoomPropInteractPayload;
      const p = map(base);
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: P) => void)(p);
      }
    });
  }

  whenLookAt(targetId: VerbTargetId, handler: () => void): void;
  whenLookAt(targetId: VerbTargetId, handler: (p: any) => void): void;
  whenLookAt(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('look'), targetId, handler);
  }

  whenUse(targetId: VerbTargetId, handler: () => void): void;
  whenUse(targetId: VerbTargetId, handler: (p: any) => void): void;
  whenUse(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('use'), targetId, handler);
  }

  whenPickUp(targetId: VerbTargetId, handler: () => void): void;
  whenPickUp(targetId: VerbTargetId, handler: (p: any) => void): void;
  whenPickUp(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('pickUp'), targetId, handler);
  }

  whenGive(itemId: InventoryItemId, targetId: PropId, handler: () => void): void;
  whenGive(itemId: InventoryItemId, targetId: PropId, handler: (payload: GivePropInteractPayload) => void): void;
  whenGive(
    itemId: string,
    targetId: string,
    handler: ((payload: GivePropInteractPayload) => void) | (() => void),
  ): void {
    const verbId = this.resolveVerbId('give');
    this.onPropMapped(targetId, verbId, handler, (base) => ({ ...base, itemId }));
  }

  whenPush(targetId: VerbTargetId, handler: () => void): void;
  whenPush(targetId: VerbTargetId, handler: (p: any) => void): void;
  whenPush(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('push'), targetId, handler);
  }

  whenPull(targetId: VerbTargetId, handler: () => void): void;
  whenPull(targetId: VerbTargetId, handler: (p: any) => void): void;
  whenPull(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('pull'), targetId, handler);
  }

  whenOpen(targetId: VerbTargetId, handler: () => void): void;
  whenOpen(targetId: VerbTargetId, handler: (p: any) => void): void;
  whenOpen(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('open'), targetId, handler);
  }

  whenClose(targetId: VerbTargetId, handler: () => void): void;
  whenClose(targetId: VerbTargetId, handler: (p: any) => void): void;
  whenClose(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('close'), targetId, handler);
  }

  whenVerb(verbId: GameVerbId, targetId: VerbTargetId, handler: () => void): void;
  whenVerb(verbId: GameVerbId, targetId: VerbTargetId, handler: (p: any) => void): void;
  whenVerb(
    verbId: GameVerbId,
    targetId: VerbTargetId,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(verbId, targetId, handler);
  }

  whenTalkTo(targetId: VerbTargetId, handler: () => void): void;
  whenTalkTo(targetId: VerbTargetId, handler: (p: any) => void): void;
  whenTalkTo(
    targetId: VerbTargetId,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('talkTo'), targetId, handler);
  }

  prop(propId: PropId): BenneScriptPropFacade {
    return createBenneScriptPropFacade(
      propId,
      () => this.roomScene,
      (factory) => this.chain(factory),
      this.sound,
      this.video,
    );
  }

  get player(): BenneScriptPlayerFacade {
    return this.makePlayerFacadeFromScene(() => this.roomScene);
  }

  region(regionId: RegionId): BenneScriptRegionFacade {
    const rid = String(regionId).trim();
    if (rid.length === 0) {
      if (import.meta.env.DEV) {
        console.warn('[Benne] B.region: region id must be a non-empty string.');
      }
      return noopBenneScriptRegionFacade;
    }
    const active = createBenneScriptRegionActiveFacade(rid, () => this.roomScene);
    const B = this;
    return {
      get active() {
        return active.active;
      },
      set active(v: boolean) {
        active.active = v;
      },
      whenEnter(handler: (() => void) | ((ctx: RegionEnterExitContext) => void)): void {
        const eventId = roomRegionEnterEventId(B.roomId, rid);
        B.subscribe(eventId, (payload) => {
          const p = payload as RegionEnterExitContext;
          if (handler.length === 0) {
            (handler as () => void)();
          } else {
            (handler as (x: RegionEnterExitContext) => void)(p);
          }
        });
      },
      whenExit(handler: (() => void) | ((ctx: RegionEnterExitContext) => void)): void {
        const eventId = roomRegionExitEventId(B.roomId, rid);
        B.subscribe(eventId, (payload) => {
          const p = payload as RegionEnterExitContext;
          if (handler.length === 0) {
            (handler as () => void)();
          } else {
            (handler as (x: RegionEnterExitContext) => void)(p);
          }
        });
      },
    };
  }

  hotspot(hotspotId: HotspotId): BenneScriptHotspotFacade {
    return createBenneScriptHotspotFacade(hotspotId, () => this.roomScene);
  }

  whenEnterRegion(
    regionId: RegionId,
    handler: (() => void) | ((ctx: RegionEnterExitContext) => void),
  ): void {
    this.region(regionId).whenEnter(handler);
  }

  whenExitRegion(
    regionId: RegionId,
    handler: (() => void) | ((ctx: RegionEnterExitContext) => void),
  ): void {
    this.region(regionId).whenExit(handler);
  }

  whenLeaveRoom(
    handler: (ctx: RoomTransitionContext) => void | Promise<void>,
  ): void {
    const r = tryGetGlobalRoomHookRegistry();
    if (!r) {
      if (import.meta.env.DEV) {
        console.warn('[Benne] B.whenLeaveRoom: room hook registry missing — not wired.');
      }
      return;
    }
    r.registerRoomLeaveRoom(this.roomId, handler);
  }

  /**
   * @param options `{ skippable: false }` makes the automatic enter cutscene unskippable by ESC
   * (see {@link BenneScriptCore.cutscene}). One unskippable handler locks the whole enter phase.
   */
  whenEnterRoom(
    handler: (ctx: RoomTransitionContext) => void | Promise<void>,
    options?: CutsceneOptions,
  ): void {
    const r = tryGetGlobalRoomHookRegistry();
    if (!r) {
      if (import.meta.env.DEV) {
        console.warn('[Benne] B.whenEnterRoom: room hook registry missing — not wired.');
      }
      return;
    }
    r.registerRoomEnterRoom(this.roomId, handler, options);
  }

  whenLoadedRoom(
    handler: (ctx: RoomTransitionContext) => void | Promise<void>,
  ): void {
    const r = tryGetGlobalRoomHookRegistry();
    if (!r) {
      if (import.meta.env.DEV) {
        console.warn('[Benne] B.whenLoadedRoom: room hook registry missing — not wired.');
      }
      return;
    }
    r.registerRoomLoadedRoom(this.roomId, handler);
  }

  /**
   * @param options `{ skippable: false }` makes the automatic after-fade cutscene unskippable by
   * ESC (see {@link BenneScriptCore.cutscene}). One unskippable handler locks the whole phase.
   */
  whenEnterRoomAfterFade(
    handler: (ctx: RoomTransitionContext) => void | Promise<void>,
    options?: CutsceneOptions,
  ): void {
    const r = tryGetGlobalRoomHookRegistry();
    if (!r) {
      if (import.meta.env.DEV) {
        console.warn('[Benne] B.whenEnterRoomAfterFade: room hook registry missing — not wired.');
      }
      return;
    }
    r.registerRoomEnterRoomAfterFade(this.roomId, handler, options);
  }

  /**
   * Registers a named **Play From** block for this room (BENNE Play). Runs once before
   * **`whenEnterAnyRoom`** / **`whenEnterRoom`** on **`boot`** or **`preview`** when **`globalThis.__BENNE_PLAY_FROM_NAME`**
   * matches and the current room matches **`this.roomId`**. Skipped on in-game **`changeTo`** (`transition`).
   * Queued **`B.*`** without **`.now`** from Play From are flushed before enter handlers, and
   * enter-handler queues are flushed before fade-in (see **`RoomScene.waitForEnterPhaseBenneScriptQueues`**).
   */
  playFrom(name: string, handler: () => void | Promise<void>): void {
    const id = String(name).trim();
    if (id.length === 0) {
      if (import.meta.env.DEV) {
        console.warn('[Benne] B.playFrom: name must be a non-empty string.');
      }
      return;
    }
    registerPlayFromForRoom(this.roomId, id, handler);
  }

}
