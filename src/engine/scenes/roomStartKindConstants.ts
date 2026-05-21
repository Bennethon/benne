export const BENNE_ROOM_START_KIND_KEY = 'benneRoomStartKind';

/**
 * How the active `RoomScene` was started: shipped boot, runtime `changeTo`, save-game load,
 * or editor preview.
 */
export type BenneRoomStartKind = 'boot' | 'transition' | 'load' | 'preview';
