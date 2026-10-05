import {
  beginInteractionActivity,
  runInInteraction,
  type InteractionActivity,
} from '../interaction/interactionActivity.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { isTask } from './task.js';

/** Thrown out of `$.step` when the interaction was cancelled (room change). Swallowed by {@link runHandler}. */
const CANCELLED: unique symbol = Symbol('bennescript.cancelled');
/** Thrown by ending calls (`goTo`, …) after they schedule their effect. Swallowed by {@link runHandler}. */
const END_HANDLER: unique symbol = Symbol('bennescript.endHandler');

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

let current: InteractionContext | null = null;
const live = new Set<InteractionContext>();

/**
 * The state of one running handler (`$` in transformed code): which click started it, the engine
 * activity it reports to, and whether it has been cancelled.
 *
 * Transformed handler bodies call {@link step} for every statement-level call. The call runs
 * synchronously with this context as the ambient {@link currentContext}, which is how
 * `walkToClicked()` finds the clicked target and how a player walk is attributed to the
 * interaction (`runInInteraction`).
 */
export class InteractionContext {
  private isCancelled = false;
  private rejectCancel: ((reason: unknown) => void) | null = null;
  private readonly cancelSignal: Promise<never>;
  readonly activity: InteractionActivity | null;
  /** Event payload of the verb / inventory click; `null` for room lifecycle handlers. */
  readonly payload: unknown;
  readonly scene: RoomScene | undefined;

  constructor(activity: InteractionActivity | null, payload: unknown, scene: RoomScene | undefined) {
    this.activity = activity;
    this.payload = payload;
    this.scene = scene;
    this.cancelSignal = new Promise<never>((_, reject) => {
      this.rejectCancel = reject;
    });
    // Nobody may be racing against the signal when it fires.
    this.cancelSignal.catch(() => {});
  }

  get cancelled(): boolean {
    return this.isCancelled;
  }

  /** Runs `fn` synchronously as part of this interaction. */
  run<T>(fn: () => T): T {
    const previous = current;
    current = this;
    try {
      return runInInteraction(this.activity, fn);
    } finally {
      current = previous;
    }
  }

  /**
   * One statement of a handler. Waits when the statement produced a `Task` (or the promise of a
   * step function); returns at once otherwise.
   */
  async step(thunk: () => unknown): Promise<unknown> {
    if (this.isCancelled) {
      throw CANCELLED;
    }
    const value = this.run(thunk);
    if (isTask(value)) {
      await this.raceCancel(value.promise);
      return undefined;
    }
    if (isPromiseLike(value)) {
      return this.raceCancel(value);
    }
    return value;
  }

  cancel(): void {
    if (this.isCancelled) {
      return;
    }
    this.isCancelled = true;
    this.rejectCancel?.(CANCELLED);
  }

  private raceCancel<T>(value: PromiseLike<T>): Promise<T> {
    return Promise.race([value, this.cancelSignal]);
  }
}

/** Context for code that runs outside any handler (module top level, untracked callbacks). */
const detached = new InteractionContext(null, null, undefined);

/**
 * The context of the handler whose statement is running right now. Transformed step functions
 * capture it on entry (`const __$ = __bs.ctx()`), so helpers called from a handler join it.
 */
export function currentContext(): InteractionContext {
  return current ?? detached;
}

/** Ends the running handler. Used by calls typed `never` (`goTo`, …). */
export function endHandler(): never {
  throw END_HANDLER;
}

export type HandlerOutcome = 'finished' | 'ended' | 'cancelled' | 'failed';

/**
 * Starts a handler in a new interaction and resolves when it is over. Reports the interaction to
 * the engine activity registry from start to end, including cancellation (decision 12).
 */
export async function runHandler(
  label: string,
  scene: RoomScene | undefined,
  payload: unknown,
  handler: (...args: never[]) => unknown,
  args: readonly unknown[] = [],
): Promise<HandlerOutcome> {
  const activity = beginInteractionActivity();
  const ctx = new InteractionContext(activity, payload, scene);
  live.add(ctx);
  try {
    const result = ctx.run(() => (handler as (...a: readonly unknown[]) => unknown)(...args));
    await ctx.step(() => result);
    return 'finished';
  } catch (err) {
    if (err === END_HANDLER) {
      return 'ended';
    }
    if (err === CANCELLED) {
      return 'cancelled';
    }
    console.error(`[Benne] Error in ${label} handler:`, err);
    return 'failed';
  } finally {
    live.delete(ctx);
    activity.end();
  }
}

/** Room change: every running handler stops at its current step (§5 rule 7). */
export function cancelAllInteractions(): void {
  for (const ctx of [...live]) {
    ctx.cancel();
  }
}

/**
 * DEV guard for a handler the build transform did not see (§12): its timed lines would all start
 * at once instead of in order.
 */
export function warnIfUntransformed(label: string, handler: unknown): void {
  if (!import.meta.env.DEV || typeof handler !== 'function') {
    return;
  }
  if (handler.constructor?.name !== 'AsyncFunction') {
    console.warn(
      `[Benne] ${label}: handler was not transformed by the BenneScript plugin, so its lines will not wait for each other. ` +
        'Is the file named *.room.ts / *.dialog.ts / … and does it import @benne/script or a .ids module?',
    );
  }
}
