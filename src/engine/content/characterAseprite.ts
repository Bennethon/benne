import type { CharacterData } from '../../types/character';

export function usesAsepriteDisplay(data: CharacterData): boolean {
  return data.display.aseprite === true;
}

/** Loader / texture cache key shared by all instances of this character definition. */
export function getAsepriteTextureKey(characterId: string): string {
  return `aseprite:${characterId}`;
}

/** PNG + JSON paths under `src/game/assets/` for Aseprite export. */
export function getAsepriteAssetPaths(characterId: string): { png: string; json: string } {
  const base = `images/characters/${characterId}/${characterId}`;
  return { png: `${base}.png`, json: `${base}.json` };
}
