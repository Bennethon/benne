import * as Phaser from 'phaser';
import type { EventBus } from '../events/EventBus.js';
import { GlobalBenneScript } from './GlobalBenneScript.js';
import { getBenneGlobalScriptRegistrations } from './registerGlobalScript.js';
import type { GlobalScriptContext } from './types.js';
import { RoomTransitionHookRegistry } from '../scenes/RoomTransitionHookRegistry.js';
import { RoomTransitionOrchestrator } from '../scenes/RoomTransitionOrchestrator.js';
import { setGlobalRoomHookRegistry } from '../scenes/roomHookRegistrySingleton.js';
import {
  setGlobalBenneScriptForRoomTransitions,
  setRoomTransitionOrchestratorInstance,
} from '../scenes/roomTransitionGlobals.js';
import { clearGlobalBenneScriptOnUpdateHandlers } from './benneScriptOnUpdateRegistry.js';

/**
 * Invokes all `registerGlobalScript` callbacks with a {@link GlobalBenneScript} bound to the live game.
 * Call from `main.ts` immediately after {@link import('../Game.js').createBenneGame}.
 */
export function wireBenneGlobalScripts(game: Phaser.Game, events: EventBus): void {
  const hookRegistry = new RoomTransitionHookRegistry();
  setGlobalRoomHookRegistry(hookRegistry);
  setRoomTransitionOrchestratorInstance(new RoomTransitionOrchestrator(game, events, hookRegistry));

  const registrations = getBenneGlobalScriptRegistrations();
  if (registrations.length === 0) {
    return;
  }

  const B = new GlobalBenneScript(events, game);
  setGlobalBenneScriptForRoomTransitions(B);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    clearGlobalBenneScriptOnUpdateHandlers();
  });
  const ctx: GlobalScriptContext = { B, events, game };

  for (const registerFn of registrations) {
    try {
      registerFn(ctx);
    } catch (err) {
      console.error('[Benne] Error in global script:', err);
    }
  }
}
