/**
 * Phaser's AnimationManager#createFromAseprite expects `frames` keys to be "0", "1", "2", …
 * matching tag `from` / `to` indices. Aseprite hash exports often use keys like "name 0.aseprite" instead,
 * which produces empty animations and crashes on sprite.play().
 */
export function normalizeAsepriteJsonForPhaser(data: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  const frames = clone.frames as Record<string, unknown> | undefined;
  if (!frames || typeof frames !== 'object') {
    return clone;
  }

  const keys = Object.keys(frames);
  if (keys.length === 0) {
    return clone;
  }

  const allNumericKeys = keys.every((k) => /^\d+$/.test(k));
  if (allNumericKeys) {
    return clone;
  }

  const sortedKeys = [...keys].sort((a, b) => extractFrameSortIndex(a) - extractFrameSortIndex(b));
  const newFrames: Record<string, unknown> = {};
  sortedKeys.forEach((oldKey, index) => {
    newFrames[String(index)] = frames[oldKey];
  });

  clone.frames = newFrames;
  return clone;
}

function extractFrameSortIndex(frameKey: string): number {
  const match = frameKey.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}
