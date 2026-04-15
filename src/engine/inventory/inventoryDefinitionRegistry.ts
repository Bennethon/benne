import type { InventoryItemData } from '../../types/inventory.js';

const definitions = new Map<string, InventoryItemData>();

export function registerInventoryDefinition(data: InventoryItemData): void {
  definitions.set(data.id, data);
}

export function getInventoryDefinition(itemId: string): InventoryItemData | undefined {
  return definitions.get(itemId);
}

export function getRegisteredInventoryDefinitionIds(): string[] {
  return [...definitions.keys()].sort((a, b) => a.localeCompare(b));
}
