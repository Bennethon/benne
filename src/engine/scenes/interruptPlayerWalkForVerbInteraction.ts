import { SCENE_ROOM } from '../../game/constants.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import type { RoomScene } from './RoomScene.js';

/**
 * Stops any in-progress player walk before verb / inventory interaction handlers run, so lines and
 * scripted `walkToClicked` do not overlap a prior empty-space or walk-to-target move.
 */
export function interruptPlayerWalkForVerbInteraction(): void {
  const game = tryGetActiveBenneGame();
  if (!game) {
    return;
  }
  const scene = game.scene.getScene(SCENE_ROOM) as RoomScene | undefined;
  if (!scene?.scene.isActive()) {
    return;
  }
  scene.interruptPlayerWalk();
}
