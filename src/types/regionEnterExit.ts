/**
 * Payload for {@link import('../engine/scripting/BenneScript.js').BenneScript}'s
 * **`B.region('…').whenEnter` / `whenExit`** (and flat **`whenEnterRegion` / `whenExitRegion`**).
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
