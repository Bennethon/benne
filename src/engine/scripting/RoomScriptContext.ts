import type { RoomScriptContext as ContextType } from './types.js';
import { BenneScript } from './BenneScript.js';
import type { RoomScene } from '../scenes/RoomScene.js';

export function createRoomScriptContext(
  events: Phaser.Events.EventEmitter,
  roomId: string,
  roomScene: RoomScene
): ContextType {
  const B = new BenneScript(events, roomId, roomScene);

  const context: ContextType = {
    B,
    events,
    roomId,
    roomScene,
    onProp: B.onProp.bind(B),
    whenLookAt: B.whenLookAt.bind(B),
    whenUse: B.whenUse.bind(B),
  };

  return context;
}