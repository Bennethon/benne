import * as Phaser from 'phaser';
import {
  VERB_GLOBAL_FALLBACK_EVENT,
  VERB_UNHANDLED_EVENT,
  globalVerbHandlerEventId,
} from '../events/verbInteractionEvents.js';
import type { VerbGlobalFallbackPayload, VerbUnhandledPayload } from '../events/verbInteractionEvents.js';
import type { RoomScene } from '../scenes/RoomScene.js';
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
  readonly state: BenneScriptGameStateNamespace;
  readonly inventory: BenneScriptInventoryNamespace;

  constructor(events: Phaser.Events.EventEmitter, game: Phaser.Game) {
    super(events, () => {
      const room = game.scene.getScene(SCENE_ROOM) as RoomScene | undefined;
      return room?.time ?? null;
    });
    const manager = resolveGameStateManager(game);
    this.state = createBenneScriptGameStateNamespace(manager);
    this.inventory = createBenneScriptInventoryNamespace(manager);
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
}
