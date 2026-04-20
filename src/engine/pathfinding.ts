import type { Point2, WalkablePolygon } from '../types/room';
import {
  clampWalkDestinationTowardClick,
  isPointInWalkableArea,
  pointInPolygon,
} from './walkable';

/**
 * 2D pathfinding for the walkable mesh.
 *
 * **Algorithm**: classical **visibility graph + A\***. This is the textbook shortest-path
 * approach for simple polygons with holes and is what most modern adventure-game engines
 * (Adventure Creator, Wintermute-family, PowerQuest) use for their polygon walk meshes.
 * The result is the **exact Euclidean shortest path** that hugs concave corners and bends
 * cleanly around hole rings — the classic LucasArts walk look.
 *
 * **Graph nodes** are
 *  - **reflex** outer-ring vertices (concave-from-inside corners) of each active polygon, and
 *  - **every** vertex of each active hole ring (holes poke into the walkable region, so every
 *    hole vertex is reflex as seen from the walkable side).
 *
 * Convex outer corners are omitted — shortest paths never bend around them.
 *
 * **Inward corner offset** — each node is nudged ~{@link CORNER_INWARD_OFFSET_PX} pixels along
 * the interior bisector (into the walkable region) so paths do not sit exactly on the pixel
 * that forms the corner. This gives characters a sub-pixel corner radius that matches the
 * classic LucasArts look and makes the segment-midpoint-in-walkable test robust against
 * on-boundary numerical edge cases.
 *
 * **Start / goal handling**
 *  - If the start point is already **outside** the walkable region (e.g. the character spawned
 *    on a non-walkable pixel), we skip pathfinding and return a direct line to the clamped
 *    goal — matches the engine's pre-pathfinding fallback behavior.
 *  - The goal is always clamped to the walkable union before pathfinding (reusing
 *    {@link clampWalkDestinationTowardClick}).
 *  - If start and goal lie in **disconnected** components of the walkable union, A\* returns no
 *    path and we fall back to a direct line to the clamped goal.
 *
 * **Complexity** — O((N+2)²) visibility tests per query, where N is the number of candidate
 * nodes (typically tens for hand-authored rooms). Each visibility test is O(E) across all
 * ring edges. Cheap in practice; called once per walk command, not per frame.
 */

/**
 * Inward offset applied to graph nodes so they sit just inside the walkable region rather
 * than exactly on the polygon boundary. Gives characters a sub-pixel corner radius and keeps
 * segment midpoint checks robust at vertices.
 */
const CORNER_INWARD_OFFSET_PX = 1;

/**
 * If `start` is reported outside the walkable region but within this distance of the walkable
 * boundary, treat it as boundary-rounding noise (the natural outcome of a previous pathfound
 * walk ending on an inward-offset corner node) and pathfind from the snapped-inside point.
 * Beyond this we assume the character is genuinely off-mesh (spawn / cutscene placement) and
 * fall back to the historical "glide straight to the clamped goal" behavior.
 *
 * Without this tolerance, the ray-cast `pointInPolygon` test can false-negative on boundary
 * pixels and `findWalkPath` would short-circuit to a direct line — straight through holes or
 * concavities — for every subsequent click after any pathfound walk.
 */
const OFF_MESH_SNAP_TOLERANCE_PX = 2;

/**
 * Perpendicular jitter used by {@link isSegmentInsideWalkable} to rescue interior samples
 * that land on a polygon boundary edge. Chosen < {@link CORNER_INWARD_OFFSET_PX} so the jitter
 * never reaches as far as a neighbouring node would sit, while still being wide enough that
 * `pointInPolygon`'s ray cast reliably classifies the jittered points (0.5 px is unambiguous
 * for integer-vertex polygons).
 */
const BOUNDARY_JITTER_PX = 0.5;

/** Tolerance for orientation tests (pixel-scale; coordinates are integer in authored JSON). */
const EPS = 1e-6;

interface GraphNode {
  readonly x: number;
  readonly y: number;
}

/**
 * Shortest path from `start` to `goal` through the walkable region as an ordered list of
 * waypoints (goal last). Does **not** include the start.
 *
 * - Returns `[goal]` when the straight line is entirely inside the walkable region.
 * - Returns a polyline `[corner₁, corner₂, …, goal]` when a path must bend around hole rings
 *   or concavities.
 * - Returns `[clampedGoal]` as a one-hop fallback when:
 *   - the start is outside the walkable region (spawn / cutscene placement), or
 *   - start and goal are in disconnected walkable components and A\* cannot reach the goal.
 * - Returns `[]` only when there is no usable polygon geometry at all.
 */
export function findWalkPath(
  start: Point2,
  goal: Point2,
  polygons: readonly WalkablePolygon[],
): Point2[] {
  const clamped = clampWalkDestinationTowardClick(start.x, start.y, goal.x, goal.y, polygons);
  if (!clamped) {
    return [];
  }

  // Treat "on the boundary" as "inside": pointInPolygon ray-casts are unreliable for points
  // exactly on an edge, so after a pathfound walk ends on (or within a pixel of) the mesh
  // boundary, a strict inside-check would bail out and short-circuit to a direct line — right
  // through any hole or concavity between start and goal. If start is only marginally off,
  // snap it inward and pathfind from there. Only genuinely off-mesh starts (spawn / cutscene
  // placement further from the mesh than `OFF_MESH_SNAP_TOLERANCE_PX`) fall back to the
  // historical straight-line-to-clamped-goal behavior.
  let effectiveStart = start;
  if (!isPointInWalkableArea(start.x, start.y, polygons)) {
    const snapped = clampWalkDestinationTowardClick(
      start.x,
      start.y,
      start.x,
      start.y,
      polygons,
    );
    if (!snapped) {
      return [clamped];
    }
    const off = Math.hypot(snapped.x - start.x, snapped.y - start.y);
    if (off > OFF_MESH_SNAP_TOLERANCE_PX) {
      return [clamped];
    }
    effectiveStart = snapped;
  }

  if (isSegmentInsideWalkable(effectiveStart, clamped, polygons)) {
    return [clamped];
  }

  const nodes = buildGraphNodes(polygons);
  const path = aStarPath(effectiveStart, clamped, nodes, polygons);
  if (path.length === 0) {
    return [clamped];
  }
  return path;
}

/**
 * True when the open segment between `a` and `b` lies entirely inside the walkable region
 * (inside some active outer ring, not crossing any active hole ring, and not cutting across
 * a concavity even when both endpoints are on the boundary).
 *
 * Uses interior-sample points (t = 0.25, 0.5, 0.75) plus a proper-intersection test against
 * every ring edge. Shared-endpoint touches and purely collinear overlaps are not treated as
 * crossings; the interior-sample test catches segments that would leave the mesh without
 * crossing an edge (e.g. vertex-to-vertex across a notch).
 */
export function isSegmentInsideWalkable(
  a: Point2,
  b: Point2,
  polygons: readonly WalkablePolygon[],
): boolean {
  // Interior samples. We use seven asymmetric points rather than three because the
  // proper-crossing test can be numerically fragile for segments that pass through (or very
  // near) a polygon vertex, and extra samples are the cheapest way to notice that the segment
  // actually dips out of the walkable region in a narrow concavity or crosses a small hole.
  //
  // Each sample is rescued by a small perpendicular jitter: if the sample lands exactly on a
  // boundary edge (where `pointInPolygon` ray casts are unreliable) we instead accept it if
  // either side of the segment is clearly inside walkable. Without this, segments running
  // **along** a polygon boundary — e.g. a character on the top edge of the walkable mesh
  // walking sideways to a goal clamped onto the same top edge — fail the sample test, which
  // forces A\* to route the walk via some other graph node (typically a hole-ring vertex
  // offset inward from the hole), making the character detour *away* from a perfectly valid
  // straight-line walk along the boundary. Segments that leave the mesh through a real
  // concavity or hole still fail because both perpendicular neighbours are also outside.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  let nx = 0;
  let ny = 0;
  if (len > EPS) {
    nx = -dy / len;
    ny = dx / len;
  }

  const samples = [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9];
  for (const t of samples) {
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    if (isPointInWalkableArea(px, py, polygons)) {
      continue;
    }
    if (
      isPointInWalkableArea(px + nx * BOUNDARY_JITTER_PX, py + ny * BOUNDARY_JITTER_PX, polygons) ||
      isPointInWalkableArea(px - nx * BOUNDARY_JITTER_PX, py - ny * BOUNDARY_JITTER_PX, polygons)
    ) {
      continue;
    }
    return false;
  }

  for (const poly of polygons) {
    if (poly.active === false || poly.points.length < 3) {
      continue;
    }
    if (ringHasProperCrossing(a, b, poly.points)) {
      return false;
    }
    for (const h of poly.holes ?? []) {
      if (h.active === false || h.points.length < 3) {
        continue;
      }
      if (ringHasProperCrossing(a, b, h.points)) {
        return false;
      }
    }
  }
  return true;
}

function ringHasProperCrossing(a: Point2, b: Point2, ring: readonly Point2[]): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const c = ring[i]!;
    const d = ring[(i + 1) % n]!;
    if (segmentsProperlyIntersect(a, b, c, d)) {
      return true;
    }
  }
  return false;
}

function cross2(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/**
 * True iff segments [A,B] and [C,D] cross each other strictly in their interiors. Touching at
 * a shared endpoint and collinear overlap both return false.
 */
function segmentsProperlyIntersect(a: Point2, b: Point2, c: Point2, d: Point2): boolean {
  const d1 = cross2(b.x - a.x, b.y - a.y, c.x - a.x, c.y - a.y);
  const d2 = cross2(b.x - a.x, b.y - a.y, d.x - a.x, d.y - a.y);
  const d3 = cross2(d.x - c.x, d.y - c.y, a.x - c.x, a.y - c.y);
  const d4 = cross2(d.x - c.x, d.y - c.y, b.x - c.x, b.y - c.y);
  return (
    ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
    ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))
  );
}

function normalize(x: number, y: number): { x: number; y: number } | null {
  const len = Math.hypot(x, y);
  if (len < EPS) {
    return null;
  }
  return { x: x / len, y: y / len };
}

/** Reflex test for an outer-ring vertex: triangle centroid (pulled toward the vertex) is
 * **outside** the ring iff the interior angle at the vertex is > 180° (concave as seen from
 * inside the polygon). Hole rings are excluded from this check because their contribution is
 * "subtract the hole", which does not flip an outer-ring vertex's convexity classification.
 */
function isReflexOuterVertex(prev: Point2, curr: Point2, next: Point2, ring: readonly Point2[]): boolean {
  const tx = (prev.x + curr.x + next.x) / 3;
  const ty = (prev.y + curr.y + next.y) / 3;
  const sx = curr.x + (tx - curr.x) * 0.25;
  const sy = curr.y + (ty - curr.y) * 0.25;
  return !pointInPolygon(sx, sy, ring);
}

/**
 * Interior-bisector direction at a ring vertex, oriented so that stepping along it lands
 * inside the walkable region. Returns `null` for degenerate vertices (zero-length incident
 * edge, or both bisector sides outside the walkable region — e.g. a pinched corner where the
 * offset would not fit).
 */
function inwardOffsetDirection(
  prev: Point2,
  curr: Point2,
  next: Point2,
  polygons: readonly WalkablePolygon[],
): { x: number; y: number } | null {
  const toPrev = normalize(prev.x - curr.x, prev.y - curr.y);
  const toNext = normalize(next.x - curr.x, next.y - curr.y);
  if (!toPrev || !toNext) {
    return null;
  }

  let bx = toPrev.x + toNext.x;
  let by = toPrev.y + toNext.y;
  let bisector = normalize(bx, by);
  if (!bisector) {
    // 180° vertex (prev, curr, next collinear): use the perpendicular to the incoming edge as
    // the candidate direction; the sidedness probe below picks the correct side.
    bisector = normalize(-toPrev.y, toPrev.x);
    if (!bisector) {
      return null;
    }
  }

  const probe = CORNER_INWARD_OFFSET_PX + 0.1;
  const plusIn = isPointInWalkableArea(
    curr.x + bisector.x * probe,
    curr.y + bisector.y * probe,
    polygons,
  );
  const minusIn = isPointInWalkableArea(
    curr.x - bisector.x * probe,
    curr.y - bisector.y * probe,
    polygons,
  );
  if (plusIn && !minusIn) {
    return bisector;
  }
  if (minusIn && !plusIn) {
    return { x: -bisector.x, y: -bisector.y };
  }
  return null;
}

function buildGraphNodes(polygons: readonly WalkablePolygon[]): GraphNode[] {
  const nodes: GraphNode[] = [];
  for (const poly of polygons) {
    if (poly.active === false || poly.points.length < 3) {
      continue;
    }
    collectRingNodes(poly.points, poly.points, /* onlyReflex */ true, polygons, nodes);
    for (const h of poly.holes ?? []) {
      if (h.active === false || h.points.length < 3) {
        continue;
      }
      collectRingNodes(h.points, poly.points, /* onlyReflex */ false, polygons, nodes);
    }
  }
  return nodes;
}

function collectRingNodes(
  ring: readonly Point2[],
  outerRingForReflex: readonly Point2[],
  onlyReflex: boolean,
  polygons: readonly WalkablePolygon[],
  out: GraphNode[],
): void {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n]!;
    const curr = ring[i]!;
    const next = ring[(i + 1) % n]!;
    if (onlyReflex && !isReflexOuterVertex(prev, curr, next, outerRingForReflex)) {
      continue;
    }
    const inward = inwardOffsetDirection(prev, curr, next, polygons);
    if (!inward) {
      continue;
    }
    out.push({
      x: curr.x + inward.x * CORNER_INWARD_OFFSET_PX,
      y: curr.y + inward.y * CORNER_INWARD_OFFSET_PX,
    });
  }
}

/**
 * A\* on the visibility graph of {start, goal, …nodes}. Edges exist between pairs of points
 * whose connecting segment is entirely inside the walkable region. Edge cost and heuristic
 * are Euclidean distance (admissible and consistent → optimal).
 */
function aStarPath(
  start: Point2,
  goal: Point2,
  nodes: readonly GraphNode[],
  polygons: readonly WalkablePolygon[],
): Point2[] {
  const N = nodes.length;
  const startIdx = N;
  const goalIdx = N + 1;
  const total = N + 2;

  const pos = (i: number): Point2 => {
    if (i === startIdx) return start;
    if (i === goalIdx) return goal;
    return nodes[i]!;
  };

  const adj: number[][] = Array.from({ length: total }, () => []);
  const edgeDist: number[][] = Array.from({ length: total }, () => []);

  for (let i = 0; i < total; i++) {
    for (let j = i + 1; j < total; j++) {
      const pi = pos(i);
      const pj = pos(j);
      if (!isSegmentInsideWalkable(pi, pj, polygons)) {
        continue;
      }
      const d = Math.hypot(pi.x - pj.x, pi.y - pj.y);
      adj[i]!.push(j);
      adj[j]!.push(i);
      edgeDist[i]!.push(d);
      edgeDist[j]!.push(d);
    }
  }

  const heuristic = (i: number): number => {
    const p = pos(i);
    return Math.hypot(p.x - goal.x, p.y - goal.y);
  };

  const gScore = new Array<number>(total).fill(Infinity);
  const fScore = new Array<number>(total).fill(Infinity);
  const cameFrom = new Array<number>(total).fill(-1);
  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(startIdx);

  // Linear-scan priority queue: graph size is tens of nodes, a real heap would be overkill.
  const open = new Set<number>();
  open.add(startIdx);

  while (open.size > 0) {
    let current = -1;
    let bestF = Infinity;
    for (const i of open) {
      if (fScore[i]! < bestF) {
        bestF = fScore[i]!;
        current = i;
      }
    }
    if (current === -1) {
      break;
    }
    if (current === goalIdx) {
      const out: Point2[] = [];
      let cur = current;
      while (cur !== startIdx) {
        const p = pos(cur);
        out.push({ x: p.x, y: p.y });
        const prev = cameFrom[cur]!;
        if (prev === -1) {
          return [];
        }
        cur = prev;
      }
      return out.reverse();
    }
    open.delete(current);

    const neighbors = adj[current]!;
    const dists = edgeDist[current]!;
    for (let k = 0; k < neighbors.length; k++) {
      const n = neighbors[k]!;
      const tentative = gScore[current]! + dists[k]!;
      if (tentative < gScore[n]!) {
        cameFrom[n] = current;
        gScore[n] = tentative;
        fScore[n] = tentative + heuristic(n);
        open.add(n);
      }
    }
  }

  return [];
}
