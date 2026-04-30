import * as Phaser from 'phaser';
import { gameEvents } from '../events/EventBus.js';
import {
  DIALOG_STOPPED_EVENT,
  type DialogStoppedPayload,
} from '../events/dialogEvents.js';
import { BENNE_ACTIVE_DIALOG_ID_VARIABLE } from '../dialog/dialogOptionVariables.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';

/** Minimal surface for {@link import('./DialogBenneScript.js').DialogBenneScript} in session bookkeeping (avoids import cycles). */
export interface DialogSessionScript {
  readonly dialogId: string;
  readonly game: Phaser.Game;
  dispose(): void;
  resetInteractionTailForEngine(): void;
}

let activeDialogScript: DialogSessionScript | null = null;

export function getActiveDialogBenneScript(): DialogSessionScript | null {
  return activeDialogScript;
}

export function setActiveDialogBenneScript(script: DialogSessionScript | null): void {
  activeDialogScript = script;
}

export function endDialogSessionIfMatches(script: DialogSessionScript): void {
  if (activeDialogScript !== script) {
    return;
  }
  activeDialogScript = null;
  const dialogId = script.dialogId;
  const manager = resolveGameStateManager(script.game);
  manager.clearVariable(BENNE_ACTIVE_DIALOG_ID_VARIABLE);
  script.dispose();
  script.resetInteractionTailForEngine();
  const payload: DialogStoppedPayload = { dialogId };
  gameEvents.emit(DIALOG_STOPPED_EVENT, payload);
}
