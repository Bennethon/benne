import type { EventBus } from '@engine/events/EventBus';

/**
 * Character script for `hank` — register verb handlers on the game EventBus.
 */
export function registerCharacterScript(_events: EventBus): void {
  // Example: _events.on(characterVerbEventId('hank', 'look'), (payload: CharacterVerbInteractPayload) => { ... });
}
