import type { EventBus } from '@engine/events/EventBus';
import { VERB_GLOBAL_FALLBACK_EVENT, VERB_UNHANDLED_EVENT } from '@engine/events/verbInteractionEvents';
import type { VerbUnhandledPayload } from '@engine/events/verbInteractionEvents';

/**
 * Handlers for events that are not tied to a single room (inventory, UI, global flags, verbs, etc.).
 *
 * Verb fallback chain (engine): object `onVerb[id]` → object `onVerbFallback` →
 * `verb:global:<id>` → `verb:global:fallback` → `verb:unhandled`.
 */
export function registerGlobalScript(events: EventBus): void {
  // Example per-verb defaults (opt-in): events.on(globalVerbHandlerEventId('use'), (payload) => { ... });

  events.on(VERB_GLOBAL_FALLBACK_EVENT, (payload: unknown) => {
    void payload;
    // Last script-level fallback before the engine emits `verb:unhandled`.
  });

  events.on(VERB_UNHANDLED_EVENT, (p: VerbUnhandledPayload) => {
    // No dialogue UI yet: surface the configured line in dev; hook UI here later.
    if (import.meta.env.DEV) {
      console.info(`[Benne] verb:unhandled → "${p.fallbackLine}"`, p.target);
    }
  });
}
