import { getGameSettings } from '@engine/ConfigManager';
import { registerGlobalScript } from '@engine/scripting';
import type { VerbGlobalFallbackPayload, VerbUnhandledPayload } from '@engine/events/verbInteractionEvents';
import { getEffectiveVerbDefinitions } from '@engine/verbs/verbConfig';

/** Per-verb default lines for {@link B.whenGlobalVerb} (9-verb template). */
const DEFAULT_VERB_FALLBACK_LINE: Readonly<Record<string, string>> = {
  give: "I can't give them that.",
  pickUp: "I can't take that.",
  use: "That doesn't work.",
  open: "I can't open that.",
  look: 'Nothing special about that.',
  push: "It won't move.",
  close: "I don't need to close that.",
  talkTo: "I don't have anything to say about that.",
  pull: "It won't come loose.",
};

function resolveVerbFallbackLine(verbId: string): string {
  const custom = DEFAULT_VERB_FALLBACK_LINE[verbId];
  if (custom !== undefined) {
    return custom;
  }
  return getGameSettings().defaultFallbackLine ?? "That doesn't work.";
}

registerGlobalScript(({ B }) => {
  for (const v of getEffectiveVerbDefinitions(getGameSettings())) {
    const verbId = v.id;
    B.whenGlobalVerb(verbId, () => {
      B.player.say(resolveVerbFallbackLine(verbId));
    });
  }

  B.whenGlobalFallback((_payload: VerbGlobalFallbackPayload) => {
    B.player.say(getGameSettings().defaultFallbackLine ?? "That doesn't work.");
  });

  B.whenInventoryOnVerbTargetUnhandled(() => {
    B.player.say("That doesn't work.");
  });

  B.whenVerbUnhandled((p: VerbUnhandledPayload) => {
    if (import.meta.env.DEV) {
      console.info(`[Benne 9-verb] verb:unhandled → "${p.fallbackLine}"`, p.target);
    }
  });
});
