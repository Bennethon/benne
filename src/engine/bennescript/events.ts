import { gameEvents } from '../events/EventBus.js';
import {
  DIALOG_OPTION_ENABLED_CHANGED_EVENT,
  DIALOG_STARTED_EVENT,
  DIALOG_STOPPED_EVENT,
} from '../events/dialogEvents.js';
import { VERB_UNHANDLED_EVENT } from '../events/verbInteractionEvents.js';
import { getLoadingRoomScriptId } from '../scenes/roomScriptModules.js';
import {
  GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT,
  GAME_STATE_ACTIVE_PLAYER_CHARACTER_CHANGED_EVENT,
  GAME_STATE_ACTIVE_VERB_CHANGED_EVENT,
  GAME_STATE_FLAG_CHANGED_EVENT,
  GAME_STATE_INVENTORY_CHANGED_EVENT,
  GAME_STATE_REPLACED_EVENT,
  GAME_STATE_ROOM_CONTEXT_CHANGED_EVENT,
  GAME_STATE_VARIABLE_CHANGED_EVENT,
} from '../../types/gameState.js';
import { runDetached, warnIfUntransformed } from './interactionContext.js';
import { registerRoomEventHandler } from './roomHandlers.js';

/**
 * The game's event bus (§4.21), for engine events (`'gameState:inventoryChanged'`, …) and events
 * scripts send each other (decision 50).
 */

/** Engine events scripts can listen to. Payload types are in `src/types/gameState.ts` and `src/engine/events/`. */
export type EngineEventName =
  | typeof GAME_STATE_FLAG_CHANGED_EVENT
  | typeof GAME_STATE_VARIABLE_CHANGED_EVENT
  | typeof GAME_STATE_INVENTORY_CHANGED_EVENT
  | typeof GAME_STATE_REPLACED_EVENT
  | typeof GAME_STATE_ACTIVE_VERB_CHANGED_EVENT
  | typeof GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT
  | typeof GAME_STATE_ACTIVE_PLAYER_CHARACTER_CHANGED_EVENT
  | typeof GAME_STATE_ROOM_CONTEXT_CHANGED_EVENT
  | typeof DIALOG_STARTED_EVENT
  | typeof DIALOG_STOPPED_EVENT
  | typeof DIALOG_OPTION_ENABLED_CHANGED_EVENT
  | typeof VERB_UNHANDLED_EVENT;

/** An engine event (completed by the editor) or any name of your own. */
export type EventName = EngineEventName | (string & {});

type Listener = (...args: never[]) => unknown;

/** Live subscriptions per listener, so `events.off(name, listener)` can find them. */
const subscriptions = new Map<Listener, Array<{ name: string; off: () => void }>>();

function forget(listener: Listener, entry: { name: string; off: () => void }): void {
  const list = subscriptions.get(listener);
  const i = list?.indexOf(entry) ?? -1;
  if (list && i >= 0) {
    list.splice(i, 1);
  }
}

/**
 * Subscribes `listener` to `name` on the game event bus; it runs immediately with the event's
 * arguments, and its own lines are sequenced. Returns the unsubscribe. Used directly, and by the
 * room handler table for room-scoped listeners.
 */
export function subscribeEvent(name: string, listener: Listener, once: boolean): () => void {
  const entry = { name, off: () => {} };
  const run = (...args: unknown[]): void => {
    if (once) {
      entry.off();
    }
    runDetached(`events "${name}"`, listener, args);
  };
  gameEvents.on(name, run);
  entry.off = () => {
    gameEvents.off(name, run);
    forget(listener, entry);
  };
  const list = subscriptions.get(listener) ?? [];
  list.push(entry);
  subscriptions.set(listener, list);
  return entry.off;
}

function add(name: string, listener: Listener, once: boolean): void {
  warnIfUntransformed(`events.${once ? 'once' : 'on'}("${name}")`, listener);
  const roomId = getLoadingRoomScriptId();
  if (roomId != null) {
    registerRoomEventHandler(roomId, name, once, listener);
  } else {
    subscribeEvent(name, listener, once);
  }
}

/**
 * The event bus: engine events (`'gameState:inventoryChanged'`, …) and events scripts send each
 * other. Listeners are handlers: their lines are sequenced.
 */
export const events = {
  /**
   * Runs `listener` each time `name` is emitted. In a room script it listens only while that room
   * is active (from its creation until the player leaves); anywhere else, for the whole game.
   */
  on(name: EventName, listener: (...args: never[]) => void): void {
    add(name, listener, false);
  },

  /** Like {@link on}, but only for the next `name` (in a room script: the next one in each visit). */
  once(name: EventName, listener: (...args: never[]) => void): void {
    add(name, listener, true);
  },

  /** Stops `listener` (the same function passed to `on`), or every script listener of `name`. */
  off(name: EventName, listener?: (...args: never[]) => void): void {
    const lists = listener ? [subscriptions.get(listener) ?? []] : [...subscriptions.values()];
    for (const list of lists) {
      for (const entry of [...list]) {
        if (entry.name === name) {
          entry.off();
        }
      }
    }
  },

  /** Sends `name` with `args` to every listener. Returns whether anything was listening. */
  emit(name: EventName, ...args: unknown[]): boolean {
    return gameEvents.emit(name, ...args);
  },
};
