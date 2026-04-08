import type { EventBus } from '@engine/events/EventBus';
import { roomPropVerbEventId } from '@engine/events/verbInteractionEvents';
import { E, C, I, R } from '@engine/scripting';

/**
 * Room script for `test-room` — keep all handlers for this room here (PowerQuest-style).
 * Export name is fixed so `registerGameContent` can discover files via `*.room.ts` glob.
 *
 * BenneScript (`E`, `C`, `I`, `R`) — discoverable facade over `gameEvents` + in-memory stubs (phase 1).
 *
 * @example
 * _events.on(roomPropVerbEventId('test-room', 'propName', 'look'), async () => {
 *   if (E.firstOccurrence('sawPropName')) {
 *     await E.wait(0.5);
 *     void C.Player.say('Hmm…');
 *   }
 *   if (I.has('key')) E.changeRoom('otherRoom', 'doorSpawn');
 * });
 */
export function registerRoomScript(_events: EventBus): void {
  // Keeps imports used until you add handlers (strict TypeScript).
  void [_events, E, C, I, R, roomPropVerbEventId];
  // Example: _events.on(roomPropVerbEventId('test-room', 'propName', 'look'), () => { ... });
}
