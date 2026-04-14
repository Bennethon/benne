import type { GuiScriptContext } from './types.js';

const benneGuiScriptRegistrations: Array<{
  guiId: string;
  registerFn: (context: GuiScriptContext) => void;
}> = [];

export function getBenneGuiScriptRegistrations(): ReadonlyArray<{
  guiId: string;
  registerFn: (context: GuiScriptContext) => void;
}> {
  return benneGuiScriptRegistrations;
}

/** Call at the top level of each `*.gui.ts` to register GUI-scoped Bennescript (or `raw`) handlers. */
export function registerGuiScript(
  guiId: string,
  registerFn: (context: GuiScriptContext) => void,
): void {
  benneGuiScriptRegistrations.push({ guiId, registerFn });
}
