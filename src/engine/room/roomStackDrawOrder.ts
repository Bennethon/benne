import type * as Phaser from 'phaser';
import type { CharacterData } from '../../types/character';
import { getCharacterWorldFeet } from '../characterFeet';

/** Props, characters, and hotspot zones share depths in `[base, base + n)`; GUIs start at 25_000. */
export const ROOM_STACK_DEPTH_BASE = 100;

export type RoomStackFootSprite = Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

export type RoomStackEntity =
  | {
      kind: 'prop';
      sprite: Phaser.GameObjects.Sprite;
      zIndex: number;
      /** Room-space Y (pixels); when set, walkers with feet Y greater than this draw in front. */
      baselineRoomY?: number;
      sortKey: string;
    }
  | {
      kind: 'character';
      sprite: RoomStackFootSprite;
      zIndex: number;
      character: CharacterData;
      sortKey: string;
    }
  | {
      kind: 'hotspot';
      zone: Phaser.GameObjects.Zone;
      zIndex: number;
      baselineRoomY?: number;
      sortKey: string;
    };

function feetWorldY(sprite: RoomStackFootSprite): number {
  return getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite).y;
}

function kindRank(k: RoomStackEntity['kind']): number {
  return k === 'prop' ? 0 : k === 'hotspot' ? 1 : 2;
}

/**
 * Same ordering intent as {@link compareRoomStackEntities}, but **without** prop/hotspot baseline
 * exceptions for characters. This relation is a **strict weak ordering** (transitive), so it can
 * seed a deterministic insertion index when baseline + zIndex constraints contradict.
 */
function compareWithoutBaselineExceptions(a: RoomStackEntity, b: RoomStackEntity): number {
  const feetA = a.kind === 'character' ? feetWorldY(a.sprite) : null;
  const feetB = b.kind === 'character' ? feetWorldY(b.sprite) : null;

  if (a.kind === 'character' && b.kind === 'character') {
    if (feetA! > feetB!) {
      return 1;
    }
    if (feetB! > feetA!) {
      return -1;
    }
  }

  const za = a.zIndex ?? 0;
  const zb = b.zIndex ?? 0;
  if (za !== zb) {
    return za - zb;
  }

  const dk = kindRank(a.kind) - kindRank(b.kind);
  if (dk !== 0) {
    return dk;
  }

  if (a.kind === 'character' && b.kind === 'character') {
    return feetA! - feetB!;
  }

  return a.sortKey.localeCompare(b.sortKey);
}

/**
 * Total ordering for room stack draw order (ascending = lower depth = drawn first = further back).
 * When a walker’s feet are **below** (greater Y than) a thing’s baseline, the walker draws in front
 * of that thing; otherwise `zIndex` applies, with props before hotspots before characters at the same band.
 * Character-vs-character uses **world feet Y** only.
 *
 * **Note:** This comparator is **not** guaranteed to be transitive when several props use different
 * `baseline` values together with `zIndex` — do not pass it to `Array.prototype.sort` for the full
 * stack. Use {@link sortRoomStackEntities} instead.
 */
export function compareRoomStackEntities(a: RoomStackEntity, b: RoomStackEntity): number {
  const feetA = a.kind === 'character' ? feetWorldY(a.sprite) : null;
  const feetB = b.kind === 'character' ? feetWorldY(b.sprite) : null;

  if (feetA !== null && b.kind !== 'character' && b.baselineRoomY !== undefined) {
    if (feetA > b.baselineRoomY) {
      return 1;
    }
  }
  if (feetB !== null && a.kind !== 'character' && a.baselineRoomY !== undefined) {
    if (feetB > a.baselineRoomY) {
      return -1;
    }
  }

  if (a.kind === 'character' && b.kind === 'character') {
    if (feetA! > feetB!) {
      return 1;
    }
    if (feetB! > feetA!) {
      return -1;
    }
  }

  const za = a.zIndex ?? 0;
  const zb = b.zIndex ?? 0;
  if (za !== zb) {
    return za - zb;
  }

  const dk = kindRank(a.kind) - kindRank(b.kind);
  if (dk !== 0) {
    return dk;
  }

  if (a.kind === 'character' && b.kind === 'character') {
    return feetA! - feetB!;
  }

  return a.sortKey.localeCompare(b.sortKey);
}

function compareSortKeyTie(a: RoomStackEntity, b: RoomStackEntity): number {
  return a.sortKey.localeCompare(b.sortKey);
}

/**
 * Stable sort for props + hotspots only: `zIndex`, then kind, then id.
 */
function sortStaticEntities(statics: RoomStackEntity[]): RoomStackEntity[] {
  return [...statics].sort((a, b) => {
    const za = a.zIndex ?? 0;
    const zb = b.zIndex ?? 0;
    if (za !== zb) {
      return za - zb;
    }
    const dk = kindRank(a.kind) - kindRank(b.kind);
    if (dk !== 0) {
      return dk;
    }
    return a.sortKey.localeCompare(b.sortKey);
  });
}

/**
 * Insertion index for `c` into `list` sorted back→front, using {@link compareWithoutBaselineExceptions}
 * (first index `i` where `c` draws in front of `list[i]` or `i === list.length`).
 */
function insertionIndexTransitive(list: readonly RoomStackEntity[], c: RoomStackEntity): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const cmp = compareWithoutBaselineExceptions(c, list[mid]!);
    if (cmp < 0) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
}

function computeInsertionBounds(list: readonly RoomStackEntity[], c: RoomStackEntity): { lo: number; hi: number } {
  let lo = 0;
  let hi = list.length;
  for (let p = 0; p < list.length; p++) {
    const e = list[p]!;
    let cmp = compareRoomStackEntities(c, e);
    if (cmp === 0) {
      cmp = compareSortKeyTie(c, e);
    }
    if (cmp < 0) {
      hi = Math.min(hi, p);
    } else if (cmp > 0) {
      lo = Math.max(lo, p + 1);
    }
  }
  return { lo, hi };
}

let warnedBaselineContradiction = false;

/**
 * Deterministic back→front draw order for the room stack. Baseline rules can contradict `zIndex`
 * chains across multiple props; when that happens we fall back to **zIndex / kind / feet /
 * sortKey** only (no baseline exceptions) for that character’s insertion so removing unrelated
 * props cannot change unrelated pairwise order.
 */
export function sortRoomStackEntities(entities: readonly RoomStackEntity[]): RoomStackEntity[] {
  const statics: RoomStackEntity[] = [];
  const chars: RoomStackEntity[] = [];
  for (const e of entities) {
    if (e.kind === 'character') {
      chars.push(e);
    } else {
      statics.push(e);
    }
  }

  const sortedStatics = sortStaticEntities(statics);
  const sortedChars = [...chars].sort(compareRoomStackEntities);

  const out: RoomStackEntity[] = [...sortedStatics];
  for (const c of sortedChars) {
    const { lo, hi } = computeInsertionBounds(out, c);
    let insertAt: number;
    if (lo <= hi) {
      insertAt = lo;
    } else {
      if (import.meta.env.DEV && !warnedBaselineContradiction) {
        warnedBaselineContradiction = true;
        console.warn(
          '[Benne] Room stack: baseline vs zIndex constraints contradicted for at least one character; ' +
            'using zIndex-only placement for that insertion. Adjust baselines or zIndex bands if draw order looks wrong.',
        );
      }
      insertAt = insertionIndexTransitive(out, c);
    }
    out.splice(insertAt, 0, c);
  }
  return out;
}

export function applyRoomStackDepths(sorted: readonly RoomStackEntity[]): void {
  for (let i = 0; i < sorted.length; i++) {
    const depth = ROOM_STACK_DEPTH_BASE + i;
    const e = sorted[i]!;
    if (e.kind === 'hotspot') {
      e.zone.setDepth(depth);
    } else {
      e.sprite.setDepth(depth);
    }
  }
}
