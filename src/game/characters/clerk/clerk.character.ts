import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';
import { characterVerbEventId, roomCharacterVerbEventId } from '@engine/events/verbInteractionEvents';

/**
 * Character script for `clerk` — register verb handlers on the game EventBus.
 */
export function registerCharacterScript(_events: EventBus): void {
  _events.on(characterVerbEventId('clerk', 'look'), (payload: CharacterVerbInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'Someone is working here.'}`);
  });

  // Room-specific override example (takes precedence over character-global when present).
  _events.on(roomCharacterVerbEventId('office', 'clerk', 'look'), (payload: CharacterVerbInteractPayload) => {
    console.log(`[Office] ${payload.description ?? 'Someone is working here.'}`);
  });
}
