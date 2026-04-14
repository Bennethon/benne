import type { CharacterScriptContext } from './types.js';

const benneCharacterScriptRegistrations: Array<{
  characterId: string;
  registerFn: (context: CharacterScriptContext) => void;
}> = [];

export function getBenneCharacterScriptRegistrations(): ReadonlyArray<{
  characterId: string;
  registerFn: (context: CharacterScriptContext) => void;
}> {
  return benneCharacterScriptRegistrations;
}

/**
 * Call at the top level of each `*.character.ts` to register Bennescript handlers for that character definition.
 * Handlers subscribe to **character-global** verb ids only; room-scoped handlers in `*.room.ts` still take precedence
 * (see {@link import('../verbs/dispatchVerb.js').dispatchVerbInteraction}).
 */
export function registerCharacterScript(
  characterId: string,
  registerFn: (context: CharacterScriptContext) => void,
): void {
  benneCharacterScriptRegistrations.push({ characterId, registerFn });
}
