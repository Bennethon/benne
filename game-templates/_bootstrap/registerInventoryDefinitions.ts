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
  if (o.dropWhenUsed !== undefined && typeof o.dropWhenUsed !== 'boolean') {
    return false;
  }
  if (o.defaultAnimation !== undefined && typeof o.defaultAnimation !== 'string') {
    return false;
  }
  if (o.cursorAnimation !== undefined && typeof o.cursorAnimation !== 'string') {
    return false;
  }
  if (o.onVerb !== undefined) {
    if (!o.onVerb || typeof o.onVerb !== 'object' || Array.isArray(o.onVerb)) {
      return false;
    }
    for (const v of Object.values(o.onVerb as Record<string, unknown>)) {
      if (v !== true) {
        return false;
      }
    }
  }
  if (o.animations !== undefined) {
    if (!o.animations || typeof o.animations !== 'object' || Array.isArray(o.animations)) {
      return false;
    }
    for (const clip of Object.values(o.animations as Record<string, unknown>)) {
      if (!clip || typeof clip !== 'object' || Array.isArray(clip)) {
        return false;
      }
      const c = clip as Record<string, unknown>;
      if (c.loop !== undefined && typeof c.loop !== 'boolean') {
        return false;
      }
      if (c.frameDuration !== undefined && typeof c.frameDuration !== 'number') {
        return false;
      }
    }
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
  return true;
}

/** Migrate legacy `display.tag` into `defaultAnimation` and drop `display.tag` from the registered object. */
function normalizeLegacyInventoryDisplayTag(data: InventoryItemData): void {
  const root = data as unknown as Record<string, unknown>;
  const display = root.display;
  if (!display || typeof display !== 'object' || Array.isArray(display)) {
    return;
  }
  const disp = display as Record<string, unknown>;
  const legacy = disp.tag;
  if (typeof legacy !== 'string') {
    return;
  }
  const trimmed = legacy.trim();
  if (trimmed.length === 0) {
    delete disp.tag;
    return;
  }
  const current = root.defaultAnimation;
  const currentEmpty =
    current === undefined || (typeof current === 'string' && current.trim().length === 0);
  if (currentEmpty) {
    root.defaultAnimation = trimmed;
  }
  delete disp.tag;
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
    normalizeLegacyInventoryDisplayTag(raw);
    registerInventoryDefinition(raw);
  }
}
