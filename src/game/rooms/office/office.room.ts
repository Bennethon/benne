import type { EventBus } from '@engine/events/EventBus';
import type { RoomPropInteractPayload } from '@engine/events/propInteractionEvents';

/**
 * Room script for `office` — keep all handlers for this room here (PowerQuest-style).
 * Export name is fixed so `registerGameContent` can discover files via `*.room.ts` glob.
 */
export function registerRoomScript(events: EventBus): void {
  events.on('look:office-desk', (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the desk.'}`);
  });

  events.on('look:office-door', (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the door.'}`);
  });

  events.on('look:office-jacket', (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the jacket.'}`);
  });

  events.on('look:office-glasses', (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the glasses.'}`);
  });

  events.on('look:office-cyberbuddy', (payload: RoomPropInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'You look at the desk toy.'}`);
  });

  events.on('look:clerk', (payload: { description?: string }) => {
    console.log(`[Office] ${payload.description ?? 'Someone is working here.'}`);
  });
}
