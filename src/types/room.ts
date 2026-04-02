export interface Point2 {
  x: number;
  y: number;
}

export interface WalkablePolygon {
  id: string;
  points: Point2[];
}

export interface RoomHotspotData {
  id: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  onLook?: string;
  onUse?: string;
}

export interface RoomCharacterInstance {
  /** Unique id for this placement in the room (Phaser texture key suffix). */
  instanceId: string;
  /** Path relative to `src/game/characters/` (e.g. `clerk/clerk.character.json`). */
  definition: string;
  x: number;
  y: number;
}

export interface RoomData {
  id: string;
  name: string;
  background: {
    /** Path under `src/game/assets/` (e.g. `images/backgrounds/office.png`). Resolved by Vite at build time. */
    image: string;
  };
  walkable: {
    polygons: WalkablePolygon[];
  };
  hotspots: RoomHotspotData[];
  /** NPCs / props that use a character definition. */
  characters?: RoomCharacterInstance[];
}
