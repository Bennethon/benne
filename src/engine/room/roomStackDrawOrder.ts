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

/**
 * Total ordering for room stack draw order (ascending = lower depth = drawn first = further back).
 * When a walker’s feet are **below** (greater Y than) a thing’s baseline, the walker draws in front
 * of that thing; otherwise `zIndex` applies, with props before hotspots before characters at the same band.
 * Character-vs-character uses **world feet Y** only.
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

  const kindRank = (k: RoomStackEntity['kind']): number =>
    k === 'prop' ? 0 : k === 'hotspot' ? 1 : 2;
  const dk = kindRank(a.kind) - kindRank(b.kind);
  if (dk !== 0) {
    return dk;
  }

  if (a.kind === 'character' && b.kind === 'character') {
    return feetA! - feetB!;
  }

  return a.sortKey.localeCompare(b.sortKey);
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
