/**
 * Picks an idle clip for the character preview (editor). Prefers `IdleD`, then other common idles,
 * then any tag starting with `Idle` (lexicographic).
 */
const PREVIEW_IDLE_PRIORITY: readonly string[] = [
  'IdleD',
  'IdleDR',
  'IdleDL',
  'IdleR',
  'IdleL',
  'IdleU',
  'IdleUR',
  'IdleUL',
];

export function pickCharacterPreviewIdleTag(frameTagNames: readonly string[]): string | null {
  const set = new Set(frameTagNames);
  for (const t of PREVIEW_IDLE_PRIORITY) {
    if (set.has(t)) {
      return t;
    }
  }
  const idles = frameTagNames.filter((n) => n.startsWith('Idle')).sort();
  return idles[0] ?? null;
}
