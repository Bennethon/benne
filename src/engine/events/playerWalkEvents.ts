/** Emitted on `gameEvents` when the player starts walking to a point. */
export const PLAYER_WALK_START = 'player:walk:start' as const;

/** Emitted when a walk finishes (arrived) or is cancelled (new destination / shutdown). */
export const PLAYER_WALK_STOP = 'player:walk:stop' as const;

export type PlayerWalkStartPayload = {
  roomId: string;
  targetX: number;
  targetY: number;
};

export type PlayerWalkStopReason = 'complete' | 'interrupted';

export type PlayerWalkStopPayload = {
  roomId: string;
  reason: PlayerWalkStopReason;
};
