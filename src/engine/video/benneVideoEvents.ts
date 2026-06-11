/**
 * Emitted on the shared {@link import('../events/EventBus.js').gameEvents} bus when a room cinematic
 * video finishes (reaches its end) or is stopped. Payload carries the video stem `key`.
 */
export const BENNE_VIDEO_ENDED_EVENT = 'benne:video:ended';

export interface BenneVideoEndedPayload {
  /** Basename stem of the video that ended (e.g. `intro-cinematic`). */
  readonly key: string;
}
