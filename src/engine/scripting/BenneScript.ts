import * as Phaser from 'phaser';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import { computeDialogLineDurationMs, getGameSettings } from '../ConfigManager.js';
import { getStartingPlayerCharacterId } from '../../game/constants.js';
import type {
  CharacterVerbInteractPayload,
  RoomHotspotInteractPayload,
  RoomPropInteractPayload,
} from '../events/propInteractionEvents.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import {
  characterVerbEventId,
  roomCharacterVerbEventId,
  roomHotspotVerbEventId,
  roomPropVerbEventId,
} from '../events/verbInteractionEvents.js';
import { playDirectionalAnimation, type DirectionalCharacterSprite } from '../directionalCharacterAnimation.js';
import { getEffectiveVerbDefinitions } from '../verbs/verbConfig.js';

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
 * | **`walkTo` / `walkTo.now`** on **`B.player`** or **`B.character('…')`** | **Unified target string** (first match): **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** → **`points[].id`**, or **`{ x, y }`** in **room pixels**. **`walkTo`** queues; **`walkTo.now`** and **`say.now`**, **`face.now`**, **`playAnimation.now`**, **`B.wait.now`** can run without blocking the queue. |
 * | **`playAnimation(tag)`** | Aseprite **frame tag** on the character sheet (e.g. `'Idle'`, `'WalkL'`). |
 * | **`face(direction)`** | One of **`CharacterFacingLetter`**: `'L' \| 'R' \| 'U' \| 'D' \| 'UL' \| 'UR' \| 'DL' \| 'DR'`. |
 * | **`B.character(id)`** | **`CharacterData.id`** for a character **placed in this room**. |
 *
 * Aliased sugar (**`whenLookAt`**, **`whenUse`**, …) maps to **`game-config.json`** verb ids via **`VERB_ALIAS_CANDIDATES`** in this file. **`whenVerb`** uses an exact verb id.
 */

/** Payload for {@link BenneScript.whenGive} — prop interaction plus the item id from the sugar API. */
export type GivePropInteractPayload = RoomPropInteractPayload & { itemId: string };

/** Internal keys for {@link BenneScript.resolveVerbId}. */
type VerbAlias =
  | 'look'
  | 'use'
  | 'pickUp'
  | 'give'
  | 'talkTo'
  | 'push'
  | 'pull'
  | 'open'
  | 'close';

const VERB_ALIAS_CANDIDATES: Record<VerbAlias, readonly string[]> = {
  look: ['look', 'examine'],
  use: ['use', 'interact'],
  pickUp: ['pickUp', 'pickup', 'take'],
  give: ['give'],
  talkTo: ['talkTo', 'talk', 'speak'],
  push: ['push'],
  pull: ['pull'],
  open: ['open'],
  close: ['close'],
};

/**
 * Callable that participates in the interaction queue; **`fn.now`** runs the same action immediately
 * without blocking subsequent chained steps (fire-and-forget).
 */
export type BlockingWithNow<TArgs extends readonly unknown[] = readonly unknown[]> = ((
  ...args: TArgs
) => void) & { now: (...args: TArgs) => void };

function withNow<TArgs extends readonly unknown[]>(
  blocking: (...args: TArgs) => void,
  nowImpl: (...args: TArgs) => void,
): BlockingWithNow<TArgs> {
  const fn = blocking as BlockingWithNow<TArgs>;
  fn.now = nowImpl;
  return fn;
}

/**
 * High-level API passed as **`B`** in the `registerRoomScript` callback. Chains async steps (walk, delays) in order; use **`await`** only if you expose promises yourself.
 *
 * @see The module comment above for which string ids to use with each method.
 */
export class BenneScript {
  private static unresolvedVerbWarnings = new Set<string>();
  private static unresolvedTargetVerbWarnings = new Set<string>();

  private events: Phaser.Events.EventEmitter;
  private roomId: string;
  private roomScene: RoomScene;
  private disposers: Array<() => void> = [];
  private interactionTail: Promise<void> = Promise.resolve();

  /**
   * Pause the interaction chain for **`seconds`**. **`B.wait.now(seconds)`** schedules the delay only (does not block the queue).
   */
  readonly wait: BlockingWithNow<[number]>;

  constructor(events: Phaser.Events.EventEmitter, roomId: string, roomScene: RoomScene) {
    this.events = events;
    this.roomId = roomId;
    this.roomScene = roomScene;

    this.wait = withNow(
      (seconds: number) => {
        const ms = Math.max(0, seconds * 1000);
        const scene = this.roomScene;
        this.chain(
          () =>
            new Promise<void>((resolve) => {
              scene.time.delayedCall(ms, () => resolve());
            }),
        );
      },
      (seconds: number) => {
        const ms = Math.max(0, seconds * 1000);
        this.roomScene.time.delayedCall(ms, () => {});
      },
    );
  }

  /** Remove all listeners this instance registered on the bus (called from the active {@link RoomScene} on shutdown). */
  dispose(): void {
    for (const off of this.disposers) {
      off();
    }
    this.disposers = [];
  }

  private beginInteraction(): void {
    this.interactionTail = Promise.resolve();
  }

  private endInteraction(): Promise<void> {
    return this.interactionTail;
  }

  /**
   * Queue async work so it runs only after prior chained steps finish. Pass a **factory** so
   * `walkTo` / `say` / timers do not start until their turn (eager `Promise`s would fire every tween in one sync handler).
   */
  private chain(factory: () => Promise<unknown>): void {
    this.interactionTail = this.interactionTail.then(factory).then(() => undefined);
  }

  /**
   * Maps a Bennescript alias to the first matching `verbs[].id` from `game-config.json`
   * (via {@link getEffectiveVerbDefinitions}). If none match, logs once and returns the alias
   * so listeners still register (align your JSON ids with the tried candidates when possible).
   */
  private resolveVerbId(alias: VerbAlias): string {
    const settings = getGameSettings();
    const configured = new Set(getEffectiveVerbDefinitions(settings).map((v) => v.id));
    const candidates = VERB_ALIAS_CANDIDATES[alias];
    for (const id of candidates) {
      if (configured.has(id)) {
        return id;
      }
    }
    const warnKey = alias;
    if (!BenneScript.unresolvedVerbWarnings.has(warnKey)) {
      BenneScript.unresolvedVerbWarnings.add(warnKey);
      console.warn(
        `[Benne] No verb in game-config matches alias "${alias}" (tried: ${candidates.join(', ')}). ` +
          `Handlers register under id "${alias}". Add a matching verb to game-config.json.`,
      );
    }
    return alias;
  }

  private subscribe(
    eventId: string,
    run: (payload: unknown) => void,
  ): void {
    const wrapped = async (payload: unknown) => {
      this.beginInteraction();
      try {
        run(payload);
        await this.endInteraction();
      } catch (err) {
        console.error(`[Benne] Error in ${eventId} handler:`, err);
      }
    };
    this.events.on(eventId, wrapped);
    this.disposers.push(() => this.events.off(eventId, wrapped));
  }

  /**
   * Direct Phaser / EventBus access. Prefer **`B.whenLookAt`**, **`whenVerb`**, etc.; use this for custom event ids or tiers the facade does not wrap.
   *
   * @example
   * import { roomHotspotVerbEventId } from '@engine/events/verbInteractionEvents';
   * B.raw.on(roomHotspotVerbEventId(roomId, 'exitDoor', 'look'), () => { ... });
   */
  readonly raw = {
    on: (event: string | symbol, fn: (...args: unknown[]) => void, context?: unknown) =>
      this.events.on(event, fn as (...args: unknown[]) => void, context),
    once: (event: string | symbol, fn: (...args: unknown[]) => void, context?: unknown) =>
      this.events.once(event, fn as (...args: unknown[]) => void, context),
    off: (event: string | symbol, fn?: (...args: unknown[]) => void, context?: unknown) =>
      this.events.off(event, fn as never, context),
    emit: (event: string | symbol, ...args: unknown[]) => this.events.emit(event, ...args),
  };

  /**
   * Room-level actions (stub / future).
   * @param _roomId - Target room id from `rooms.manifest.json` / manifest.
   */
  readonly room = {
    changeTo: (_roomId: string, _options?: { spawn?: string; transition?: string }) => {
      console.warn('[Benne] B.room.changeTo is not implemented yet.');
    },
  };

  /**
   * Inventory helpers (stub / future).
   * @param _itemId - Item id from game data (when implemented).
   */
  readonly inventory = {
    give: (_itemId: string) => {
      console.warn('[Benne] B.inventory.give is not implemented yet.');
    },
    has: (_itemId: string) => false,
  };

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

  /**
   * Runs when the player **looks** at this target (primary mouse button by default).
   *
   * @param targetId - **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** (first match in this room).
   *
   * @example
   * B.whenLookAt('desk', () => B.player.say('Ink stains.'));
   */
  whenLookAt(targetId: string, handler: () => void): void;
  whenLookAt(targetId: string, handler: (p: any) => void): void;
  whenLookAt(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('look'), targetId, handler);
  }

  /**
   * Runs when the player **uses** this target (secondary mouse button by default).
   *
   * @param targetId - **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** (first match in this room).
   *
   * @example
   * B.whenUse('lever', () => B.player.walkTo('door'));
   */
  whenUse(targetId: string, handler: () => void): void;
  whenUse(targetId: string, handler: (p: any) => void): void;
  whenUse(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('use'), targetId, handler);
  }

  /**
   * Runs when the player **pick-ups** this target (verb must exist in config + target **`onVerb`**).
   *
   * @param targetId - **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** (first match in this room).
   */
  whenPickUp(targetId: string, handler: () => void): void;
  whenPickUp(targetId: string, handler: (p: any) => void): void;
  whenPickUp(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('pickUp'), targetId, handler);
  }

  /**
   * Runs when the player **gives** **`itemId`** to prop **`targetId`**.
   *
   * @param itemId - Inventory item id (when inventory is implemented).
   * @param targetId - **`props[].id`** of the prop that receives the give verb.
   *
   * @example
   * B.whenGive('key', 'door', () => { ... });
   */
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

  /**
   * Runs when the player **pushes** this target.
   *
   * @param targetId - **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** (first match in this room).
   */
  whenPush(targetId: string, handler: () => void): void;
  whenPush(targetId: string, handler: (p: any) => void): void;
  whenPush(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('push'), targetId, handler);
  }

  /**
   * Runs when the player **pulls** this target.
   *
   * @param targetId - **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** (first match in this room).
   */
  whenPull(targetId: string, handler: () => void): void;
  whenPull(targetId: string, handler: (p: any) => void): void;
  whenPull(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('pull'), targetId, handler);
  }

  /**
   * Runs when the player **opens** this target.
   *
   * @param targetId - **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** (first match in this room).
   */
  whenOpen(targetId: string, handler: () => void): void;
  whenOpen(targetId: string, handler: (p: any) => void): void;
  whenOpen(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('open'), targetId, handler);
  }

  /**
   * Runs when the player **closes** this target.
   *
   * @param targetId - **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** (first match in this room).
   */
  whenClose(targetId: string, handler: () => void): void;
  whenClose(targetId: string, handler: (p: any) => void): void;
  whenClose(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('close'), targetId, handler);
  }

  /**
   * Runs when the player applies a specific **verb** to this target (escape hatch for verbs without sugar).
   *
   * @param verbId - Exact **`verbs[].id`** from **`game-config.json`** (not an alias).
   * @param targetId - **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** (first match in this room).
   *
   * @example
   * B.whenVerb('look', 'desk', () => { ... });
   */
  whenVerb(verbId: string, targetId: string, handler: () => void): void;
  whenVerb(verbId: string, targetId: string, handler: (p: any) => void): void;
  whenVerb(
    verbId: string,
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(verbId, targetId, handler);
  }

  /**
   * Runs when the player **talks** to this target — same **prop → hotspot → character** resolution as **`whenLookAt`** / **`whenUse`** (talk / speak verb alias).
   * Room + character-global event subscription applies only when **`targetId`** resolves to a **character**; props and hotspots use one room-scoped channel each.
   *
   * @param targetId - **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** (first match in this room).
   *
   * @example
   * B.whenTalkTo('clerk', () => B.player.walkTo({ x: 120, y: 140 }));
   * B.whenTalkTo('computer', () => B.player.say('No response.'));
   */
  whenTalkTo(targetId: string, handler: () => void): void;
  whenTalkTo(targetId: string, handler: (p: any) => void): void;
  whenTalkTo(
    targetId: string,
    handler: ((p: any) => void) | (() => void),
  ): void {
    this.registerVerbForTarget(this.resolveVerbId('talkTo'), targetId, handler);
  }

  /**
   * Script control for one prop: visibility and runtime description overrides.
   *
   * @param propId - **`props[].id`** in this room’s `.room.json`.
   *
   * @example
   * B.prop('desk').hide();
   * B.prop('desk').description = 'Empty.';
   */
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
      say: withNow(
        (line: string) => {
          logCharacterSay(line);
          const ms = computeDialogLineDurationMs(line);
          this.chain(
            () =>
              new Promise<void>((resolve) => {
                scene.setDialogTextOverlay({
                  visible: true,
                  text: line,
                  talkCharacterDefinitionId: definitionId,
                });
                scene.time.delayedCall(ms, () => {
                  scene.setDialogTextOverlay({ visible: false });
                  resolve();
                });
              }),
          );
        },
        (line: string) => {
          logCharacterSay(line);
          const ms = computeDialogLineDurationMs(line);
          scene.setDialogTextOverlay({
            visible: true,
            text: line,
            talkCharacterDefinitionId: definitionId,
          });
          scene.time.delayedCall(ms, () => {
            scene.setDialogTextOverlay({ visible: false });
          });
        },
      ),
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

  /**
   * Facade for one character **definition** present in this room (first instance wins at runtime).
   *
   * @param definitionId - **`CharacterData.id`** from the character’s `*.character.json`.
   *
   * @example
   * B.character('henry').walkTo('desk');
   */
  character(definitionId: string): BenneScriptCharacterFacade {
    return this.makeCharacterFacade(definitionId);
  }

  /**
   * The playable character in this room (from **`game-config.json`** starting player id).
   *
   * @example
   * B.player.walkTo('exitDoor');
   * B.player.face('R');
   */
  get player(): BenneScriptPlayerFacade {
    const scene = this.roomScene;

    const runPlayerPlayAnimation = (tag: string): void => {
      const pl = scene.player;
      if (pl?.anims) {
        if (scene.anims.exists(tag)) {
          pl.play(tag);
        } else {
          console.warn(`[Benne] Unknown animation tag "${tag}" for player`);
        }
      }
    };

    const runPlayerFace = (direction: CharacterFacingLetter): void => {
      const pl = scene.player;
      if (pl) {
        playDirectionalAnimation(pl, 'Idle', direction);
      }
    };

    const logPlayerSay = (line: string): void => {
      console.log(`[Player] ${line}`);
    };

    return {
      walkTo: withNow(
        (target: Point2 | string) => {
          this.chain(() => scene.walkPlayerTo(target));
        },
        (target: Point2 | string) => {
          void scene.walkPlayerTo(target);
        },
      ),
      playAnimation: withNow(
        (tag: string) => {
          this.chain(() => {
            runPlayerPlayAnimation(tag);
            return Promise.resolve();
          });
        },
        runPlayerPlayAnimation,
      ),
      say: withNow(
        (line: string) => {
          logPlayerSay(line);
          const ms = computeDialogLineDurationMs(line);
          const talkCharacterDefinitionId = getStartingPlayerCharacterId();
          this.chain(
            () =>
              new Promise<void>((resolve) => {
                scene.setDialogTextOverlay({
                  visible: true,
                  text: line,
                  talkCharacterDefinitionId,
                });
                scene.time.delayedCall(ms, () => {
                  scene.setDialogTextOverlay({ visible: false });
                  resolve();
                });
              }),
          );
        },
        (line: string) => {
          logPlayerSay(line);
          const ms = computeDialogLineDurationMs(line);
          const talkCharacterDefinitionId = getStartingPlayerCharacterId();
          scene.setDialogTextOverlay({
            visible: true,
            text: line,
            talkCharacterDefinitionId,
          });
          scene.time.delayedCall(ms, () => {
            scene.setDialogTextOverlay({ visible: false });
          });
        },
      ),
      face: withNow(
        (direction: CharacterFacingLetter) => {
          this.chain(() => {
            runPlayerFace(direction);
            return Promise.resolve();
          });
        },
        runPlayerFace,
      ),
    };
  }

  /**
   * Reserved hook for future cutscene boundaries (currently runs **`callback`** immediately).
   */
  cutscene(callback: () => void): void {
    callback();
  }
}

/** Visibility + description overrides for one prop; see {@link BenneScript.prop}. */
export interface BenneScriptPropFacade {
  /** Hide the prop sprite in the room. */
  hide(): void;
  /** Show the prop sprite. */
  show(): void;
  /** Whether the prop is currently visible. */
  get visible(): boolean;
  set visible(v: boolean);
  /** Runtime description string (script override). */
  get description(): string;
  set description(v: string);
}

/** Movement + animation + facing for the player; see {@link BenneScript.player}. */
export interface BenneScriptPlayerFacade {
  /**
   * Walk the player’s feet to a room point or resolve a **string** id (first match): **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** (in room) → **`points[].id`**. Room pixel coordinates.
   *
   * @param target - **`{ x, y }`** or one id string from the table in the `BenneScript` module doc.
   *
   * @example
   * B.player.walkTo('desk');
   * B.player.walkTo('exitDoor');
   * B.player.walkTo('guard');
   * B.player.walkTo('mySpawnPoint');
   * B.player.walkTo({ x: 180, y: 140 });
   */
  walkTo: BlockingWithNow<[Point2 | string]>;

  /**
   * Play an Aseprite animation tag on the player (e.g. **`'WalkL'`**, **`'IdleD'`**).
   *
   * @param tag - Frame tag on the player character sheet.
   */
  playAnimation: BlockingWithNow<[string]>;

  /** Shows line on the `dialog-text` GUI above the player’s `talkPoint`; hides per `game-config.json` `dialog` timing. */
  say: BlockingWithNow<[string]>;

  /**
   * Face a direction using the **`Idle*`** clip family.
   *
   * @param direction - **`'L'`** | **`'R'`** | **`'U'`** | **`'D'`** | **`'UL'`** | **`'UR'`** | **`'DL'`** | **`'DR'`**
   */
  face: BlockingWithNow<[CharacterFacingLetter]>;
}

/** Movement + animation + facing for an NPC; see {@link BenneScript.character}. */
export interface BenneScriptCharacterFacade {
  /**
   * Walk this character to **`{ x, y }`** or the same string resolution order as {@link BenneScriptPlayerFacade.walkTo}.
   *
   * @param target - Room pixels or unified walk id (prop → hotspot → character → point).
   *
   * @example
   * B.character('guard').walkTo('lever');
   * B.character('guard').walkTo({ x: 200, y: 100 });
   */
  walkTo: BlockingWithNow<[Point2 | string]>;

  /**
   * Play an Aseprite tag on this character (e.g. **`'WalkL'`**, **`'IdleD'`**).
   *
   * @param tag - Frame tag from this character’s sheet JSON.
   */
  playAnimation: BlockingWithNow<[string]>;

  /** Shows line on the `dialog-text` GUI above this character’s `talkPoint`; hides per `game-config.json` `dialog` timing. */
  say: BlockingWithNow<[string]>;

  /**
   * Set facing via **`Idle` + direction** (e.g. **`IdleR`**).
   *
   * @param direction - **`'L'`** | **`'R'`** | **`'U'`** | **`'D'`** | **`'UL'`** | **`'UR'`** | **`'DL'`** | **`'DR'`**
   */
  face: BlockingWithNow<[CharacterFacingLetter]>;
}
