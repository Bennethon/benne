import type { EventBus } from '@engine/events/EventBus';
import type { RoomPropInteractPayload, RoomHotspotInteractPayload } from '@engine/events/propInteractionEvents';
import { roomHotspotVerbEventId, roomPropVerbEventId } from '@engine/events/verbInteractionEvents';
import { E, C, I, R } from '@engine/scripting';

/**
 * Room script for `office` — keep all handlers for this room here (PowerQuest-style).
 * Export name is fixed so `registerGameContent` can discover files via `*.room.ts` glob.
 *
 * BenneScript (`E`, `C`, `I`, `R`) — discoverable facade over `gameEvents` + in-memory stubs (phase 1).
 *
 * @example
 * _events.on(roomPropVerbEventId('office', 'propName', 'look'), async () => {
 *   if (E.firstOccurrence('sawPropName')) {
 *     await E.wait(0.5);
 *     void C.Player.say('Hmm…');
 *     void C.henry.say('…');
 *   }
 *   if (I.has('key')) E.changeRoom('otherRoom', 'doorSpawn');
 * });
 */
export function registerRoomScript(_events: EventBus): void {
  void [E, I, R];

  _events.on(roomPropVerbEventId('office', 'desk', 'look'), (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the desk.'}`);
  });

  _events.on(roomPropVerbEventId('office', 'desk', 'use'), () => {
    console.log(`[Office] The desk prop is unusable.`);
  });

  _events.on(roomPropVerbEventId('office', 'office-prop-door', 'look'), (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the door.'}`);
  });

  _events.on(roomPropVerbEventId('office', 'office-prop-jacket', 'look'), (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the jacket.'}`);
  });

  _events.on(roomPropVerbEventId('office', 'office-prop-glasses', 'look'), (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the glasses.'}`);
  });

  _events.on(roomPropVerbEventId('office', 'office-prop-cyberbuddy', 'look'), (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the desk toy.'}`);
  });

  _events.on(roomPropVerbEventId('office', 'office-prop-jacket', 'use'), (_payload: RoomPropInteractPayload) => {
    // TODO
  });

  _events.on(roomHotspotVerbEventId('office', 'office-hotspot-1', 'look'), (_payload: RoomHotspotInteractPayload) => {
    console.log(`[Office] Looks like a window`);
    C.Player.say('Looks like a window');
    // C.henry.say('Looks like a window');
  });

  _events.on(roomHotspotVerbEventId('office', 'desk', 'use'), (_payload: RoomHotspotInteractPayload) => {
    console.log(`[Office] The desk hotspot is unusable.`);
  });
}
