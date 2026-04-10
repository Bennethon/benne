import type { GuiData } from '../types/gui';

export function usesAsepriteDisplay(data: GuiData): boolean {
  return data.display?.aseprite === true;
}

/** Loader / texture cache key for this GUI definition. */
export function getAsepriteTextureKey(guiId: string): string {
  return `aseprite:gui:${guiId}`;
}

/** PNG + JSON paths under `src/game/assets/` for Aseprite export. */
export function getAsepriteAssetPaths(guiId: string): { png: string; json: string } {
  const base = `images/guis/${guiId}/${guiId}`;
  return { png: `${base}.png`, json: `${base}.json` };
}
