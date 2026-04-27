import type { Point2 } from './room';

/**
 * Frame-synced marker from character JSON (footsteps, SFX hooks, dialogue beats, etc.).
 */
export interface CharacterAnimationFrameEvent {
  /** 0-based index within the Aseprite tag / Phaser animation sequence. */
  frame: number;
  type: string;
  data?: unknown;
}

/**
 * Per-tag animation policy (keys match Aseprite frame tag names, e.g. `WalkL`, `IdleD`).
 */
export interface CharacterAnimationClipConfig {
  /** When true, repeat forever (`repeat: -1` in Phaser). When false or omitted, play once. */
  loop?: boolean;
  /**
   * Milliseconds each frame is shown (uniform for this tag). Applied to every frame in the clip.
   * When omitted, keeps per-frame durations from the Aseprite export.
   */
  frameDuration?: number;
  events?: CharacterAnimationFrameEvent[];
  // Future: pingPong?: boolean; reverse?: boolean;
}

export type CharacterAnimationsConfig = Record<string, CharacterAnimationClipConfig>;

/** Facing suffix on directional clips (`IdleL`, `WalkDR`, …). */
export type CharacterFacingLetter = 'L' | 'R' | 'U' | 'D' | 'UL' | 'UR' | 'DL' | 'DR';

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
  /**
   * Ground contact in **texture / frame pixel space**: from the top-left of each cel to the feet
   * (Y increases downward). When omitted, the engine uses the bottom-centre of the current frame.
   */
  feet?: { x: number; y: number };
  /**
   * Click hit area in **texture / frame pixel space** (same origin as `feet`). When omitted and the
   * character is clickable, the full sprite rectangle is used. Requires at least three vertices.
   */
  collider?: { points: { x: number; y: number }[] };
  /**
   * Optional stand position in **texture / frame pixel space** (same origin as `feet`).
   * World stand = sprite position + this offset. Used when scripts call `walkTo('<this id>')` targeting
   * this character, or when resolving another walker’s target to this character — same idea as prop `walkToPoint`.
   */
  walkToPoint?: Point2;
  /**
   * Optional “face / dialogue” point in **texture / frame pixel space** (same origin as `feet`).
   * World position = sprite position + offset. Verb payloads expose this as **world** `talkPoint`
   * for scripts (similar role to prop `lookAtPoint` in room space).
   */
  talkPoint?: Point2;
  /** Game pixels per second when walking (used when movement is implemented). */
  walkSpeed: number;
  clickable: boolean;
  display: CharacterDisplayData;
  /** Optional per Aseprite-tag playback (keys must match `meta.frameTags` on `images/characters/<id>/<id>.json`). */
  animations?: CharacterAnimationsConfig;
  /**
   * Verb id invoked when an `inputProfile` slot resolves to `"defaultVerb"` on this character.
   * Falls back to `"look"` when omitted.
   */
  defaultVerb?: string;
  /** Enables character fallback dispatch when no supported verb matches. */
  onVerbFallback?: boolean;
}
