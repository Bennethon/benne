import type { GameSettings, GameVerbDefinition, VerbInputProfile } from '../../types/game';

/**
 * Built-in universal walk verb id. Not authored in `game-config.json` `verbs[]` and never shown
 * as a verb chip in the Inspector. Valid as an `inputProfile` slot value: the pointer resolution
 * walks the player to the target's stand point instead of dispatching a verb.
 */
export const WALK_TO_VERB_ID = 'walkTo';

/**
 * Reserved literal for `inputProfile` slots: substitute with the clicked target's authored
 * `defaultVerb` (prop / hotspot / character / inventory item), falling back to `"look"`.
 */
export const DEFAULT_VERB_TOKEN = 'defaultVerb';

/** Per-clickable default-verb fallback when the target omits `defaultVerb` in its JSON. */
export const DEFAULT_VERB_FALLBACK = 'look';

const DEFAULT_VERBS: GameVerbDefinition[] = [
  { id: 'look', label: 'Look at' },
  { id: 'use', label: 'Use', preposition: 'with' },
];

/** Effective verb list: explicit `settings.verbs` or implicit `look` + `use`. */
export function getEffectiveVerbDefinitions(settings: GameSettings): GameVerbDefinition[] {
  if (settings.verbs && settings.verbs.length > 0) {
    return settings.verbs;
  }
  return DEFAULT_VERBS;
}

/**
 * Two-button input profile. When `inputProfile` is omitted, defaults to
 * left (primary) → `look`, right (secondary) → `use`.
 */
export function getEffectiveInputProfile(settings: GameSettings): VerbInputProfile {
  const ip = settings.inputProfile;
  if (ip) {
    return ip;
  }
  return {
    primaryButtonVerb: 'look',
    secondaryButtonVerb: 'use',
  };
}

/** Verb ids tried for the default **use** verb (aligned with Bennescript `resolveVerbId('use')` candidates). */
const USE_VERB_ALIAS_CANDIDATES: readonly string[] = ['use', 'interact'];

/**
 * First configured verb id matching the **use** aliases, or **`"use"`** if none match (same resolution idea as
 * Bennescript `resolveVerbId('use')`).
 */
export function resolveEffectiveUseVerbId(settings: GameSettings): string {
  const configured = new Set(getEffectiveVerbDefinitions(settings).map((v) => v.id));
  for (const id of USE_VERB_ALIAS_CANDIDATES) {
    if (configured.has(id)) {
      return id;
    }
  }
  return 'use';
}
