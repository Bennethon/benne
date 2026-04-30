import type { Dialog } from '../../types/dialogue.js';
import type { GameStateManager } from '../gameState/GameStateManager.js';

export function dialogOptionEnabledVariableKey(dialogId: string, optionId: string): string {
  return `dialog:${dialogId}:option:${optionId}:enabled`;
}

export function dialogOptionUsedVariableKey(dialogId: string, optionId: string): string {
  return `dialog:${dialogId}:option:${optionId}:used`;
}

export const BENNE_ACTIVE_DIALOG_ID_VARIABLE = '__benne_active_dialog_id';

export function readEffectiveDialogOptionEnabled(
  manager: GameStateManager,
  definition: Dialog,
  optionId: string,
): boolean {
  const opt = definition.options.find((o) => o.id === optionId);
  const base = opt ? opt.enabled !== false : true;
  const key = dialogOptionEnabledVariableKey(definition.id, optionId);
  if (!manager.hasVariable(key)) {
    return base;
  }
  const v = manager.getVariable(key);
  return v === true;
}

export function readEffectiveDialogOptionUsed(
  manager: GameStateManager,
  definition: Dialog,
  optionId: string,
): boolean {
  const opt = definition.options.find((o) => o.id === optionId);
  const base = opt ? opt.used === true : false;
  const key = dialogOptionUsedVariableKey(definition.id, optionId);
  if (!manager.hasVariable(key)) {
    return base;
  }
  const v = manager.getVariable(key);
  return v === true;
}
