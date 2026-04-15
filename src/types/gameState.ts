/** Values stored in {@link SerializableBenneGameState.flags}. */
export type BenneGameStateFlagValue = boolean | number | string;

/** Serializable cross-room game state (v1). */
export interface SerializableBenneGameState {
  version: 1;
  flags: Record<string, BenneGameStateFlagValue>;
  variables: Record<string, unknown>;
  /** Item id → quantity (omitted or zero means not carried). */
  inventory: Record<string, number>;
}

export const GAME_STATE_FLAG_CHANGED_EVENT = 'gameState:flagChanged' as const;
export const GAME_STATE_VARIABLE_CHANGED_EVENT = 'gameState:variableChanged' as const;
export const GAME_STATE_INVENTORY_CHANGED_EVENT = 'gameState:inventoryChanged' as const;
export const GAME_STATE_REPLACED_EVENT = 'gameState:replaced' as const;

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
