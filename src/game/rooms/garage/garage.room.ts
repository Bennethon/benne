import type { EventBus } from '@engine/events/EventBus';

/**
 * Room script for `garage` — keep all handlers for this room here (PowerQuest-style).
 * Export name is fixed so `registerGameContent` can discover files via `*.room.ts` glob.
 */
export function registerRoomScript(_events: EventBus): void {
  // Example: _events.on(roomPropVerbEventId('garage', 'propName', 'look'), () => { ... });
}
