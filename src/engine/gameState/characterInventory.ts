import { getStartingPlayerCharacterId } from '../content/constants.js';

/** Accepts v1 map, legacy string[], or empty. */
export function normalizeSerializedInventory(raw: unknown): Record<string, number> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (k.length === 0) {
        continue;
      }
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) {
        continue;
      }
      const q = Math.floor(n);
      if (q > 0) {
        out[k] = q;
      }
    }
    return out;
  }
  if (Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const id of raw) {
      if (typeof id === 'string' && id.length > 0) {
        out[id] = (out[id] ?? 0) + 1;
      }
    }
    return out;
  }
  return {};
}

export function cloneInventoryBag(inv: Record<string, number>): Record<string, number> {
  return { ...inv };
}

export function cloneInventoryByCharacter(
  bags: Record<string, Record<string, number>>,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [characterId, bag] of Object.entries(bags)) {
    out[characterId] = cloneInventoryBag(bag);
  }
  return out;
}

/**
 * Normalizes bootstrap / snapshot `inventoryByCharacter` from config or save JSON.
 * Each value may be a quantity map or legacy string[] id list.
 */
export function normalizeSerializedInventoryByCharacter(
  raw: unknown,
): Record<string, Record<string, number>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, Record<string, number>> = {};
  for (const [characterId, bagRaw] of Object.entries(raw as Record<string, unknown>)) {
    if (characterId.length === 0) {
      continue;
    }
    const bag = normalizeSerializedInventory(bagRaw);
    if (Object.keys(bag).length > 0) {
      out[characterId] = bag;
    }
  }
  return out;
}

/**
 * Builds initial per-character bags from game-config `initialGameState`.
 * Legacy flat `inventory` seeds the starting player character only.
 */
export function buildInitialInventoryByCharacter(options: {
  inventoryByCharacter?: unknown;
  legacyInventory?: unknown;
  startingPlayerCharacterId?: string;
}): Record<string, Record<string, number>> {
  const out = normalizeSerializedInventoryByCharacter(options.inventoryByCharacter);
  const legacy = normalizeSerializedInventory(options.legacyInventory);
  if (Object.keys(legacy).length === 0) {
    return out;
  }
  const playerId = options.startingPlayerCharacterId?.trim() || getStartingPlayerCharacterId();
  const existing = out[playerId] ?? {};
  out[playerId] = { ...existing, ...legacy };
  return out;
}

/** Debug / future variable-bag parity key (primary storage is snapshot `inventoryByCharacter`). */
export function characterInventoryVariableKey(characterId: string): string {
  return `character:${characterId}:inventory`;
}

export function normalizeActivePlayerCharacterIdFromSnapshot(raw: unknown): string | null {
  if (typeof raw === 'string' && raw.length > 0) {
    return raw;
  }
  return null;
}

export function resolveActivePlayerCharacterId(
  persisted: string | null | undefined,
  fallback = getStartingPlayerCharacterId(),
): string {
  const trimmed = persisted?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}
