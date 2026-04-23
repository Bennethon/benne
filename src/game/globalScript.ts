import { registerGlobalScript } from '@engine/scripting';
import type {
  VerbGlobalFallbackPayload,
  VerbUnhandledPayload,
} from '@engine/events/verbInteractionEvents';
import { getGameSettings } from '@engine/ConfigManager';

/**
 * Global fallbacks.
 *
 * These run when a verb is used on something that has no specific handler
 * in the room script, character script, or inventory script.
 *
 * Feel free to put ANY code here — play animations, change game state,
 * start cutscenes, etc. These are real global handlers.
 */
registerGlobalScript(({ B }) => {

  // ─────────────────────────────────────────────────────────────
  // Global per-verb fallbacks
  // ─────────────────────────────────────────────────────────────

  B.whenGlobalVerb('look', () => {
    B.player.say("Nothing special about that.");
  });

  B.whenGlobalVerb('use', () => {
    B.player.say("That doesn't work.");
  });

  B.whenGlobalVerb('pickUp', () => {
    B.player.say("I can't take that.");
  });

  B.whenGlobalVerb('push', () => {
    B.player.say("It won't move.");
  });

  B.whenGlobalVerb('pull', () => {
    B.player.say("It won't move.");
  });

  B.whenGlobalVerb('open', () => {
    B.player.say("I can't open that.");
  });

  B.whenGlobalVerb('close', () => {
    B.player.say("That doesn't need closing.");
  });

  B.whenGlobalVerb('talkTo', () => {
    B.player.say("I don't have anything to say to that.");
  });

  B.whenGlobalVerb('give', () => {
    B.player.say("I can't give that.");
  });

  // ─────────────────────────────────────────────────────────────
  // Ultimate safety net (for verbs added in game-config.json
  // but not handled above)
  // ─────────────────────────────────────────────────────────────
  B.whenGlobalFallback((_payload: VerbGlobalFallbackPayload) => {
    B.player.say(
      getGameSettings().defaultFallbackLine ?? "That doesn't work."
    );
  });

  // ─────────────────────────────────────────────────────────────
  // Inventory "use X on Y" when nothing handled it
  // ─────────────────────────────────────────────────────────────
  B.whenInventoryOnVerbTargetUnhandled(() => {
    B.player.say("That doesn't work.");
  });

  // DEV diagnostic
  B.whenVerbUnhandled((p: VerbUnhandledPayload) => {
    if (import.meta.env.DEV) {
      console.info(`[Benne 9-verb] verb:unhandled → "${p.fallbackLine}"`, p.target);
    }
  });
});