import type { EventBus } from '@engine/events/EventBus';
import type { RoomPropInteractPayload, RoomHotspotInteractPayload } from '@engine/events/propInteractionEvents';
import { roomHotspotVerbEventId, roomPropVerbEventId } from '@engine/events/verbInteractionEvents';
/**
 * Room script for `office` — keep all handlers for this room here (PowerQuest-style).
 * Export name is fixed so `registerGameContent` can discover files via `*.room.ts` glob.
 */
export function registerRoomScript(_events: EventBus): void {
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
  });

  _events.on(roomHotspotVerbEventId('office', 'desk', 'use'), (payload: RoomHotspotInteractPayload) => {
    console.log(`[Office] The desk hotspot is unusable.`);
  });
}
