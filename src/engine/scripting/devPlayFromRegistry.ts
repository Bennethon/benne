/**
 * Named **Play From** setups keyed by **`roomId` → `name` → handler** (BENNE Play / editor).
 * Populated from {@link import('./BenneScript.js').BenneScript.prototype.playFrom}; consumed by
 * {@link import('../scenes/RoomTransitionOrchestrator.js').RoomTransitionOrchestrator}.
 *
 * Cleared per room when {@link import('../scenes/RoomScene.js').RoomScene} begins wiring scripts
 * for that room (same cadence as {@link import('../scenes/RoomTransitionHookRegistry.js').RoomTransitionHookRegistry.prototype.clearPerRoomScriptHooksForRoomId}).
 */

export type PlayFromSetupFn = () => void | Promise<void>;

const playFromRegistry = new Map<string, Map<string, PlayFromSetupFn>>();

export function clearPlayFromRegistrationsForRoom(roomId: string): void {
  playFromRegistry.delete(String(roomId));
}

export function registerPlayFromForRoom(roomId: string, name: string, setup: PlayFromSetupFn): void {
  const rid = String(roomId);
  const id = String(name).trim();
  if (id.length === 0) {
    return;
  }
  let m = playFromRegistry.get(rid);
  if (!m) {
    m = new Map();
    playFromRegistry.set(rid, m);
  }
  if (import.meta.env.DEV && m.has(id)) {
    console.warn(`[Benne] Play From: duplicate name "${id}" for room "${rid}" — last registration wins.`);
  }
  m.set(id, setup);
}

export function getPlayFromSetupForRoom(roomId: string, name: string): PlayFromSetupFn | undefined {
  const id = String(name).trim();
  if (id.length === 0) {
    return undefined;
  }
  return playFromRegistry.get(String(roomId))?.get(id);
}
