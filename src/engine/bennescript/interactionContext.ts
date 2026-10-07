import {
  beginInteractionActivity,
  runInInteraction,
  type InteractionActivity,
  type WorldClickPolicy,
} from '../interaction/interactionActivity.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { liveRoomScene } from './scene.js';
import { isTaskWait, setTimedStartGuard, Task } from './task.js';

/** Thrown out of `$.step` when the interaction was cancelled. Swallowed by {@link runHandler}. */
const CANCELLED: unique symbol = Symbol('bennescript.cancelled');
/** Thrown by ending calls (`goTo`, `saves.load`, `dialog.end`). Swallowed by {@link runHandler}. */
const END_HANDLER: unique symbol = Symbol('bennescript.endHandler');
/** Thrown by `unhandled()`. {@link runHandler} reports it so the caller can fall through. */
const UNHANDLED: unique symbol = Symbol('bennescript.unhandled');

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Where a gameplay handler is in its sequence, for the interrupt policy (§5 rule 9):
 * - `start`: no timed step yet;
 * - `openingWalk`: its first timed step is a player walk that is still going;
 * - `busy`: anything after that.
 */
type Phase = 'start' | 'openingWalk' | 'busy';

export interface ContextOptions {
  /**
   * Gameplay handlers take the interaction lock (§5 rule 9) and block saving. `background` blocks
   * and GUI handlers don't. Default `true`.
   */
  gameplay?: boolean;
  /**
   * Marks an `onUpdate` frame context (§4.18) and receives its errors. A step that throws there
   * (a timed action in a helper) is reported here, and the helper stops at that step instead of
   * rejecting: helpers called from a callback with a block body drop their promise.
   */
  onFrameError?: (err: unknown) => void;
}

let current: InteractionContext | null = null;
const live = new Set<InteractionContext>();
const cancelAllHooks: Array<() => void> = [];

/**
 * The state of one running handler (`$` in transformed code): which click started it, the engine
 * activity it reports to, its phase for the interrupt policy, whether it is inside a cutscene, and
 * whether it has been cancelled.
 *
 * Transformed handler bodies call {@link step} for every statement-level call. The call runs
 * synchronously with this context as the ambient {@link currentContext}, which is how
 * `walkToClicked()` finds the clicked target and how a player walk is attributed to the
 * interaction (`runInInteraction`). Helpers, `cutscene` blocks and `together` branches called from
 * a handler run on the same context; `background` blocks get their own.
 */
export class InteractionContext {
  private isCancelled = false;
  private rejectCancel: ((reason: unknown) => void) | null = null;
  private readonly cancelSignal: Promise<never>;
  private phase: Phase = 'start';
  /** Depth of `cutscene` blocks this handler is inside. */
  cutsceneDepth = 0;
  readonly activity: InteractionActivity | null;
  /** Event payload of the verb / inventory click; `null` for room lifecycle handlers. */
  readonly payload: unknown;
  readonly scene: RoomScene | undefined;
  readonly gameplay: boolean;
  readonly onFrameError: ((err: unknown) => void) | undefined;

  constructor(
    activity: InteractionActivity | null,
    payload: unknown,
    scene: RoomScene | undefined,
    options: ContextOptions = {},
  ) {
    this.activity = activity;
    this.payload = payload;
    this.scene = scene;
    this.gameplay = options.gameplay !== false;
    this.onFrameError = options.onFrameError;
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
   * One statement of a handler (§6.4). Waits when the statement produced `task.wait()` (every
   * blocking action does) or the promise of a step function; returns at once otherwise, including
   * for the bare `Task` of a `.now` call.
   */
  async step(thunk: () => unknown): Promise<unknown> {
    if (this.isCancelled) {
      throw CANCELLED;
    }
    let value: unknown;
    try {
      value = this.run(thunk);
    } catch (err) {
      if (this.onFrameError) {
        this.onFrameError(err);
        return new Promise<never>(() => {});
      }
      throw err;
    }
    if (isTaskWait(value)) {
      await this.waitFor(value.task);
      return undefined;
    }
    if (isPromiseLike(value)) {
      return this.raceCancel(value);
    }
    return value;
  }

  /** World-click policy (§5 rule 9) while this handler runs. */
  worldClickPolicy(): WorldClickPolicy | null {
    if (!this.gameplay) {
      return null;
    }
    if (this.cutsceneDepth > 0) {
      return 'ignore';
    }
    return this.phase === 'openingWalk' ? 'interrupt' : 'ignore';
  }

  /** Stops the handler at its current step (§5 rule 7). Code after that step never runs. */
  cancel(): void {
    if (this.isCancelled) {
      return;
    }
    this.isCancelled = true;
    this.rejectCancel?.(CANCELLED);
  }

  /** The room this handler's timed actions play in. */
  roomScene(): RoomScene | undefined {
    return this.scene ?? liveRoomScene();
  }

  private async waitFor(task: Task<unknown>): Promise<void> {
    const isOpeningWalk = this.phase === 'start' && task.isPlayerWalk;
    if (!task.isTurn) {
      this.phase = isOpeningWalk ? 'openingWalk' : 'busy';
    }

    const scene = this.roomScene();
    // Skip mode (§5 rule 8): a skipped cutscene finishes every timed step at once.
    if (scene?.isCutsceneSkipFastForwarding()) {
      task.finishNow();
    }
    // ESC pressed while this step is in flight: finish it at its end state.
    const unregisterSkip =
      scene && !task.done && scene.isCutsceneActive()
        ? scene.registerCutsceneSkipFinisher(() => task.finishNow())
        : null;
    const waitingForPlayer = task.waitsForPlayer && !task.done;
    if (waitingForPlayer) {
      this.activity?.setWaitingForPlayer(true);
    }
    try {
      await this.raceCancel(task.promise);
    } finally {
      unregisterSkip?.();
      if (waitingForPlayer) {
        this.activity?.setWaitingForPlayer(false);
      }
      if (isOpeningWalk && this.phase === 'openingWalk') {
        this.phase = 'busy';
      }
    }
  }

  private raceCancel<T>(value: PromiseLike<T>): Promise<T> {
    return Promise.race([value, this.cancelSignal]);
  }
}

/** Context for code that runs outside any handler (module top level, untracked callbacks). */
const detached = new InteractionContext(null, null, undefined, { gameplay: false });

/** Ending calls, `unhandled()` and cancellation: ways a handler stops that aren't errors. */
function isQuietOutcome(err: unknown): boolean {
  return err === END_HANDLER || err === UNHANDLED || err === CANCELLED;
}

/**
 * Makes the runner for one `onUpdate` callback, with its own frame context, where timed actions
 * refuse to start (§4.18). Ending calls (`goTo`), `unhandled()` and cancellation just stop the
 * callback; any other error, including {@link TimedActionInUpdateError}, goes to `report`, also
 * when it surfaces later: in a step-function helper's step, or from an async callback's promise.
 */
export function createFrameRunner(
  report: (err: unknown) => void,
): (fn: (...args: never[]) => unknown, args: readonly unknown[]) => void {
  const fail = (err: unknown): void => {
    if (!isQuietOutcome(err)) {
      report(err);
    }
  };
  const frame = new InteractionContext(null, null, undefined, { gameplay: false, onFrameError: fail });
  return (fn, args) => {
    try {
      const result = frame.run(() => (fn as (...a: readonly unknown[]) => unknown)(...args));
      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch(fail);
      }
    } catch (err) {
      fail(err);
    }
  };
}

/** Thrown when a timed action starts inside `onUpdate`. */
export class TimedActionInUpdateError extends Error {
  constructor() {
    super(
      'A timed action (walkTo, say, wait, face, fade, save, …) was started inside onUpdate, which runs every frame and ' +
        "can't wait. To start a sequence from a frame check, use background(() => { … }) and guard it so it starts once. " +
        'Instant forms work there: x.startFacing(target) to keep a character turned toward another (or check x.facing ' +
        'first), x.alpha = … instead of fade, saves.autosave() instead of saves.save.',
    );
    this.name = 'TimedActionInUpdateError';
  }
}

setTimedStartGuard(() => {
  if (current?.onFrameError) {
    throw new TimedActionInUpdateError();
  }
});

/**
 * The context of the handler whose statement is running right now. Transformed step functions
 * capture it on entry (`const __$ = __bs.ctx()`), so helpers called from a handler join it.
 */
export function currentContext(): InteractionContext {
  return current ?? detached;
}

/**
 * Calls a step function outside any handler: it gets the detached context, not whichever handler
 * happens to be running (an event can fire synchronously inside another handler's step). Errors
 * are logged; ending calls and `unhandled()` just stop it.
 */
export function runDetached(label: string, fn: (...args: never[]) => unknown, args: readonly unknown[] = []): void {
  const previous = current;
  current = null;
  try {
    const result = (fn as (...a: readonly unknown[]) => unknown)(...args);
    if (isPromiseLike(result)) {
      void Promise.resolve(result).catch((err: unknown) => {
        outcomeOf(err, label);
      });
    }
  } catch (err) {
    outcomeOf(err, label);
  } finally {
    current = previous;
  }
}

/** Ends the running handler. Used by calls typed `never` (`goTo`, `saves.load`, `dialog.end`). */
export function endHandler(): never {
  throw END_HANDLER;
}

/**
 * Ends the running handler and hands the interaction to the next handler in the chain: the
 * character script's handler, then the global handlers and fallbacks (§4.5).
 */
export function unhandled(): never {
  throw UNHANDLED;
}

export type HandlerOutcome = 'finished' | 'ended' | 'unhandled' | 'cancelled' | 'failed';

function outcomeOf(err: unknown, label: string): HandlerOutcome {
  if (err === END_HANDLER) {
    return 'ended';
  }
  if (err === UNHANDLED) {
    return 'unhandled';
  }
  if (err === CANCELLED) {
    return 'cancelled';
  }
  console.error(`[Benne] Error in ${label} handler:`, err);
  return 'failed';
}

/**
 * Starts a handler in a new interaction and resolves when it is over. Reports the interaction to
 * the engine activity registry from start to end, including cancellation (decision 12), and gives
 * the registry its world-click policy (decision 1).
 */
export async function runHandler(
  label: string,
  scene: RoomScene | undefined,
  payload: unknown,
  handler: (...args: never[]) => unknown,
  args: readonly unknown[] = [],
  options: ContextOptions = {},
): Promise<HandlerOutcome> {
  let ctx: InteractionContext | null = null;
  const activity = beginInteractionActivity({
    gameplay: options.gameplay !== false,
    worldClickPolicy: () => ctx?.worldClickPolicy() ?? null,
    onInterrupt: () => ctx?.cancel(),
  });
  ctx = new InteractionContext(activity, payload, scene, options);
  live.add(ctx);
  const run = ctx;
  try {
    await run.step(() => (handler as (...a: readonly unknown[]) => unknown)(...args));
    return 'finished';
  } catch (err) {
    return outcomeOf(err, label);
  } finally {
    live.delete(run);
    activity.end();
  }
}

/**
 * Runs `fn` alongside the calling handler (§4.13): it does not take the interaction lock, the
 * caller does not wait for it, and it stops on a room change or save load like any handler.
 */
export function startBackground(fn: () => unknown): Task {
  const parent = currentContext();
  const ctx = new InteractionContext(null, parent.payload, parent.scene, { gameplay: false });
  live.add(ctx);
  const done = ctx
    .step(fn)
    .then(
      () => undefined,
      (err) => {
        if (outcomeOf(err, 'background') === 'unhandled' && import.meta.env.DEV) {
          console.warn('[Benne] unhandled() in a background block does nothing.');
        }
      },
    )
    .finally(() => live.delete(ctx));
  return new Task(done, { cancel: () => ctx.cancel() });
}

/**
 * Room change or save load: every running handler (and background block) stops at its current
 * step (§5 rule 7). `except` is the handler that asked for it and ends itself (`saves.load`).
 */
export function cancelAllInteractions(except?: InteractionContext): void {
  for (const ctx of [...live]) {
    if (ctx !== except) {
      ctx.cancel();
    }
  }
  for (const hook of cancelAllHooks) {
    hook();
  }
}

/** Runs `hook` after {@link cancelAllInteractions} cancels the handlers (e.g. drop the dialog stack). */
export function onCancelAllInteractions(hook: () => void): void {
  cancelAllHooks.push(hook);
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
