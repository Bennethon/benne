import type { GameSettings, GameVerbDefinition, VerbInputProfileTwoVerb } from '../../types/game';

const DEFAULT_VERBS: GameVerbDefinition[] = [{ id: 'look' }, { id: 'use' }];

/** Effective verb list: explicit `settings.verbs` or implicit `look` + `use`. */
export function getEffectiveVerbDefinitions(settings: GameSettings): GameVerbDefinition[] {
  if (settings.verbs && settings.verbs.length > 0) {
    return settings.verbs;
  }
  return DEFAULT_VERBS;
}

/**
 * Two-button profile. When `inputProfile` is omitted, defaults to
 * left (primary) → `look`, right (secondary) → `use`.
 */
export function getEffectiveTwoVerbProfile(settings: GameSettings): VerbInputProfileTwoVerb {
  const ip = settings.inputProfile;
  if (ip?.kind === 'twoVerb') {
    return ip;
  }
  return {
    kind: 'twoVerb',
    primaryButtonVerb: 'look',
    secondaryButtonVerb: 'use',
  };
}
