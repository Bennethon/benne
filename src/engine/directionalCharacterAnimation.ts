import * as Phaser from 'phaser';
import { playCharacterAnimation, type CharacterAnimSprite } from './characterAnimationPlayback';

/** Matches Aseprite frame-tag suffix convention (IdleL, WalkDR, …). */
export type CharacterFacing = 'L' | 'R' | 'U' | 'D' | 'UL' | 'UR' | 'DL' | 'DR';

const SQRT1_2 = Math.SQRT1_2;

/** Screen-space unit dirs (y+ down). */
const FACING_UNIT: Record<CharacterFacing, [number, number]> = {
  R: [1, 0],
  DR: [SQRT1_2, SQRT1_2],
  D: [0, 1],
  DL: [-SQRT1_2, SQRT1_2],
  L: [-1, 0],
  UL: [-SQRT1_2, -SQRT1_2],
  U: [0, -1],
  UR: [SQRT1_2, -SQRT1_2],
};

/** Radians from +x toward +y (clockwise from R through D). */
const FACING_ANGLE_RAD: Record<CharacterFacing, number> = {
  R: 0,
  DR: Math.PI / 4,
  D: Math.PI / 2,
  DL: (3 * Math.PI) / 4,
  L: Math.PI,
  UL: (-3 * Math.PI) / 4,
  U: -Math.PI / 2,
  UR: -Math.PI / 4,
};

/** Authoring / stable tie-break order (matches `CharacterFacingLetter`). */
const ALL_FACINGS: CharacterFacing[] = ['L', 'R', 'U', 'D', 'UL', 'UR', 'DL', 'DR'];

function angleDistRad(a: number, b: number): number {
  let d = Math.abs(a - b) % (2 * Math.PI);
  if (d > Math.PI) {
    d = 2 * Math.PI - d;
  }
  return d;
}

/** Horizontal mirror partner for flipX fallbacks; U/D have none. */
export function mirrorHorizontalFacing(dir: CharacterFacing): CharacterFacing | null {
  switch (dir) {
    case 'L':
      return 'R';
    case 'R':
      return 'L';
    case 'UL':
      return 'UR';
    case 'UR':
      return 'UL';
    case 'DL':
      return 'DR';
    case 'DR':
      return 'DL';
    default:
      return null;
  }
}

function facingFallbackOrder(requested: CharacterFacing): CharacterFacing[] {
  const ra = FACING_ANGLE_RAD[requested];
  return [...ALL_FACINGS].sort((a, b) => {
    const da = angleDistRad(FACING_ANGLE_RAD[a], ra);
    const db = angleDistRad(FACING_ANGLE_RAD[b], ra);
    if (Math.abs(da - db) < 1e-9) {
      return ALL_FACINGS.indexOf(a) - ALL_FACINGS.indexOf(b);
    }
    return da - db;
  });
}

/** 8-way facing from a world movement vector (y+ is down on screen). */
export function facingFromWorldDelta(dx: number, dy: number): CharacterFacing {
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) {
    return 'D';
  }
  const nx = dx / len;
  const ny = dy / len;
  let best: CharacterFacing = 'D';
  let bestDot = -Infinity;
  for (const dir of ALL_FACINGS) {
    const [vx, vy] = FACING_UNIT[dir];
    const dot = nx * vx + ny * vy;
    if (dot > bestDot + 1e-9) {
      bestDot = dot;
      best = dir;
    }
  }
  return best;
}

export interface DirectionalCharacterSprite extends CharacterAnimSprite {
  playDirectionalAnimation(baseName: string, direction: CharacterFacing): void;
}

/**
 * Picks the first existing `Idle*` tag in a sensible default order (cardinals, then diagonals).
 */
export function resolveInitialIdleFacing(sprite: Phaser.GameObjects.Sprite): CharacterFacing {
  const order: CharacterFacing[] = ['R', 'D', 'L', 'U', 'DR', 'DL', 'UR', 'UL'];
  for (const dir of order) {
    if (sprite.anims.exists(`Idle${dir}`)) {
      return dir;
    }
  }
  return 'D';
}

const VALID_SPAWN_FACING = new Set<string>(ALL_FACINGS);

/**
 * Uses room placement `initialFacing` when valid; otherwise same fallback as {@link resolveInitialIdleFacing}.
 */
export function resolveSpawnIdleFacing(
  sprite: Phaser.GameObjects.Sprite,
  initialFacing: string | undefined,
): CharacterFacing {
  if (initialFacing !== undefined && VALID_SPAWN_FACING.has(initialFacing)) {
    return initialFacing as CharacterFacing;
  }
  return resolveInitialIdleFacing(sprite);
}

/**
 * Plays `<baseName><facing>` (e.g. `IdleR`). If that tag is missing, tries the next closest facing (by angle),
 * then horizontal mirror (L/R, UL/UR, DL/DR) with `setFlipX` when the mirrored tag exists.
 */
export function playDirectionalAnimation(
  sprite: Phaser.GameObjects.Sprite,
  baseName: string,
  direction: CharacterFacing,
): void {
  const tryPlay = (key: string, flipX: boolean): boolean => {
    if (!sprite.anims.exists(key)) {
      return false;
    }
    const anim = sprite.anims.get(key);
    if (!anim || anim.frames.length === 0) {
      console.warn(`[Benne] Animation '${key}' has no frames (check Aseprite JSON / Phaser frame keys).`);
      return false;
    }
    sprite.setFlipX(flipX);
    playCharacterAnimation(sprite, key);
    sprite.setData('facing', direction);
    sprite.setData('facingBase', baseName);
    return true;
  };

  for (const d of facingFallbackOrder(direction)) {
    if (tryPlay(`${baseName}${d}`, false)) {
      return;
    }
    const m = mirrorHorizontalFacing(d);
    if (m !== null && tryPlay(`${baseName}${m}`, true)) {
      return;
    }
  }
}

/**
 * Attaches `playDirectionalAnimation` on the sprite. Call after {@link setupCharacterAsepritePlayback}
 * so `playCharacterAnimation` is available.
 */
export function attachDirectionalAnimationApi(sprite: Phaser.GameObjects.Sprite): DirectionalCharacterSprite {
  const extended = sprite as DirectionalCharacterSprite;
  extended.playDirectionalAnimation = (baseName: string, direction: CharacterFacing): void => {
    playDirectionalAnimation(extended, baseName, direction);
  };
  return extended;
}
