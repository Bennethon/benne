import * as Phaser from 'phaser';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import type {
  CharacterVerbInteractPayload,
  RoomHotspotInteractPayload,
  RoomPropInteractPayload,
} from '../events/propInteractionEvents.js';
import type { GivePropInteractPayload } from './benneScriptPayloads.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import {
  globalInventoryOnCharacterEventId,
  globalInventoryOnHotspotEventId,
  globalInventoryOnPropEventId,
  roomInventoryOnCharacterEventId,
  roomInventoryOnHotspotEventId,
  roomInventoryOnPropEventId,
} from '../events/inventoryOnVerbEvents.js';
import {
  characterVerbEventId,
  roomCharacterVerbEventId,
  roomHotspotVerbEventId,
  roomPropVerbEventId,
} from '../events/verbInteractionEvents.js';
import { getRegisteredInventoryDefinitionIds } from '../inventory/inventoryDefinitionRegistry.js';
import {
  playDirectionalAnimation,
  type DirectionalCharacterSprite,
} from '../directionalCharacterAnimation.js';
import type {
  AnyInventoryUsedOnPayload,
  BenneScriptCharacterFacade,
  BenneScriptPlayerFacade,
  BenneScriptPropFacade,
  RoomInventoryUsedOnRegistrar,
} from './benneScriptFacades.js';
import { BenneScriptCore, withNow } from './BenneScriptCore.js';
import {
  createBenneScriptGameStateNamespace,
  createBenneScriptInventoryNamespace,
  type BenneScriptGameStateNamespace,
  type BenneScriptInventoryNamespace,
} from './benneScriptGameStateApi.js';

export type {
  AnyInventoryUsedOnPayload,
  BenneScriptCharacterFacade,
  BenneScriptPlayerFacade,
  BenneScriptPropFacade,
  BenneScriptSharedSelectionApi,
  InventoryWhenGiveHandler,
  InventoryWhenGiveRegistrar,
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
 * | **`walkTo` / `walkTo.now`** on **`B.player`** or **`B.character('…')`** | **Unified target string** (first match): **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** → **`points[].id`**, or **`{ x, y }`** in **room pixels**. **`walkTo`** queues; **`walkTo.now`** and **`face.now`**, **`playAnimation.now`**, **`B.wait.now`** can run without blocking the queue. **`say.now`** also skips the queue but still uses the same per-line room input lock as **`say`**. |
 * | **`walkToClicked` / `walkToClicked.now`** on **`B`**, **`B.player`**, or global **`B`** | Inside a verb handler, walks the player to the **clicked** prop / hotspot / character (same resolution as **`walkTo`** for that id). No room target for pure inventory-row verbs (one-time dev warn). |
 * | **`faceClicked` / `faceClicked.now`** on **`B`**, **`B.player`**, or global **`B`** | Uses payload **`lookAtPoint`** for props/hotspots when present; for **characters**, faces that character’s **feet**; otherwise falls back to the walk stand point (see {@link RoomScene.facePlayerTowardClicked}). Same dev warnings as **`walkToClicked`** when there is no target or no room. |
 * | **`playAnimation(tag)`** | Aseprite **frame tag** on the character sheet (e.g. `'Idle'`, `'WalkL'`). |
 * | **`face(direction)`** | One of **`CharacterFacingLetter`**: `'L' \| 'R' \| 'U' \| 'D' \| 'UL' \| 'UR' \| 'DL' \| 'DR'`. |
 * | **`B.character(id)`** | **`CharacterData.id`** for a character **placed in this room**. |
 * | **`B.say` / `B.say.now`** | Tagged **`B.say`**…``: PowerQuest-style block — lines **`Speaker: text`** (`Player` any case → protagonist id; other names match spawned character ids **case-insensitively**). Blank lines and **`//`** comments ignored; unknown speakers throw. Queues each line; **`B.say.now`**… skips the interaction tail (see implementation notes in **`BenneScriptCore`**). |
 * | **`say` / `say.now`** on **`B.player`** or **`B.character('…')`** | Same dialog overlay as **`B.say`**, plus string form **`B.player.say('…')`**. Scoped tagged blocks: each line is that character (optional **`Player:`** prefix); mismatched **`Name:`** throws (compared **case-insensitively** to the scoped character). Optional second argument **`{ clickToSkip: false \| true }`** on string calls. |
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

  /**
   * Register a handler for "inventory used on target" clicks for this room. Whether the active
   * inventory selection is dropped (active inventory + active verb both cleared) after the handler
   * runs follows {@link import('../verbs/dispatchInventoryOnVerbTarget.js').shouldDropActiveInventoryOnUse}
   * (per-item **`dropWhenUsed`** → global **`dropWhenInventoryUsed`** → default **`false`**).
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
    this.inventory = createBenneScriptInventoryNamespace(manager);
    this.whenInventoryUsedOn = Object.assign(
      (
        targetId: string,
        handler: ((p: AnyInventoryUsedOnPayload) => void) | (() => void),
        options?: { doNotClear?: boolean },
      ) => {
        this.registerInventoryUsedOnForTarget(targetId, handler, options?.doNotClear === true);
      },
      {
        doNotClear: (targetId: string, handler: ((p: AnyInventoryUsedOnPayload) => void) | (() => void)) => {
          this.registerInventoryUsedOnForTarget(targetId, handler, true);
        },
      },
    ) as RoomInventoryUsedOnRegistrar;
  }

  /**
   * Subscribe to a **prop** verb event for this room (**prop id only**). Prefer **`when*`** / **`whenVerb`** for prop → hotspot → character resolution.
   *
   * @param propId - **`props[].id`** in this room’s `.room.json`.
   * @param verbId - Verb id from **`game-config.json`** `verbs[]` (must match **`onVerb`** on the prop).
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
    handler: ((p: AnyInventoryUsedOnPayload) => void) | (() => void),
    doNotClear: boolean,
  ): void {
    const itemIds = getRegisteredInventoryDefinitionIds();
    if (this.roomScene.getRoomPropInstance(targetId)) {
      for (const itemId of itemIds) {
        this.subscribeInventoryUsedOnTargetEvents(
          roomInventoryOnPropEventId(this.roomId, targetId, itemId),
          globalInventoryOnPropEventId(targetId, itemId),
          handler,
          doNotClear,
        );
      }
      return;
    }
    if (this.roomScene.getRoomHotspotInstance(targetId)) {
      for (const itemId of itemIds) {
        this.subscribeInventoryUsedOnTargetEvents(
          roomInventoryOnHotspotEventId(this.roomId, targetId, itemId),
          globalInventoryOnHotspotEventId(targetId, itemId),
          handler,
          doNotClear,
        );
      }
      return;
    }
    if (this.roomScene.getCharacterSprite(targetId)) {
      for (const itemId of itemIds) {
        this.subscribeInventoryUsedOnTargetEvents(
          roomInventoryOnCharacterEventId(this.roomId, targetId, itemId),
          globalInventoryOnCharacterEventId(targetId, itemId),
          handler,
          doNotClear,
        );
      }
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
    return {
      hide: () => {
        scene.setPropScriptVisible(propId, false);
      },
      show: () => {
        scene.setPropScriptVisible(propId, true);
      },
      get visible() {
        return scene.getPropScriptVisible(propId);
      },
      set visible(v: boolean) {
        scene.setPropScriptVisible(propId, v);
      },
      get description() {
        return scene.getPropScriptDescription(propId);
      },
      set description(v: string) {
        scene.setPropScriptDescription(propId, v);
      },
    };
  }

  private makeCharacterFacade(definitionId: string): BenneScriptCharacterFacade {
    const scene = this.roomScene;

    const runCharacterPlayAnimation = (tag: string): void => {
      const sprite = scene.getCharacterSprite(definitionId);
      if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
        if (scene.anims.exists(tag)) {
          sprite.play(tag);
        } else {
          console.warn(`[Benne] Unknown animation tag "${tag}" for character "${definitionId}"`);
        }
      }
    };

    const runCharacterFace = (direction: CharacterFacingLetter): void => {
      const sprite = scene.getCharacterSprite(definitionId) as DirectionalCharacterSprite | undefined;
      if (sprite?.anims) {
        playDirectionalAnimation(sprite, 'Idle', direction);
      }
    };

    const logCharacterSay = (line: string): void => {
      console.log(`[Character ${definitionId}] ${line}`);
    };

    return {
      walkTo: withNow(
        (target: Point2 | string) => {
          this.chain(() => scene.walkCharacterTo(definitionId, target));
        },
        (target: Point2 | string) => {
          void scene.walkCharacterTo(definitionId, target);
        },
      ),
      playAnimation: withNow(
        (tag: string) => {
          this.chain(() => {
            runCharacterPlayAnimation(tag);
            return Promise.resolve();
          });
        },
        runCharacterPlayAnimation,
      ),
      say: this.composeFixedCharacterSayHybrid(scene, definitionId, logCharacterSay),
      face: withNow(
        (direction: CharacterFacingLetter) => {
          this.chain(() => {
            runCharacterFace(direction);
            return Promise.resolve();
          });
        },
        runCharacterFace,
      ),
    };
  }

  character(definitionId: string): BenneScriptCharacterFacade {
    return this.makeCharacterFacade(definitionId);
  }

  get player(): BenneScriptPlayerFacade {
    return this.makePlayerFacadeFromScene(() => this.roomScene);
  }

  cutscene(callback: () => void): void {
    callback();
  }
}
