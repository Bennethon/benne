import type { CharacterScriptHandle } from '@engine/scripting';

declare module '@engine/scripting' {
  interface BenneKnownCharacters {
    bob: CharacterScriptHandle;
    clerk: CharacterScriptHandle;
    henry: CharacterScriptHandle;
    penny: CharacterScriptHandle;
    sally: CharacterScriptHandle;
  }
}
