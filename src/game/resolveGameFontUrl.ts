/**
 * Resolves font paths under `src/game/assets/` to Vite-built URLs (separate from image glob).
 */
const fontUrls = import.meta.glob('./assets/**/*.{ttf,otf,woff,woff2}', {
  eager: true,
  as: 'url',
}) as Record<string, string>;

function normalizeAssetPath(relativePath: string): string {
  return relativePath.replace(/^\.?\/+/, '').replaceAll('\\', '/');
}

export function resolveGameFontUrl(relativePath: string): string {
  const normalized = normalizeAssetPath(relativePath);
  const key = `./assets/${normalized}`;
  const url = fontUrls[key];

  if (!url) {
    throw new Error(
      `Missing font asset '${relativePath}' (expected src/game/assets/${normalized}). Available: ${Object.keys(fontUrls).sort().join(', ')}`,
    );
  }

  return url;
}
