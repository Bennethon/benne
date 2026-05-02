import type { CharacterScriptContext } from './types.js';

const benneCharacterScriptRegistrations = new Map<string, {
  characterId: string;
  registerFn: (context: CharacterScriptContext) => void;
}>();
let fallbackModuleKeyCounter = 0;
let warnedMissingModuleKey = false;

function resolveModuleKey(moduleKey: string | undefined, characterId: string): string {
  const trimmed = moduleKey?.trim();
  if (trimmed && trimmed.length > 0) {
    return `${trimmed}::${characterId}`;
  }
  if (import.meta.env.DEV && !warnedMissingModuleKey) {
    warnedMissingModuleKey = true;
    console.warn(
      '[Benne] registerCharacterScript called without moduleKey. Pass import.meta.url as the third argument to keep HMR registrations stable.',
    );
  }
  fallbackModuleKeyCounter += 1;
  return `character:legacy:${characterId}:${fallbackModuleKeyCounter}`;
}

export function getBenneCharacterScriptRegistrations(): ReadonlyArray<{
  characterId: string;
  registerFn: (context: CharacterScriptContext) => void;
}> {
  return [...benneCharacterScriptRegistrations.values()];
}

/**
 * Call at the top level of each `*.character.ts` to register Bennescript handlers for that character definition.
 * Handlers subscribe to **character-global** verb ids only; room-scoped handlers in `*.room.ts` still take precedence
 * (see {@link import('../verbs/dispatchVerb.js').dispatchVerbInteraction}).
 */
export function registerCharacterScript(
  characterId: string,
  registerFn: (context: CharacterScriptContext) => void,
  moduleKey?: string,
): void {
  const resolvedKey = resolveModuleKey(moduleKey, characterId);
  benneCharacterScriptRegistrations.set(resolvedKey, { characterId, registerFn });
}
