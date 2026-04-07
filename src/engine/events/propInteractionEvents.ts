import type { Point2 } from '../../types/room';

/**
 * Payload for prop interaction events (`onVerb`, legacy `onLook` / `onUse`).
 * Handlers subscribe to the same event id the prop references.
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
  /** Present for legacy verbs when `verbId` is `look` or `use`. */
  kind?: 'look' | 'use';
};
