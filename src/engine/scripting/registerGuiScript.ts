import type { GuiBenneScript } from './GuiBenneScript.js';
import type { GuiScriptContext } from './types.js';

const benneGuiScriptRegistrations = new Map<string, {
  guiId: string;
  registerFn: (context: GuiScriptContext) => void;
}>();
let fallbackModuleKeyCounter = 0;
let warnedMissingModuleKey = false;

function resolveModuleKey(moduleKey: string | undefined, guiId: string): string {
  const trimmed = moduleKey?.trim();
  if (trimmed && trimmed.length > 0) {
    return `${trimmed}::${guiId}`;
  }
  if (import.meta.env.DEV && !warnedMissingModuleKey) {
    warnedMissingModuleKey = true;
    console.warn(
      '[Benne] registerGuiScript called without moduleKey. Pass import.meta.url as the third argument to keep HMR registrations stable.',
    );
  }
  fallbackModuleKeyCounter += 1;
  return `gui:legacy:${guiId}:${fallbackModuleKeyCounter}`;
}

/** Live facade per `guiId` (last wins if multiple modules register the same id). Wired in `registerGameContent`. */
const guiBenneScriptById = new Map<string, GuiBenneScript>();

export function getBenneGuiScriptRegistrations(): ReadonlyArray<{
  guiId: string;
  registerFn: (context: GuiScriptContext) => void;
}> {
  return [...benneGuiScriptRegistrations.values()];
}

/** Called when a {@link GuiBenneScript} is constructed for a `registerGuiScript` registration. */
export function registerGuiBenneScriptInstance(guiId: string, script: GuiBenneScript): void {
  guiBenneScriptById.set(guiId, script);
}

export function getGuiBenneScript(guiId: string): GuiBenneScript | undefined {
  return guiBenneScriptById.get(guiId);
}

export function getAllGuiBenneScriptInstances(): ReadonlyMap<string, GuiBenneScript> {
  return guiBenneScriptById;
}

/** Call at the top level of each `*.gui.ts` to register GUI-scoped Bennescript (or `raw`) handlers. */
export function registerGuiScript(
  guiId: string,
  registerFn: (context: GuiScriptContext) => void,
  moduleKey?: string,
): void {
  const resolvedKey = resolveModuleKey(moduleKey, guiId);
  benneGuiScriptRegistrations.set(resolvedKey, { guiId, registerFn });
}
