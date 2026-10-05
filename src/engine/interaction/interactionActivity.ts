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
 *   {@link currentInteraction} when a walk starts and ends it if the walk is dropped.
 */

export interface InteractionActivity {
  /** Marks the interaction finished. Safe to call more than once. */
  end(): void;
}

const running = new Set<number>();
let nextId = 0;
let current: InteractionActivity | null = null;

export function beginInteractionActivity(): InteractionActivity {
  const id = ++nextId;
  running.add(id);
  return {
    end: () => {
      running.delete(id);
    },
  };
}

export function isInteractionActivityRunning(): boolean {
  return running.size > 0;
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
