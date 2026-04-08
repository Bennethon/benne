import type { EventBus } from '@engine/events/EventBus';
import type { RoomPropInteractPayload, RoomHotspotInteractPayload } from '@engine/events/propInteractionEvents';
/**
 * Room script for `office` — keep all handlers for this room here (PowerQuest-style).
 * Export name is fixed so `registerGameContent` can discover files via `*.room.ts` glob.
 */
export function registerRoomScript(_events: EventBus): void {
  _events.on('look:desk', (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the desk.'}`);
  });

  _events.on('use:desk', () => {
    console.log(`[Office] The desk is unusable.`);
  });

  _events.on('look:office-door', (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the door.'}`);
  });

  _events.on('look:office-jacket', (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the jacket.'}`);
  });

  _events.on('look:office-glasses', (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the glasses.'}`);
  });

  _events.on('look:office-cyberbuddy', (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the desk toy.'}`);
  });

  _events.on('use:office-jacket', (_payload: RoomPropInteractPayload) => {
    // TODO
  });

  _events.on('look:office-hotspot-1', (payload: RoomHotspotInteractPayload) => {
    console.log(`[Office] Looks like a window`);
  });
}
