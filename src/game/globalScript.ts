import { registerGlobalScript } from '@engine/scripting';
import type {
  VerbGlobalFallbackPayload,
  VerbUnhandledPayload,
} from '@engine/events/verbInteractionEvents';
import { getGameSettings } from '@engine/ConfigManager';

registerGlobalScript(({ B }) => {

  /**
  * Game state flags.
  *
  * These are used to store game state across room loads.
  */
  B.state.setFlag('unlockedDoor', false);
  B.state.setFlag('turnedOnFountain', false);
  
  /**
  * Global update handler. Runs every frame while the game is running. Can also be used in room scripts.
  * @param ctx - The update context.
  * @returns void
  */
  B.onUpdate((_ctx) => { })

  // ─────────────────────────────────────────────────────────────
  // Room transitions (global hooks — optional)
  // Runs for every room load, including the first from BootScene. See architecture.md
  // (Room transitions) for hook order and RoomTransitionContext.
  // ─────────────────────────────────────────────────────────────
  B.whenLeaveAnyRoom(() => {
    // Optional: extra leave effects (sound, music crossfade, etc.)
  });

  B.whenEnterAnyRoom((_ctx) => {
    // Invisible setup — player placement, prop state, music, etc.
    // Example using last room:
    // if (_ctx.lastRoom === 'apartment') {
    //   B.player.moveToNow('streetDoor');
    // }
  });

  B.whenEnterAnyRoomAfterFade(() => {
    // Visible entrance behavior (walk in, cutscene start, etc.)
  });

  /**
  * Global fallbacks.
  *
  * These run when a verb is used on something that has no specific handler
  * in the room script, character script, or inventory script.
  *
  * Feel free to put ANY code here — play animations, change game state,
  * start cutscenes, etc. These are real global handlers.
  */

  // ─────────────────────────────────────────────────────────────
  // Global per-verb fallbacks
  // ─────────────────────────────────────────────────────────────

  B.whenGlobalVerb('look', () => {
    B.player.say("Nothing special about that.");
  });

  B.whenGlobalVerb('use', () => {
    B.player.say("That doesn't work.");
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