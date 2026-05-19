import * as Phaser from 'phaser';

/** Event id for **`B.onDialogSettingsChanged.on(BENNE_DIALOG_SETTINGS_CHANGED_EVENT, …)`**. */
export const BENNE_DIALOG_SETTINGS_CHANGED_EVENT = 'benne:dialogSettingsChanged' as const;

/** Listeners subscribe with **`BENNE_DIALOG_SETTINGS_CHANGED_EVENT`**. Cleared on room shutdown like verb context. */
const emitter = new Phaser.Events.EventEmitter();

export function emitBenneDialogSettingsChanged(): void {
  emitter.emit(BENNE_DIALOG_SETTINGS_CHANGED_EVENT);
}

export function getBenneDialogSettingsChangedEmitter(): Phaser.Events.EventEmitter {
  return emitter;
}
