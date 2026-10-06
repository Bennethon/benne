import { expect, it } from 'vitest';
import type Phaser from 'phaser';
import { facingFromWorldDelta, mirrorHorizontalFacing } from '../../src/engine/directionalCharacterAnimation';
import { mergeCharacterFollowOptions } from '../../src/engine/benneAnimationRuntime';
import { getCharacterWorldFeet, placeSpriteByFeet } from '../../src/engine/characterFeet';
import { resolveAuthoredPositionForAsepriteTrim } from '../../src/engine/aseprite/asepriteFramePlacement';
import { computeRoomRegionCharacterScale } from '../../src/engine/room/regionCharacterScale';
import { readRoomPlayFromNamesFromSource } from '../../benne-editor/src/playFromDiscovery';
it.each([[1, 0, 'R'], [-1, 0, 'L'], [0, 1, 'D'], [0, -1, 'U'], [1, 1, 'DR'], [0, 0, 'D']] as const)('direction (%s,%s) = %s', (x, y, facing) => {
  expect(facingFromWorldDelta(x, y)).toBe(facing);
});
it('mirrors horizontal animation direction', () => { expect(mirrorHorizontalFacing('L')).toBe('R'); expect(mirrorHorizontalFacing('U')).toBeNull(); });
it('follow options normalize invalid distances and offsets', () => {
  expect(mergeCharacterFollowOptions({ minDistance: 10, repathThreshold: 5, offset: { x: NaN, y: 3 }, speedMultiplier: Infinity })).toMatchObject({ minDistance: 10, repathThreshold: 22, offset: { x: 0, y: 3 }, speedMultiplier: 1 });
});
it('feet placement is reversible at different scales', () => {
  for (const scale of [0.5, 1, 2]) {
    const data = new Map<string, unknown>();
    const sprite = { x: 0, y: 0, scaleX: scale, scaleY: scale, setOrigin() {}, setPosition(x: number, y: number) { this.x = x; this.y = y; }, setData(k: string, v: unknown) { data.set(k, v); }, getData(k: string) { return data.get(k); } };
    placeSpriteByFeet(sprite as unknown as Phaser.GameObjects.Sprite, { x: 8, y: 24 }, 100, 120);
    expect(getCharacterWorldFeet(sprite as unknown as Phaser.GameObjects.Sprite)).toEqual({ x: 100, y: 120 });
  }
});
it('trimmed frame anchors compensate for padding', () => {
  const frame = { cutWidth: 10, cutHeight: 20, data: { trim: true, sourceSize: { w: 30, h: 40 }, spriteSourceSize: { x: 3, y: 4, w: 10, h: 20 } } } as unknown as Phaser.Textures.Frame;
  expect(resolveAuthoredPositionForAsepriteTrim('top-left', 100, 200, frame)).toEqual({ x: 97, y: 196 });
  expect(resolveAuthoredPositionForAsepriteTrim('center', 100, 200, frame)).toEqual({ x: 107, y: 206 });
  expect(resolveAuthoredPositionForAsepriteTrim('screen', 100, 200, frame)).toEqual({ x: 100, y: 200 });
});
it('inactive/outside regions do not scale a character', () => {
  expect(computeRoomRegionCharacterScale(20, 20, [])).toBe(1);
  expect(computeRoomRegionCharacterScale(20, 20, [{ id: 'r', active: false, scaleEnabled: true, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] }])).toBe(1);
});
it('Play From ignores commented and quoted examples, deduplicates static names', () => {
  expect(readRoomPlayFromNamesFromSource('// playFrom("bad", () => {});\nconst s = "playFrom(\\"bad2\\", () => {})";\nplayFrom( "ok", () => {}); playFrom(`ok`, () => {}); playFrom(`dynamic-${id}`, () => {});')).toEqual(['ok']);
});
