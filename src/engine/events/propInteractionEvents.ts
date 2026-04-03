/**
 * Payload for `onLook` / `onUse` strings defined on room props (`*.room.json`).
 * Handlers subscribe to the same event id the prop references.
 */
export type RoomPropInteractPayload = {
  propId: string;
  roomId: string;
  /** Aseprite tag / animation name for this prop instance. */
  tag: string;
  description?: string;
  /** Present when the player used left (`look`) vs right (`use`) click. */
  kind?: 'look' | 'use';
};
