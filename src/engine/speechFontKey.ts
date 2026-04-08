/** Phaser loader / Text `fontFamily` cache key for overhead speech (see BootScene `load.font`). */
export const BENNE_SPEECH_FONT_CACHE_KEY = 'benne-speech-font';

export function speechFontLoaderFormat(fontPath: string): string {
  const lower = fontPath.toLowerCase();
  if (lower.endsWith('.woff2')) {
    return 'woff2';
  }
  if (lower.endsWith('.woff')) {
    return 'woff';
  }
  if (lower.endsWith('.otf')) {
    return 'opentype';
  }
  return 'truetype';
}
