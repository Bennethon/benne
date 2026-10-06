import * as Phaser from 'phaser';
import { gameEvents } from '../events/EventBus.js';
import {
  DIALOG_STARTED_EVENT,
  DIALOG_STOPPED_EVENT,
  type DialogStartedPayload,
  type DialogStoppedPayload,
} from '../events/dialogEvents.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { tryGetBenneSoundManager } from '../sound/benneSoundRegistry.js';
import { getDialogDefinition } from './dialogDefinitionRegistry.js';
import { BENNE_ACTIVE_DIALOG_ID_VARIABLE } from './dialogOptionVariables.js';

/**
 * The engine's one open conversation. Opening a session emits {@link DIALOG_STARTED_EVENT} (the room
 * shows the choice GUI, BenneScript attaches the dialog's choice handlers); ending it emits
 * {@link DIALOG_STOPPED_EVENT}. BenneScript's dialog stack (`bennescript/dialogs.ts`) sits on top.
 */
export interface DialogSession {
  readonly dialogId: string;
  /** GUI overlay showing the choices (`guiId` in `*.dialog.json`, default `dialog`). */
  readonly guiId: string;
  readonly game: Phaser.Game;
}

let activeSession: DialogSession | null = null;

export function getActiveDialogSession(): DialogSession | null {
  return activeSession;
}

/** Opens `dialogId`, ending any open conversation first. Unknown ids are ignored with a DEV warning. */
export function openDialogSession(game: Phaser.Game, dialogId: string): void {
  const id = dialogId.trim();
  const def = id ? getDialogDefinition(id) : undefined;
  if (!def) {
    if (import.meta.env.DEV) {
      console.warn(`[Benne] openDialogSession: unknown dialog id "${id}" — ignored.`);
    }
    return;
  }
  if (activeSession) {
    endDialogSessionIfMatches(activeSession);
  }
  const session: DialogSession = { dialogId: id, guiId: def.guiId?.trim() || 'dialog', game };
  activeSession = session;
  resolveGameStateManager(game).setVariable(BENNE_ACTIVE_DIALOG_ID_VARIABLE, id);
  const started: DialogStartedPayload = { dialogId: id, guiId: session.guiId };
  gameEvents.emit(DIALOG_STARTED_EVENT, started);
}

/** Ends `session` if it is still the open one: stops dialog sounds and emits {@link DIALOG_STOPPED_EVENT}. */
export function endDialogSessionIfMatches(session: DialogSession): void {
  if (activeSession !== session) {
    return;
  }
  activeSession = null;
  resolveGameStateManager(session.game).clearVariable(BENNE_ACTIVE_DIALOG_ID_VARIABLE);
  const soundManager = tryGetBenneSoundManager(session.game);
  soundManager?.stopAllSfx();
  soundManager?.stopAllVoice();
  const payload: DialogStoppedPayload = { dialogId: session.dialogId };
  gameEvents.emit(DIALOG_STOPPED_EVENT, payload);
}
