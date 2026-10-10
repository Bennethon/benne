/**
 * Engine-level record of gameplay interactions that are still running (a verb handler walking and
 * talking, a region handler, …). Script runtimes report each handler from start until its queued
 * steps drain. The engine and dev/test hooks read it to tell "waiting for the player" apart from
 * "a script is mid-sequence but nothing is moving right now" (e.g. during a `wait`).
 *
 * An interaction also ends when it can never finish:
 * - Room transitions discard the old room's interaction queues ({@link clearInteractionActivity}).
 * - A player walk that is interrupted outside a cutscene never resolves, so the interaction that
 *   started it is abandoned. Runtimes run each step inside {@link runInInteraction}; the room reads
 *   {@link currentInteraction} when a walk starts and calls {@link InteractionActivity.abandon} if
 *   the walk is dropped.
 *
 * Runtimes that enforce "one gameplay interaction at a time" (BenneScript §5 rule 9) also give the
 * registry a world-click policy; the room asks {@link admitGameplayClick} before a click starts a
 * walk or an interaction. Activities without a policy never block clicks.
 */

/** What a running interaction wants done with a world click: cancel itself, or drop the click. */
export type WorldClickPolicy = 'interrupt' | 'ignore';

export interface InteractionActivityOptions {
  /**
   * Gameplay interactions (room, character, inventory, dialog and global handlers) block saving.
   * GUI handlers pass `false`. Default `true`.
   */
  gameplay?: boolean;
  /** Asked on every world click while this interaction runs. `null` (or no policy) lets the click through. */
  worldClickPolicy?: () => WorldClickPolicy | null;
  /** Called when a world click interrupts this interaction, or when its player walk is dropped. */
  onInterrupt?: () => void;
}

export interface InteractionActivity {
  /** Marks the interaction finished. Safe to call more than once. */
  end(): void;
  /**
   * The interaction can never finish (its player walk was dropped outside a cutscene): lets the
   * runtime stop it, then ends it.
   */
  abandon(): void;
  /**
   * While true, the interaction is waiting on the player (an open dialog it started), so it does
   * not count as "busy" for {@link isInteractionActivityRunning}. It still blocks saving.
   */
  setWaitingForPlayer(waiting: boolean): void;
}

interface Entry {
  gameplay: boolean;
  waitingForPlayer: boolean;
  options: InteractionActivityOptions;
}

const running = new Map<number, Entry>();
let nextId = 0;
let current: InteractionActivity | null = null;
const endListeners = new Set<() => void>();

/** Runs `listener` each time an interaction ends (finished, cancelled or abandoned). */
export function onInteractionActivityEnded(listener: () => void): void {
  endListeners.add(listener);
}

export function beginInteractionActivity(options: InteractionActivityOptions = {}): InteractionActivity {
  const id = ++nextId;
  const entry: Entry = { gameplay: options.gameplay !== false, waitingForPlayer: false, options };
  running.set(id, entry);
  const end = (): void => {
    if (running.delete(id)) {
      for (const listener of endListeners) {
        listener();
      }
    }
  };
  return {
    end,
    abandon: () => {
      if (running.has(id)) {
        options.onInterrupt?.();
      }
      end();
    },
    setWaitingForPlayer: (waiting) => {
      entry.waitingForPlayer = waiting;
    },
  };
}

/** True while any interaction is mid-sequence (not just waiting for the player in a dialog). */
export function isInteractionActivityRunning(): boolean {
  for (const entry of running.values()) {
    if (!entry.waitingForPlayer) {
      return true;
    }
  }
  return false;
}

/** True while any gameplay interaction runs, including one waiting on a dialog. Saving is refused then. */
export function isGameplayInteractionRunning(): boolean {
  for (const entry of running.values()) {
    if (entry.gameplay) {
      return true;
    }
  }
  return false;
}

/**
 * Applies the running interactions' world-click policies to a click that would start a walk or an
 * interaction. Returns `false` when the click must be dropped. Otherwise interrupts every
 * interaction that asked for it and returns `true`.
 */
export function admitGameplayClick(): boolean {
  const toInterrupt: Entry[] = [];
  for (const entry of running.values()) {
    const policy = entry.options.worldClickPolicy?.() ?? null;
    if (policy === 'ignore') {
      return false;
    }
    if (policy === 'interrupt') {
      toInterrupt.push(entry);
    }
  }
  for (const entry of toInterrupt) {
    entry.options.onInterrupt?.();
  }
  return true;
}

/** Room-transition hook: forget interactions whose queues the transition discarded. */
export function clearInteractionActivity(): void {
  running.clear();
}

/** Runs the synchronous part of `fn` as part of `activity`, so work it starts can be attributed. */
export function runInInteraction<T>(activity: InteractionActivity | null, fn: () => T): T {
  const previous = current;
  current = activity;
  try {
    return fn();
  } finally {
    current = previous;
  }
}

/** The interaction whose step is executing right now, if any. */
export function currentInteraction(): InteractionActivity | null {
  return current;
}
