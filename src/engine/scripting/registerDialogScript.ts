import type { DialogScriptContext } from './types.js';
import type { DialogId } from '../../types/generated/benne-game-ids.js';

const benneDialogScriptRegistrations: Array<{
  dialogId: string;
  registerFn: (context: DialogScriptContext) => void;
}> = [];

export function getBenneDialogScriptRegistrations(): ReadonlyArray<{
  dialogId: string;
  registerFn: (context: DialogScriptContext) => void;
}> {
  return benneDialogScriptRegistrations;
}

/**
 * Call at the top level of each `*.dialog.ts` to register handlers for that dialog id.
 * Callbacks run when {@link import('./DialogBenneScript.js').openDialogSessionForId} opens a session
 * (typically via `B.dialog(dialogId).start()` from room / character / global / GUI / inventory scripts).
 */
export function registerDialogScript(
  dialogId: DialogId,
  registerFn: (context: DialogScriptContext) => void,
): void {
  benneDialogScriptRegistrations.push({ dialogId, registerFn });
}
