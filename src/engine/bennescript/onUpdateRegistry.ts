/** What `RoomScene` passes to per-frame handlers each frame. */
export interface UpdateContext {
  /** Seconds since the previous frame. */
  readonly deltaSeconds: number;
  /** The active room. */
  readonly roomId: string;
}

export type OnUpdateHandler = (ctx: UpdateContext) => void;

const handlers: OnUpdateHandler[] = [];

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

/** Runs every per-frame handler; called by `RoomScene.update`. One failing handler doesn't stop the others. */
export function runOnUpdateHandlers(ctx: UpdateContext): void {
  const snapshot = [...handlers];
  for (let i = 0; i < snapshot.length; i += 1) {
    try {
      snapshot[i]!(ctx);
    } catch (e) {
      console.error(`[Benne] onUpdate handler #${i} failed:`, e);
    }
  }
}
