import type { EventBus } from '@engine/events/EventBus';
import { VERB_GLOBAL_FALLBACK_EVENT, VERB_UNHANDLED_EVENT } from '@engine/events/verbInteractionEvents';
import type { VerbGlobalFallbackPayload, VerbUnhandledPayload } from '@engine/events/verbInteractionEvents';

/**
 * Handlers for events that are not tied to a single room (inventory, UI, global flags, verbs, etc.).
 *
 * Verb fallback chain (engine): object scoped handler (room/character channels) → object fallback →
 * `verb:global:<id>` → `verb:global:fallback` → `verb:unhandled`.
 */
export function registerGlobalScript(events: EventBus): void {
  // Example per-verb defaults (opt-in): events.on(globalVerbHandlerEventId('use'), (payload) => { ... });

  events.on(VERB_GLOBAL_FALLBACK_EVENT, (payload: VerbGlobalFallbackPayload) => {
    if (payload.verbId === 'use') {
      console.log("I can't use that.");
    } else if (payload.verbId === 'look') {
      console.log('It looks like nothing.');
    }
    // Last script-level fallback before the engine emits `verb:unhandled`.
  });

  events.on(VERB_UNHANDLED_EVENT, (p: VerbUnhandledPayload) => {
    // `B.say` uses the dialog-text GUI; unhandled verbs still log the fallback line in dev only.
    if (import.meta.env.DEV) {
      console.info(`[Benne] verb:unhandled → "${p.fallbackLine}"`, p.target);
    }
  });
}
