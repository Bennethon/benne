import type { Point2 } from '../../types/room';

/** Emitted when no object handler, object fallback, or global handler consumes the verb. */
export const VERB_UNHANDLED_EVENT = 'verb:unhandled';

/** Ultimate global fallback after `verb:global:<verbId>`. */
export const VERB_GLOBAL_FALLBACK_EVENT = 'verb:global:fallback';

const VERB_GLOBAL_PREFIX = 'verb:global:';

/** `verb:global:<verbId>` — register here for default handling of a verb on any target. */
export function globalVerbHandlerEventId(verbId: string): string {
  return `${VERB_GLOBAL_PREFIX}${verbId}`;
}

export type VerbInteractTarget =
  | {
      type: 'prop';
      propId: string;
      tag: string;
      roomId: string;
      description?: string;
      /** Optional hints from room JSON for script-driven walk/face (not applied by the engine on click). */
      walkToPoint?: Point2;
      lookAtPoint?: Point2;
    }
  | { type: 'hotspot'; hotspotId: string; roomId: string; description?: string }
  | { type: 'character'; characterId: string; instanceId: string; roomId: string; description?: string };

/**
 * Payload for {@link VERB_GLOBAL_FALLBACK_EVENT} and {@link globalVerbHandlerEventId} emissions
 * (flat object from `dispatchVerb`; which optional ids are set depends on target type).
 */
export type VerbGlobalFallbackPayload = {
  verbId: string;
  roomId: string;
  description?: string;
  propId?: string;
  tag?: string;
  hotspotId?: string;
  characterId?: string;
  instanceId?: string;
  walkToPoint?: Point2;
  lookAtPoint?: Point2;
  kind?: 'look' | 'use';
  verbFallback?: boolean;
};

export type VerbUnhandledPayload = {
  verbId: string;
  target: VerbInteractTarget;
  fallbackLine: string;
};
