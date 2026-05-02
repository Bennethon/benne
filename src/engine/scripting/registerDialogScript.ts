import type { DialogScriptContext } from './types.js';

const benneDialogScriptRegistrations = new Map<string, {
  dialogId: string;
  registerFn: (context: DialogScriptContext) => void;
}>();
let fallbackModuleKeyCounter = 0;
let warnedMissingModuleKey = false;

function resolveModuleKey(moduleKey: string | undefined, dialogId: string): string {
  const trimmed = moduleKey?.trim();
  if (trimmed && trimmed.length > 0) {
    return `${trimmed}::${dialogId}`;
  }
  if (import.meta.env.DEV && !warnedMissingModuleKey) {
    warnedMissingModuleKey = true;
    console.warn(
      '[Benne] registerDialogScript called without moduleKey. Pass import.meta.url as the third argument to keep HMR registrations stable.',
    );
  }
  fallbackModuleKeyCounter += 1;
  return `dialog:legacy:${dialogId}:${fallbackModuleKeyCounter}`;
}

export function getBenneDialogScriptRegistrations(): ReadonlyArray<{
  dialogId: string;
  registerFn: (context: DialogScriptContext) => void;
}> {
  return [...benneDialogScriptRegistrations.values()];
}

/**
 * Call at the top level of each `*.dialog.ts` to register handlers for that dialog id.
 * Callbacks run when {@link import('./DialogBenneScript.js').openDialogSessionForId} opens a session
 * (typically via `B.dialog(dialogId).start()` from room / character / global / GUI / inventory scripts).
 */
export function registerDialogScript(
  dialogId: string,
  registerFn: (context: DialogScriptContext) => void,
  moduleKey?: string,
): void {
  const resolvedKey = resolveModuleKey(moduleKey, dialogId);
  benneDialogScriptRegistrations.set(resolvedKey, { dialogId, registerFn });
}
