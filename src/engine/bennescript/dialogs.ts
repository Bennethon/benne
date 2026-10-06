import { dialogOptionEnabledVariableKey, readEffectiveDialogOptionEnabled } from '../dialog/dialogOptionVariables.js';
import { getDialogDefinition } from '../dialog/dialogDefinitionRegistry.js';
import { gameEvents } from '../events/EventBus.js';
import {
  DIALOG_OPTION_ENABLED_CHANGED_EVENT,
  DIALOG_STARTED_EVENT,
  DIALOG_STOPPED_EVENT,
  dialogChoiceSyntheticButtonId,
  type DialogOptionEnabledChangedPayload,
  type DialogStartedPayload,
  type DialogStoppedPayload,
} from '../events/dialogEvents.js';
import { guiButtonClickEventId } from '../events/guiButtonEvents.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { endDialogSessionIfMatches, getActiveDialogSession, openDialogSession } from '../dialog/dialogSession.js';
import { PLAYER_SPEAKER, sayTask } from './actions.js';
import {
  currentContext,
  endHandler,
  onCancelAllInteractions,
  runHandler,
  warnIfUntransformed,
} from './interactionContext.js';
import { liveRoomScene } from './scene.js';
import { Task } from './task.js';

/**
 * BenneScript dialogs (§4.8, decision 3).
 *
 * `start()` waits until the conversation ends. Conversations started from a choice handler stack:
 * the parent session is suspended while the sub-dialog runs and comes back, choices and all, when
 * the sub-dialog ends (`dialog.end()`), once the parent's choice handler has finished.
 *
 * The engine has one active session at a time (`dialog/dialogSession.ts`); this module keeps the
 * stack on top of it.
 */

function devWarn(message: string): void {
  if (import.meta.env.DEV) {
    console.warn(`[Benne] ${message}`);
  }
}

// ─── The stack ───────────────────────────────────────────────────────────────

interface StackEntry {
  readonly dialogId: string;
  /** Resolves the `start()` task. */
  readonly finish: () => void;
  /** A sub-dialog replaced this session; its end brings this one back. */
  suspended: boolean;
  /** Choice handlers of this dialog still running. The parent comes back after them. */
  busyChoices: number;
  resumePending: boolean;
}

const stack: StackEntry[] = [];

function findEntry(dialogId: string): StackEntry | undefined {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]!.dialogId === dialogId) {
      return stack[i];
    }
  }
  return undefined;
}

function removeFrom(entry: StackEntry): void {
  const i = stack.indexOf(entry);
  if (i < 0) {
    return;
  }
  for (const removed of stack.splice(i)) {
    removed.finish();
  }
}

function openSession(dialogId: string): boolean {
  const game = tryGetActiveBenneGame();
  if (!game) {
    return false;
  }
  openDialogSession(game, dialogId);
  return getActiveDialogSession()?.dialogId === dialogId;
}

function maybeResume(entry: StackEntry): void {
  if (!stack.includes(entry) || !entry.resumePending || entry.busyChoices > 0) {
    return;
  }
  entry.resumePending = false;
  entry.suspended = false;
  if (!openSession(entry.dialogId)) {
    removeFrom(entry);
  }
}

function onSessionStopped(dialogId: string): void {
  const entry = findEntry(dialogId);
  if (!entry || entry.suspended) {
    return;
  }
  removeFrom(entry);
  const parent = stack[stack.length - 1];
  if (parent?.suspended) {
    parent.resumePending = true;
    // Deferred: a room change ends the session first and cancels the handlers right after, which
    // drops the stack, so the parent must not reopen in the room being left.
    queueMicrotask(() => maybeResume(parent));
  }
}

onCancelAllInteractions(() => {
  for (const entry of stack.splice(0)) {
    entry.finish();
  }
});

/** Opens `dialogId` and resolves when the conversation ends. Used by `dialogs.x.start()`. */
export function startDialog(dialogId: string): Task {
  if (!tryGetActiveBenneGame()) {
    devWarn(`dialogs.${dialogId}.start(): the game is not running — ignored.`);
    return Task.resolved();
  }
  if (findEntry(dialogId)) {
    const message =
      `dialogs.${dialogId}.start(): "${dialogId}" is already open. ` +
      'A sub-dialog returns to its parent by calling dialog.end(); it does not need to start it again.';
    if (import.meta.env.DEV) {
      throw new Error(`[Benne] ${message}`);
    }
    return Task.resolved();
  }
  const top = stack[stack.length - 1];
  const parentOpen = top != null && getActiveDialogSession()?.dialogId === top.dialogId;
  if (parentOpen) {
    top.suspended = true;
  }
  let finish!: () => void;
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const entry: StackEntry = { dialogId, finish, suspended: false, busyChoices: 0, resumePending: false };
  stack.push(entry);
  if (!openSession(dialogId) && stack.includes(entry)) {
    // Unknown dialog id: nothing opened and the parent was never closed.
    removeFrom(entry);
    if (parentOpen) {
      top.suspended = false;
    }
  }
  return new Task(done, { waitsForPlayer: true });
}

/** Ends `dialogId` if it is the open conversation, then ends the handler (`dialog.end()`). */
export function endDialog(dialogId: string): never {
  const active = getActiveDialogSession();
  if (active?.dialogId === dialogId) {
    endDialogSessionIfMatches(active);
  } else {
    devWarn(`dialogs.${dialogId}.end(): that dialog is not open.`);
  }
  return endHandler();
}

/** Dialog ids on the stack, innermost last. For tests and debugging. */
export function dialogStackForTesting(): string[] {
  return stack.map((e) => (e.suspended ? `${e.dialogId} (suspended)` : e.dialogId));
}

// ─── Options ─────────────────────────────────────────────────────────────────

export function setDialogOptionEnabled(dialogId: string, optionId: string, enabled: boolean): void {
  const manager = tryGetActiveGameStateManager();
  if (!manager) {
    devWarn(`dialogs.${dialogId}.options: the game is not running — ignored.`);
    return;
  }
  const def = getDialogDefinition(dialogId);
  if (def && !def.options.some((o) => o.id === optionId)) {
    devWarn(`dialogs.${dialogId}: unknown option "${optionId}".`);
  }
  manager.setVariable(dialogOptionEnabledVariableKey(dialogId, optionId), enabled);
  const payload: DialogOptionEnabledChangedPayload = { dialogId, optionId, enabled };
  gameEvents.emit(DIALOG_OPTION_ENABLED_CHANGED_EVENT, payload);
}

export function isDialogOptionEnabled(dialogId: string, optionId: string): boolean {
  const manager = tryGetActiveGameStateManager();
  const def = getDialogDefinition(dialogId);
  if (!manager || !def) {
    return false;
  }
  return readEffectiveDialogOptionEnabled(manager, def, optionId);
}

// ─── Choice handlers ─────────────────────────────────────────────────────────

type Handler = () => unknown;

interface ChoiceRegistration {
  readonly optionId: string;
  readonly handler: Handler;
  /** `onChooseOnce`: turn the option off when it is chosen. */
  readonly once: boolean;
}

const choices = new Map<string, ChoiceRegistration[]>();
let attached: { dialogId: string; offs: Array<() => void> } | null = null;

export function registerChoiceHandler(dialogId: string, optionId: string, handler: Handler, once: boolean): void {
  warnIfUntransformed(`dialog ${dialogId} option "${optionId}"`, handler);
  const regs = choices.get(dialogId) ?? [];
  regs.push({ optionId, handler, once });
  choices.set(dialogId, regs);
}

/** The option's text, which the player says before the handler runs (unless `say: false`). */
function autoSayLine(dialogId: string, optionId: string): string {
  const opt = getDialogDefinition(dialogId)?.options.find((o) => o.id === optionId);
  if (opt && opt.say === false) {
    return '';
  }
  return (opt?.text ?? '').trim();
}

async function runChoice(dialogId: string, guiId: string, reg: ChoiceRegistration): Promise<void> {
  const scene = liveRoomScene();
  // Hide the choices while the handler plays.
  scene?.hideDialogChoicesWhileChoiceRuns(guiId);
  const entry = findEntry(dialogId);
  if (entry) {
    entry.busyChoices += 1;
  }
  if (reg.once) {
    setDialogOptionEnabled(dialogId, reg.optionId, false);
  }
  const line = autoSayLine(dialogId, reg.optionId);
  try {
    const outcome = await runHandler(`dialog ${dialogId} option "${reg.optionId}"`, scene, null, async () => {
      const ctx = currentContext();
      if (line) {
        await ctx.step(() => sayTask(PLAYER_SPEAKER, line).wait());
      }
      return ctx.step(reg.handler);
    });
    if (outcome === 'unhandled') {
      devWarn(`unhandled() in a dialog choice ("${reg.optionId}") has nothing to fall through to.`);
    }
  } finally {
    if (entry) {
      entry.busyChoices -= 1;
      maybeResume(entry);
    }
    // Shows the choices again, unless the dialog ended or a sub-dialog replaced it.
    liveRoomScene()?.showDialogChoicesAfterChoice(guiId, dialogId);
  }
}

function attach(dialogId: string, guiId: string): void {
  const regs = choices.get(dialogId);
  if (!regs || regs.length === 0) {
    return;
  }
  const offs: Array<() => void> = [];
  for (const reg of regs) {
    const eventId = guiButtonClickEventId(guiId, dialogChoiceSyntheticButtonId(reg.optionId));
    const listener = () => {
      void runChoice(dialogId, guiId, reg);
    };
    gameEvents.on(eventId, listener);
    offs.push(() => gameEvents.off(eventId, listener));
  }
  attached = { dialogId, offs };
}

function detach(): void {
  for (const off of attached?.offs ?? []) {
    off();
  }
  attached = null;
}

const startHandlers = new Map<string, Handler[]>();

/** `dialog.onStart(…)`: runs each time the conversation opens (and when a sub-dialog returns to it). */
export function registerDialogStartHandler(dialogId: string, handler: Handler): void {
  warnIfUntransformed(`dialog ${dialogId} onStart`, handler);
  const list = startHandlers.get(dialogId) ?? [];
  list.push(handler);
  startHandlers.set(dialogId, list);
}

gameEvents.on(DIALOG_STARTED_EVENT, (payload: unknown) => {
  const p = payload as DialogStartedPayload;
  detach();
  attach(p.dialogId, p.guiId);
  for (const handler of startHandlers.get(p.dialogId) ?? []) {
    void runHandler(`dialog ${p.dialogId} onStart`, liveRoomScene(), null, handler, [], { gameplay: false });
  }
});

gameEvents.on(DIALOG_STOPPED_EVENT, (payload: unknown) => {
  const p = payload as DialogStoppedPayload;
  if (attached?.dialogId === p.dialogId) {
    detach();
  }
  onSessionStopped(p.dialogId);
});
