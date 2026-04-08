import type { EventBus } from '@engine/events/EventBus';
import type { RoomPropInteractPayload } from '@engine/events/propInteractionEvents';

/**
 * Room script for `outsideOffice` — keep all handlers for this room here (PowerQuest-style).
 * Export name is fixed so `registerGameContent` can discover files via `*.room.ts` glob.
 */
export function registerRoomScript(_events: EventBus): void {
  // Example: _events.on('look:propName', () => { ... });

  _events.on('look:outsideOffice-prop-car', (payload: RoomPropInteractPayload) => {
    console.log(`[Outside Office] ${payload.description ?? 'You look at the car.'}`);
  });






  _events.on('use:outsideOffice-prop-desk-2', (payload: RoomPropInteractPayload) => {
    // TODO
  });
}