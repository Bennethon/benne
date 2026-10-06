import type * as Phaser from 'phaser';
import type { VerbInputProfile } from '../../types/game';
import { getGameSettings } from '../ConfigManager';
import {
  DEFAULT_VERB_TOKEN,
  resolveDefaultItemVerbId,
  resolveGameDefaultVerbId,
  WALK_TO_VERB_ID,
} from './verbConfig';

/** Minimal target shape the resolver needs: optional authored `defaultVerb`. */
export interface PointerVerbTarget {
  defaultVerb?: string;
}

/** Options for {@link resolvePointerVerbForTarget}. */
export type ResolvePointerVerbForTargetOptions = {
  /**
   * When an inventory item is armed for use-on-target and the resolved primary slot is the built-in
   * {@link WALK_TO_VERB_ID}, treat the click as the configured **use** verb instead of
   * {@link PointerVerbResolution} `walkToTarget` (avoids walking to the stand point while also
   * running inventory-on-target). Inventory **panel** rows pass `false` — they use
   * {@link resolvePointerVerbForInventoryItem} to map `walkTo` to the row’s `defaultVerb` instead.
   * @default true
   */
  coerceWalkToUseWhenArmed?: boolean;
};

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
 * When **`activeInventoryItemId`** is non-null, a right-click always resolves to
 * `clearActive` — the caller is expected to clear **both** the active inventory selection and the
 * active verb (see `RoomScene` handlers). This keeps the “armed inventory cancels on right-click”
 * rule uniform across props, hotspots, clickable characters, and inventory rows, regardless of
 * whether an active verb was also set.
 *
 * Empty-space clicks (no target) are **not** routed through this function — the scene's empty-space
 * handler walks on left-click and {@link clearActiveVerbOnEmptyRightClick} handles the right-click
 * clear. That keeps the resolver focused on target-click semantics.
 *
 * When **`activeInventoryItemId`** is set, the primary slot **`walkTo`** is coerced to the effective
 * **use** verb (see {@link ResolvePointerVerbForTargetOptions}) so use-on-target matches inventory-row
 * semantics and does not start a stand-point walk in parallel.
 */
export function resolvePointerVerbForTarget(
  pointer: Phaser.Input.Pointer,
  profile: VerbInputProfile,
  target: PointerVerbTarget,
  activeVerbId: string | null,
  activeInventoryItemId: string | null = null,
  options?: ResolvePointerVerbForTargetOptions,
): PointerVerbResolution {
  const left = pointer.leftButtonDown();
  const right = pointer.rightButtonDown();
  if (!left && !right) {
    return { kind: 'none' };
  }

  if (activeInventoryItemId !== null && right) {
    return { kind: 'clearActive' };
  }

  if (activeVerbId !== null) {
    if (left) {
      return { kind: 'verb', verbId: activeVerbId, consumeActive: true };
    }
    return { kind: 'clearActive' };
  }

  const coerceWalkToUseWhenArmed = options?.coerceWalkToUseWhenArmed !== false;
  const slotValue = left ? profile.primaryButtonVerb : profile.secondaryButtonVerb;
  if (
    coerceWalkToUseWhenArmed &&
    activeInventoryItemId !== null &&
    left &&
    slotValue === WALK_TO_VERB_ID
  ) {
    return {
      kind: 'verb',
      verbId: resolveDefaultItemVerbId(getGameSettings()),
      consumeActive: false,
    };
  }

  if (slotValue === WALK_TO_VERB_ID) {
    return { kind: 'walkToTarget' };
  }
  if (slotValue === DEFAULT_VERB_TOKEN) {
    const effective = target.defaultVerb && target.defaultVerb.length > 0
      ? target.defaultVerb
      : resolveGameDefaultVerbId(getGameSettings());
    return { kind: 'verb', verbId: effective, consumeActive: false };
  }
  return { kind: 'verb', verbId: slotValue, consumeActive: false };
}

/**
 * Same rules as {@link resolvePointerVerbForTarget}, but inventory items have no stand point: when
 * the resolved `inputProfile` slot is the built-in `walkTo`, substitute the item's authored
 * `defaultVerb` (fallback: the game-level default verb) instead of returning `walkToTarget`.
 *
 * When **no** inventory item is armed for use-on-target, **`consumeActive`** matches
 * {@link resolvePointerVerbForTarget}: an **active verb** left-click applies to the row and the
 * caller should clear the active verb after dispatch (same as props / hotspots / characters).
 *
 * When **`activeInventoryItemId`** is set, **`consumeActive`** is forced to `false` for `verb`
 * resolutions so the verb bar selection stays for the next world or inventory-row click (inventory
 * use-on-target / combine).
 * World targets use {@link resolvePointerVerbForTarget}; inventory-on-target dispatch does not
 * clear the active verb from this flag (see room / GUI handlers).
 */
export function resolvePointerVerbForInventoryItem(
  pointer: Phaser.Input.Pointer,
  profile: VerbInputProfile,
  target: PointerVerbTarget,
  activeVerbId: string | null,
  activeInventoryItemId: string | null = null,
): PointerVerbResolution {
  const base = resolvePointerVerbForTarget(
    pointer,
    profile,
    target,
    activeVerbId,
    activeInventoryItemId,
    { coerceWalkToUseWhenArmed: false },
  );
  if (base.kind === 'verb' && base.consumeActive && activeInventoryItemId !== null) {
    return { kind: 'verb', verbId: base.verbId, consumeActive: false };
  }
  if (base.kind !== 'walkToTarget') {
    return base;
  }
  const effective =
    target.defaultVerb && target.defaultVerb.length > 0
      ? target.defaultVerb
      : resolveGameDefaultVerbId(getGameSettings());
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
