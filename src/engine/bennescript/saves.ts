import { gameEvents } from '../events/EventBus.js';
import { GAME_STATE_REPLACED_EVENT } from '../../types/gameState.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { isGameplayInteractionRunning } from '../interaction/interactionActivity.js';
import { isRoomTransitionInProgress, tryGetRoomTransitionOrchestrator } from '../scenes/roomTransitionGlobals.js';
import { getActiveDialogBenneScript } from '../scripting/dialogSession.js';
import { cancelAllInteractions, currentContext, endHandler } from './interactionContext.js';
import { Task, timed } from './task.js';

export interface SaveInfo {
  readonly slot: number;
  readonly name: string;
  readonly timestamp: number;
}

function devWarn(message: string): void {
  if (import.meta.env.DEV) {
    console.warn(`[Benne] ${message}`);
  }
}

function manager(what: string) {
  const m = tryGetActiveGameStateManager();
  if (!m) {
    devWarn(`saves.${what}: the game is not running — ignored.`);
  }
  return m;
}

// A loaded snapshot replaces the world every running handler was acting on (§5 rule 7). This also
// covers loads and new games started from the old `B` API. The handler that is loading (if any)
// ends itself.
gameEvents.on(GAME_STATE_REPLACED_EVENT, () => cancelAllInteractions(currentContext()));

/**
 * Save slots (§4.16). Saving is refused while a gameplay interaction or a dialog is running
 * (decision 2): see {@link saves.canSaveNow}.
 */
export const saves = {
  /**
   * False while a gameplay interaction (room, character, inventory, dialog or global handler,
   * including cutscenes), an open dialog or a room transition is in progress. GUI handlers don't
   * count, so a save menu opened between interactions can save.
   */
  get canSaveNow(): boolean {
    const game = tryGetActiveBenneGame();
    return (
      !isGameplayInteractionRunning() &&
      getActiveDialogBenneScript() == null &&
      !(game != null && isRoomTransitionInProgress(game))
    );
  },

  /** Every numbered save slot, oldest slot first. */
  list(): SaveInfo[] {
    const out: SaveInfo[] = [];
    for (const entry of manager('list')?.getSaveList() ?? []) {
      if (entry.slot != null) {
        out.push({ slot: entry.slot, name: entry.name, timestamp: entry.timestamp });
      }
    }
    return out.sort((a, b) => a.slot - b.slot);
  },

  get(slot: number): SaveInfo | undefined {
    return saves.list().find((s) => s.slot === slot);
  },

  /**
   * Writes the game to `slot`. Waits until written. While {@link canSaveNow} is false it does
   * nothing and logs a DEV warning; it never throws, so a stray call can't break a GUI handler.
   */
  save: timed((slot: number, name: string): Task => {
    if (!saves.canSaveNow) {
      devWarn(`saves.save(${slot}): refused while an interaction or dialog is running (saves.canSaveNow is false).`);
      return Task.resolved();
    }
    manager('save')?.save(name, slot);
    return Task.resolved();
  }),

  /** Loads `slot` and ends the handler; the game reloads into the saved room. */
  load(slot: number): never {
    const m = manager('load');
    // Stop every other handler before the snapshot replaces the state they would write to. This
    // one ends itself below.
    const self = currentContext();
    cancelAllInteractions(self);
    if (m?.load(slot)) {
      const orch = tryGetRoomTransitionOrchestrator();
      if (orch) {
        void orch.transitionToLoadedRoom(false);
      } else {
        devWarn('saves.load: no room transitions here (preview?) — snapshot loaded only.');
      }
    } else if (m) {
      devWarn(`saves.load(${slot}): no save in that slot.`);
    }
    return endHandler();
  },

  delete(slot: number): void {
    manager('delete')?.deleteSave(slot);
  },
};
