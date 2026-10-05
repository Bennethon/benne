/**
 * A timed action that has started (a walk, a speech line, a wait). Handlers never see the promise:
 * the build transform wraps each statement in `$.step(…)`, which waits when the statement's value
 * is a Task. See `docs/bennescript-ergonomics-refactor.md` §5 and §6.
 *
 * Phase 1 (spike) keeps this minimal: no `finishNow()` for cutscene skip and no `cancel()` of the
 * underlying action. Those arrive with the Phase 2 runtime.
 */
export class Task<T = void> {
  private settled = false;
  readonly promise: Promise<T>;

  constructor(promise: Promise<T>) {
    this.promise = promise;
    promise.then(
      () => {
        this.settled = true;
      },
      () => {
        this.settled = true;
      },
    );
  }

  /** True once the action has finished. */
  get done(): boolean {
    return this.settled;
  }

  /**
   * Waits for this task. Written as a statement (`walk.wait()`), the transform turns it into
   * `await $.step(() => walk.wait())`, so returning the task itself is what makes it wait.
   */
  wait(): void {
    return this as unknown as void;
  }

  static resolved(): Task {
    return new Task(Promise.resolve());
  }
}

export function isTask(value: unknown): value is Task<unknown> {
  return value instanceof Task;
}
