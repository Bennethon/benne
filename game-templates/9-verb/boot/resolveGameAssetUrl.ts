import {
  benneMusicCacheKey,
  benneSfxCacheKey,
  benneVoiceCacheKey,
} from '../../engine/sound/benneAudioCacheKeys.js';
import { benneVideoCacheKey } from '../../engine/video/benneVideoCacheKeys.js';

/**
 * Resolves paths from room JSON (`images/...` under `src/game/assets/`) to Vite-built URLs.
 */
const imageUrls = import.meta.glob('../assets/**/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const jsonUrls = import.meta.glob('../assets/**/*.json', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const xmlUrls = import.meta.glob('../assets/**/*.xml', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const sfxAudioUrls = import.meta.glob('../assets/audio/sfx/**/*.{mp3,ogg,wav,m4a}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const musicAudioUrls = import.meta.glob('../assets/audio/music/**/*.{mp3,ogg,wav,m4a}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const voiceAudioUrls = import.meta.glob('../assets/audio/voice/**/*.{mp3,ogg,wav,m4a}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const videoUrls = import.meta.glob('../assets/videos/**/*.{mp4,webm}', {
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
  const key = `../assets/${normalized}`;
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
  const key = `../assets/${normalized}`;
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
  const key = `../assets/${normalized}`;
  const url = xmlUrls[key];

  if (!url) {
    throw new Error(
      `Missing XML asset '${relativePath}' (expected src/game/assets/${normalized}). Available: ${Object.keys(xmlUrls).sort().join(', ')}`,
    );
  }

  return absolutizeBundledAssetUrl(url);
}

export interface BenneAudioBootEntry {
  readonly cacheKey: string;
  /** Resolved URLs (often one); multiple formats for the same stem → Phaser tries fallbacks. */
  readonly urls: readonly string[];
}

function stemFromAudioGlobKey(globKey: string): string | null {
  const seg = globKey.replace(/^\.?\//, '').split('/');
  const file = seg[seg.length - 1];
  if (!file || !file.includes('.')) {
    return null;
  }
  return file.slice(0, file.lastIndexOf('.'));
}

function groupAudioByStem(urlMap: Record<string, string>): Map<string, string[]> {
  const byStem = new Map<string, Set<string>>();
  for (const [globKey, rawUrl] of Object.entries(urlMap)) {
    const stem = stemFromAudioGlobKey(globKey);
    if (stem == null || stem.length === 0) {
      continue;
    }
    let set = byStem.get(stem);
    if (!set) {
      set = new Set<string>();
      byStem.set(stem, set);
    }
    set.add(absolutizeBundledAssetUrl(rawUrl));
  }
  const out = new Map<string, string[]>();
  for (const [stem, urlSet] of byStem) {
    out.set(stem, [...urlSet].sort());
  }
  return out;
}

/**
 * Entries for {@link import('../../engine/sound/queueBenneAudioBoot.js').queueBenneAudioForBootLoader}.
 * Keys match {@link import('../../engine/sound/benneAudioCacheKeys.js').benneSfxCacheKey} /
 * {@link import('../../engine/sound/benneAudioCacheKeys.js').benneMusicCacheKey} /
 * {@link import('../../engine/sound/benneAudioCacheKeys.js').benneVoiceCacheKey}.
 */
export function getBenneAudioBootEntries(): {
  sfx: BenneAudioBootEntry[];
  music: BenneAudioBootEntry[];
  voice: BenneAudioBootEntry[];
} {
  const sfxGrouped = groupAudioByStem(sfxAudioUrls);
  const musicGrouped = groupAudioByStem(musicAudioUrls);
  const voiceGrouped = groupAudioByStem(voiceAudioUrls);

  const sfx: BenneAudioBootEntry[] = [];
  for (const [stem, urls] of sfxGrouped) {
    sfx.push({ cacheKey: benneSfxCacheKey(stem), urls });
  }
  sfx.sort((a, b) => a.cacheKey.localeCompare(b.cacheKey));

  const music: BenneAudioBootEntry[] = [];
  for (const [stem, urls] of musicGrouped) {
    music.push({ cacheKey: benneMusicCacheKey(stem), urls });
  }
  music.sort((a, b) => a.cacheKey.localeCompare(b.cacheKey));

  const voice: BenneAudioBootEntry[] = [];
  for (const [stem, urls] of voiceGrouped) {
    voice.push({ cacheKey: benneVoiceCacheKey(stem), urls });
  }
  voice.sort((a, b) => a.cacheKey.localeCompare(b.cacheKey));

  return { sfx, music, voice };
}

export interface BenneVideoBootEntry {
  readonly cacheKey: string;
  /** Resolved URLs (often one); multiple formats for the same stem → Phaser tries fallbacks. */
  readonly urls: readonly string[];
}

/**
 * Entries for {@link import('../../engine/video/queueBenneVideoBoot.js').queueBenneVideoForBootLoader}.
 * Keys match {@link import('../../engine/video/benneVideoCacheKeys.js').benneVideoCacheKey}; one entry
 * per basename stem under `src/game/assets/videos/` (e.g. `intro-cinematic.mp4` → key `intro-cinematic`).
 */
export function getBenneVideoBootEntries(): BenneVideoBootEntry[] {
  const grouped = groupAudioByStem(videoUrls);
  const out: BenneVideoBootEntry[] = [];
  for (const [stem, urls] of grouped) {
    out.push({ cacheKey: benneVideoCacheKey(stem), urls });
  }
  out.sort((a, b) => a.cacheKey.localeCompare(b.cacheKey));
  return out;
}
