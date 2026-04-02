import type { EventBus } from '@engine/events/EventBus';

/**
 * Handlers for events that are not tied to a single room (inventory, UI, global flags, etc.).
 */
export function registerGlobalScript(events: EventBus): void {
  void events;
  // Example: events.on('game:started', () => { ... });
}
