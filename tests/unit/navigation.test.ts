import { describe, expect, it } from 'vitest';
import { findWalkPath, isSegmentInsideWalkable } from '../../src/engine/pathfinding';
import { isPointInWalkableArea, withNonWalkableRegionsAsHoles } from '../../src/engine/walkable';
const box = (x: number, y: number, w: number, h: number) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const start = { x: 10, y: 50 };
describe('navigation invariants', () => {
  it.each([false, true])('routes around a contained blocker, active=%s', active => {
    const polygons = [{ id: 'floor', points: box(0, 0, 100, 100), holes: [{ id: 'hole', active, points: box(40, 30, 20, 40) }] }];
    const path = findWalkPath(start, { x: 90, y: 50 }, polygons);
    expect(path.length).toBeGreaterThan(0);
    let prev = start;
    for (const p of path) {
      expect(isPointInWalkableArea(p.x, p.y, polygons)).toBe(true);
      expect(isSegmentInsideWalkable(prev, p, polygons)).toBe(true);
      prev = p;
    }
    expect(prev).toEqual({ x: 90, y: 50 });
    expect(path.length > 1).toBe(active);
  });
  it('stops on the reachable side of a partition', () => {
    const polygons = withNonWalkableRegionsAsHoles([{ id: 'floor', points: box(0, 0, 100, 100) }], [{ id: 'wall', walkable: false, points: box(40, -10, 20, 120) }]);
    const path = findWalkPath(start, { x: 90, y: 50 }, polygons);
    expect(path.length).toBeGreaterThan(0);
    expect(path.at(-1)!.x).toBeLessThan(40);
    expect(path.at(-1)!.x).toBeGreaterThan(39);
  });
  it('seed 731: every randomized route stays inside the floor and outside its hole', () => {
    let seed = 731;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    const polygons = [{ id: 'floor', points: box(0, 0, 100, 100), holes: [{ id: 'hole', points: box(40, 30, 20, 40) }] }];
    for (let i = 0; i < 100; i++) {
      const goal = { x: random() * 140 - 20, y: random() * 140 - 20 };
      const path = findWalkPath(start, goal, polygons);
      expect(path.length, `seed=731 case=${i}`).toBeGreaterThan(0);
      let prev = start;
      for (const p of path) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        expect(isSegmentInsideWalkable(prev, p, polygons), `seed=731 case=${i}`).toBe(true);
        prev = p;
      }
    }
  });
});
