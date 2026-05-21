/** Values stored in {@link SerializableBenneGameState.flags}. */
export type BenneGameStateFlagValue = boolean | number | string;

/** Serializable cross-room game state (v1). */
export interface SerializableBenneGameState {
  version: 1;
  flags: Record<string, BenneGameStateFlagValue>;
  variables: Record<string, unknown>;
  /** Item id → quantity (omitted or zero means not carried). */
  inventory: Record<string, number>;
  /**
   * Runtime "use on target" selection (item id). Persisted in save snapshots; omitted or invalid in JSON is treated as null.
   */
  activeInventoryItemId?: string | null;
  /**
   * Id of the room the player is considered to be in (for saves and room-transition orchestration). Empty string when unknown / not yet set. Omitted in legacy snapshots (treated as `""` / `null` when loaded).
   */
  currentRoom?: string;
  /**
   * Previous room id when transitioning, or `null` when not applicable. Omitted in legacy saves.
   */
  lastRoom?: string | null;
}

/** Public metadata returned by `B.state.getSaveList()`. */
export interface SaveMetadata {
  /** Player-facing save name. */
  name: string;
  /** Legacy slot id when the entry originates from `saveToBrowser(slot)` data. */
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
  itemId?: string;
  inventory: Record<string, number>;
}

export interface GameStateReplacedPayload {
  snapshot: SerializableBenneGameState;
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

/** Emitted when persisted room context (`currentRoom` / `lastRoom`) changes. */
export interface GameStateRoomContextChangedPayload {
  currentRoom: string;
  lastRoom: string | null;
  previousCurrentRoom: string;
  previousLastRoom: string | null;
}
