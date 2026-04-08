import type { EventBus } from '@engine/events/EventBus';
import type { RoomPropInteractPayload, CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';
import { roomPropVerbEventId, roomCharacterVerbEventId } from '@engine/events/verbInteractionEvents';
import { E, C, I, R } from '@engine/scripting';

/**
 * Room script for `outsideOffice` — keep all handlers for this room here (PowerQuest-style).
 * Export name is fixed so `registerGameContent` can discover files via `*.room.ts` glob.
 *
 * BenneScript (`E`, `C`, `I`, `R`) — discoverable facade over `gameEvents` + in-memory stubs (phase 1).
 *
 * @example
 * _events.on(roomPropVerbEventId('outsideOffice', 'propName', 'look'), async () => {
 *   if (E.firstOccurrence('sawPropName')) {
 *     await E.wait(0.5);
 *     void C.Player.say('Hmm…');
 *   }
 *   if (I.has('key')) E.changeRoom('otherRoom', 'doorSpawn');
 * });
 */
export function registerRoomScript(_events: EventBus): void {
  void [E, C, I, R];

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