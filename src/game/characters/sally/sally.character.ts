import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';
import { characterVerbEventId } from '@engine/events/verbInteractionEvents';
import { E, C, I, R } from '@engine/scripting';

/**
 * Character script for `sally` — register verb handlers on the game EventBus.
 *
 * BenneScript (`E`, `C`, `I`, `R`) — `C.sally` is listed in `src/game/scripting/known-characters.d.ts` for autocomplete.
 *
 * @example
 * _events.on(characterVerbEventId('sally', 'look'), async (payload: CharacterVerbInteractPayload) => {
 *   if (E.firstOccurrence(`sally:looked`)) {
 *     await E.wait(0.3);
 *     void C.Player.say(payload.description ?? '…');
 *   }
 * });
 */
export function registerCharacterScript(_events: EventBus): void {
  void [_events, E, C, I, R, characterVerbEventId];
  void (0 as unknown as CharacterVerbInteractPayload);
  // Example: _events.on(characterVerbEventId('sally', 'look'), (payload: CharacterVerbInteractPayload) => { ... });
}
