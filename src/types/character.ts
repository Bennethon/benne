/**
 * Character template loaded from `src/game/characters/` as `*.character.json` files.
 */
export interface CharacterDisplayData {
  /**
   * Static portrait / NPC image under `src/game/assets/`.
   * Required when `aseprite` is not true.
   */
  defaultImage?: string;
  /**
   * When true, loads `images/characters/<characterId>/<characterId>.png` and `.json` (Aseprite sheet export).
   */
  aseprite?: boolean;
}

export interface CharacterData {
  id: string;
  name: string;
  description: string;
  /** Game pixels per second when walking (used when movement is implemented). */
  walkSpeed: number;
  clickable: boolean;
  display: CharacterDisplayData;
  /** Event id for look / examine (optional). */
  onLook?: string;
}
