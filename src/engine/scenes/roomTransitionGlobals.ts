import * as Phaser from 'phaser';
import type { GlobalBenneScript } from '../scripting/GlobalBenneScript.js';
import type { RoomTransitionOrchestrator } from './RoomTransitionOrchestrator.js';

let orchestrator: RoomTransitionOrchestrator | null = null;
let globalBForTransition: (GlobalBenneScript & { resetInteractionTailForEngine?: () => void }) | null = null;

export function setRoomTransitionOrchestratorInstance(o: RoomTransitionOrchestrator | null): void {
  orchestrator = o;
}

export function tryGetRoomTransitionOrchestrator(): RoomTransitionOrchestrator | null {
  return orchestrator;
}

/**
 * The global B instance (used to reset the interaction queue on room changes).
 * Set from {@link import('../scripting/wireBenneGlobalScripts.js').wireBenneGlobalScripts}.
 */
export function setGlobalBenneScriptForRoomTransitions(B: GlobalBenneScript | null): void {
  globalBForTransition = B;
}

export function tryGetGlobalBenneScriptForRoomTransitions(): GlobalBenneScript | null {
  return globalBForTransition;
}

export const BENNE_ROOM_TRANSITION_IN_PROGRESS_KEY = 'benneRoomTransitionInProgress';

export function isRoomTransitionInProgress(game: Phaser.Game): boolean {
  return game.registry.get(BENNE_ROOM_TRANSITION_IN_PROGRESS_KEY) === true;
}

export function setRoomTransitionInProgress(game: Phaser.Game, v: boolean): void {
  game.registry.set(BENNE_ROOM_TRANSITION_IN_PROGRESS_KEY, v);
}
