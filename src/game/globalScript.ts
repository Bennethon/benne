import { registerGlobalScript } from '@engine/scripting';
import type { VerbGlobalFallbackPayload, VerbUnhandledPayload } from '@engine/events/verbInteractionEvents';

/**
 * 9-verb template global script placeholder. Fill in cross-room verb handling
 * (global fallbacks, UI wiring, etc.) as the template gains content.
 */
registerGlobalScript(({ B }) => {
  B.whenGlobalFallback((_payload: VerbGlobalFallbackPayload) => {
    // No-op until the 9-verb template defines global verb fallbacks.
  });

  B.whenVerbUnhandled((p: VerbUnhandledPayload) => {
    if (import.meta.env.DEV) {
      console.info(`[Benne 9-verb] verb:unhandled → "${p.fallbackLine}"`, p.target);
    }
  });
});
