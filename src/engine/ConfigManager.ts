import type { GameSettings } from '../types/game';
import rawSettings from '../game/game-config.json';

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
    for (const key of ['showWalkable', 'showPropOutlines'] as const) {
      const v = d[key];
      if (v !== undefined && typeof v !== 'boolean') {
        throw new Error(`game-config debug.${key} must be a boolean when present`);
      }
    }
  }
  assertVerbSettings(data);
}

const settings = rawSettings as GameSettings;
assertGameSettings(settings);

/**
 * Synchronous access to `src/game/game-config.json` (bundled by Vite at build time).
 */
export function getGameSettings(): GameSettings {
  return settings;
}
