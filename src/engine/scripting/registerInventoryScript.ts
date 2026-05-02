import type { InventoryScriptContext } from './types.js';

const benneInventoryScriptRegistrations = new Map<string, {
  itemId: string;
  registerFn: (context: InventoryScriptContext) => void;
}>();
let fallbackModuleKeyCounter = 0;
let warnedMissingModuleKey = false;

function resolveModuleKey(moduleKey: string | undefined, itemId: string): string {
  const trimmed = moduleKey?.trim();
  if (trimmed && trimmed.length > 0) {
    return `${trimmed}::${itemId}`;
  }
  if (import.meta.env.DEV && !warnedMissingModuleKey) {
    warnedMissingModuleKey = true;
    console.warn(
      '[Benne] registerInventoryScript called without moduleKey. Pass import.meta.url as the third argument to keep HMR registrations stable.',
    );
  }
  fallbackModuleKeyCounter += 1;
  return `inventory:legacy:${itemId}:${fallbackModuleKeyCounter}`;
}

export function getBenneInventoryScriptRegistrations(): ReadonlyArray<{
  itemId: string;
  registerFn: (context: InventoryScriptContext) => void;
}> {
  return [...benneInventoryScriptRegistrations.values()];
}

/** Item ids that have a `registerInventoryScript` module (vs JSON-only inventory definitions). */
export function getInventoryItemIdsWithBenneScripts(): ReadonlySet<string> {
  return new Set([...benneInventoryScriptRegistrations.values()].map((r) => r.itemId));
}

/**
 * Call at the top level of each `*.inventory.ts` to register Bennescript handlers for that item.
 * Handlers subscribe to **room-scoped and global** inventory verb ids so
 * {@link import('../verbs/dispatchInventoryVerb.js').dispatchInventoryVerbInteraction} can prefer room listeners first.
 */
export function registerInventoryScript(
  itemId: string,
  registerFn: (context: InventoryScriptContext) => void,
  moduleKey?: string,
): void {
  const resolvedKey = resolveModuleKey(moduleKey, itemId);
  benneInventoryScriptRegistrations.set(resolvedKey, { itemId, registerFn });
}
