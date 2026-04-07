import type * as Phaser from 'phaser';
import type { VerbInputProfileTwoVerb } from '../../types/game';

/** Resolve which verb id the player intended from a pointer event (two-button profile). */
export function resolveVerbIdFromPointer(
  pointer: Phaser.Input.Pointer,
  profile: VerbInputProfileTwoVerb,
): string | null {
  if (pointer.leftButtonDown()) {
    return profile.primaryButtonVerb;
  }
  if (pointer.rightButtonDown()) {
    return profile.secondaryButtonVerb;
  }
  return null;
}
