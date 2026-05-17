import type { GuiData } from '../../types/gui';

/** Compares two GUI definitions for overlay stack order (`zIndex`, then `id`). */
export function compareGuiOverlayStackOrder(a: GuiData, b: GuiData): number {
  const dz = (a.zIndex ?? 0) - (b.zIndex ?? 0);
  return dz !== 0 ? dz : a.id.localeCompare(b.id);
}

/** Returns a new array of GUIs sorted for {@link RoomScene} overlay depth assignment. */
export function sortGuisForOverlayStack(guis: readonly GuiData[]): GuiData[] {
  return [...guis].sort(compareGuiOverlayStackOrder);
}
