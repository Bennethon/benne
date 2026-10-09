import { SCENE_ROOM } from '../content/constants.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import type { RoomScene } from '../scenes/RoomScene.js';

/** The room scene that is running now, regardless of which handler is asking. */
export function liveRoomScene(): RoomScene | undefined {
  return tryGetActiveBenneGame()?.scene.getScene(SCENE_ROOM) as RoomScene | undefined;
}
