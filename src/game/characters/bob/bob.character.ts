import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';
import { characterVerbEventId } from '@engine/events/verbInteractionEvents';

/**
 * Character script for `bob` — register verb handlers on the game EventBus.
 */
export function registerCharacterScript(_events: EventBus): void {
  // Example global: _events.on(characterVerbEventId('bob', 'look'), (_payload) => { ... });

  _events.on(characterVerbEventId('bob', 'use'), (_payload: CharacterVerbInteractPayload) => {
    // TODO
  });
}
