import { CURSOR_HOTSPOT_PRESETS, isValidGameSettingsCursorHotspot } from '../game/cursorAseprite';
import type { GameSettings, GameSettingsDialog, GameSettingsPerspective, GameSettingsSpeech } from '../types/game';
import { readEffectiveDialogSettings } from './dialog/dialogGameState.js';
import { readEffectiveSpeechSettings } from './dialog/speechGameState.js';
import type { GameStateManager } from './gameState/GameStateManager.js';
import { DEFAULT_VERB_TOKEN, WALK_TO_VERB_ID } from './verbs/verbConfig';
import rawSettings from '../game/game-config.json';

const SPEECH_DEFAULTS: GameSettingsSpeech = {
  clickToSkip: false,
  showText: true,
  defaultTalkOffset: { x: 0, y: 0 },
  minDurationMs: 800,
  msPerCharacter: 35,
  maxDurationMs: 4500,
  durationMultiplier: 1.0,
};

const DIALOG_DEFAULTS: GameSettingsDialog = {};

const PERSPECTIVE_DEFAULTS: GameSettingsPerspective = {
  minWalkScale: 0.3,
  walkScalePower: 0.8,
};

function mergePerspectiveSettings(data: GameSettings): GameSettingsPerspective {
  const p = data.perspective;
  if (!p || typeof p !== 'object') {
    return { ...PERSPECTIVE_DEFAULTS };
  }
  return {
    minWalkScale:
      typeof p.minWalkScale === 'number' && Number.isFinite(p.minWalkScale)
        ? p.minWalkScale
        : PERSPECTIVE_DEFAULTS.minWalkScale,
    walkScalePower:
      typeof p.walkScalePower === 'number' && Number.isFinite(p.walkScalePower)
        ? p.walkScalePower
        : PERSPECTIVE_DEFAULTS.walkScalePower,
  };
}

function assertPerspectiveSettings(data: GameSettings): void {
  const p = data.perspective;
  if (p === undefined) {
    return;
  }
  if (typeof p !== 'object' || p === null || Array.isArray(p)) {
    throw new Error('game-config perspective must be an object when present');
  }
  for (const key of ['minWalkScale', 'walkScalePower'] as const) {
    const v = p[key];
    if (v !== undefined && !Number.isFinite(v)) {
      throw new Error(`game-config perspective.${key} must be a finite number when present`);
    }
  }
  const merged = mergePerspectiveSettings(data);
  if (merged.minWalkScale <= 0) {
    throw new Error('game-config perspective.minWalkScale must be > 0');
  }
}

function mergeSpeechSettings(data: GameSettings): GameSettingsSpeech {
  const s = data.speech;
  if (!s) {
    return { ...SPEECH_DEFAULTS };
  }
  const off = s.defaultTalkOffset;
  return {
    clickToSkip: s.clickToSkip ?? SPEECH_DEFAULTS.clickToSkip,
    showText: s.showText ?? SPEECH_DEFAULTS.showText,
    defaultTalkOffset:
      off != null && typeof off === 'object' && Number.isFinite(off.x) && Number.isFinite(off.y)
        ? { x: off.x, y: off.y }
        : { ...SPEECH_DEFAULTS.defaultTalkOffset },
    minDurationMs: s.minDurationMs ?? SPEECH_DEFAULTS.minDurationMs,
    msPerCharacter: s.msPerCharacter ?? SPEECH_DEFAULTS.msPerCharacter,
    maxDurationMs: s.maxDurationMs ?? SPEECH_DEFAULTS.maxDurationMs,
    durationMultiplier: s.durationMultiplier ?? SPEECH_DEFAULTS.durationMultiplier,
  };
}

function mergeDialogSettings(data: GameSettings): GameSettingsDialog {
  const d = data.dialog;
  if (!d) {
    return { ...DIALOG_DEFAULTS };
  }
  return {
    choiceOptionsViewportHeightPx:
      typeof d.choiceOptionsViewportHeightPx === 'number' &&
      Number.isFinite(d.choiceOptionsViewportHeightPx)
        ? d.choiceOptionsViewportHeightPx
        : undefined,
    usedColor:
      typeof d.usedColor === 'string' && d.usedColor.trim().length > 0
        ? d.usedColor.trim()
        : undefined,
  };
}

function assertSpeechSettings(data: GameSettings): void {
  const s = data.speech;
  if (s === undefined) {
    return;
  }
  if (typeof s !== 'object' || s === null) {
    throw new Error('game-config speech must be an object when present');
  }
  if (s.clickToSkip !== undefined && typeof s.clickToSkip !== 'boolean') {
    throw new Error('game-config speech.clickToSkip must be a boolean when present');
  }
  if (s.showText !== undefined && typeof s.showText !== 'boolean') {
    throw new Error('game-config speech.showText must be a boolean when present');
  }
  const off = s.defaultTalkOffset;
  if (off !== undefined) {
    if (typeof off !== 'object' || off === null) {
      throw new Error('game-config speech.defaultTalkOffset must be an object when present');
    }
    if (!Number.isFinite(off.x) || !Number.isFinite(off.y)) {
      throw new Error('game-config speech.defaultTalkOffset.x and .y must be finite numbers when present');
    }
  }
  for (const key of ['minDurationMs', 'msPerCharacter', 'maxDurationMs', 'durationMultiplier'] as const) {
    const v = s[key];
    if (v !== undefined && !Number.isFinite(v)) {
      throw new Error(`game-config speech.${key} must be a finite number when present`);
    }
  }
  const merged = mergeSpeechSettings(data);
  if (merged.minDurationMs < 0 || merged.maxDurationMs < 0 || merged.msPerCharacter < 0 || merged.durationMultiplier <= 0) {
    throw new Error(
      'game-config speech: minDurationMs, maxDurationMs, and msPerCharacter must be >= 0; durationMultiplier must be > 0',
    );
  }
  if (merged.minDurationMs > merged.maxDurationMs) {
    throw new Error('game-config speech.minDurationMs must be <= maxDurationMs');
  }
}

function assertDialogSettings(data: GameSettings): void {
  const d = data.dialog;
  if (d === undefined) {
    return;
  }
  if (typeof d !== 'object' || d === null) {
    throw new Error('game-config dialog must be an object when present');
  }
  if (d.choiceOptionsViewportHeightPx !== undefined) {
    if (!Number.isFinite(d.choiceOptionsViewportHeightPx)) {
      throw new Error('game-config dialog.choiceOptionsViewportHeightPx must be a finite number when present');
    }
    if (d.choiceOptionsViewportHeightPx <= 0) {
      throw new Error('game-config dialog.choiceOptionsViewportHeightPx must be > 0 when present');
    }
  }
}

function collectEffectiveVerbIds(data: GameSettings): Set<string> {
  const ids = new Set<string>();
  if (data.verbs !== undefined && data.verbs.length > 0) {
    for (const v of data.verbs) {
      ids.add(v.id);
    }
    return ids;
  }
  ids.add('look');
  ids.add('use');
  return ids;
}

function assertVerbSettings(data: GameSettings): void {
  if (data.verbs !== undefined) {
    if (!Array.isArray(data.verbs)) {
      throw new Error('game-config verbs must be an array when present');
    }
    const seen = new Set<string>();
    for (const v of data.verbs) {
      if (typeof v !== 'object' || v === null) {
        throw new Error('game-config each verbs entry must be an object');
      }
      if (typeof v.id !== 'string' || v.id.length === 0) {
        throw new Error('game-config each verbs[].id must be a non-empty string');
      }
      if (v.id === WALK_TO_VERB_ID) {
        throw new Error(
          `game-config verbs[] may not declare "${WALK_TO_VERB_ID}" — it is a reserved built-in verb id`,
        );
      }
      if (v.id === DEFAULT_VERB_TOKEN) {
        throw new Error(
          `game-config verbs[] may not declare "${DEFAULT_VERB_TOKEN}" — it is a reserved inputProfile token`,
        );
      }
      if (seen.has(v.id)) {
        throw new Error(`game-config duplicate verb id: ${v.id}`);
      }
      seen.add(v.id);
      if (v.label !== undefined && typeof v.label !== 'string') {
        throw new Error(`game-config verbs["${v.id}"].label must be a string when present`);
      }
      if (v.preposition !== undefined && typeof v.preposition !== 'string') {
        throw new Error(`game-config verbs["${v.id}"].preposition must be a string when present`);
      }
    }
  }

  const effectiveIds = collectEffectiveVerbIds(data);
  const isValidSlotValue = (value: string): boolean =>
    value === WALK_TO_VERB_ID || value === DEFAULT_VERB_TOKEN || effectiveIds.has(value);

  const ip = data.inputProfile;
  if (ip !== undefined) {
    if (typeof ip !== 'object' || ip === null) {
      throw new Error('game-config inputProfile must be an object when present');
    }
    if ('kind' in ip) {
      throw new Error(
        'game-config inputProfile.kind is no longer supported — remove the field (the profile is flat `primaryButtonVerb` / `secondaryButtonVerb`)',
      );
    }
    if (typeof ip.primaryButtonVerb !== 'string' || ip.primaryButtonVerb.length === 0) {
      throw new Error('game-config inputProfile.primaryButtonVerb must be a non-empty string');
    }
    if (typeof ip.secondaryButtonVerb !== 'string' || ip.secondaryButtonVerb.length === 0) {
      throw new Error('game-config inputProfile.secondaryButtonVerb must be a non-empty string');
    }
    if (!isValidSlotValue(ip.primaryButtonVerb)) {
      throw new Error(
        `game-config inputProfile.primaryButtonVerb "${ip.primaryButtonVerb}" must be listed in verbs, or one of "${WALK_TO_VERB_ID}" / "${DEFAULT_VERB_TOKEN}"`,
      );
    }
    if (!isValidSlotValue(ip.secondaryButtonVerb)) {
      throw new Error(
        `game-config inputProfile.secondaryButtonVerb "${ip.secondaryButtonVerb}" must be listed in verbs, or one of "${WALK_TO_VERB_ID}" / "${DEFAULT_VERB_TOKEN}"`,
      );
    }
  }

  if (data.defaultFallbackLine !== undefined && typeof data.defaultFallbackLine !== 'string') {
    throw new Error('game-config defaultFallbackLine must be a string when present');
  }
}

function assertInitialGameState(data: GameSettings): void {
  const init = data.initialGameState;
  if (init === undefined) {
    return;
  }
  if (typeof init !== 'object' || init === null || Array.isArray(init)) {
    throw new Error('game-config initialGameState must be an object when present');
  }
  if (init.flags !== undefined) {
    if (typeof init.flags !== 'object' || init.flags === null || Array.isArray(init.flags)) {
      throw new Error('game-config initialGameState.flags must be a plain object when present');
    }
    for (const [k, v] of Object.entries(init.flags)) {
      if (k.length === 0) {
        throw new Error('game-config initialGameState.flags keys must be non-empty strings');
      }
      const ok = typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string';
      if (!ok) {
        throw new Error(
          `game-config initialGameState.flags["${k}"] must be a boolean, number, or string when present`,
        );
      }
    }
  }
  if (init.variables !== undefined) {
    if (typeof init.variables !== 'object' || init.variables === null || Array.isArray(init.variables)) {
      throw new Error('game-config initialGameState.variables must be a plain object when present');
    }
  }
  if (init.inventory !== undefined) {
    if (Array.isArray(init.inventory)) {
      const seen = new Set<string>();
      for (const item of init.inventory) {
        if (typeof item !== 'string' || item.length === 0) {
          throw new Error('game-config initialGameState.inventory entries must be non-empty strings');
        }
        if (seen.has(item)) {
          console.warn(
            `[Benne] game-config initialGameState.inventory: duplicate "${item}" — quantities merge at runtime`,
          );
        }
        seen.add(item);
      }
    } else if (typeof init.inventory === 'object' && init.inventory !== null && !Array.isArray(init.inventory)) {
      for (const [k, v] of Object.entries(init.inventory as Record<string, unknown>)) {
        if (k.length === 0) {
          throw new Error('game-config initialGameState.inventory keys must be non-empty strings');
        }
        const n = typeof v === 'number' ? v : Number(v);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error(
            `game-config initialGameState.inventory["${k}"] must be a non-negative finite number when present`,
          );
        }
      }
    } else {
      throw new Error(
        'game-config initialGameState.inventory must be a string[] id list or Record<string, number> when present',
      );
    }
  }
}

function assertGameSettings(data: GameSettings): void {
  const { width, height } = data.resolution;
  if (!Number.isFinite(width) || width < 1 || !Number.isFinite(height) || height < 1) {
    throw new Error(`Invalid game-config resolution: ${width} x ${height}`);
  }
  const { masterVolume, sfxVolume, musicVolume, dialogueVolume } = data.audio;
  for (const [key, v] of Object.entries({
    masterVolume,
    sfxVolume,
    musicVolume,
    dialogueVolume,
  })) {
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      throw new Error(`Invalid game-config audio.${key}: ${v} (expected 0.0–1.0)`);
    }
  }
  if (typeof data.startingPlayerCharacter !== 'string' || data.startingPlayerCharacter.length === 0) {
    throw new Error('game-config startingPlayerCharacter must be a non-empty string');
  }
  if (data.dropWhenInventoryUsed !== undefined && typeof data.dropWhenInventoryUsed !== 'boolean') {
    throw new Error('game-config dropWhenInventoryUsed must be a boolean when present');
  }
  if (data.debug !== undefined) {
    const d = data.debug;
    if (typeof d !== 'object' || d === null) {
      throw new Error('game-config debug must be an object when present');
    }
    for (const key of ['showWalkable', 'showPropOutlines', 'showGuiOutlines', 'showRegionOutlines'] as const) {
      const v = d[key];
      if (v !== undefined && typeof v !== 'boolean') {
        throw new Error(`game-config debug.${key} must be a boolean when present`);
      }
    }
  }
  assertInitialGameState(data);
  assertVerbSettings(data);
  assertSpeechSettings(data);
  assertDialogSettings(data);
  assertPerspectiveSettings(data);
  assertCursorSettings(data);
}

function assertCursorSettings(data: GameSettings): void {
  const c = data.cursor;
  if (c === undefined) {
    return;
  }
  if (typeof c !== 'object' || c === null || Array.isArray(c)) {
    throw new Error('game-config cursor must be an object when present');
  }
  if (typeof c.idleAnimation !== 'string' || c.idleAnimation.trim().length === 0) {
    throw new Error('game-config cursor.idleAnimation must be a non-empty string when cursor is set');
  }
  if (typeof c.activeAnimation !== 'string' || c.activeAnimation.trim().length === 0) {
    throw new Error('game-config cursor.activeAnimation must be a non-empty string when cursor is set');
  }
  const anims = c.animations;
  if (anims !== undefined) {
    if (typeof anims !== 'object' || anims === null || Array.isArray(anims)) {
      throw new Error('game-config cursor.animations must be a plain object when present');
    }
    for (const [tag, clip] of Object.entries(anims)) {
      if (typeof tag !== 'string' || tag.length === 0) {
        throw new Error('game-config cursor.animations keys must be non-empty strings');
      }
      if (typeof clip !== 'object' || clip === null || Array.isArray(clip)) {
        throw new Error(`game-config cursor.animations["${tag}"] must be an object when present`);
      }
      const rec = clip as Record<string, unknown>;
      if (rec.loop !== undefined && typeof rec.loop !== 'boolean') {
        throw new Error(`game-config cursor.animations["${tag}"].loop must be a boolean when present`);
      }
      if (rec.frameDuration !== undefined && !Number.isFinite(rec.frameDuration)) {
        throw new Error(`game-config cursor.animations["${tag}"].frameDuration must be a finite number when present`);
      }
    }
  }
  const hs = c.hotspot;
  if (hs !== undefined) {
    if (typeof hs !== 'string' || !isValidGameSettingsCursorHotspot(hs)) {
      throw new Error(
        `game-config cursor.hotspot must be one of: ${CURSOR_HOTSPOT_PRESETS.join(', ')}`,
      );
    }
    if (hs === 'custom') {
      const p = c.hotspotPixel;
      if (p === undefined || typeof p !== 'object' || p === null || Array.isArray(p)) {
        throw new Error('game-config cursor.hotspotPixel { x, y } is required when cursor.hotspot is "custom"');
      }
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        throw new Error('game-config cursor.hotspotPixel.x and .y must be finite numbers when hotspot is "custom"');
      }
    }
  } else if (c.hotspotPixel !== undefined) {
    console.warn('[Benne] game-config cursor.hotspotPixel is ignored unless cursor.hotspot is "custom"');
  }
  const disp = c.display;
  if (disp !== undefined) {
    if (typeof disp !== 'object' || disp === null || Array.isArray(disp)) {
      throw new Error('game-config cursor.display must be an object when present');
    }
    if (disp.aseprite !== undefined && typeof disp.aseprite !== 'boolean') {
      throw new Error('game-config cursor.display.aseprite must be a boolean when present');
    }
  }
}

const settings = rawSettings as GameSettings;
assertGameSettings(settings);

/**
 * Synchronous access to `src/game/game-config.json` (bundled by Vite at build time).
 */
export function getGameSettings(): GameSettings {
  return settings;
}

/** Merged `speech` values from `game-config.json` only (no runtime variable overrides). */
export function getSpeechSettingsFromConfig(): GameSettingsSpeech {
  return mergeSpeechSettings(settings);
}

/**
 * Merged `speech` values: when `manager` is set, overlays runtime `speech:*` variables
 * (see `B.speechSettings`); otherwise returns config defaults only.
 */
export function getSpeechSettings(manager?: GameStateManager | null): GameSettingsSpeech {
  if (manager) {
    return readEffectiveSpeechSettings(manager);
  }
  return mergeSpeechSettings(settings);
}

/** Merged `dialog` values from `game-config.json` only (no runtime variable overrides). */
export function getDialogSettingsFromConfig(): GameSettingsDialog {
  return mergeDialogSettings(settings);
}

/**
 * Merged `dialog` values: when `manager` is set, overlays runtime `dialog:*` variables
 * (see `B.dialogSettings`); otherwise returns config defaults only.
 */
export function getDialogSettings(manager?: GameStateManager | null): GameSettingsDialog {
  if (manager) {
    return readEffectiveDialogSettings(manager);
  }
  return mergeDialogSettings(settings);
}

/** Merged `perspective` values for room-region walk-speed scaling (defaults when block or fields are omitted). */
export function getPerspectiveSettings(): GameSettingsPerspective {
  return mergePerspectiveSettings(settings);
}

/** How long a `.say()` line should stay on screen from {@link getSpeechSettings} timing rules. */
export function computeSpeechLineDurationMs(
  line: string,
  manager?: GameStateManager | null,
): number {
  const speech = getSpeechSettings(manager);
  const n = Array.from(line).length;
  const scaled = n * speech.msPerCharacter * speech.durationMultiplier;
  const clamped = Math.min(speech.maxDurationMs, Math.max(speech.minDurationMs, scaled));
  return Math.round(clamped);
}
