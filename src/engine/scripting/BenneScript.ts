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

  /** Remove all listeners this instance registered on the bus (call from RoomScene shutdown). */
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

  readonly raw = {
    on: (event: string | symbol, fn: (...args: unknown[]) => void, context?: unknown) =>
      this.events.on(event, fn as (...args: unknown[]) => void, context),
    once: (event: string | symbol, fn: (...args: unknown[]) => void, context?: unknown) =>
      this.events.once(event, fn as (...args: unknown[]) => void, context),
    off: (event: string | symbol, fn?: (...args: unknown[]) => void, context?: unknown) =>
      this.events.off(event, fn as never, context),
    emit: (event: string | symbol, ...args: unknown[]) => this.events.emit(event, ...args),
  };

  readonly room = {
    changeTo: (_roomId: string, _options?: { spawn?: string; transition?: string }) => {
      console.warn('[Benne] B.room.changeTo is not implemented yet.');
    },
  };

  readonly inventory = {
    give: (_itemId: string) => {
      console.warn('[Benne] B.inventory.give is not implemented yet.');
    },
    has: (_itemId: string) => false,
  };

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

  whenLookAt(propId: string, handler: () => void): void;
  whenLookAt(propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenLookAt(
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, this.resolveVerbId('look'), handler);
  }

  whenUse(propId: string, handler: () => void): void;
  whenUse(propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenUse(
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, this.resolveVerbId('use'), handler);
  }

  whenPickUp(propId: string, handler: () => void): void;
  whenPickUp(propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenPickUp(
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, this.resolveVerbId('pickUp'), handler);
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

  whenPush(propId: string, handler: () => void): void;
  whenPush(propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenPush(
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, this.resolveVerbId('push'), handler);
  }

  whenPull(propId: string, handler: () => void): void;
  whenPull(propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenPull(
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, this.resolveVerbId('pull'), handler);
  }

  whenOpen(propId: string, handler: () => void): void;
  whenOpen(propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenOpen(
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, this.resolveVerbId('open'), handler);
  }

  whenClose(propId: string, handler: () => void): void;
  whenClose(propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenClose(
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, this.resolveVerbId('close'), handler);
  }

  whenVerb(verbId: string, propId: string, handler: () => void): void;
  whenVerb(verbId: string, propId: string, handler: (payload: RoomPropInteractPayload) => void): void;
  whenVerb(
    verbId: string,
    propId: string,
    handler: ((payload: RoomPropInteractPayload) => void) | (() => void),
  ): void {
    this.onProp(propId, verbId, handler);
  }

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

  prop(propId: string) {
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

  private makeCharacterFacade(definitionId: string) {
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

  character(definitionId: string) {
    return this.makeCharacterFacade(definitionId);
  }

  get player() {
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

  wait(seconds: number): void {
    const ms = Math.max(0, seconds * 1000);
    this.chain(
      new Promise<void>((resolve) => {
        this.roomScene.time.delayedCall(ms, () => resolve());
      }),
    );
  }

  cutscene(callback: () => void): void {
    callback();
  }
}
