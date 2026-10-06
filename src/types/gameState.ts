/** Values stored in {@link SerializableBenneGameState.flags}. */
export type BenneGameStateFlagValue = boolean | number | string;

/** Legacy v1 snapshot (flat player inventory). Loaded for migration only; new saves use v2. */
export interface SerializableBenneGameStateV1 {
  version: 1;
  flags: Record<string, BenneGameStateFlagValue>;
  variables: Record<string, unknown>;
  /** @deprecated v1 — migrated into {@link SerializableBenneGameStateV2.inventoryByCharacter} on load. */
  inventory: Record<string, number>;
  activeInventoryItemId?: string | null;
  currentRoom?: string;
  lastRoom?: string | null;
}

/** Serializable cross-room game state (v2). */
export interface SerializableBenneGameStateV2 {
  version: 2;
  flags: Record<string, BenneGameStateFlagValue>;
  variables: Record<string, unknown>;
  /** Character definition id → item id → quantity. */
  inventoryByCharacter: Record<string, Record<string, number>>;
  /**
   * Character definition id the player controls (`player`, whose bag is `inventory`).
   * Omitted in JSON defaults to `game-config.json` `startingPlayerCharacter` at load.
   */
  activePlayerCharacterId?: string;
  /**
   * Runtime "use on target" selection (item id) for the active player's bag.
   * Persisted in save snapshots; omitted or invalid in JSON is treated as null.
   */
  activeInventoryItemId?: string | null;
  currentRoom?: string;
  lastRoom?: string | null;
}

/** Union accepted by {@link import('../engine/gameState/GameStateManager.js').GameStateManager.applySnapshot}. */
export type SerializableBenneGameState = SerializableBenneGameStateV1 | SerializableBenneGameStateV2;

/** Public metadata of a save (`saves.list()`).*/
export interface SaveMetadata {
  /** Player-facing save name. */
  name: string;
  /** Slot id when the entry maps to fixed-slot storage (`benne-save-<slot>`). */
  slot?: number;
  /** Last write/load touch time in epoch milliseconds. */
  timestamp: number;
}

/** Internal manifest row persisted in localStorage for named saves. */
export interface SaveManifestEntry extends SaveMetadata {
  /**
   * Storage key for the snapshot payload. For legacy slots this is `benne-save-<slot>`,
   * for named saves this is `benne-save-v1-<sanitized-name>`.
   */
  storageKey: string;
}

/** Internal manifest payload persisted under `benne-saves-manifest-v1`. */
export interface SaveManifest {
  version: 1;
  saves: SaveManifestEntry[];
}

export const GAME_STATE_FLAG_CHANGED_EVENT = 'gameState:flagChanged' as const;
export const GAME_STATE_VARIABLE_CHANGED_EVENT = 'gameState:variableChanged' as const;
export const GAME_STATE_INVENTORY_CHANGED_EVENT = 'gameState:inventoryChanged' as const;
export const GAME_STATE_REPLACED_EVENT = 'gameState:replaced' as const;
export const GAME_STATE_ACTIVE_VERB_CHANGED_EVENT = 'gameState:activeVerbChanged' as const;
export const GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT =
  'gameState:activeInventoryItemChanged' as const;
export const GAME_STATE_ACTIVE_PLAYER_CHARACTER_CHANGED_EVENT =
  'gameState:activePlayerCharacterChanged' as const;
export const GAME_STATE_ROOM_CONTEXT_CHANGED_EVENT = 'gameState:roomContextChanged' as const;

export interface GameStateFlagChangedPayload {
  key: string;
  previousValue?: BenneGameStateFlagValue;
  value?: BenneGameStateFlagValue;
}

export interface GameStateVariableChangedPayload {
  key: string;
  previousValue?: unknown;
  value?: unknown;
}

export interface GameStateInventoryChangedPayload {
  reason: 'add' | 'remove' | 'clear';
  /** Character definition id whose bag changed. */
  characterId: string;
  itemId?: string;
  /** Clone of that character's bag after the mutation. */
  inventory: Record<string, number>;
}

export interface GameStateReplacedPayload {
  snapshot: SerializableBenneGameStateV2;
}

/**
 * Emitted when the runtime "active verb" changes (runtime UI state; not part of the snapshot).
 * `value` is `null` when cleared.
 */
export interface GameStateActiveVerbChangedPayload {
  previousValue: string | null;
  value: string | null;
}

/** Emitted when the runtime active inventory item (use-on-target) changes. */
export interface GameStateActiveInventoryItemChangedPayload {
  itemId: string | null;
}

/** Emitted when the active controllable player character changes. */
export interface GameStateActivePlayerCharacterChangedPayload {
  previousCharacterId: string;
  characterId: string;
}

/** Emitted when persisted room context (`currentRoom` / `lastRoom`) changes. */
export interface GameStateRoomContextChangedPayload {
  currentRoom: string;
  lastRoom: string | null;
  previousCurrentRoom: string;
  previousLastRoom: string | null;
}
