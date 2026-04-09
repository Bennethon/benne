import type { EventBus } from '@engine/events/EventBus';
import type { RoomPropInteractPayload, CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';
import { roomPropVerbEventId, roomCharacterVerbEventId } from '@engine/events/verbInteractionEvents';
/**
 * Room script for `outsideOffice` — keep all handlers for this room here (PowerQuest-style).
 * Export name is fixed so `registerGameContent` can discover files via `*.room.ts` glob.
 */
export function registerRoomScript(_events: EventBus): void {
  // Example: _events.on(roomPropVerbEventId('outsideOffice', 'propName', 'look'), () => { ... });

  _events.on(roomPropVerbEventId('outsideOffice', 'outsideOffice-prop-car', 'look'), (payload: RoomPropInteractPayload) => {
    console.log(`[Outside Office] ${payload.description ?? 'You look at the car.'}`);
  });

  _events.on(roomPropVerbEventId('outsideOffice', 'desk', 'use'), (_payload: RoomPropInteractPayload) => {
    console.log(`[Outside Office] The desk is unusable.`);
  });

  _events.on(roomCharacterVerbEventId('outsideOffice', 'henry', 'look'), (_payload: CharacterVerbInteractPayload) => {
    console.log(`[Outside Office] It looks like Henry outside the office!`);
  });
}