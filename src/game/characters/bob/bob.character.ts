import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';
import { characterVerbEventId } from '@engine/events/verbInteractionEvents';
import { E, C, I, R } from '@engine/scripting';

/**
 * Character script for `bob` — register verb handlers on the game EventBus.
 *
 * BenneScript (`E`, `C`, `I`, `R`) — `C.bob` is listed in `src/game/scripting/known-characters.d.ts` for autocomplete.
 *
 * @example
 * _events.on(characterVerbEventId('bob', 'look'), async (payload: CharacterVerbInteractPayload) => {
 *   if (E.firstOccurrence('bob:looked')) {
 *     await E.wait(0.3);
 *     void C.Player.say(payload.description ?? '…');
 *   }
 * });
 */
export function registerCharacterScript(_events: EventBus): void {
  void [E, C, I, R];

  _events.on(characterVerbEventId('bob', 'use'), (_payload: CharacterVerbInteractPayload) => {
    // TODO
  });
}
