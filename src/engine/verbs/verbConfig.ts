import type { GameSettings, GameVerbDefinition, VerbInputProfile } from '../../types/game';

/**
 * Built-in universal walk verb id. Not authored in `game-config.json` `verbs[]` and never shown
 * as a verb chip in the Inspector. Valid as an `inputProfile` slot value: the pointer resolution
 * walks the player to the target's stand point instead of dispatching a verb.
 */
export const WALK_TO_VERB_ID = 'walkTo';

/**
 * Default copy for the built-in walk pointer mode when no custom verb is armed
 * (HUD status lines authored with **`text`** + **`*.gui.ts`**, cursors, etc.).
 */
export const WALK_TO_VERB_DISPLAY_LABEL = 'Walk to';

function titleCaseVerbId(id: string): string {
  if (id.length === 0) {
    return id;
  }
  return id[0]!.toUpperCase() + id.slice(1);
}

/**
 * Resolves the short label shown on a GUI verb line: {@link WALK_TO_VERB_DISPLAY_LABEL} when no verb
 * is active (or the active id is {@link WALK_TO_VERB_ID}); otherwise the configured `verbs[].label`,
 * or a fallback from id / `preposition`.
 */
export function resolveVerbLineDisplayLabel(settings: GameSettings, activeVerbId: string | null): string {
  const trimmed = activeVerbId?.trim() ?? '';
  if (trimmed.length === 0 || trimmed === WALK_TO_VERB_ID) {
    return WALK_TO_VERB_DISPLAY_LABEL;
  }
  const defs = getEffectiveVerbDefinitions(settings);
  const def = defs.find((v) => v.id === trimmed);
  if (!def) {
    return titleCaseVerbId(trimmed);
  }
  const label = def.label?.trim();
  if (label && label.length > 0) {
    return label;
  }
  const prep = def.preposition?.trim();
  if (prep && prep.length > 0) {
    return `${titleCaseVerbId(def.id)} ${prep}`;
  }
  return titleCaseVerbId(def.id);
}

/**
 * Leading verb word for triplet lines like “Use **broom** with …”: configured `label`, or else
 * title-cased `id` — **not** the `preposition` suffix from {@link resolveVerbLineDisplayLabel}.
 */
export function resolveVerbLineLeadingVerbWord(settings: GameSettings, activeVerbId: string): string {
  const trimmed = activeVerbId.trim();
  if (trimmed.length === 0 || trimmed === WALK_TO_VERB_ID) {
    return WALK_TO_VERB_DISPLAY_LABEL;
  }
  const defs = getEffectiveVerbDefinitions(settings);
  const def = defs.find((v) => v.id === trimmed);
  if (!def) {
    return titleCaseVerbId(trimmed);
  }
  const label = def.label?.trim();
  if (label && label.length > 0) {
    return label;
  }
  return titleCaseVerbId(def.id);
}

/**
 * Full verb-line copy: {@link resolveVerbLineDisplayLabel} when idle (no hover), except that an
 * armed inventory item plus a verb with **`preposition`** keeps **`"<verb word> <item> <preposition>"`**
 * visible over empty space (e.g. “Use broom with”), then appends the hovered target when present
 * (“Use broom with pillar”). Otherwise hover appends **`"<verb label> <description>"`** (LucasArts-style).
 */
export function composeVerbLineText(
  settings: GameSettings,
  activeVerbId: string | null,
  hoveredObjectDescription: string | null,
  activeInventoryItemDisplayName?: string | null,
): string {
  const desc = hoveredObjectDescription?.trim() ?? '';
  const trimmedVerb = activeVerbId?.trim() ?? '';
  const walkMode = trimmedVerb.length === 0 || trimmedVerb === WALK_TO_VERB_ID;
  const inv = activeInventoryItemDisplayName?.trim() ?? '';
  const defs = getEffectiveVerbDefinitions(settings);
  const def = walkMode ? undefined : defs.find((v) => v.id === trimmedVerb);
  const prep = def?.preposition?.trim() ?? '';
  const useInventoryPrepLine = !walkMode && prep.length > 0 && inv.length > 0;

  if (desc.length === 0) {
    if (useInventoryPrepLine) {
      const verbWord = resolveVerbLineLeadingVerbWord(settings, trimmedVerb);
      return `${verbWord} ${inv} ${prep}`;
    }
    return resolveVerbLineDisplayLabel(settings, activeVerbId);
  }

  if (walkMode) {
    return `${WALK_TO_VERB_DISPLAY_LABEL} ${desc}`;
  }
  if (useInventoryPrepLine) {
    const verbWord = resolveVerbLineLeadingVerbWord(settings, trimmedVerb);
    return `${verbWord} ${inv} ${prep} ${desc}`;
  }
  const prefix = resolveVerbLineDisplayLabel(settings, activeVerbId);
  return `${prefix} ${desc}`;
}

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

/** Verb ids tried for the default **give** verb (aligned with Bennescript `resolveVerbId('give')`). */
const GIVE_VERB_ALIAS_CANDIDATES: readonly string[] = ['give'];

/**
 * First configured verb id matching the **give** aliases, or **`"give"`** if none match (same resolution idea as
 * Bennescript `resolveVerbId('give')`).
 */
export function resolveEffectiveGiveVerbId(settings: GameSettings): string {
  const configured = new Set(getEffectiveVerbDefinitions(settings).map((v) => v.id));
  for (const id of GIVE_VERB_ALIAS_CANDIDATES) {
    if (configured.has(id)) {
      return id;
    }
  }
  return 'give';
}
