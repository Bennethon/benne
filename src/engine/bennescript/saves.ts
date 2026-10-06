import { gameEvents } from '../events/EventBus.js';
import { GAME_STATE_REPLACED_EVENT } from '../../types/gameState.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { isGameplayInteractionRunning } from '../interaction/interactionActivity.js';
import { isRoomTransitionInProgress, tryGetRoomTransitionOrchestrator } from '../scenes/roomTransitionGlobals.js';
import { getActiveDialogSession } from '../dialog/dialogSession.js';
import { cancelAllInteractions, currentContext, endHandler } from './interactionContext.js';
import { Task, timed } from './task.js';

/** A save: a numbered slot, or a name (named saves have no slot). */
export type SaveRef = number | string;

export interface SaveInfo {
  /** The slot, or `null` for a named save. */
  readonly slot: number | null;
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
// covers new games and loads started by the engine (BENNE Play). The handler that is loading (if
// any) ends itself.
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
      getActiveDialogSession() == null &&
      !(game != null && isRoomTransitionInProgress(game))
    );
  },

  /** Every save: numbered slots first, in slot order, then named saves, newest first. */
  list(): SaveInfo[] {
    const all = (manager('list')?.getSaveList() ?? []).map((e) => ({ slot: e.slot ?? null, name: e.name, timestamp: e.timestamp }));
    const slots = all.filter((s) => s.slot != null).sort((a, b) => a.slot! - b.slot!);
    const named = all.filter((s) => s.slot == null).sort((a, b) => b.timestamp - a.timestamp);
    return [...slots, ...named];
  },

  /** The save in `slot`, or the named save `name`. */
  get(save: SaveRef): SaveInfo | undefined {
    return saves.list().find((s) => (typeof save === 'number' ? s.slot === save : s.slot == null && s.name === save));
  },

  /**
   * Writes the game: `saves.save(2, 'Before the lab')` to a slot, or `saves.save('checkpoint')` as
   * a named save. Waits until written. While {@link canSaveNow} is false it does nothing and logs
   * a DEV warning; it never throws, so a stray call can't break a GUI handler.
   */
  save: timed((save: SaveRef, name?: string): Task => {
    const label = typeof save === 'number' ? save : JSON.stringify(save);
    if (!saves.canSaveNow) {
      devWarn(`saves.save(${label}): refused while an interaction or dialog is running (saves.canSaveNow is false).`);
      return Task.resolved();
    }
    if (typeof save === 'number') {
      manager('save')?.save(name ?? `Slot ${save + 1}`, save);
    } else {
      manager('save')?.save(save);
    }
    return Task.resolved();
  }),

  /** Loads a slot or a named save and ends the handler; the game reloads into the saved room. */
  load(save: SaveRef): never {
    const m = manager('load');
    // Stop every other handler before the snapshot replaces the state they would write to. This
    // one ends itself below.
    cancelAllInteractions(currentContext());
    if (m?.load(save)) {
      enterLoadedRoom('load');
    } else if (m) {
      devWarn(`saves.load(${typeof save === 'number' ? save : JSON.stringify(save)}): no such save.`);
    }
    return endHandler();
  },

  delete(save: SaveRef): void {
    manager('delete')?.deleteSave(save);
  },

  /** Renames a slot's or a named save's save name. */
  rename(save: SaveRef, newName: string): void {
    const m = manager('rename');
    const existing = saves.get(save);
    if (!m || !existing) {
      if (m) {
        devWarn(`saves.rename(${typeof save === 'number' ? save : JSON.stringify(save)}): no such save.`);
      }
      return;
    }
    m.renameSave(existing.name, newName);
  },

  /** The game as it is now, as JSON (for a "copy save" button, or a file download). */
  export(): string {
    return manager('export')?.exportSnapshotJson() ?? '{}';
  },

  /** Loads a game exported with {@link export} and ends the handler, like {@link load}. */
  import(json: string): never {
    const m = manager('import');
    cancelAllInteractions(currentContext());
    if (m?.importSnapshotJson(json)) {
      enterLoadedRoom('import');
    } else if (m) {
      devWarn('saves.import: not a BENNE save — ignored.');
    }
    return endHandler();
  },
};

/** Reloads the room the loaded snapshot is in. */
function enterLoadedRoom(what: string): void {
  const orch = tryGetRoomTransitionOrchestrator();
  if (orch) {
    void orch.transitionToLoadedRoom(false);
  } else {
    devWarn(`saves.${what}: no room transitions here (preview?) — snapshot loaded only.`);
  }
}
