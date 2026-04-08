/** Emitted when `E.changeRoom` runs; listeners perform the real room transition (phase 2). */
export const GAME_ROOM_CHANGE_REQUESTED_EVENT = 'game:roomChangeRequested';

export type GameRoomChangeRequestedPayload = {
  roomId: string;
  spawnPoint?: string;
};

/** Emitted when a script flag is set via the BenneScript facade. */
export const FLAG_CHANGED_EVENT = 'flag:changed';

export type FlagChangedPayload = {
  key: string;
  value: unknown;
};

/** Emitted when the in-memory inventory stub changes. */
export const INVENTORY_CHANGED_EVENT = 'inventory:changed';

export type InventoryChangedPayload = {
  itemId: string;
  action: 'add' | 'remove';
};

/** Emitted when `E.firstOccurrence` returns `true` for a key (first time only). */
export const FIRST_OCCURRENCE_CONSUMED_EVENT = 'firstOccurrence:consumed';

export type FirstOccurrenceConsumedPayload = {
  key: string;
};

/** Request a full-screen fade out; no renderer listens yet (phase 2: PostEffects / camera filters). */
export const GAME_FADE_OUT_REQUESTED_EVENT = 'game:fadeOutRequested';

/** Request a full-screen fade in; no renderer listens yet (phase 2). */
export const GAME_FADE_IN_REQUESTED_EVENT = 'game:fadeInRequested';

export type GameFadePayload = {
  /** Duration in milliseconds; omitted means engine default when wired. */
  durationMs?: number;
};
