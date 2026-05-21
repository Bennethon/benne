/**
 * Pull-up registry for **lazy** runtime → game-state writes.
 *
 * Most engine state (visibility, alpha, animation overrides, flags, variables) is written
 * **eagerly** into {@link import('./GameStateManager.js').GameStateManager} on every change,
 * so its snapshot is always in sync. A few fields (notably **character / prop positions**)
 * are too noisy to write per-tick during walks, so they live on the live Phaser sprites and
 * only get pulled into game state when something asks for an authoritative snapshot.
 *
 * Hooks fire on:
 * - **Room transition leave** — {@link import('../scenes/RoomTransitionOrchestrator.js').RoomTransitionOrchestrator}
 *   calls {@link runSnapshotFlushHooks} before tearing the active room scene down.
 * - **Snapshot creation** — {@link import('./GameStateManager.js').GameStateManager.getSnapshot}
 *   runs hooks before cloning state (unless `runFlushHooks: false`), so
 *   {@link import('./GameStateManager.js').GameStateManager.exportSnapshotJson} and saves pick them up.
 *   {@link import('./GameStateManager.js').GameStateManager.applySnapshot} must **not** flush — the loaded
 *   JSON is authoritative while the old {@link import('../scenes/RoomScene.js').RoomScene} may still be active.
 * - **`B.state.flush()`** — explicit script-level save point.
 *
 * Hooks register on scene `create` and unregister on scene `shutdown` (or equivalent).
 * Failures in a single hook are logged but do not break other hooks or `getSnapshot` itself —
 * saves are sacred.
 */
const flushHooks: Set<() => void> = new Set();

export function registerSnapshotFlushHook(hook: () => void): () => void {
  flushHooks.add(hook);
  return () => {
    flushHooks.delete(hook);
  };
}

export function runSnapshotFlushHooks(): void {
  for (const hook of flushHooks) {
    try {
      hook();
    } catch (err) {
      console.error('[Benne] snapshot flush hook threw:', err);
    }
  }
}
