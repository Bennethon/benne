import type { GameSettingsDialog } from '../../types/game.js';
import type { GameStateManager } from '../gameState/GameStateManager.js';
import { getDialogSettingsFromConfig } from '../ConfigManager.js';

/** Persisted user dialog click-to-skip preference; included in save snapshots. */
export const DIALOG_CLICK_TO_SKIP_VARIABLE = 'dialog:clickToSkip';

/** Persisted user dialog show-text preference; included in save snapshots. */
export const DIALOG_SHOW_TEXT_VARIABLE = 'dialog:showText';

/** Persisted `.say` line timing: milliseconds per character. */
export const DIALOG_MS_PER_CHARACTER_VARIABLE = 'dialog:msPerCharacter';

/** Persisted `.say` line timing duration multiplier. */
export const DIALOG_DURATION_MULTIPLIER_VARIABLE = 'dialog:durationMultiplier';

/** Persisted `.say` line minimum duration (ms). */
export const DIALOG_MIN_DURATION_MS_VARIABLE = 'dialog:minDurationMs';

/** Persisted `.say` line maximum duration (ms). */
export const DIALOG_MAX_DURATION_MS_VARIABLE = 'dialog:maxDurationMs';

/** Persisted speaking-text offset `{ x, y }` in canvas pixels. */
export const DIALOG_DEFAULT_TALK_OFFSET_VARIABLE = 'dialog:defaultTalkOffset';

/** Persisted choice-dialog viewport height cap (px); omitted = use config default. */
export const DIALOG_CHOICE_OPTIONS_VIEWPORT_HEIGHT_PX_VARIABLE = 'dialog:choiceOptionsViewportHeightPx';

export const PERSISTED_DIALOG_SETTINGS_VARIABLE_KEYS = [
  DIALOG_CLICK_TO_SKIP_VARIABLE,
  DIALOG_SHOW_TEXT_VARIABLE,
  DIALOG_MS_PER_CHARACTER_VARIABLE,
  DIALOG_DURATION_MULTIPLIER_VARIABLE,
  DIALOG_MIN_DURATION_MS_VARIABLE,
  DIALOG_MAX_DURATION_MS_VARIABLE,
  DIALOG_DEFAULT_TALK_OFFSET_VARIABLE,
  DIALOG_CHOICE_OPTIONS_VIEWPORT_HEIGHT_PX_VARIABLE,
] as const;

export type RuntimeDialogSettings = GameSettingsDialog;

function readBooleanVariable(manager: GameStateManager, key: string, fallback: boolean): boolean {
  if (!manager.hasVariable(key)) {
    return fallback;
  }
  const v = manager.getVariable(key);
  return typeof v === 'boolean' ? v : fallback;
}

function readPositiveNumberVariable(
  manager: GameStateManager,
  key: string,
  fallback: number,
): number {
  if (!manager.hasVariable(key)) {
    return fallback;
  }
  const v = manager.getVariable(key);
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

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

function readTalkOffsetVariable(
  manager: GameStateManager,
  key: string,
  fallback: { x: number; y: number },
): { x: number; y: number } {
  if (!manager.hasVariable(key)) {
    return { ...fallback };
  }
  const v = manager.getVariable(key);
  if (v != null && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as { x?: unknown; y?: unknown };
    if (typeof o.x === 'number' && Number.isFinite(o.x) && typeof o.y === 'number' && Number.isFinite(o.y)) {
      return { x: o.x, y: o.y };
    }
  }
  return { ...fallback };
}

function validateTimingWrites(
  manager: GameStateManager,
  patch: {
    minDurationMs?: number;
    maxDurationMs?: number;
    msPerCharacter?: number;
    durationMultiplier?: number;
  },
): void {
  const config = getDialogSettingsFromConfig();
  const minDurationMs = patch.minDurationMs ?? readPositiveNumberVariable(
    manager,
    DIALOG_MIN_DURATION_MS_VARIABLE,
    config.minDurationMs,
  );
  const maxDurationMs = patch.maxDurationMs ?? readPositiveNumberVariable(
    manager,
    DIALOG_MAX_DURATION_MS_VARIABLE,
    config.maxDurationMs,
  );
  const msPerCharacter = patch.msPerCharacter ?? readPositiveNumberVariable(
    manager,
    DIALOG_MS_PER_CHARACTER_VARIABLE,
    config.msPerCharacter,
  );
  const durationMultiplier = patch.durationMultiplier ?? readPositiveNumberVariable(
    manager,
    DIALOG_DURATION_MULTIPLIER_VARIABLE,
    config.durationMultiplier,
  );
  if (minDurationMs < 0 || maxDurationMs < 0 || msPerCharacter < 0 || durationMultiplier <= 0) {
    throw new Error(
      '[Benne] dialog settings: minDurationMs, maxDurationMs, and msPerCharacter must be >= 0; durationMultiplier must be > 0',
    );
  }
  if (minDurationMs > maxDurationMs) {
    throw new Error('[Benne] dialog settings: minDurationMs must be <= maxDurationMs');
  }
}

/** Effective dialog settings: saved variable overrides when typed correctly, else `game-config.json` defaults. */
export function readEffectiveDialogSettings(manager: GameStateManager): RuntimeDialogSettings {
  const config = getDialogSettingsFromConfig();
  return {
    clickToSkip: readBooleanVariable(manager, DIALOG_CLICK_TO_SKIP_VARIABLE, config.clickToSkip),
    showText: readBooleanVariable(manager, DIALOG_SHOW_TEXT_VARIABLE, config.showText),
    defaultTalkOffset: readTalkOffsetVariable(
      manager,
      DIALOG_DEFAULT_TALK_OFFSET_VARIABLE,
      config.defaultTalkOffset,
    ),
    minDurationMs: readPositiveNumberVariable(
      manager,
      DIALOG_MIN_DURATION_MS_VARIABLE,
      config.minDurationMs,
    ),
    msPerCharacter: readPositiveNumberVariable(
      manager,
      DIALOG_MS_PER_CHARACTER_VARIABLE,
      config.msPerCharacter,
    ),
    maxDurationMs: readPositiveNumberVariable(
      manager,
      DIALOG_MAX_DURATION_MS_VARIABLE,
      config.maxDurationMs,
    ),
    durationMultiplier: readPositiveNumberVariable(
      manager,
      DIALOG_DURATION_MULTIPLIER_VARIABLE,
      config.durationMultiplier,
    ),
    choiceOptionsViewportHeightPx: readOptionalPositiveViewportHeight(
      manager,
      DIALOG_CHOICE_OPTIONS_VIEWPORT_HEIGHT_PX_VARIABLE,
      config.choiceOptionsViewportHeightPx,
    ),
  };
}

export function writePersistedDialogClickToSkip(manager: GameStateManager, value: boolean): void {
  manager.setVariable(DIALOG_CLICK_TO_SKIP_VARIABLE, value);
}

export function writePersistedDialogShowText(manager: GameStateManager, value: boolean): void {
  manager.setVariable(DIALOG_SHOW_TEXT_VARIABLE, value);
}

export function writePersistedDialogMsPerCharacter(manager: GameStateManager, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('[Benne] dialog settings: msPerCharacter must be a finite number >= 0');
  }
  validateTimingWrites(manager, { msPerCharacter: value });
  manager.setVariable(DIALOG_MS_PER_CHARACTER_VARIABLE, value);
}

export function writePersistedDialogDurationMultiplier(manager: GameStateManager, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('[Benne] dialog settings: durationMultiplier must be a finite number > 0');
  }
  validateTimingWrites(manager, { durationMultiplier: value });
  manager.setVariable(DIALOG_DURATION_MULTIPLIER_VARIABLE, value);
}

export function writePersistedDialogMinDurationMs(manager: GameStateManager, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('[Benne] dialog settings: minDurationMs must be a finite number >= 0');
  }
  validateTimingWrites(manager, { minDurationMs: value });
  manager.setVariable(DIALOG_MIN_DURATION_MS_VARIABLE, value);
}

export function writePersistedDialogMaxDurationMs(manager: GameStateManager, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('[Benne] dialog settings: maxDurationMs must be a finite number >= 0');
  }
  validateTimingWrites(manager, { maxDurationMs: value });
  manager.setVariable(DIALOG_MAX_DURATION_MS_VARIABLE, value);
}

export function writePersistedDialogDefaultTalkOffset(
  manager: GameStateManager,
  value: { x: number; y: number },
): void {
  if (
    value == null ||
    typeof value !== 'object' ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y)
  ) {
    throw new Error('[Benne] dialog settings: defaultTalkOffset requires finite x and y');
  }
  manager.setVariable(DIALOG_DEFAULT_TALK_OFFSET_VARIABLE, { x: value.x, y: value.y });
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
