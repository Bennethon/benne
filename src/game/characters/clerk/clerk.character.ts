import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';
import { characterVerbEventId, roomCharacterVerbEventId } from '@engine/events/verbInteractionEvents';
import { E, C, I, R } from '@engine/scripting';

/**
 * Character script for `clerk` — register verb handlers on the game EventBus.
 *
 * BenneScript (`E`, `C`, `I`, `R`) — `C.clerk` is listed in `src/game/scripting/known-characters.d.ts` for autocomplete.
 *
 * @example
 * _events.on(characterVerbEventId('clerk', 'look'), async (payload: CharacterVerbInteractPayload) => {
 *   if (E.firstOccurrence('clerk:looked')) {
 *     await E.wait(0.3);
 *     void C.Player.say(payload.description ?? '…');
 *   }
 * });
 */
export function registerCharacterScript(_events: EventBus): void {
  void [E, C, I, R];

  _events.on(characterVerbEventId('clerk', 'look'), (payload: CharacterVerbInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'Someone is working here.'}`);
  });

  // Room-specific override example (takes precedence over character-global when present).
  _events.on(roomCharacterVerbEventId('office', 'clerk', 'look'), (payload: CharacterVerbInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'Someone is working here.'}`);
  });
}
