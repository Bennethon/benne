import type { InventoryItemData } from '../../types/inventory.js';
import type { GameStateManager } from '../gameState/GameStateManager.js';

export function inventoryDefaultAnimationVariableKey(itemId: string): string {
  return `inventory:${itemId}:defaultAnimation`;
}

export function inventoryCursorAnimationVariableKey(itemId: string): string {
  return `inventory:${itemId}:cursorAnimation`;
}

export function inventoryDescriptionVariableKey(itemId: string): string {
  return `inventory:${itemId}:description`;
}

/** Keys written by {@link import('../scenes/RoomScene.js').RoomScene} inventory scripting animation setters. */
export function isPersistedInventoryAnimationVariableKey(key: string): boolean {
  return (
    key.startsWith('inventory:') &&
    (key.endsWith(':defaultAnimation') || key.endsWith(':cursorAnimation'))
  );
}

export function readJsonDefaultAnimationBase(def: InventoryItemData): string {
  const fromJson = def.defaultAnimation?.trim();
  if (fromJson && fromJson.length > 0) {
    return fromJson;
  }
  return def.id;
}

export function readEffectiveInventoryDefaultAnimationTag(
  manager: GameStateManager,
  def: InventoryItemData,
): string {
  const jsonDefault = readJsonDefaultAnimationBase(def);
  const v = manager.getVariable(inventoryDefaultAnimationVariableKey(def.id));
  if (typeof v === 'string' && v.trim().length > 0) {
    return v.trim();
  }
  return jsonDefault;
}

/**
 * Aseprite tag for the armed-item cursor clip, or `null` when the item should fall back to the verb cursor.
 * A saved empty override (variable present, empty string) suppresses JSON `cursorAnimation`.
 */
export function readEffectiveInventoryCursorAnimationTag(
  manager: GameStateManager,
  def: InventoryItemData,
): string | null {
  const jsonTag = def.cursorAnimation?.trim();
  const hasJson = jsonTag != null && jsonTag.length > 0;
  const key = inventoryCursorAnimationVariableKey(def.id);
  if (!manager.hasVariable(key)) {
    return hasJson ? jsonTag! : null;
  }
  const v = manager.getVariable(key);
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return hasJson ? jsonTag! : null;
}

/**
 * Effective `B.inventory(id).description` — saved override (string, including empty) when set,
 * else JSON `InventoryItemData.description`, else `''`.
 */
export function readEffectiveInventoryDescription(
  manager: GameStateManager,
  def: InventoryItemData,
): string {
  const v = manager.getVariable(inventoryDescriptionVariableKey(def.id));
  if (typeof v === 'string') {
    return v;
  }
  return def.description ?? '';
}

/** Persist `B.inventory(id).description = …` for this item id. */
export function writeSavedInventoryDescription(
  manager: GameStateManager,
  itemId: string,
  description: string,
): void {
  manager.setVariable(inventoryDescriptionVariableKey(itemId), description);
}
