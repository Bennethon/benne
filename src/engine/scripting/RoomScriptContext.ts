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
    whenPickUp: B.whenPickUp.bind(B),
    whenGive: B.whenGive.bind(B),
    whenPush: B.whenPush.bind(B),
    whenPull: B.whenPull.bind(B),
    whenOpen: B.whenOpen.bind(B),
    whenClose: B.whenClose.bind(B),
    whenVerb: B.whenVerb.bind(B),
    whenTalkTo: B.whenTalkTo.bind(B),
  };

  return context;
}