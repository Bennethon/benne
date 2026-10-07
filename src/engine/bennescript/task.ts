/**
 * A timed action that has started (a walk, a speech line, a wait). See
 * `docs/bennescript-ergonomics-refactor.md` §5 and §10.
 *
 * Every timed action has two forms, built by {@link timed}:
 * - the blocking form (`walkToClicked()`) starts the action and returns `task.wait()`, which the
 *   transformed statement (`await $.step(() => …)`) waits on;
 * - `.now(…)` starts the action and returns the {@link Task} itself. `$.step` does not wait on a
 *   bare Task, so the script continues; `task.wait()` on a later line waits for it.
 */

export interface TaskHooks {
  /**
   * Cutscene skip: apply the action's end state at once (timer fired, walk arrived, line
   * dismissed). The task settles right after, whether or not the action's own promise has.
   */
  finishNow?: () => void;
  /** Stop the action where it is. The task settles right after. */
  cancel?: () => void;
  /** A walk of the active player (the opening walk of the interrupt policy, §5 rule 9). */
  playerWalk?: boolean;
  /** The action waits on the player (an open dialog), not on time passing. */
  waitsForPlayer?: boolean;
  /**
   * A turn (`face`, `faceClicked`): it doesn't count as a timed step for the interrupt policy, so a
   * player walk after it is still the opening walk (§5 rule 9, decision 53).
   */
  turn?: boolean;
}

export class Task<T = void> {
  private settled = false;
  private release!: () => void;
  private readonly hooks: TaskHooks;
  /** Settles when the action ends, or at once after {@link finishNow} / {@link cancel}. */
  readonly promise: Promise<T | undefined>;

  constructor(source: Promise<T>, hooks: TaskHooks = {}) {
    this.hooks = hooks;
    const released = new Promise<undefined>((resolve) => {
      this.release = () => resolve(undefined);
    });
    this.promise = Promise.race([source, released]);
    const settle = () => {
      this.settled = true;
    };
    this.promise.then(settle, settle);
  }

  /** True once the action has finished. */
  get done(): boolean {
    return this.settled;
  }

  get isPlayerWalk(): boolean {
    return this.hooks.playerWalk === true;
  }

  get waitsForPlayer(): boolean {
    return this.hooks.waitsForPlayer === true;
  }

  /** A turn (`face`, `faceClicked`), which the interrupt policy doesn't count as a timed step. */
  get isTurn(): boolean {
    return this.hooks.turn === true;
  }

  /**
   * Waits for this task, written as a statement: `walk.wait()`.
   *
   * The transform turns that line into `await $.step(() => walk.wait())`; the returned marker is
   * what makes the step wait.
   */
  wait(): void {
    return new TaskWait(this) as unknown as void;
  }

  /** Completes the action at its end state now (cutscene skip). */
  finishNow(): void {
    if (this.settled) {
      return;
    }
    try {
      this.hooks.finishNow?.();
    } finally {
      this.release();
    }
  }

  /** Stops the action. A later `wait()` returns at once. */
  cancel(): void {
    if (this.settled) {
      return;
    }
    try {
      this.hooks.cancel?.();
    } finally {
      this.release();
    }
  }

  static resolved(hooks: TaskHooks = {}): Task {
    return new Task(Promise.resolve(), hooks);
  }
}

/** What `task.wait()` returns at runtime: tells `$.step` to wait for `task`. */
export class TaskWait {
  readonly task: Task<unknown>;

  constructor(task: Task<unknown>) {
    this.task = task;
  }
}

export function isTask(value: unknown): value is Task<unknown> {
  return value instanceof Task;
}

export function isTaskWait(value: unknown): value is TaskWait {
  return value instanceof TaskWait;
}

let startGuard: (() => void) | null = null;

/** Lets the runtime refuse to start timed actions where nothing could wait for them (`onUpdate`, §4.18). */
export function setTimedStartGuard(guard: () => void): void {
  startGuard = guard;
}

/** A timed action as the author sees it: blocking call, plus `.now` (§5 rules 2–4, §6.3). */
export interface Timed<A extends unknown[]> {
  (...args: A): void;
  now(...args: A): Task;
}

/**
 * Builds both forms of a timed action from one `start` function that begins the action and
 * returns its Task. The action starts at the line where it is written either way.
 */
export function timed<A extends unknown[]>(start: (...args: A) => Task): Timed<A> {
  const begin = (...args: A): Task => {
    startGuard?.();
    return start(...args);
  };
  const blocking = ((...args: A) => begin(...args).wait()) as Timed<A>;
  blocking.now = begin;
  return blocking;
}
