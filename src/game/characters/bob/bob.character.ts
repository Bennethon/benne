import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';

/**
 * Character script for `bob` — register verb handlers on the game EventBus.
 */
export function registerCharacterScript(_events: EventBus): void {
  // Example: _events.on('verbName:characterId', (_payload) => { ... }); // CharacterVerbInteractPayload

  _events.on('use:bob', (payload: CharacterVerbInteractPayload) => {
    // TODO
  });
}
