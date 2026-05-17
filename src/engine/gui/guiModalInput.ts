/** Tracks a modal GUI overlay registered by {@link RoomScene} for depth-based input blocking. */
export type ModalGuiDepthEntry = {
  depth: number;
  isVisible: () => boolean;
};

/**
 * Depth of the topmost **visible** modal overlay, or `null` when none are visible.
 */
export function getTopVisibleModalDepth(
  entries: readonly ModalGuiDepthEntry[],
): number | null {
  let top: number | null = null;
  for (const e of entries) {
    if (!e.isVisible()) {
      continue;
    }
    if (top === null || e.depth > top) {
      top = e.depth;
    }
  }
  return top;
}

/** True when `depth` is strictly below the top visible modal overlay (blocked from pointer input). */
export function isGuiDepthBehindVisibleModal(
  depth: number,
  entries: readonly ModalGuiDepthEntry[],
): boolean {
  const top = getTopVisibleModalDepth(entries);
  return top !== null && depth < top;
}

/** True when any modal overlay is currently visible (used to suppress verb hover under modals). */
export function hasAnyVisibleModal(entries: readonly ModalGuiDepthEntry[]): boolean {
  return getTopVisibleModalDepth(entries) !== null;
}
