/** What `RoomScene` passes to per-frame handlers each frame. */
export interface UpdateContext {
  /** Seconds since the previous frame. */
  readonly deltaSeconds: number;
  /** The active room. */
  readonly roomId: string;
}

export type OnUpdateHandler = (ctx: UpdateContext) => void;

const handlers: OnUpdateHandler[] = [];
/**
 * Failures logged per handler. A failing handler fails every frame, so each distinct message is
 * logged once, and after {@link MAX_REPORTED_MESSAGES} of them (a message with a changing value in
 * it) the handler is logged as silenced and nothing more is.
 */
const reported = new WeakMap<OnUpdateHandler, Set<string>>();
const MAX_REPORTED_MESSAGES = 5;

/** Registers a per-frame handler for the lifetime of the game (`onUpdate`, §4.18). Returns unregister. */
export function registerOnUpdateHandler(handler: OnUpdateHandler): () => void {
  handlers.push(handler);
  return () => {
    const i = handlers.indexOf(handler);
    if (i >= 0) {
      handlers.splice(i, 1);
    }
  };
}

/**
 * Logs a failure of `handler`, once per message (see {@link reported}). Also for failures that
 * surface after the frame, such as a rejected step-function helper called from `onUpdate`.
 */
export function reportOnUpdateFailure(handler: OnUpdateHandler, error: unknown): void {
  const seen = reported.get(handler) ?? new Set<string>();
  reported.set(handler, seen);
  if (seen.size > MAX_REPORTED_MESSAGES) {
    return;
  }
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (seen.has(message)) {
    return;
  }
  seen.add(message);
  const label = `[Benne] onUpdate handler #${handlers.indexOf(handler)}`;
  if (seen.size > MAX_REPORTED_MESSAGES) {
    console.error(`${label} keeps failing with different errors; not logging it any more.`);
    return;
  }
  console.error(`${label} failed (logged once):`, error);
}

/** Runs every per-frame handler; called by `RoomScene.update`. One failing handler doesn't stop the others. */
export function runOnUpdateHandlers(ctx: UpdateContext): void {
  for (const handler of [...handlers]) {
    try {
      handler(ctx);
    } catch (e) {
      reportOnUpdateFailure(handler, e);
    }
  }
}
