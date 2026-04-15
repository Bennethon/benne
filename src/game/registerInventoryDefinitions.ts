import type { InventoryItemData } from '../types/inventory.js';
import { registerInventoryDefinition } from '../engine/inventory/inventoryDefinitionRegistry.js';

function rawJsonFromModule(mod: { default?: unknown } | Record<string, unknown>): unknown {
  if (mod && typeof mod === 'object' && 'default' in mod) {
    return (mod as { default?: unknown }).default;
  }
  return mod;
}

function isInventoryItemData(value: unknown): value is InventoryItemData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const o = value as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) {
    return false;
  }
  if (typeof o.name !== 'string') {
    return false;
  }
  if (typeof o.description !== 'string') {
    return false;
  }
  if (typeof o.stackable !== 'boolean') {
    return false;
  }
  const d = o.display;
  if (!d || typeof d !== 'object' || Array.isArray(d)) {
    return false;
  }
  const disp = d as Record<string, unknown>;
  const a = disp.aseprite;
  if (a !== true && a !== 'shared') {
    return false;
  }
  if (disp.tag !== undefined && typeof disp.tag !== 'string') {
    return false;
  }
  return true;
}

// Eager-loads ./inventory/**/*.inventory.json into the engine registry (before GameStateManager / boot).
export function registerInventoryDefinitionsFromGame(): void {
  const modules = import.meta.glob('./inventory/**/*.inventory.json', {
    eager: true,
  }) as Record<string, { default?: unknown } | Record<string, unknown>>;

  for (const [path, mod] of Object.entries(modules)) {
    const raw = rawJsonFromModule(mod);
    if (!isInventoryItemData(raw)) {
      console.error(`[Benne] Invalid inventory JSON shape at ${path}`);
      continue;
    }
    const m = path.match(/\.\/inventory\/([^/]+)\//);
    const folderId = m?.[1];
    if (folderId && folderId !== raw.id) {
      console.warn(
        `[Benne] Inventory folder "${folderId}" does not match JSON id "${raw.id}" (${path}) — definition still registered.`,
      );
    }
    registerInventoryDefinition(raw);
  }
}
