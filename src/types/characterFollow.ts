import type { Point2 } from './room.js';

/**
 * Options for {@link import('../engine/scripting/benneScriptFacades.js').BenneScriptCharacterFacade.startFollowingCharacter}
 * / {@link import('../engine/scripting/benneScriptFacades.js').BenneScriptPlayerFacade} (same API).
 */
export interface CharacterFollowOptions {
  /** Minimum distance (world pixels) to maintain from the target's feet. Default: 32. */
  minDistance?: number;

  /**
   * Repath when the follower is farther than this from the computed stand goal (world pixels).
   * Default: `minDistance + 12`.
   */
  repathThreshold?: number;

  /**
   * Offset from the target's feet in the target's facing frame: local +x is forward, +y is
   * perpendicular to the right (screen-space, y down).
   */
  offset?: Point2;

  /** Multiplier on the follower's base walk speed while following. Default: 1. */
  speedMultiplier?: number;

  /** When true, idle followers turn toward the target. Default: true. */
  faceTargetWhenIdle?: boolean;

  /**
   * When true, following pauses while cutscenes or scripted-dialog input suppression is active.
   * Default: true.
   */
  pauseDuringCutscene?: boolean;
}
