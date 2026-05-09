import type { RoomRegionData } from '../../types/room';
import { pointInPolygon } from '../walkable';

/**
 * Which authored region “wins” at the feet position — **last** active polygon in `regions[]` that
 * contains the point (same overlap rule as {@link computeRoomRegionPerspective}). `null` when
 * outside all regions or when `regions` is empty / unusable.
 */
export function resolveWinningRoomRegionIdAtFeet(
  feetX: number,
  feetY: number,
  regions: readonly RoomRegionData[] | undefined,
): string | null {
  if (!regions || regions.length === 0) {
    return null;
  }
  let id: string | null = null;
  for (const r of regions) {
    if (r.active === false) {
      continue;
    }
    const pts = r.points;
    if (!pts || pts.length < 3) {
      continue;
    }
    if (!pointInPolygon(feetX, feetY, pts)) {
      continue;
    }
    id = r.id;
  }
  return id;
}

/** Tunable caps for {@link computeRoomRegionPerspective} walk-speed multiplier (from `game-config.json`). */
export type RoomRegionPerspectiveSettings = {
  minWalkScale: number;
  walkScalePower: number;
};

export type RoomRegionPerspectiveResult = {
  /** Linear sprite scale from the winning region (1 outside regions). */
  characterScale: number;
  /**
   * Multiplier applied to authored walk speed when the winning region has `scaleWalkSpeed: true`;
   * otherwise `1`.
   */
  walkSpeedMultiplier: number;
};

function linearScaleForRegionFeetY(region: RoomRegionData, feetY: number): number {
  const scaleTop = typeof region.scaleTop === 'number' && Number.isFinite(region.scaleTop) ? region.scaleTop : 1;
  const scaleBottom =
    typeof region.scaleBottom === 'number' && Number.isFinite(region.scaleBottom) ? region.scaleBottom : 1;
  const pts = region.points;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.y < minY) {
      minY = p.y;
    }
    if (p.y > maxY) {
      maxY = p.y;
    }
  }
  const span = maxY - minY;
  if (span <= 1e-6) {
    return (scaleTop + scaleBottom) * 0.5;
  }
  const t = Math.max(0, Math.min(1, (feetY - minY) / span));
  return scaleTop + t * (scaleBottom - scaleTop);
}

/**
 * Sprite scale and optional walk-speed multiplier from room regions (feet position in room space).
 * Overlapping regions: **last** match in `regions` wins for both values.
 */
export function computeRoomRegionPerspective(
  feetX: number,
  feetY: number,
  regions: readonly RoomRegionData[] | undefined,
  perspective: RoomRegionPerspectiveSettings,
): RoomRegionPerspectiveResult {
  if (!regions || regions.length === 0) {
    return { characterScale: 1, walkSpeedMultiplier: 1 };
  }
  let characterScale = 1;
  let walkSpeedMultiplier = 1;
  for (const r of regions) {
    if (r.active === false) {
      continue;
    }
    const pts = r.points;
    if (!pts || pts.length < 3) {
      continue;
    }
    if (!pointInPolygon(feetX, feetY, pts)) {
      continue;
    }
    const linear = linearScaleForRegionFeetY(r, feetY);
    characterScale = linear;
    if (r.scaleWalkSpeed === true) {
      walkSpeedMultiplier = Math.max(
        perspective.minWalkScale,
        Math.pow(linear, perspective.walkScalePower),
      );
    } else {
      walkSpeedMultiplier = 1;
    }
  }
  return { characterScale, walkSpeedMultiplier };
}

/**
 * Linear vertical scale for a character whose **feet** lie in an active room region.
 * Same rules as {@link computeRoomRegionPerspective}.`characterScale` (walk multiplier ignored here).
 */
export function computeRoomRegionCharacterScale(
  feetX: number,
  feetY: number,
  regions: readonly RoomRegionData[] | undefined,
): number {
  return computeRoomRegionPerspective(feetX, feetY, regions, {
    minWalkScale: 0.3,
    walkScalePower: 0.8,
  }).characterScale;
}
