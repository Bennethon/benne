/** Phaser loader / cache key for one SFX stem under `assets/audio/sfx/`. */
export function benneSfxCacheKey(stem: string): string {
  return `benne:sfx:${stem}`;
}

/** Phaser loader / cache key for one music stem under `assets/audio/music/`. */
export function benneMusicCacheKey(stem: string): string {
  return `benne:music:${stem}`;
}

/** Phaser loader / cache key for one voice stem under `assets/audio/voice/`. */
export function benneVoiceCacheKey(stem: string): string {
  return `benne:voice:${stem}`;
}
