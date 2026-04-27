import type { Point2 } from '../../types/room';

/**
 * Payload for prop interaction events (verb-enabled props in room JSON).
 * Handlers subscribe to canonical scoped event ids from `verbInteractionEvents.ts`.
 */
export type RoomPropInteractPayload = {
  propId: string;
  roomId: string;
  /** Aseprite tag / animation name for this prop instance. */
  tag: string;
  description?: string;
  /** Optional room JSON hints for script-driven movement/facing toward this prop. */
  walkToPoint?: Point2;
  lookAtPoint?: Point2;
  /** Which verb was used (`game-config.json` `verbs[].id`). */
  verbId: string;
  /** True when this run used the prop’s `onVerbFallback` handler. */
  verbFallback?: boolean;
};

/**
 * Payload for hotspot interaction events (verb-enabled `RoomHotspotData`).
 */
export type RoomHotspotInteractPayload = {
  hotspotId: string;
  roomId: string;
  description?: string;
  verbId: string;
  verbFallback?: boolean;
  walkToPoint?: Point2;
  lookAtPoint?: Point2;
};

/**
 * Payload for character interaction events (clickable `CharacterData` spawned in a room).
 */
export type CharacterVerbInteractPayload = {
  characterId: string;
  instanceId: string;
  roomId: string;
  description?: string;
  verbId: string;
  verbFallback?: boolean;
  /** World coordinates when character JSON defines `walkToPoint` (frame offset applied at click time). */
  walkToPoint?: Point2;
  /** World coordinates when character JSON defines `talkPoint` (frame offset applied at click time). */
  talkPoint?: Point2;
};
