import * as Phaser from 'phaser';
import type { InventoryScriptContext } from './types.js';
import { InventoryBenneScript } from './InventoryBenneScript.js';
import type { RoomScene } from '../scenes/RoomScene.js';

export function createInventoryScriptContext(
  events: Phaser.Events.EventEmitter,
  itemId: string,
  roomId: string,
  roomScene: RoomScene,
): InventoryScriptContext {
  const B = new InventoryBenneScript(events, itemId, roomId, roomScene);

  return {
    B,
    events,
    itemId,
    roomId,
    roomScene,
    whenInventoryUsedOn: B.whenInventoryUsedOn,
  };
}
