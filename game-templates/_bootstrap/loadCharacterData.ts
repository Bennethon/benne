import type { CharacterData } from '../types/character';
import { usesAsepriteDisplay } from './characterAseprite';

const characterJsonModules = import.meta.glob('./characters/**/*.character.json', {
  eager: true,
}) as Record<string, { default: CharacterData }>;

function assertValidCharacterDisplay(data: CharacterData): void {
  if (usesAsepriteDisplay(data)) {
    return;
  }
  const img = data.display.defaultImage;
  if (!img || img.length === 0) {
    throw new Error(`Character '${data.id}': set display.aseprite true or display.defaultImage`);
  }
}

export function loadCharacterData(definitionRelativePath: string): CharacterData {
  const normalized = definitionRelativePath.replace(/^\.?\/+/, '').replaceAll('\\', '/');
  const key = `./characters/${normalized}`;
  const mod = characterJsonModules[key];

  if (!mod) {
    throw new Error(
      `Character JSON not found '${definitionRelativePath}' (expected key '${key}'). Keys: ${Object.keys(characterJsonModules).join(', ')}`,
    );
  }

  const data = mod.default;
  assertValidCharacterDisplay(data);
  return data;
}
