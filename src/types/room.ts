import type { CharacterFacingLetter, CharacterAnimationsConfig } from './character';

export type {
  HotspotId,
  PointId,
  PropId,
  RegionId,
  ResolvableTargetId,
  RoomId,
  VerbTargetId,
  WalkableId,
} from './generated/benne-game-ids.js';

export interface Point2 {
  x: number;
  y: number;
}

/** Inner ring subtracted from a walkable polygon when `active` is not false. */
export interface WalkableHole {
  id: string;
  /** When false, this ring does not cut a hole (ignored for walk tests and debug). Omitted = active. */
  active?: boolean;
  points: Point2[];
}

export interface WalkablePolygon {
  id: string;
  /** When false, this polygon is ignored for walking and debug overlays. Omitted = active. */
  active?: boolean;
  points: Point2[];
  /** Optional holes (each an inner closed ring). Inactive holes are ignored. */
  holes?: WalkableHole[];
}

/**
 * Clickable room hotspot: closed polygon in room pixels (same space as walkable meshes).
 * The engine requires at least three vertices in `points` for hit-testing.
 */
export interface RoomHotspotData {
  id: string;
  /** When false, ignored for interaction. Omitted = active. */
  active?: boolean;
  description?: string;
  /** Draw / hit stacking vs other hotspots (higher tested later, tends to sit on top). */
  zIndex?: number;
  /**
   * Room-space Y (pixels, y increases downward). When set, characters with **world feet Y greater
   * than** this line draw in front of this hotspot’s stack entry; otherwise `zIndex` ordering applies.
   */
  baseline?: number;
  /** Polygon hit area in room pixels (at least three vertices). */
  points: Point2[];
  /** Where the player walks when this hotspot is used (optional; editor + future walk-to flow). */
  walkToPoint?: Point2;
  /** Facing target after walking (optional; pairs with `walkToPoint`). */
  lookAtPoint?: Point2;
  /**
   * Verb id invoked when an `inputProfile` slot resolves to `"defaultVerb"` on this hotspot.
   * Falls back to `"look"` when omitted.
   */
  defaultVerb?: string;
  /** Enables object-level fallback dispatch when no supported verb matches. */
  onVerbFallback?: boolean;
  /**
   * Optional Aseprite tag on the **game** cursor sheet (`game-config.json` `cursor` + `images/cursor/`).
   * When set and the pointer hovers this hotspot, the custom cursor uses this tag instead of
   * `cursor.activeAnimation`. Active inventory with `cursorAnimation` still wins.
   */
  activeCursorOverride?: string;
}

/** Named marker in room space (spawns, triggers, script anchors). */
export interface RoomPointData {
  id: string;
  x: number;
  y: number;
}

/** Logical area (perspective scale, tint, walk blocking, triggers) as a closed polygon in room space. */
export interface RoomRegionData {
  id: string;
  /** When false, ignored by tooling/runtime that respects regions. Omitted = active. */
  active?: boolean;
  /**
   * When `false`, characters cannot walk through this polygon (treated as a hole in the walkable mesh).
   * Omitted or `true` = walkable (no movement restriction from this region).
   */
  walkable?: boolean;
  points: Point2[];
  /**
   * When `true`, this region applies perspective character scale (`scaleTop` / `scaleBottom`) and
   * optional `scaleWalkSpeed`. Omitted or not `true` = this region does not scale (it does not
   * cancel scale from an earlier overlapping region).
   */
  scaleEnabled?: boolean;
  /**
   * Character scale at the **top** of the region (smaller room Y). `1` = normal size. Omitted = `1`.
   * Interpolates linearly with {@link scaleBottom} by feet Y across the region’s vertical bounds.
   * Applied only when {@link scaleEnabled} is `true`.
   */
  scaleTop?: number;
  /**
   * Character scale at the **bottom** of the region (larger room Y). Omitted = `1`.
   * Applied only when {@link scaleEnabled} is `true`.
   */
  scaleBottom?: number;
  /**
   * When `true`, walking speed is multiplied by a perspective factor derived from the same linear
   * {@link scaleTop} / {@link scaleBottom} value as sprite scale (see `game-config.json` `perspective`).
   * Omitted = `false`. Read only from the scale winner (`scaleEnabled`).
   */
  scaleWalkSpeed?: boolean;
  /**
   * When `true`, this region is a character-tint source (`tint` / `tintAlpha`). Omitted or not
   * `true` = this region does not tint (it does not clear tint from an earlier overlapping region).
   */
  tintEnabled?: boolean;
  /**
   * Hex RGB (e.g. `#aabbcc`). When this region is the tint winner (`tintEnabled`), characters
   * multiply-tint toward this color. Omitted or invalid hex = no tint color from this region.
   */
  tint?: string;
  /**
   * 0–1 blend between no tint and full {@link tint} multiply (`1` = full strength). Omitted = `1` when `tint` is set.
   * Applied only when this region is the tint winner ({@link tintEnabled}).
   */
  tintAlpha?: number;
}

export interface RoomCharacterInstance {
  /** Unique id for this placement in the room (Phaser texture key suffix). */
  instanceId: string;
  /** Path relative to `src/game/characters/` (e.g. `clerk/clerk.character.json`). */
  definition: string;
  x: number;
  y: number;
  /** Facing for the first directional animation (e.g. `Idle` + `L` -> `IdleL`). */
  initialFacing?: CharacterFacingLetter;
  /** Base name before direction suffix; default `Idle`. */
  initialAnimation?: string;
  /** When false, sprite is hidden and not interactive. Default true. */
  visible?: boolean;
  /** Added to the engine character layer base depth; higher draws in front of lower. */
  zIndex?: number;
}

/** Clickable / hit-test region for a room prop, in room pixel space (same as walkable polygons). */
export interface RoomPropCollider {
  points: Point2[];
}

/**
 * One placed prop in a room: Aseprite tag on this room's sheet (`images/rooms/<roomId>/`), draw order, and interaction.
 */
export interface RoomPropInstance {
  id: string;
  /**
   * Aseprite frame-tag name for this prop. Must appear in `meta.frameTags` on the room sheet
   * (see `getAsepriteFrameTagNames('room', roomId)`); cels with no tag are not props.
   */
  tag: string;
  /**
   * Optional extra root for `<root>-*` clip families on the room sheet (editor / import tooling).
   * When set (non-empty), tags matching `defaultAnimation` or `defaultAnimation-*` are grouped with this prop
   * alongside tags matching `id` / `id-*`. Omitted when `id` alone is the Aseprite prefix root.
   */
  defaultAnimation?: string;
  /**
   * How the prop’s `x` / `y` fields map to the Aseprite cel when the room sheet uses **trim cells** (JSON
   * `spriteSourceSize` / Phaser `frame.data.trim`).
   * - **`canvas`** (default): `(x, y)` is the **logical cel / sheet canvas** origin — same as a GUI
   *   `screen` anchor; Phaser’s built-in trim offset keeps art aligned with the Aseprite canvas
   *   (typical full-room composite props).
   * - **`tight`**: `(x, y)` is the **top-left of the trimmed opaque** region in room pixels — same
   *   idea as a GUI `top-left` image with trim; the engine subtracts `spriteSourceSize` and keeps
   *   it in sync when the prop’s current frame changes.
   */
  spritePlacement?: 'canvas' | 'tight';
  /** Sprite position in room pixels (default top-left 0,0 for full-room composite frames). */
  x?: number;
  y?: number;
  /** Draw order: higher values render in front of lower values. */
  zIndex?: number;
  /**
   * Room-space Y (pixels, y increases downward). When set, characters with **world feet Y greater
   * than** this line draw in front of this prop; otherwise `zIndex` ordering applies.
   */
  baseline?: number;
  /** When true, the prop may receive clicks; the engine dispatches verb scripts immediately (no auto walk/face). */
  clickable?: boolean;
  visible?: boolean;
  /** 0–1; default 1. */
  alpha?: number;
  /**
   * Optional stand position for script-driven movement (not used by the engine for clicks).
   * Game scripts may read this from payloads / room data when implementing walk-to-object behavior.
   */
  walkToPoint?: Point2;
  /**
   * Optional facing target for script-driven facing (not used by the engine for clicks).
   */
  lookAtPoint?: Point2;
  description?: string;
  /** Hit area in room space; required when `clickable` is true. */
  collider?: RoomPropCollider;
  /**
   * Verb id invoked when an `inputProfile` slot resolves to `"defaultVerb"` on this prop.
   * Falls back to `"look"` when omitted. Shown in the Inspector as the "Default verb" dropdown.
   */
  defaultVerb?: string;
  /** Enables object-level fallback dispatch when no supported verb matches (before global handlers). */
  onVerbFallback?: boolean;
  /**
   * Optional Aseprite tag on the **game** cursor sheet. When set and the pointer hovers this clickable
   * prop, the cursor uses this tag instead of `cursor.activeAnimation`. Inventory cursor clips take precedence.
   */
  activeCursorOverride?: string;
  /** Per-tag playback (loop, frameDuration); keys match Aseprite tags on this room's sheet. */
  animations?: CharacterAnimationsConfig;
  /**
   * Parallax multiplier vs camera view. Each frame:
   * `sprite position = parallaxDepth * (x,y) + (1 - parallaxDepth) * (worldView.x, worldView.y)`.
   * - `0` — moves fully with the camera (world position tracks scroll origin)
   * - `0–1` — distant; moves slower than the camera
   * - `1` — no parallax (default if omitted); stays at authored `(x, y)`
   * - `>1` — foreground; moves faster than the camera
   */
  parallaxDepth?: number;
}

export interface RoomData {
  id: string;
  name: string;
  /**
   * Optional static backdrop under props. When omitted, only props (and game backgroundColor) show.
   */
  background?: {
    /** Path under `src/game/assets/` (e.g. `images/backgrounds/office.png`). Resolved by Vite at build time. */
    image: string;
  };
  /**
   * Explicit room dimensions in pixels. When omitted the room is assumed to be the same size as the
   * game viewport (e.g. 352x198). Set this when the background or prop sheet is wider or taller than
   * the game resolution so the camera can scroll.
   */
  size?: { width: number; height: number };
  /**
   * Camera scroll bounds in room pixel space. Restricts how far the camera can pan within the room.
   * When omitted the camera is bounded by the full room `size`.
   * The character can walk beyond scroll bounds but the camera stops panning before reaching the room edge.
   */
  scrollBounds?: { x: number; y: number; width: number; height: number };
  walkable: {
    polygons: WalkablePolygon[];
  };
  hotspots: RoomHotspotData[];
  /** Named points in room space (optional; used by editor and future systems). */
  points?: RoomPointData[];
  /** Closed polygons for regions (optional; editor + future gameplay). */
  regions?: RoomRegionData[];
  /**
   * Layered Aseprite props from `images/rooms/<id>/<id>.png` + `.json` (one sheet per room).
   */
  props?: RoomPropInstance[];
  /** NPCs / props that use a character definition. */
  characters?: RoomCharacterInstance[];
}
