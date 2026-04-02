import { normalizeAsepriteJsonForPhaser } from './normalizeAsepriteJson';

const jsonModules = import.meta.glob('./assets/images/characters/**/*.json', {
  eager: true,
}) as Record<string, { default?: Record<string, unknown> } | Record<string, unknown>>;

function rawJsonFromModule(mod: { default?: Record<string, unknown> } | Record<string, unknown>): Record<string, unknown> {
  if (mod && typeof mod === 'object' && 'default' in mod && mod.default && typeof mod.default === 'object') {
    return mod.default as Record<string, unknown>;
  }
  return mod as Record<string, unknown>;
}

/**
 * Loads bundled Aseprite JSON for `images/characters/<id>/<id>.json`, normalizes frame keys for Phaser, and returns a plain object for `load.aseprite({ atlasURL })`.
 */
export function getNormalizedAsepriteAtlasData(characterId: string): Record<string, unknown> {
  const key = `./assets/images/characters/${characterId}/${characterId}.json`;
  const mod = jsonModules[key];
  if (!mod) {
    throw new Error(
      `Missing Aseprite JSON for character '${characterId}' (expected Vite glob key '${key}'). Keys: ${Object.keys(jsonModules).join(', ')}`,
    );
  }
  return normalizeAsepriteJsonForPhaser(rawJsonFromModule(mod)) as Record<string, unknown>;
}
