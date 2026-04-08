import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';

/**
 * Character script for `penny` — register verb handlers on the game EventBus.
 */
export function registerCharacterScript(_events: EventBus): void {
  // Example: _events.on('verbName:characterId', (_payload) => { ... }); // CharacterVerbInteractPayload
}
