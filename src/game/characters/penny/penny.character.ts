import type { EventBus } from '@engine/events/EventBus';

/**
 * Character script for `penny` — register verb handlers on the game EventBus.
 */
export function registerCharacterScript(_events: EventBus): void {
  // Example global: _events.on(characterVerbEventId('penny', 'look'), (payload: CharacterVerbInteractPayload) => { ... });
}
