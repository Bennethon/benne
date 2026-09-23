import * as Phaser from 'phaser';
import type { RoomRegionData } from '../../types/room';
import { pointInPolygon } from '../walkable';

function isActiveRegionContainingFeet(
  r: RoomRegionData,
  feetX: number,
  feetY: number,
): boolean {
  if (r.active === false) {
    return false;
  }
  const pts = r.points;
  if (!pts || pts.length < 3) {
    return false;
  }
  return pointInPolygon(feetX, feetY, pts);
}

/**
 * **Last** active polygon in `regions[]` that contains the feet point (enter/exit and walkability).
 * Scale and tint use their own winners inside {@link computeRoomRegionPerspective}. `null` when
 * outside all regions or when `regions` is empty.
 */
export function resolveWinningRoomRegionDataAtFeet(
  feetX: number,
  feetY: number,
  regions: readonly RoomRegionData[] | undefined,
): RoomRegionData | null {
  if (!regions || regions.length === 0) {
    return null;
  }
  let winner: RoomRegionData | null = null;
  for (const r of regions) {
    if (!isActiveRegionContainingFeet(r, feetX, feetY)) {
      continue;
    }
    winner = r;
  }
  return winner;
}

/**
 * Which authored region “wins” at the feet position for enter/exit — **last** active polygon in
 * `regions[]` that contains the point. Scale and tint winners are independent
 * ({@link computeRoomRegionPerspective}). `null` when outside all regions or when `regions` is empty
 * / unusable.
 */
export function resolveWinningRoomRegionIdAtFeet(
  feetX: number,
  feetY: number,
  regions: readonly RoomRegionData[] | undefined,
): string | null {
  return resolveWinningRoomRegionDataAtFeet(feetX, feetY, regions)?.id ?? null;
}

function tryParseTintHexRgb(hex: string): number | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) {
    return null;
  }
  return parseInt(m[1], 16);
}

/**
 * Raw tint color (`0xRRGGBB`) and alpha (`0`–`1`) from the tint-winning region, or `null` when the
 * region has no authored `tint` field (or `tintAlpha` is `0`).
 */
export function regionTintForWinningRegion(
  region: RoomRegionData | null | undefined,
): { color: number; alpha: number } | null {
  if (!region) {
    return null;
  }
  const hex = region.tint;
  if (typeof hex !== 'string') {
    return null;
  }
  const color = tryParseTintHexRgb(hex);
  if (color == null) {
    return null;
  }
  const alpha =
    typeof region.tintAlpha === 'number' && Number.isFinite(region.tintAlpha)
      ? Math.max(0, Math.min(1, region.tintAlpha))
      : 1;
  if (alpha <= 0) {
    return null;
  }
  return { color, alpha };
}

/**
 * Packed `0xRRGGBB` suitable for Phaser **multiply** `setTint`: interpolates each channel from
 * white (`255`) toward `rgb` by `strength` (region `tintAlpha`). At strength `0` returns white
 * (identity multiply); at `1` returns the authored RGB.
 */
export function packedMultiplyTintFromRgbAndStrength(rgb: number, strength: number): number {
  const a = Math.max(0, Math.min(1, strength));
  const tr = (rgb >> 16) & 0xff;
  const tg = (rgb >> 8) & 0xff;
  const tb = rgb & 0xff;
  const r = Math.round(255 + (tr - 255) * a);
  const g = Math.round(255 + (tg - 255) * a);
  const b = Math.round(255 + (tb - 255) * a);
  return (r << 16) | (g << 8) | b;
}

/**
 * Multiply tint for the tint-winning region, or `null` when no tint applies (`clearTint` in that case).
 */
export function packedTintFromWinningRegion(region: RoomRegionData | null | undefined): number | null {
  const spec = regionTintForWinningRegion(region);
  if (!spec) {
    return null;
  }
  return packedMultiplyTintFromRgbAndStrength(spec.color, spec.alpha);
}

/**
 * Applies region multiply-tint on a character `Sprite` / `Image`, or clears tint when the tint
 * winner has no usable color (or there is no tint winner).
 */
export function applyCharacterSpriteRegionTintFromWinningRegion(
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  winningRegion: RoomRegionData | null | undefined,
): void {
  const packed = packedTintFromWinningRegion(winningRegion);
  if (packed == null) {
    sprite.clearTint();
    return;
  }
  sprite.setTint(packed);
}

/** Tunable caps for {@link computeRoomRegionPerspective} walk-speed multiplier (from `game-config.json`). */
export type RoomRegionPerspectiveSettings = {
  minWalkScale: number;
  walkScalePower: number;
};

export type RoomRegionPerspectiveResult = {
  /** Linear sprite scale from the last `scaleEnabled` region (1 when none apply). */
  characterScale: number;
  /**
   * Multiplier applied to authored walk speed when the scale winner has `scaleWalkSpeed: true`;
   * otherwise `1`.
   */
  walkSpeedMultiplier: number;
  /** Last active region whose polygon contained the feet (enter/exit; same as {@link resolveWinningRoomRegionIdAtFeet}). */
  winningRegion: RoomRegionData | null;
  /**
   * Last active region containing the feet with `tintEnabled: true`. `null` when no tint source
   * applies (do not clear a tint that was never set by a later region with tint off).
   */
  tintRegion: RoomRegionData | null;
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
 * Overlapping regions: the **last** active polygon still wins for enter/exit (`winningRegion`).
 * Scale and tint are independent: only the last containing region with `scaleEnabled` updates
 * scale and walk speed, and only the last with `tintEnabled` becomes `tintRegion`. A later region
 * with that feature off does not reset the earlier winner.
 */
export function computeRoomRegionPerspective(
  feetX: number,
  feetY: number,
  regions: readonly RoomRegionData[] | undefined,
  perspective: RoomRegionPerspectiveSettings,
): RoomRegionPerspectiveResult {
  if (!regions || regions.length === 0) {
    return { characterScale: 1, walkSpeedMultiplier: 1, winningRegion: null, tintRegion: null };
  }
  let characterScale = 1;
  let walkSpeedMultiplier = 1;
  let winningRegion: RoomRegionData | null = null;
  let tintRegion: RoomRegionData | null = null;
  for (const r of regions) {
    if (!isActiveRegionContainingFeet(r, feetX, feetY)) {
      continue;
    }
    winningRegion = r;
    if (r.scaleEnabled === true) {
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
    if (r.tintEnabled === true) {
      tintRegion = r;
    }
  }
  return { characterScale, walkSpeedMultiplier, winningRegion, tintRegion };
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
