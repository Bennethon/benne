import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({
  appType: 'custom',
  configFile: false,
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false, ws: false },
});

try {
  const walkable = await server.ssrLoadModule('/src/engine/walkable.ts');
  const pathfinding = await server.ssrLoadModule('/src/engine/pathfinding.ts');

  const {
    clampWalkDestinationTowardClick,
    isPointInWalkableArea,
    withNonWalkableRegionsAsHoles,
  } = walkable;
  const { findWalkPath, isSegmentInsideWalkable } = pathfinding;

  const assertPointWalkable = (point, polygons, message) => {
    assert.equal(
      isPointInWalkableArea(point.x, point.y, polygons),
      true,
      `${message}: (${point.x}, ${point.y})`,
    );
  };

  const assertPathInside = (start, path, polygons, message) => {
    let prev = start;
    for (const [index, point] of path.entries()) {
      assertPointWalkable(point, polygons, `${message} waypoint ${index}`);
      assert.equal(
        isSegmentInsideWalkable(prev, point, polygons),
        true,
        `${message} leg ${index}: (${prev.x}, ${prev.y}) -> (${point.x}, ${point.y})`,
      );
      prev = point;
    }
  };

  const rectangleOuter = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  const edgeOverlappingBlocker = [
    { x: 40, y: -20 },
    { x: 70, y: -20 },
    { x: 70, y: 50 },
    { x: 40, y: 50 },
  ];

  {
    const polygons = withNonWalkableRegionsAsHoles(
      [
        {
          id: 'walk',
          points: rectangleOuter,
          holes: [{ id: 'edge-hole', points: edgeOverlappingBlocker }],
        },
      ],
      undefined,
    );
    const start = { x: 20, y: 80 };
    const clamped = clampWalkDestinationTowardClick(start.x, start.y, 55, -15, polygons);
    assert.ok(clamped, 'hole overlap click should clamp to walkable space');
    assertPointWalkable(clamped, polygons, 'hole overlap clamp');
    assert.ok(
      clamped.x < 40 || clamped.x > 70 || clamped.y > 50,
      `hole overlap clamp should avoid blocker, got (${clamped.x}, ${clamped.y})`,
    );
    assertPathInside(start, findWalkPath(start, { x: 55, y: -15 }, polygons), polygons, 'hole overlap path');

    const insideHoleClick = { x: 55, y: 5 };
    const insideClamped = clampWalkDestinationTowardClick(
      start.x,
      start.y,
      insideHoleClick.x,
      insideHoleClick.y,
      polygons,
    );
    assert.ok(insideClamped, 'click inside overlapping hole should clamp to walkable space');
    assertPointWalkable(insideClamped, polygons, 'click inside overlapping hole clamp');
    assertPathInside(
      start,
      findWalkPath(start, insideHoleClick, polygons),
      polygons,
      'click inside overlapping hole path',
    );
  }

  {
    const polygons = withNonWalkableRegionsAsHoles(
      [{ id: 'walk', points: rectangleOuter }],
      [{ id: 'edge-region', walkable: false, points: edgeOverlappingBlocker }],
    );
    const start = { x: 20, y: 80 };
    const clamped = clampWalkDestinationTowardClick(start.x, start.y, 55, -15, polygons);
    assert.ok(clamped, 'region overlap click should clamp to walkable space');
    assertPointWalkable(clamped, polygons, 'region overlap clamp');
    assert.ok(
      clamped.x < 40 || clamped.x > 70 || clamped.y > 50,
      `region overlap clamp should avoid blocker, got (${clamped.x}, ${clamped.y})`,
    );
    assertPathInside(start, findWalkPath(start, { x: 55, y: -15 }, polygons), polygons, 'region overlap path');

    const insideRegionClick = { x: 55, y: 5 };
    const insideClamped = clampWalkDestinationTowardClick(
      start.x,
      start.y,
      insideRegionClick.x,
      insideRegionClick.y,
      polygons,
    );
    assert.ok(insideClamped, 'click inside overlapping region should clamp to walkable space');
    assertPointWalkable(insideClamped, polygons, 'click inside overlapping region clamp');
    assertPathInside(
      start,
      findWalkPath(start, insideRegionClick, polygons),
      polygons,
      'click inside overlapping region path',
    );
  }

  {
    const polygons = withNonWalkableRegionsAsHoles(
      [{ id: 'walk', points: rectangleOuter }],
      [
        {
          id: 'partition-region',
          walkable: false,
          points: [
            { x: 40, y: -10 },
            { x: 60, y: -10 },
            { x: 60, y: 110 },
            { x: 40, y: 110 },
          ],
        },
      ],
    );
    const start = { x: 20, y: 50 };
    const goal = { x: 80, y: 50 };
    assert.equal(
      isSegmentInsideWalkable(start, goal, polygons),
      false,
      'partitioning region should block direct visibility',
    );
    const leftToRight = findWalkPath(start, goal, polygons);
    assert.equal(leftToRight.length, 1, 'partitioning region should walk to the blocker edge');
    assertPathInside(start, leftToRight, polygons, 'partitioning region left-to-right partial path');
    assert.ok(
      leftToRight[0].x > 39 && leftToRight[0].x < 40,
      `left-to-right partial path should stop before blocker, got (${leftToRight[0].x}, ${leftToRight[0].y})`,
    );

    const rightStart = { x: 80, y: 50 };
    const rightGoal = { x: 20, y: 50 };
    const rightToLeft = findWalkPath(rightStart, rightGoal, polygons);
    assert.equal(rightToLeft.length, 1, 'partitioning region should walk to the blocker edge from the right');
    assertPathInside(rightStart, rightToLeft, polygons, 'partitioning region right-to-left partial path');
    assert.ok(
      rightToLeft[0].x > 60 && rightToLeft[0].x < 61,
      `right-to-left partial path should stop before blocker, got (${rightToLeft[0].x}, ${rightToLeft[0].y})`,
    );
  }

  {
    const polygons = withNonWalkableRegionsAsHoles(
      [
        {
          id: 'walk',
          points: rectangleOuter,
          holes: [
            {
              id: 'contained-hole',
              points: [
                { x: 40, y: 40 },
                { x: 60, y: 40 },
                { x: 60, y: 60 },
                { x: 40, y: 60 },
              ],
            },
          ],
        },
      ],
      undefined,
    );
    const start = { x: 20, y: 50 };
    const path = findWalkPath(start, { x: 80, y: 50 }, polygons);
    assert.ok(path.length > 1, 'contained hole should require a routed path');
    assertPathInside(start, path, polygons, 'contained hole path');
  }

  {
    const polygons = withNonWalkableRegionsAsHoles(
      [
        {
          id: 'walk',
          points: rectangleOuter,
          holes: [{ id: 'inactive-hole', active: false, points: edgeOverlappingBlocker }],
        },
      ],
      [{ id: 'inactive-region', active: false, walkable: false, points: edgeOverlappingBlocker }],
    );
    const start = { x: 20, y: 80 };
    const clamped = clampWalkDestinationTowardClick(start.x, start.y, 55, -15, polygons);
    assert.ok(clamped, 'inactive blockers should still allow clamping to raw outer edge');
    assert.ok(
      Math.abs(clamped.x - 55) < 0.001 && Math.abs(clamped.y) < 0.001,
      `inactive blockers should not affect clamp, got (${clamped.x}, ${clamped.y})`,
    );
  }

  console.log('Pathfinding blocker regressions passed.');
} finally {
  await server.close();
}
