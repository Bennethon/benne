/**
 * Resolves paths from room JSON (`images/...` under `src/game/assets/`) to Vite-built URLs.
 */
const imageUrls = import.meta.glob('./assets/**/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const jsonUrls = import.meta.glob('./assets/**/*.json', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const xmlUrls = import.meta.glob('./assets/**/*.xml', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** When set (BENNE Play webview), rewrites relative Vite `?url` paths to absolute extension media URLs. */
let benneWebviewPlayAssetBase: string | undefined;

/**
 * Called from the BENNE Play webview bootstrap before the game loads. Vite emits `./assets/…`
 * URLs that do not resolve correctly against a `vscode-webview://` document; joining them to
 * this base (from `webview.asWebviewUri(…/media/benne-play/)`) fixes Phaser texture loads.
 */
export function setBenneWebviewPlayAssetBase(base: string): void {
  const b = base.trim();
  benneWebviewPlayAssetBase = b.length === 0 ? undefined : b.endsWith('/') ? b : `${b}/`;
}

function absolutizeBundledAssetUrl(url: string): string {
  if (!benneWebviewPlayAssetBase) {
    return url;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
    return url;
  }
  // Vite commonly emits root-relative `/assets/foo.png` for built files. In a VS Code webview,
  // that root is not the extension media folder, so make emitted asset URLs bundle-relative.
  const bundleRelative = url.replace(/^\/+/, '');
  return new URL(bundleRelative, benneWebviewPlayAssetBase).href;
}

function normalizeAssetPath(relativePath: string): string {
  return relativePath.replace(/^\.?\/+/, '').replaceAll('\\', '/');
}

export function resolveGameAssetUrl(relativePath: string): string {
  const normalized = normalizeAssetPath(relativePath);
  const key = `./assets/${normalized}`;
  const url = imageUrls[key];

  if (!url) {
    throw new Error(
      `Missing game asset '${relativePath}' (expected src/game/assets/${normalized}). Available: ${Object.keys(imageUrls).sort().join(', ')}`,
    );
  }

  return absolutizeBundledAssetUrl(url);
}

/** Aseprite JSON exports and other data JSON under `src/game/assets/`. */
export function resolveGameAssetJsonUrl(relativePath: string): string {
  const normalized = normalizeAssetPath(relativePath);
  const key = `./assets/${normalized}`;
  const url = jsonUrls[key];

  if (!url) {
    throw new Error(
      `Missing JSON asset '${relativePath}' (expected src/game/assets/${normalized}). Available: ${Object.keys(jsonUrls).sort().join(', ')}`,
    );
  }

  return absolutizeBundledAssetUrl(url);
}

/** BMFont XML and other `.xml` under `src/game/assets/` (paths like `fonts/MyFont.xml`). */
export function resolveGameAssetXmlUrl(relativePath: string): string {
  const normalized = normalizeAssetPath(relativePath);
  const key = `./assets/${normalized}`;
  const url = xmlUrls[key];

  if (!url) {
    throw new Error(
      `Missing XML asset '${relativePath}' (expected src/game/assets/${normalized}). Available: ${Object.keys(xmlUrls).sort().join(', ')}`,
    );
  }

  return absolutizeBundledAssetUrl(url);
}
