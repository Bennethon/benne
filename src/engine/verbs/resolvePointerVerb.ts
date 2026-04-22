import type * as Phaser from 'phaser';
import type { VerbInputProfile } from '../../types/game';
import { DEFAULT_VERB_FALLBACK, DEFAULT_VERB_TOKEN, WALK_TO_VERB_ID } from './verbConfig';

/** Minimal target shape the resolver needs: optional authored `defaultVerb`. */
export interface PointerVerbTarget {
  defaultVerb?: string;
}

/**
 * Outcome of resolving a pointer click over a clickable target.
 *
 * When combined with an active inventory item, {@link import('./dispatchInventoryOnVerbTarget.js').shouldDispatchInventoryUsedOnVerb}
 * may route the click to inventory-on-target dispatch instead of normal {@link import('./dispatchVerb.js').dispatchVerbInteraction}.
 *
 * - `verb` — dispatch this verb against the target (normal case). When `consumeActive` is true, the
 *   caller should clear the runtime active verb after emit.
 * - `walkToTarget` — the `inputProfile` slot resolved to the built-in `walkTo`; walk to the target's
 *   stand point instead of dispatching a verb.
 * - `clearActive` — right-click while an active verb was set; clear the active verb and skip dispatch.
 * - `none` — no button state we care about (e.g. middle click).
 */
export type PointerVerbResolution =
  | { kind: 'verb'; verbId: string; consumeActive: boolean }
  | { kind: 'walkToTarget' }
  | { kind: 'clearActive' }
  | { kind: 'none' };

/**
 * Resolve a pointer click over a clickable **target**. The built-in `walkTo` verb and the
 * `"defaultVerb"` slot token are handled here; the active verb (when set) takes precedence over
 * either `inputProfile` slot.
 *
 * Empty-space clicks (no target) are **not** routed through this function — the scene's empty-space
 * handler walks on left-click and {@link clearActiveVerbOnEmptyRightClick} handles the right-click
 * clear. That keeps the resolver focused on target-click semantics.
 */
export function resolvePointerVerbForTarget(
  pointer: Phaser.Input.Pointer,
  profile: VerbInputProfile,
  target: PointerVerbTarget,
  activeVerbId: string | null,
): PointerVerbResolution {
  const left = pointer.leftButtonDown();
  const right = pointer.rightButtonDown();
  if (!left && !right) {
    return { kind: 'none' };
  }

  if (activeVerbId !== null) {
    if (left) {
      return { kind: 'verb', verbId: activeVerbId, consumeActive: true };
    }
    return { kind: 'clearActive' };
  }

  const slotValue = left ? profile.primaryButtonVerb : profile.secondaryButtonVerb;
  if (slotValue === WALK_TO_VERB_ID) {
    return { kind: 'walkToTarget' };
  }
  if (slotValue === DEFAULT_VERB_TOKEN) {
    const effective = target.defaultVerb && target.defaultVerb.length > 0
      ? target.defaultVerb
      : DEFAULT_VERB_FALLBACK;
    return { kind: 'verb', verbId: effective, consumeActive: false };
  }
  return { kind: 'verb', verbId: slotValue, consumeActive: false };
}

/**
 * Same rules as {@link resolvePointerVerbForTarget}, but inventory items have no stand point: when
 * the resolved `inputProfile` slot is the built-in `walkTo`, substitute the item's authored
 * `defaultVerb` (fallback {@link DEFAULT_VERB_FALLBACK}) instead of returning `walkToTarget`.
 *
 * **Active verb is never consumed** on inventory-slot clicks (`consumeActive` is forced to `false`
 * for `verb` resolutions). Applying a verb to an inventory row arms use-on-target (active item +
 * often the same verb for the next world click); clearing the active verb here broke that flow.
 * World targets still use {@link resolvePointerVerbForTarget} and may consume the active verb.
 */
export function resolvePointerVerbForInventoryItem(
  pointer: Phaser.Input.Pointer,
  profile: VerbInputProfile,
  target: PointerVerbTarget,
  activeVerbId: string | null,
): PointerVerbResolution {
  const base = resolvePointerVerbForTarget(pointer, profile, target, activeVerbId);
  if (base.kind === 'verb' && base.consumeActive) {
    return { kind: 'verb', verbId: base.verbId, consumeActive: false };
  }
  if (base.kind !== 'walkToTarget') {
    return base;
  }
  const effective =
    target.defaultVerb && target.defaultVerb.length > 0 ? target.defaultVerb : DEFAULT_VERB_FALLBACK;
  return { kind: 'verb', verbId: effective, consumeActive: false };
}

/**
 * Legacy pointer-verb resolver retained for any call site that still wants the pre-refactor
 * behavior (primary → `primaryButtonVerb`, secondary → `secondaryButtonVerb`, no active verb /
 * defaultVerb substitution). New code should prefer {@link resolvePointerVerbForTarget}.
 *
 * @deprecated Use {@link resolvePointerVerbForTarget}.
 */
export function resolveVerbIdFromPointer(
  pointer: Phaser.Input.Pointer,
  profile: VerbInputProfile,
): string | null {
  if (pointer.leftButtonDown()) {
    return profile.primaryButtonVerb;
  }
  if (pointer.rightButtonDown()) {
    return profile.secondaryButtonVerb;
  }
  return null;
}
