import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';
import { characterVerbEventId } from '@engine/events/verbInteractionEvents';
import { E, C, I, R } from '@engine/scripting';

/**
 * Character script for `henry` — register verb handlers on the game EventBus.
 *
 * BenneScript (`E`, `C`, `I`, `R`) — `C.henry` is listed in `src/game/scripting/known-characters.d.ts` for autocomplete.
 *
 * @example
 * _events.on(characterVerbEventId('henry', 'look'), async (payload: CharacterVerbInteractPayload) => {
 *   if (E.firstOccurrence('henry:looked')) {
 *     await E.wait(0.3);
 *     void C.Player.say(payload.description ?? '…');
 *   }
 * });
 */
export function registerCharacterScript(_events: EventBus): void {
  void [E, C, I, R];

  _events.on(characterVerbEventId('henry', 'look'), (_payload: CharacterVerbInteractPayload) => {
    console.log("It looks like Henry!");
  });
}
