import * as Phaser from 'phaser';
import {
  INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT,
  type AnyInventoryUsedOnPayload,
} from '../events/inventoryOnVerbEvents.js';
import {
  VERB_GLOBAL_FALLBACK_EVENT,
  VERB_UNHANDLED_EVENT,
  globalVerbHandlerEventId,
} from '../events/verbInteractionEvents.js';
import type { VerbGlobalFallbackPayload, VerbUnhandledPayload } from '../events/verbInteractionEvents.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import type { BenneScriptPlayerFacade } from './benneScriptFacades.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { SCENE_ROOM } from '../../game/constants.js';
import { BenneScriptCore } from './BenneScriptCore.js';
import {
  createBenneScriptGameStateNamespace,
  createBenneScriptInventoryNamespace,
  type BenneScriptGameStateNamespace,
  type BenneScriptInventoryNamespace,
} from './benneScriptGameStateApi.js';

/**
 * Bennescript facade for `globalScript.ts`: global verb fallback chain and `raw` bus access.
 */
export class GlobalBenneScript extends BenneScriptCore {
  private readonly game: Phaser.Game;
  readonly state: BenneScriptGameStateNamespace;
  readonly inventory: BenneScriptInventoryNamespace;

  constructor(events: Phaser.Events.EventEmitter, game: Phaser.Game) {
    super(
      events,
      () => {
        const room = game.scene.getScene(SCENE_ROOM) as RoomScene | undefined;
        return room?.time ?? null;
      },
      () => game.scene.getScene(SCENE_ROOM) as RoomScene | undefined,
    );
    this.game = game;
    const manager = resolveGameStateManager(game);
    this.state = createBenneScriptGameStateNamespace(manager);
    this.inventory = createBenneScriptInventoryNamespace(manager);
  }

  /**
   * Same movement / speech facade as room **`B.player`**; resolves the active {@link RoomScene} on each call.
   */
  get player(): BenneScriptPlayerFacade {
    return this.makePlayerFacadeFromScene(() => this.game.scene.getScene(SCENE_ROOM) as RoomScene | undefined);
  }

  whenGlobalFallback(
    handler: ((payload: VerbGlobalFallbackPayload) => void) | (() => void),
  ): void {
    this.subscribe(VERB_GLOBAL_FALLBACK_EVENT, (payload) => {
      const p = payload as VerbGlobalFallbackPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: VerbGlobalFallbackPayload) => void)(p);
      }
    });
  }

  whenVerbUnhandled(
    handler: ((payload: VerbUnhandledPayload) => void) | (() => void),
  ): void {
    this.subscribe(VERB_UNHANDLED_EVENT, (payload) => {
      const p = payload as VerbUnhandledPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: VerbUnhandledPayload) => void)(p);
      }
    });
  }

  whenGlobalVerb(
    verbId: string,
    handler: ((payload: VerbGlobalFallbackPayload) => void) | (() => void),
  ): void {
    const eventId = globalVerbHandlerEventId(verbId);
    this.subscribe(eventId, (payload) => {
      const p = payload as VerbGlobalFallbackPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: VerbGlobalFallbackPayload) => void)(p);
      }
    });
  }

  whenInventoryOnVerbTargetUnhandled(
    handler: ((payload: AnyInventoryUsedOnPayload) => void) | (() => void),
  ): void {
    this.subscribe(INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT, (payload) => {
      const p = payload as AnyInventoryUsedOnPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: AnyInventoryUsedOnPayload) => void)(p);
      }
    });
  }
}
