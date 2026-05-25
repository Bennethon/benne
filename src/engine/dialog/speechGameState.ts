import type { GameSettingsSpeech } from '../../types/game.js';
import type { GameStateManager } from '../gameState/GameStateManager.js';
import { getSpeechSettingsFromConfig } from '../ConfigManager.js';

/** Persisted user speech click-to-skip preference; included in save snapshots. */
export const SPEECH_CLICK_TO_SKIP_VARIABLE = 'speech:clickToSkip';

/** Persisted user speech show-text preference; included in save snapshots. */
export const SPEECH_SHOW_TEXT_VARIABLE = 'speech:showText';

/** Persisted `.say` line timing: milliseconds per character. */
export const SPEECH_MS_PER_CHARACTER_VARIABLE = 'speech:msPerCharacter';

/** Persisted `.say` line timing duration multiplier. */
export const SPEECH_DURATION_MULTIPLIER_VARIABLE = 'speech:durationMultiplier';

/** Persisted `.say` line minimum duration (ms). */
export const SPEECH_MIN_DURATION_MS_VARIABLE = 'speech:minDurationMs';

/** Persisted `.say` line maximum duration (ms). */
export const SPEECH_MAX_DURATION_MS_VARIABLE = 'speech:maxDurationMs';

/** Persisted speaking-text offset `{ x, y }` in canvas pixels. */
export const SPEECH_DEFAULT_TALK_OFFSET_VARIABLE = 'speech:defaultTalkOffset';

export const PERSISTED_SPEECH_SETTINGS_VARIABLE_KEYS = [
  SPEECH_CLICK_TO_SKIP_VARIABLE,
  SPEECH_SHOW_TEXT_VARIABLE,
  SPEECH_MS_PER_CHARACTER_VARIABLE,
  SPEECH_DURATION_MULTIPLIER_VARIABLE,
  SPEECH_MIN_DURATION_MS_VARIABLE,
  SPEECH_MAX_DURATION_MS_VARIABLE,
  SPEECH_DEFAULT_TALK_OFFSET_VARIABLE,
] as const;

export type RuntimeSpeechSettings = GameSettingsSpeech;

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
  const config = getSpeechSettingsFromConfig();
  const minDurationMs = patch.minDurationMs ?? readPositiveNumberVariable(
    manager,
    SPEECH_MIN_DURATION_MS_VARIABLE,
    config.minDurationMs,
  );
  const maxDurationMs = patch.maxDurationMs ?? readPositiveNumberVariable(
    manager,
    SPEECH_MAX_DURATION_MS_VARIABLE,
    config.maxDurationMs,
  );
  const msPerCharacter = patch.msPerCharacter ?? readPositiveNumberVariable(
    manager,
    SPEECH_MS_PER_CHARACTER_VARIABLE,
    config.msPerCharacter,
  );
  const durationMultiplier = patch.durationMultiplier ?? readPositiveNumberVariable(
    manager,
    SPEECH_DURATION_MULTIPLIER_VARIABLE,
    config.durationMultiplier,
  );
  if (minDurationMs < 0 || maxDurationMs < 0 || msPerCharacter < 0 || durationMultiplier <= 0) {
    throw new Error(
      '[Benne] speech settings: minDurationMs, maxDurationMs, and msPerCharacter must be >= 0; durationMultiplier must be > 0',
    );
  }
  if (minDurationMs > maxDurationMs) {
    throw new Error('[Benne] speech settings: minDurationMs must be <= maxDurationMs');
  }
}

/** Effective speech settings: saved variable overrides when typed correctly, else `game-config.json` defaults. */
export function readEffectiveSpeechSettings(manager: GameStateManager): RuntimeSpeechSettings {
  const config = getSpeechSettingsFromConfig();
  return {
    clickToSkip: readBooleanVariable(manager, SPEECH_CLICK_TO_SKIP_VARIABLE, config.clickToSkip),
    showText: readBooleanVariable(manager, SPEECH_SHOW_TEXT_VARIABLE, config.showText),
    defaultTalkOffset: readTalkOffsetVariable(
      manager,
      SPEECH_DEFAULT_TALK_OFFSET_VARIABLE,
      config.defaultTalkOffset,
    ),
    minDurationMs: readPositiveNumberVariable(
      manager,
      SPEECH_MIN_DURATION_MS_VARIABLE,
      config.minDurationMs,
    ),
    msPerCharacter: readPositiveNumberVariable(
      manager,
      SPEECH_MS_PER_CHARACTER_VARIABLE,
      config.msPerCharacter,
    ),
    maxDurationMs: readPositiveNumberVariable(
      manager,
      SPEECH_MAX_DURATION_MS_VARIABLE,
      config.maxDurationMs,
    ),
    durationMultiplier: readPositiveNumberVariable(
      manager,
      SPEECH_DURATION_MULTIPLIER_VARIABLE,
      config.durationMultiplier,
    ),
  };
}

export function writePersistedSpeechClickToSkip(manager: GameStateManager, value: boolean): void {
  manager.setVariable(SPEECH_CLICK_TO_SKIP_VARIABLE, value);
}

export function writePersistedSpeechShowText(manager: GameStateManager, value: boolean): void {
  manager.setVariable(SPEECH_SHOW_TEXT_VARIABLE, value);
}

export function writePersistedSpeechMsPerCharacter(manager: GameStateManager, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('[Benne] speech settings: msPerCharacter must be a finite number >= 0');
  }
  validateTimingWrites(manager, { msPerCharacter: value });
  manager.setVariable(SPEECH_MS_PER_CHARACTER_VARIABLE, value);
}

export function writePersistedSpeechDurationMultiplier(manager: GameStateManager, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('[Benne] speech settings: durationMultiplier must be a finite number > 0');
  }
  validateTimingWrites(manager, { durationMultiplier: value });
  manager.setVariable(SPEECH_DURATION_MULTIPLIER_VARIABLE, value);
}

export function writePersistedSpeechMinDurationMs(manager: GameStateManager, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('[Benne] speech settings: minDurationMs must be a finite number >= 0');
  }
  validateTimingWrites(manager, { minDurationMs: value });
  manager.setVariable(SPEECH_MIN_DURATION_MS_VARIABLE, value);
}

export function writePersistedSpeechMaxDurationMs(manager: GameStateManager, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('[Benne] speech settings: maxDurationMs must be a finite number >= 0');
  }
  validateTimingWrites(manager, { maxDurationMs: value });
  manager.setVariable(SPEECH_MAX_DURATION_MS_VARIABLE, value);
}

export function writePersistedSpeechDefaultTalkOffset(
  manager: GameStateManager,
  value: { x: number; y: number },
): void {
  if (
    value == null ||
    typeof value !== 'object' ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y)
  ) {
    throw new Error('[Benne] speech settings: defaultTalkOffset requires finite x and y');
  }
  manager.setVariable(SPEECH_DEFAULT_TALK_OFFSET_VARIABLE, { x: value.x, y: value.y });
}

/**
 * When applying a snapshot, keep prior `speech:*` variables if the incoming snapshot omits them
 * (new game keeps last values unless `initialGameState.variables` seeds them).
 */
export function mergePreserveSpeechSettingsVariables(
  incoming: Record<string, unknown>,
  previous: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...incoming };
  for (const key of PERSISTED_SPEECH_SETTINGS_VARIABLE_KEYS) {
    if (
      !Object.prototype.hasOwnProperty.call(incoming, key) &&
      Object.prototype.hasOwnProperty.call(previous, key)
    ) {
      merged[key] = previous[key];
    }
  }
  return merged;
}
