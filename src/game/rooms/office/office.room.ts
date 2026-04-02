import type { EventBus } from '@engine/events/EventBus';

/**
 * Room script for `office` — keep all handlers for this room here (PowerQuest-style).
 * Export name is fixed so `registerGameContent` can discover files via `*.room.ts` glob.
 */
export function registerRoomScript(events: EventBus): void {
  events.on('look:office-desk', () => {
    console.log('[Office] You look at the desk. Lots of old paperwork.');
  });

  events.on('look:clerk', (payload: { description?: string }) => {
    console.log(`[Office] ${payload.description ?? 'Someone is working here.'}`);
  });
}
