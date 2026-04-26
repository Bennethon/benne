import type { GuiBenneScript } from './GuiBenneScript.js';
import type { GuiScriptContext } from './types.js';

const benneGuiScriptRegistrations: Array<{
  guiId: string;
  registerFn: (context: GuiScriptContext) => void;
}> = [];

/** Live facade per `guiId` (last wins if multiple modules register the same id). Wired in `registerGameContent`. */
const guiBenneScriptById = new Map<string, GuiBenneScript>();

export function getBenneGuiScriptRegistrations(): ReadonlyArray<{
  guiId: string;
  registerFn: (context: GuiScriptContext) => void;
}> {
  return benneGuiScriptRegistrations;
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
): void {
  benneGuiScriptRegistrations.push({ guiId, registerFn });
}
