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
  BenneScriptPlayerFacade,
  BenneScriptPropFacade,
  InventoryWhenUsedOnPayloadHandler,
  RoomInventoryUsedOnRegistrar,
} from './benneScriptFacades.js';
import { BenneScriptCore, withNow } from './BenneScriptCore.js';
import {
  createBenneScriptGameStateNamespace,
  createBenneScriptInventoryNamespace,
  type BenneScriptGameStateNamespace,
  type BenneScriptInventoryNamespace,
} from './benneScriptGameStateApi.js';
import { createBenneScriptDialogAccessor } from './DialogBenneScript.js';
import { tryGetGlobalRoomHookRegistry } from '../scenes/roomHookRegistrySingleton.js';
import type { RoomTransitionContext } from '../../types/roomTransition.js';

export type {
  AnyInventoryUsedOnPayload,
  BenneScriptCharacterFacade,
  BenneScriptDialogCommandSurface,
  BenneScriptInventoryItemFacade,
  BenneScriptPlayerFacade,
  BenneScriptPropFacade,
  BenneScriptRoomFacade,
  BenneScriptSharedSelectionApi,
  InventoryWhenGiveHandler,
  InventoryWhenGiveRegistrar,
  InventoryWhenUsedOnPayloadHandler,
  InventoryWhenUseHandler,
  InventoryWhenUseRegistrar,
  RoomInventoryUsedOnRegistrar,
} from './benneScriptFacades.js';
export type {
  BenneScriptSayArgs,
  BenneScriptSayLineOptions,
  BenneScriptSayDialogueTagged,
  BenneScriptSayDialogueHybrid,
  BenneSayDialogueScope,
  BlockingWithNow,
} from './BenneScriptCore.js';
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
 * | **`walkTo` / `walkTo.now`** on **`B.player`** or **`B.character('…')`** | Pathfind **Walk**; **Unified target string** (first match): **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** → **`points[].id`**, or **`{ x, y }`** in **room pixels**. **`walkTo.now`** does not block the queue. |
 * | **`moveTo` / `moveTo.now`** / **`moveToNow`** | Instantly place **feet** at the resolved point (clamped to walkable) and update **Idle** facing — not a walk. **`moveTo`** queues on the interaction tail; **`moveTo.now`** and **`moveToNow`** run immediately. |
 * | **`walkToClicked` / `walkToClicked.now`** on **`B`**, **`B.player`**, or global **`B`** | Inside a verb handler, walks the player to the **clicked** prop / hotspot / character (same resolution as **`walkTo`** for that id). No room target for pure inventory-row verbs (one-time dev warn). |
 * | **`faceClicked` / `faceClicked.now`** on **`B`**, **`B.player`**, or global **`B`** | Uses payload **`lookAtPoint`** for props/hotspots when present; for **characters**, faces that character’s **feet**; otherwise falls back to the walk stand point (see {@link RoomScene.facePlayerTowardClicked}). Same dev warnings as **`walkToClicked`** when there is no target or no room. |
 * | **`B.fadeOut` / `B.fadeIn`**, **`.now`** | Full-screen fade over the room and all GUI overlays; optional duration (default **0.35** s) and **`0xRRGGBB` color** (default black). Queues on the interaction tail except **`.now`**. |
 * | **`playAnimation(tag)`** / **`playAnimation.now`** | One-shot Aseprite tag (not saved); then **directional idle** or **persisted** `animation` override. Same idea for **`B.prop(id).playAnimation`**, which restores that prop’s saved **base** `animation`. |
 * | **`animation` / `animation =`**, **`animationNow(...)`** | Setters queue on the **interaction tail** (order with **`walkTo`** / **`say`** / **`playAnimation`**); **`animationNow`** applies persist + sprite **immediately**. Props: persisted base tag. Characters / player: effective get; set / **`animationNow`** accept **`string \| null`** (`null` clears). **`stopAnimation()`** (characters / player) clears override + save, always immediate. |
 * | **`face(direction)`** | One of **`CharacterFacingLetter`**: `'L' \| 'R' \| 'U' \| 'D' \| 'UL' \| 'UR' \| 'DL' \| 'DR'`. |
 * | **`B.character(id)`** | **`CharacterData.id`** for a character **placed in this room**. |
 * | **`B.say` / `B.say.now`** | Tagged **`B.say`**…``: PowerQuest-style block — lines **`Speaker: text`** (`Player` any case → protagonist id; other names match spawned character ids **case-insensitively**). Blank lines and **`//`** comments ignored; unknown speakers throw. Queues each line; **`B.say.now`**… skips the interaction tail (see implementation notes in **`BenneScriptCore`**). |
 * | **`say` / `say.now`** on **`B.player`** or **`B.character('…')`** | Same dialog overlay as **`B.say`**, plus string form **`B.player.say('…')`**. Scoped tagged blocks: each line is that character (optional **`Player:`** prefix); mismatched **`Name:`** throws (compared **case-insensitively** to the scoped character). Optional second argument **`{ clickToSkip: false \| true }`** on string calls. |
 * | **`B.playFrom('…', () => { … })`** | **Dev / tooling** — named starting-state for this room; runs once after **`whenEnterRoom`** / **`whenEnterAnyRoom`** on **`boot`** or editor **`preview`** when **`globalThis.__BENNE_PLAY_FROM_NAME`** matches (BENNE Play). Skipped on in-game **`changeTo`** (`transition`). |
 * | **`B.inventory.add` / `remove`**, **`.now`** | **`GameStateManager`** quantity mutations. Blocking form **queues** on the interaction tail; **`.now`** applies immediately. **`has`**, **`quantityOf`**, **`items`**, **`clearInventory`** stay synchronous. |
 * | **`B.inventory('id').animation`**, **`cursorAnimation`** | Maps to JSON **`defaultAnimation`** / **`cursorAnimation`**; persisted in **`GameStateManager`** variables. Setters **queue** on the interaction tail (same as **`B.player.animation`**); **`animationNow`** / **`cursorAnimationNow`** apply immediately. Empty string clears that field’s override (JSON applies). |
 * | **`B.prop(id).hide` / `show`**, **`.now`**, **`visible`**, **`visibleNow`** | Script visibility overrides. **`hide` / `show` / `visible =`** queue on the interaction tail; **`.now`** / **`visibleNow`** apply immediately. |
 *
 * Aliased sugar (**`whenLookAt`**, **`whenUse`**, …) maps to **`game-config.json`** verb ids via **`VERB_ALIAS_CANDIDATES`** in `BenneScriptCore`. **`whenVerb`** uses an exact verb id.
 */

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
  readonly dialog: (dialogId: string) => BenneScriptDialogCommandSurface;

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
        targetId: string,
        handler: InventoryWhenUsedOnPayloadHandler,
        options?: { doNotClear?: boolean },
      ) => {
        this.registerInventoryUsedOnForTarget(targetId, handler, options?.doNotClear === true);
      },
      {
        doNotClear: (targetId: string, handler: InventoryWhenUsedOnPayloadHandler) => {
          this.registerInventoryUsedOnForTarget(targetId, handler, true);
        },
      },
    ) as RoomInventoryUsedOnRegistrar;
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
    propId: string,
    verbId: string,
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
    verbId: string,
    targetId: string,
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
    targetId: string,
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

  whenLookAt(targetId: string, handler: () => void): void;
  whenLookAt(targetId: string, handler: (p: any) => void): void;
  whenLookAt(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('look'), targetId, handler);
  }

  whenUse(targetId: string, handler: () => void): void;
  whenUse(targetId: string, handler: (p: any) => void): void;
  whenUse(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('use'), targetId, handler);
  }

  whenPickUp(targetId: string, handler: () => void): void;
  whenPickUp(targetId: string, handler: (p: any) => void): void;
  whenPickUp(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('pickUp'), targetId, handler);
  }

  whenGive(itemId: string, targetId: string, handler: () => void): void;
  whenGive(itemId: string, targetId: string, handler: (payload: GivePropInteractPayload) => void): void;
  whenGive(
    itemId: string,
    targetId: string,
    handler: ((payload: GivePropInteractPayload) => void) | (() => void),
  ): void {
    const verbId = this.resolveVerbId('give');
    this.onPropMapped(targetId, verbId, handler, (base) => ({ ...base, itemId }));
  }

  whenPush(targetId: string, handler: () => void): void;
  whenPush(targetId: string, handler: (p: any) => void): void;
  whenPush(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('push'), targetId, handler);
  }

  whenPull(targetId: string, handler: () => void): void;
  whenPull(targetId: string, handler: (p: any) => void): void;
  whenPull(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('pull'), targetId, handler);
  }

  whenOpen(targetId: string, handler: () => void): void;
  whenOpen(targetId: string, handler: (p: any) => void): void;
  whenOpen(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('open'), targetId, handler);
  }

  whenClose(targetId: string, handler: () => void): void;
  whenClose(targetId: string, handler: (p: any) => void): void;
  whenClose(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('close'), targetId, handler);
  }

  whenVerb(verbId: string, targetId: string, handler: () => void): void;
  whenVerb(verbId: string, targetId: string, handler: (p: any) => void): void;
  whenVerb(
    verbId: string,
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(verbId, targetId, handler);
  }

  whenTalkTo(targetId: string, handler: () => void): void;
  whenTalkTo(targetId: string, handler: (p: any) => void): void;
  whenTalkTo(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('talkTo'), targetId, handler);
  }

  prop(propId: string): BenneScriptPropFacade {
    const scene = this.roomScene;
    const B = this;
    return {
      hide: withNow(
        () => {
          B.chain(() => {
            scene.setPropScriptVisible(propId, false);
            return Promise.resolve();
          });
        },
        () => {
          scene.setPropScriptVisible(propId, false);
        },
      ),
      show: withNow(
        () => {
          B.chain(() => {
            scene.setPropScriptVisible(propId, true);
            return Promise.resolve();
          });
        },
        () => {
          scene.setPropScriptVisible(propId, true);
        },
      ),
      get visible() {
        return scene.getPropScriptVisible(propId);
      },
      set visible(v: boolean) {
        B.chain(() => {
          scene.setPropScriptVisible(propId, v);
          return Promise.resolve();
        });
      },
      visibleNow(v: boolean): void {
        scene.setPropScriptVisible(propId, v);
      },
      get description() {
        return scene.getPropScriptDescription(propId);
      },
      set description(v: string) {
        scene.setPropScriptDescription(propId, v);
      },
      get animation() {
        return scene.getPropScriptBaseAnimationTag(propId);
      },
      set animation(tag: string) {
        B.chain(() => {
          scene.setPropScriptBaseAnimationTag(propId, tag);
          return Promise.resolve();
        });
      },
      animationNow(tag: string): void {
        scene.setPropScriptBaseAnimationTag(propId, tag);
      },
      playAnimation: withNow(
        (tag: string) => {
          B.chain(() => scene.playPropScriptAnimationOneShot(propId, tag));
        },
        (tag: string) => {
          void scene.playPropScriptAnimationOneShot(propId, tag);
        },
      ),
    } as BenneScriptPropFacade;
  }

  get player(): BenneScriptPlayerFacade {
    return this.makePlayerFacadeFromScene(() => this.roomScene);
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

  whenEnterRoom(
    handler: (ctx: RoomTransitionContext) => void | Promise<void>,
  ): void {
    const r = tryGetGlobalRoomHookRegistry();
    if (!r) {
      if (import.meta.env.DEV) {
        console.warn('[Benne] B.whenEnterRoom: room hook registry missing — not wired.');
      }
      return;
    }
    r.registerRoomEnterRoom(this.roomId, handler);
  }

  whenEnterRoomAfterFade(
    handler: (ctx: RoomTransitionContext) => void | Promise<void>,
  ): void {
    const r = tryGetGlobalRoomHookRegistry();
    if (!r) {
      if (import.meta.env.DEV) {
        console.warn('[Benne] B.whenEnterRoomAfterFade: room hook registry missing — not wired.');
      }
      return;
    }
    r.registerRoomEnterRoomAfterFade(this.roomId, handler);
  }

  /**
   * Registers a named **Play From** block for this room (BENNE Play). Runs once after
   * **`whenEnterRoom`** / **`whenEnterAnyRoom`** on **`boot`** or **`preview`** when **`globalThis.__BENNE_PLAY_FROM_NAME`**
   * matches and the current room matches **`this.roomId`**. Skipped on in-game **`changeTo`** (`transition`).
   * Queued **`B.*`** without **`.now`** from enter / play-from are flushed before fade-in (see **`RoomScene.waitForEnterPhaseBenneScriptQueues`**).
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

  cutscene(callback: () => void): void {
    callback();
  }
}
