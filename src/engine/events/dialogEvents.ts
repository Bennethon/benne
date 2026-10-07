/** Emitted when a dialog session opens (`dialog/dialogSession.ts`). */
export const DIALOG_STARTED_EVENT = 'benne:dialog:started';

/** Emitted when a dialog session closes (`dialog.end()`, a room change, or a new session). */
export const DIALOG_STOPPED_EVENT = 'benne:dialog:stopped';

/** Emitted when an option’s enabled flag is written by a script (`options.x.on()` / `off()`). */
export const DIALOG_OPTION_ENABLED_CHANGED_EVENT = 'benne:dialog:optionEnabledChanged';

export interface DialogStartedPayload {
  dialogId: string;
  guiId: string;
}

export interface DialogStoppedPayload {
  dialogId: string;
}

export interface DialogOptionEnabledChangedPayload {
  dialogId: string;
  optionId: string;
  enabled: boolean;
}

/** Synthetic `button` control id for dialog choice rows (see {@link dialogChoiceSyntheticButtonId}). */
export function dialogChoiceSyntheticButtonId(optionId: string): string {
  const safe = optionId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `dc__${safe}`;
}
