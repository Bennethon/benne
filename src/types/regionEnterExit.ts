/**
 * Payload of the room's region enter / exit events, which BenneScript's **`regions.x.onEnter` /
 * `onExit`** handlers receive (as `who`, the character's handle).
 */
export type RegionEnterExitContext = {
  /** This room’s id (same as `*.room.json` `id`). */
  roomId: string;
  /** Region row id (`regions[].id`) the event applies to. */
  regionId: string;
  /** Spawned character definition id (`CharacterData.id`). */
  characterId: string;
  /** `true` when `characterId` matches the current active player character. */
  isPlayer: boolean;
  /** World feet position in room pixels when the crossing was detected. */
  feetX: number;
  feetY: number;
};
