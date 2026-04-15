import type { InventoryItemData } from '../types/inventory.js';

/** Phaser texture key for the shared `images/inventory/inventory.{png,json}` sheet. */
export const sharedInventoryTextureKey = 'aseprite:inventory:shared';

export function usesSharedInventoryAseprite(data: InventoryItemData): boolean {
  return data.display.aseprite === 'shared';
}

export function usesPerItemInventoryAseprite(data: InventoryItemData): boolean {
  return data.display.aseprite === true;
}

export function getPerItemInventoryTextureKey(itemId: string): string {
  return `aseprite:inventory:${itemId}`;
}

/** PNG + JSON paths under `src/game/assets/` for per-item Aseprite export. */
export function getPerItemInventoryAsepritePaths(itemId: string): { png: string; json: string } {
  const base = `images/inventory/${itemId}/${itemId}`;
  return { png: `${base}.png`, json: `${base}.json` };
}

export function sharedInventoryAssetPaths(): { png: string; json: string } {
  return { png: 'images/inventory/inventory.png', json: 'images/inventory/inventory.json' };
}

/**
 * Phaser animation key for a frame tag on the item's sheet (`inventory:<tag>` when using the shared atlas).
 */
export function inventoryPhaserAnimationKeyForTag(data: InventoryItemData, tagName: string): string {
  if (usesSharedInventoryAseprite(data)) {
    return `inventory:${tagName}`;
  }
  return tagName;
}

/** Default clip for UI/cursor: `defaultAnimation`, else `id`. */
export function defaultInventoryAnimationKey(data: InventoryItemData): string {
  const base = data.defaultAnimation ?? data.id;
  return inventoryPhaserAnimationKeyForTag(data, base);
}
