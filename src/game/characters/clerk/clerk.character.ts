import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';

/**
 * Character script for `clerk` — register verb handlers on the game EventBus.
 */
export function registerCharacterScript(_events: EventBus): void {
  _events.on('look:clerk', (payload: CharacterVerbInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'Someone is working here.'}`);
  });
}
