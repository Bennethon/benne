import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';
import { characterVerbEventId } from '@engine/events/verbInteractionEvents';

/**
 * Character script for `henry` — register verb handlers on the game EventBus.
 */
export function registerCharacterScript(_events: EventBus): void {
  // Example global: _events.on(characterVerbEventId('henry', 'look'), (_payload) => { ... });

  _events.on(characterVerbEventId('henry', 'look'), (_payload: CharacterVerbInteractPayload) => {
    console.log("It looks like Henry!");
  });
}
