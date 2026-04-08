const BASE_MS = 900;
const PER_CHAR_MS = 55;
const MIN_MS = 1200;
const MAX_MS = 14_000;

/**
 * How long an overhead speech line stays visible before auto-dismiss.
 * Scaled by `lineDurationScale` from game config (typically 1).
 */
export function computeSpeechDurationMs(text: string, lineDurationScale: number): number {
  const scale = Number.isFinite(lineDurationScale) && lineDurationScale > 0 ? lineDurationScale : 1;
  const len = text.length;
  const raw = (BASE_MS + len * PER_CHAR_MS) * scale;
  return Math.round(Math.min(MAX_MS, Math.max(MIN_MS, raw)));
}
