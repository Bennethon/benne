import { SCENE_ROOM } from '../content/constants.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import type { RoomScene } from './RoomScene.js';

/**
 * Stops any in-progress player walk before verb / inventory interaction handlers run, so lines and
 * scripted `walkToClicked` do not overlap a prior empty-space or walk-to-target move.
 *
 * Also pushes one frame of {@link RoomScene.pushScriptedDialogInputSuppression} for the same pointer
 * tick: a handler's steps after its first one start on later microtasks, and a speech line only
 * suppresses room background input once it starts — **after** Phaser dispatches `pointerdown` on
 * the scene. Without this brace, {@link RoomScene.handleRoomPointerDown} can still
 * treat the click as empty space and start a walk toward the cursor while a verb-only `say` line
 * is showing (common with **Look at** + no scripted `walkToClicked`).
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
  scene.pushScriptedDialogInputSuppression();
  queueMicrotask(() => {
    scene.popScriptedDialogInputSuppression();
  });
}
