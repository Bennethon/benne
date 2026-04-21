import { CURSOR_HOTSPOT_PRESETS, isValidGameSettingsCursorHotspot } from '../game/cursorAseprite';
import type { GameSettings, GameSettingsDialog } from '../types/game';
import rawSettings from '../game/game-config.json';

const DIALOG_DEFAULTS: GameSettingsDialog = {
  clickToSkip: false,
  showText: true,
  defaultTalkOffset: { x: 0, y: 0 },
  minDurationMs: 800,
  msPerCharacter: 35,
  maxDurationMs: 4500,
  durationMultiplier: 1.0,
};

function mergeDialogSettings(data: GameSettings): GameSettingsDialog {
  const d = data.dialog;
  if (!d) {
    return { ...DIALOG_DEFAULTS };
  }
  const off = d.defaultTalkOffset;
  return {
    clickToSkip: d.clickToSkip ?? DIALOG_DEFAULTS.clickToSkip,
    showText: d.showText ?? DIALOG_DEFAULTS.showText,
    defaultTalkOffset:
      off != null && typeof off === 'object' && Number.isFinite(off.x) && Number.isFinite(off.y)
        ? { x: off.x, y: off.y }
        : { ...DIALOG_DEFAULTS.defaultTalkOffset },
    minDurationMs: d.minDurationMs ?? DIALOG_DEFAULTS.minDurationMs,
    msPerCharacter: d.msPerCharacter ?? DIALOG_DEFAULTS.msPerCharacter,
    maxDurationMs: d.maxDurationMs ?? DIALOG_DEFAULTS.maxDurationMs,
    durationMultiplier: d.durationMultiplier ?? DIALOG_DEFAULTS.durationMultiplier,
  };
}

function assertDialogSettings(data: GameSettings): void {
  const d = data.dialog;
  if (d === undefined) {
    return;
  }
  if (typeof d !== 'object' || d === null) {
    throw new Error('game-config dialog must be an object when present');
  }
  if (d.clickToSkip !== undefined && typeof d.clickToSkip !== 'boolean') {
    throw new Error('game-config dialog.clickToSkip must be a boolean when present');
  }
  if (d.showText !== undefined && typeof d.showText !== 'boolean') {
    throw new Error('game-config dialog.showText must be a boolean when present');
  }
  const off = d.defaultTalkOffset;
  if (off !== undefined) {
    if (typeof off !== 'object' || off === null) {
      throw new Error('game-config dialog.defaultTalkOffset must be an object when present');
    }
    if (!Number.isFinite(off.x) || !Number.isFinite(off.y)) {
      throw new Error('game-config dialog.defaultTalkOffset.x and .y must be finite numbers when present');
    }
  }
  for (const key of ['minDurationMs', 'msPerCharacter', 'maxDurationMs', 'durationMultiplier'] as const) {
    const v = d[key];
    if (v !== undefined && !Number.isFinite(v)) {
      throw new Error(`game-config dialog.${key} must be a finite number when present`);
    }
  }
  const merged = mergeDialogSettings(data);
  if (merged.minDurationMs < 0 || merged.maxDurationMs < 0 || merged.msPerCharacter < 0 || merged.durationMultiplier <= 0) {
    throw new Error(
      'game-config dialog: minDurationMs, maxDurationMs, and msPerCharacter must be >= 0; durationMultiplier must be > 0',
    );
  }
  if (merged.minDurationMs > merged.maxDurationMs) {
    throw new Error('game-config dialog.minDurationMs must be <= maxDurationMs');
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
  const ip = data.inputProfile;
  if (ip !== undefined) {
    if (typeof ip !== 'object' || ip === null) {
      throw new Error('game-config inputProfile must be an object when present');
    }
    if (ip.kind !== 'twoVerb') {
      throw new Error('game-config inputProfile.kind must be "twoVerb" (other profiles are not implemented yet)');
    }
    if (typeof ip.primaryButtonVerb !== 'string' || ip.primaryButtonVerb.length === 0) {
      throw new Error('game-config inputProfile.primaryButtonVerb must be a non-empty string');
    }
    if (typeof ip.secondaryButtonVerb !== 'string' || ip.secondaryButtonVerb.length === 0) {
      throw new Error('game-config inputProfile.secondaryButtonVerb must be a non-empty string');
    }
    if (!effectiveIds.has(ip.primaryButtonVerb)) {
      throw new Error(
        `game-config inputProfile.primaryButtonVerb "${ip.primaryButtonVerb}" must be listed in verbs (or use default look/use when verbs is omitted)`,
      );
    }
    if (!effectiveIds.has(ip.secondaryButtonVerb)) {
      throw new Error(
        `game-config inputProfile.secondaryButtonVerb "${ip.secondaryButtonVerb}" must be listed in verbs (or use default look/use when verbs is omitted)`,
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
  if (data.debug !== undefined) {
    const d = data.debug;
    if (typeof d !== 'object' || d === null) {
      throw new Error('game-config debug must be an object when present');
    }
    for (const key of ['showWalkable', 'showPropOutlines', 'showGuiOutlines'] as const) {
      const v = d[key];
      if (v !== undefined && typeof v !== 'boolean') {
        throw new Error(`game-config debug.${key} must be a boolean when present`);
      }
    }
  }
  assertInitialGameState(data);
  assertVerbSettings(data);
  assertDialogSettings(data);
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

/** Merged `dialog` values from `game-config.json` (defaults apply when the block or fields are omitted). */
export function getDialogSettings(): GameSettingsDialog {
  return mergeDialogSettings(settings);
}

/** How long a `.say()` line should stay on screen from {@link getDialogSettings} timing rules. */
export function computeDialogLineDurationMs(line: string): number {
  const dialog = mergeDialogSettings(settings);
  const n = Array.from(line).length;
  const scaled = n * dialog.msPerCharacter * dialog.durationMultiplier;
  const clamped = Math.min(dialog.maxDurationMs, Math.max(dialog.minDurationMs, scaled));
  return Math.round(clamped);
}
