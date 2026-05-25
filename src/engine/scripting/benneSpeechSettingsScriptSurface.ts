import * as Phaser from 'phaser';

/** Event id for **`B.onSpeechSettingsChanged.on(BENNE_SPEECH_SETTINGS_CHANGED_EVENT, …)`**. */
export const BENNE_SPEECH_SETTINGS_CHANGED_EVENT = 'benne:speechSettingsChanged' as const;

/** Listeners subscribe with **`BENNE_SPEECH_SETTINGS_CHANGED_EVENT`**. Cleared on room shutdown like verb context. */
const emitter = new Phaser.Events.EventEmitter();

export function emitBenneSpeechSettingsChanged(): void {
  emitter.emit(BENNE_SPEECH_SETTINGS_CHANGED_EVENT);
}

export function getBenneSpeechSettingsChangedEmitter(): Phaser.Events.EventEmitter {
  return emitter;
}
