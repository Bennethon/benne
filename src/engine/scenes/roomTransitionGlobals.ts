import * as Phaser from 'phaser';
import type { RoomTransitionOrchestrator } from './RoomTransitionOrchestrator.js';

let orchestrator: RoomTransitionOrchestrator | null = null;

export function setRoomTransitionOrchestratorInstance(o: RoomTransitionOrchestrator | null): void {
  orchestrator = o;
}

export function tryGetRoomTransitionOrchestrator(): RoomTransitionOrchestrator | null {
  return orchestrator;
}

export const BENNE_ROOM_TRANSITION_IN_PROGRESS_KEY = 'benneRoomTransitionInProgress';

export function isRoomTransitionInProgress(game: Phaser.Game): boolean {
  return game.registry.get(BENNE_ROOM_TRANSITION_IN_PROGRESS_KEY) === true;
}

export function setRoomTransitionInProgress(game: Phaser.Game, v: boolean): void {
  game.registry.set(BENNE_ROOM_TRANSITION_IN_PROGRESS_KEY, v);
}
