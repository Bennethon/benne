/**
 * Phaser’s scene {@link Phaser.Animations.AnimationManager} uses one global key table for
 * {@link Phaser.Animations.AnimationManager#createFromAseprite} clips. These helpers map **author-facing**
 * Aseprite tag strings (as in room / GUI / inventory JSON) to **namespaced** Phaser animation keys so
 * different sheets can reuse the same tag name.
 */

/** Phaser clip key for a room prop frame tag after atlas normalization. */
export function roomPropPhaserAnimationKey(roomId: string, authorTag: string): string {
  const t = authorTag.trim();
  const p = `room:${roomId}:`;
  if (t.startsWith(p)) {
    return t;
  }
  return `${p}${t}`;
}

/** Phaser clip key for a GUI sheet frame tag after atlas normalization. */
export function guiPhaserAnimationKey(guiId: string, authorTag: string): string {
  const t = authorTag.trim();
  const p = `gui:${guiId}:`;
  if (t.startsWith(p)) {
    return t;
  }
  return `${p}${t}`;
}

/** Phaser clip key for the bundled cursor sheet after atlas normalization. */
export function cursorPhaserAnimationKey(authorTag: string): string {
  const t = authorTag.trim();
  if (t.startsWith('cursor:')) {
    return t;
  }
  return `cursor:${t}`;
}

/** Phaser clip key for a per-item inventory sheet frame tag after atlas normalization. */
export function perItemInventoryPhaserAnimationKey(itemId: string, authorTag: string): string {
  const t = authorTag.trim();
  const p = `invitem:${itemId}:`;
  if (t.startsWith(p)) {
    return t;
  }
  return `${p}${t}`;
}
