/** Emitted on `gameEvents` when a clip hits a configured frame marker. */
export const CHARACTER_ANIMATION_EVENT = 'character.animationEvent' as const;

export type CharacterAnimationEventPayload = {
  characterId: string;
  /** Room placement id when set on the sprite (`instanceId` from room JSON). */
  instanceId?: string;
  animationKey: string;
  /** Same `frame` as in JSON (0-based index in the tag). */
  frameIndex: number;
  type: string;
  data?: unknown;
};
