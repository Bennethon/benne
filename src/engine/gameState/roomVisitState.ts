import type { GameStateManager } from './GameStateManager.js';

/**
 * Persisted count of how many times the player has **entered** this room (incremented by the engine
 * at the start of each room load, before `whenEnterRoom` / `whenEnterAnyRoom`). Survives saves via
 * {@link GameStateManager.variables}.
 */
export function roomVisitCountVariableKey(roomId: string): string {
  return `room:${String(roomId)}:visitCount`;
}

function normalizeRoomVisitCountRaw(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.floor(raw));
  }
  if (typeof raw === 'string' && raw.length > 0) {
    const n = Number(raw);
    if (Number.isFinite(n)) {
      return Math.max(0, Math.floor(n));
    }
  }
  return 0;
}

/** Read persisted visit count without mutating (0 when never entered). */
export function getRoomVisitCount(manager: GameStateManager, roomId: string): number {
  return normalizeRoomVisitCountRaw(manager.getVariable(roomVisitCountVariableKey(roomId)));
}

/**
 * Increments persisted visit count for `roomId` and returns the new total (1 on first entry, then 2, …).
 */
export function incrementRoomVisitCount(manager: GameStateManager, roomId: string): number {
  const key = roomVisitCountVariableKey(roomId);
  const next = getRoomVisitCount(manager, roomId) + 1;
  manager.setVariable(key, next);
  return next;
}
