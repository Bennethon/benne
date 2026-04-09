import * as Phaser from 'phaser';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import { getGameSettings } from '../ConfigManager.js';
import type { RoomPropInteractPayload, CharacterVerbInteractPayload } from '../events/propInteractionEvents.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import {
  characterVerbEventId,
  roomCharacterVerbEventId,
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
 * | **`whenLookAt` / `whenUse` / `whenPickUp` / … / `onProp` / `B.prop(id)`** | **`props[].id`** (the prop’s `id` field). Hotspots are **not** registered through these helpers — subscribe with `B.raw.on` and `roomHotspotVerbEventId` if needed. |
 * | **`whenTalkTo` / `B.character(id)`** | **`CharacterData.id`** of a character **placed in this room** (`characters[].definition` → that JSON’s `id`). |
 * | **`whenGive(itemId, targetId, …)`** | **`itemId`**: inventory item id (future). **`targetId`**: **`props[].id`** of the prop that receives the give verb. |
 * | **`walkTo('…')`** on **`B.player`** or **`B.character('…')`** | **Unified target string** (first match wins): **`props[].id`** → **`hotspots[].id`** → **`CharacterData.id`** (character in room) → **`points[].id`**. Or pass **`{ x, y }`** in **room pixels**. Unknown ids warn once and behave as a no-move. |
 * | **`playAnimation(tag)`** | Aseprite **frame tag** on the character sheet (e.g. `'Idle'`, `'WalkL'`). |
 * | **`face(direction)`** | One of **`CharacterFacingLetter`**: `'L' \| 'R' \| 'U' \| 'D' \| 'UL' \| 'UR' \| 'DL' \| 'DR'`. |
 * | **`whenVerb(verbId, propId, …)`** | **`verbId`**: exact id from **`game-config.json`** `verbs[]`. **`propId`**: **`props[].id`**. |
 *
 * Sugar verbs (`whenLookAt`, `whenUse`, …) map to config verbs by alias (e.g. look → `look` or `examine`); see **`VERB_ALIAS_CANDIDATES`** in this file.
 */

const DEFAULT_SAY_MS = 400;

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
 * High-level API passed as **`B`** in the `registerRoomScript` callback. Chains async steps (walk, delays) in order; use **`await`** only if you expose promises yourself.
 *
 * @see The module comment above for which string ids to use with each method.
 */
export class BenneScript {
  private static unresolvedVerbWarnings = new Set<string>();

  private events: Phaser.Events.EventEmitter;
  private roomId: string;
  private roomScene: RoomScene;
  private disposers: Array<() => void> = [];
  private interactionTail: Promise<void> = Promise.resolve();

  constructor(events: Phaser.Events.EventEmitter, roomId: string, roomScene: RoomScene) {
    this.events = events;
    this.roomId = roomId;
    this.roomScene = roomScene;
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

  private chain(promise: Promise<unknown>): void {
    this.interactionTail = this.interactionTail.then(() => promise).then(() => undefined);
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
   * Direct Phaser / EventBus access. Prefer **`B.whenLookAt`** etc. for props; use this for hotspot events or custom ids.
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
   * Subscribe to a **prop** verb event for this room. Usually prefer **`whenLookAt`**, **`whenUse`**, etc.
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
   * Runs when the player **looks** at this prop (primary mouse button by default).
   *
   * @param propId - **`props[].id`** (clickable prop with look verb enabled in JSON).
   *
   * @example
   * B.whenLookAt('desk', () => B.player.say('Ink stains.'));
   */
  whenLookAt(propId: string, handler: () => void): void;
  whenLookAt(propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenLookAt(
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, this.resolveVerbId('look'), handler);
  }

  /**
   * Runs when the player **uses** this prop (secondary mouse button by default).
   *
   * @param propId - **`props[].id`**.
   *
   * @example
   * B.whenUse('lever', () => B.player.walkTo('door'));
   */
  whenUse(propId: string, handler: () => void): void;
  whenUse(propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenUse(
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, this.resolveVerbId('use'), handler);
  }

  /**
   * Runs when the player **pick-ups** this prop (verb must exist in config + prop **`onVerb`**).
   *
   * @param propId - **`props[].id`**.
   */
  whenPickUp(propId: string, handler: () => void): void;
  whenPickUp(propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenPickUp(
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, this.resolveVerbId('pickUp'), handler);
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
   * Runs when the player **pushes** this prop.
   *
   * @param propId - **`props[].id`**.
   */
  whenPush(propId: string, handler: () => void): void;
  whenPush(propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenPush(
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, this.resolveVerbId('push'), handler);
  }

  /**
   * Runs when the player **pulls** this prop.
   *
   * @param propId - **`props[].id`**.
   */
  whenPull(propId: string, handler: () => void): void;
  whenPull(propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenPull(
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, this.resolveVerbId('pull'), handler);
  }

  /**
   * Runs when the player **opens** this prop.
   *
   * @param propId - **`props[].id`**.
   */
  whenOpen(propId: string, handler: () => void): void;
  whenOpen(propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenOpen(
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, this.resolveVerbId('open'), handler);
  }

  /**
   * Runs when the player **closes** this prop.
   *
   * @param propId - **`props[].id`**.
   */
  whenClose(propId: string, handler: () => void): void;
  whenClose(propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenClose(
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, this.resolveVerbId('close'), handler);
  }

  /**
   * Runs when the player applies a specific **verb** to this prop.
   *
   * @param verbId - Exact **`verbs[].id`** from **`game-config.json`** (not an alias).
   * @param propId - **`props[].id`**.
   *
   * @example
   * B.whenVerb('look', 'desk', () => { ... });
   */
  whenVerb(verbId: string, propId: string, handler: () => void): void;
  whenVerb(verbId: string, propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenVerb(
    verbId: string,
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, verbId, handler);
  }

  /**
   * Runs when the player **talks** to this character (room-scoped + character-global channels).
   *
   * @param characterId - **`CharacterData.id`** for a character placed in this room.
   *
   * @example
   * B.whenTalkTo('clerk', () => B.player.walkTo({ x: 120, y: 140 }));
   */
  whenTalkTo(characterId: string, handler: () => void): void;
  whenTalkTo(characterId: string, handler: (payload: CharacterVerbInteractPayload) => void): void;
  whenTalkTo(
    characterId: string,
    handler: ((payload: CharacterVerbInteractPayload) => void) | (() => void),
  ): void {
    const verbId = this.resolveVerbId('talkTo');
    const roomEv = roomCharacterVerbEventId(this.roomId, characterId, verbId);
    const charEv = characterVerbEventId(characterId, verbId);
    const wrapped = async (payload: unknown) => {
      this.beginInteraction();
      try {
        const p = payload as CharacterVerbInteractPayload;
        if (handler.length === 0) {
          (handler as () => void)();
        } else {
          (handler as (x: CharacterVerbInteractPayload) => void)(p);
        }
        await this.endInteraction();
      } catch (err) {
        console.error(`[Benne] Error in character talk handler (${characterId}):`, err);
      }
    };
    this.events.on(roomEv, wrapped);
    this.events.on(charEv, wrapped);
    this.disposers.push(() => {
      this.events.off(roomEv, wrapped);
      this.events.off(charEv, wrapped);
    });
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
    return {
      walkTo: (target: Point2 | string) => {
        this.chain(scene.walkCharacterTo(definitionId, target));
      },
      playAnimation: (tag: string) => {
        const sprite = scene.getCharacterSprite(definitionId);
        if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
          if (scene.anims.exists(tag)) {
            sprite.play(tag);
          } else {
            console.warn(`[Benne] Unknown animation tag "${tag}" for character "${definitionId}"`);
          }
        }
        this.chain(Promise.resolve());
      },
      say: (line: string) => {
        console.log(`[Character ${definitionId}] ${line}`);
        this.chain(
          new Promise<void>((resolve) => {
            scene.time.delayedCall(DEFAULT_SAY_MS, () => resolve());
          }),
        );
      },
      face: (direction: CharacterFacingLetter) => {
        const sprite = scene.getCharacterSprite(definitionId) as DirectionalCharacterSprite | undefined;
        if (sprite?.anims) {
          playDirectionalAnimation(sprite, 'Idle', direction);
        }
        this.chain(Promise.resolve());
      },
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
    return {
      walkTo: (target: Point2 | string) => {
        this.chain(scene.walkPlayerTo(target));
      },
      playAnimation: (tag: string) => {
        const pl = scene.player;
        if (pl?.anims) {
          if (scene.anims.exists(tag)) {
            pl.play(tag);
          } else {
            console.warn(`[Benne] Unknown animation tag "${tag}" for player`);
          }
        }
        this.chain(Promise.resolve());
      },
      say: (line: string) => {
        console.log(`[Player] ${line}`);
        this.chain(
          new Promise<void>((resolve) => {
            scene.time.delayedCall(DEFAULT_SAY_MS, () => resolve());
          }),
        );
      },
      face: (direction: CharacterFacingLetter) => {
        const pl = scene.player;
        if (pl) {
          playDirectionalAnimation(pl, 'Idle', direction);
        }
        this.chain(Promise.resolve());
      },
    };
  }

  /**
   * Pause the interaction chain for **`seconds`** (for pacing cutscenes).
   *
   * @param seconds - Non-negative duration in seconds.
   */
  wait(seconds: number): void {
    const ms = Math.max(0, seconds * 1000);
    this.chain(
      new Promise<void>((resolve) => {
        this.roomScene.time.delayedCall(ms, () => resolve());
      }),
    );
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
  walkTo(target: Point2 | string): void;

  /**
   * Play an Aseprite animation tag on the player (e.g. **`'WalkL'`**, **`'IdleD'`**).
   *
   * @param tag - Frame tag on the player character sheet.
   */
  playAnimation(tag: string): void;

  /** Placeholder dialogue (logs + short delay until dialogue UI exists). */
  say(line: string): void;

  /**
   * Face a direction using the **`Idle*`** clip family.
   *
   * @param direction - **`'L'`** | **`'R'`** | **`'U'`** | **`'D'`** | **`'UL'`** | **`'UR'`** | **`'DL'`** | **`'DR'`**
   */
  face(direction: CharacterFacingLetter): void;
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
  walkTo(target: Point2 | string): void;

  /**
   * Play an Aseprite tag on this character (e.g. **`'WalkL'`**, **`'IdleD'`**).
   *
   * @param tag - Frame tag from this character’s sheet JSON.
   */
  playAnimation(tag: string): void;

  /** Placeholder dialogue (logs + short delay). */
  say(line: string): void;

  /**
   * Set facing via **`Idle` + direction** (e.g. **`IdleR`**).
   *
   * @param direction - **`'L'`** | **`'R'`** | **`'U'`** | **`'D'`** | **`'UL'`** | **`'UR'`** | **`'DL'`** | **`'DR'`**
   */
  face(direction: CharacterFacingLetter): void;
}
