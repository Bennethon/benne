import type { GameSettingsDialog } from '../../types/game.js';
import type { GameStateManager } from '../gameState/GameStateManager.js';
import { getDialogSettingsFromConfig } from '../ConfigManager.js';

/** Persisted choice-dialog viewport height cap (px); omitted = use config default. */
export const DIALOG_CHOICE_OPTIONS_VIEWPORT_HEIGHT_PX_VARIABLE = 'dialog:choiceOptionsViewportHeightPx';

/** Persisted hex color for used dialog option rows; omitted = use config default. */
export const DIALOG_USED_COLOR_VARIABLE = 'dialog:usedColor';

export const PERSISTED_DIALOG_SETTINGS_VARIABLE_KEYS = [
  DIALOG_CHOICE_OPTIONS_VIEWPORT_HEIGHT_PX_VARIABLE,
  DIALOG_USED_COLOR_VARIABLE,
] as const;

export type RuntimeDialogSettings = GameSettingsDialog;

function readOptionalPositiveViewportHeight(
  manager: GameStateManager,
  key: string,
  fallback: number | undefined,
): number | undefined {
  if (!manager.hasVariable(key)) {
    return fallback;
  }
  const v = manager.getVariable(key);
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    return v;
  }
  return fallback;
}

function readOptionalNonEmptyString(
  manager: GameStateManager,
  key: string,
  fallback: string | undefined,
): string | undefined {
  if (!manager.hasVariable(key)) {
    return fallback;
  }
  const v = manager.getVariable(key);
  if (typeof v === 'string' && v.trim().length > 0) {
    return v.trim();
  }
  return fallback;
}

/** Effective dialog settings: saved variable overrides when typed correctly, else `game-config.json` defaults. */
export function readEffectiveDialogSettings(manager: GameStateManager): RuntimeDialogSettings {
  const config = getDialogSettingsFromConfig();
  return {
    choiceOptionsViewportHeightPx: readOptionalPositiveViewportHeight(
      manager,
      DIALOG_CHOICE_OPTIONS_VIEWPORT_HEIGHT_PX_VARIABLE,
      config.choiceOptionsViewportHeightPx,
    ),
    usedColor: readOptionalNonEmptyString(
      manager,
      DIALOG_USED_COLOR_VARIABLE,
      config.usedColor,
    ),
  };
}

export function writePersistedDialogChoiceOptionsViewportHeightPx(
  manager: GameStateManager,
  value: number,
): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('[Benne] dialog settings: choiceOptionsViewportHeightPx must be a finite number > 0');
  }
  manager.setVariable(DIALOG_CHOICE_OPTIONS_VIEWPORT_HEIGHT_PX_VARIABLE, value);
}

export function clearPersistedDialogChoiceOptionsViewportHeightPx(manager: GameStateManager): void {
  manager.clearVariable(DIALOG_CHOICE_OPTIONS_VIEWPORT_HEIGHT_PX_VARIABLE);
}

export function writePersistedDialogUsedColor(manager: GameStateManager, value: string): void {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error('[Benne] dialog settings: usedColor must be a non-empty hex color string');
  }
  manager.setVariable(DIALOG_USED_COLOR_VARIABLE, trimmed);
}

export function clearPersistedDialogUsedColor(manager: GameStateManager): void {
  manager.clearVariable(DIALOG_USED_COLOR_VARIABLE);
}

/**
 * When applying a snapshot, keep prior `dialog:*` variables if the incoming snapshot omits them
 * (new game keeps last values unless `initialGameState.variables` seeds them).
 */
export function mergePreserveDialogSettingsVariables(
  incoming: Record<string, unknown>,
  previous: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...incoming };
  for (const key of PERSISTED_DIALOG_SETTINGS_VARIABLE_KEYS) {
    if (
      !Object.prototype.hasOwnProperty.call(incoming, key) &&
      Object.prototype.hasOwnProperty.call(previous, key)
    ) {
      merged[key] = previous[key];
    }
  }
  return merged;
}
