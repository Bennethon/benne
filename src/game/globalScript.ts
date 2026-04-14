import { registerGlobalScript } from '@engine/scripting';
import type { VerbGlobalFallbackPayload, VerbUnhandledPayload } from '@engine/events/verbInteractionEvents';

/**
 * Handlers for events that are not tied to a single room (inventory, UI, global flags, verbs, etc.).
 *
 * Verb fallback chain (engine): object scoped handler (room/character channels) → object fallback →
 * `verb:global:<id>` → `verb:global:fallback` → `verb:unhandled`.
 */
registerGlobalScript(({ B }) => {
  B.whenGlobalFallback((payload: VerbGlobalFallbackPayload) => {
    if (payload.verbId === 'use') {
      console.log("I can't use that.");
    } else if (payload.verbId === 'look') {
      console.log('It looks like nothing.');
    }
  });

  B.whenVerbUnhandled((p: VerbUnhandledPayload) => {
    if (import.meta.env.DEV) {
      console.info(`[Benne] verb:unhandled → "${p.fallbackLine}"`, p.target);
    }
  });
});
