import * as Phaser from 'phaser';
import type { EventBus } from '../events/EventBus.js';
import { attachGlobalRoomHooks } from '../bennescript/globalHandlers.js';
import { RoomTransitionHookRegistry } from './RoomTransitionHookRegistry.js';
import { RoomTransitionOrchestrator } from './RoomTransitionOrchestrator.js';
import { setGlobalRoomHookRegistry } from './roomHookRegistrySingleton.js';
import { setRoomTransitionOrchestratorInstance } from './roomTransitionGlobals.js';

/**
 * Creates the room hook registry and the transition orchestrator for a live game, then attaches the
 * BenneScript any-room hooks (`game.onEnterAnyRoom` & co.) that registered while the script modules
 * loaded, before the registry existed. Call right after {@link import('../Game.js').createBenneGame}.
 */
export function wireRoomTransitions(game: Phaser.Game, events: EventBus): void {
  const hookRegistry = new RoomTransitionHookRegistry();
  setGlobalRoomHookRegistry(hookRegistry);
  setRoomTransitionOrchestratorInstance(new RoomTransitionOrchestrator(game, events, hookRegistry));
  attachGlobalRoomHooks();
}
