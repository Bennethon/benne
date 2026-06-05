import type { Point2, RoomRegionData, WalkableHole, WalkablePolygon } from '../types/room';

const EPS = 1e-6;
const CLAMP_BOUNDARY_INSET_PX = 0.01;
const CLAMP_WALKABLE_SIDE_INSET_PX = 0.25;

/**
 * Ray-casting point-in-polygon test. Vertices are in room/world space (game pixels).
 */
export function pointInPolygon(
  px: number,
  py: number,
  vertices: readonly { x: number; y: number }[],
): boolean {
  if (vertices.length < 3) {
    return false;
  }

  let inside = false;
  for (let i = 0, len = vertices.length, j = len - 1; i < len; j = i++) {
    const vi = vertices[i]!;
    const vj = vertices[j]!;
    const yi = vi.y;
    const yj = vj.y;
    if ((yi > py) !== (yj > py)) {
      const xIntersect = ((vj.x - vi.x) * (py - yi)) / (yj - yi) + vi.x;
      if (px < xIntersect) {
        inside = !inside;
      }
    }
  }
  return inside;
}

function isActive(active: boolean | undefined): boolean {
  return active !== false;
}

function almostSamePoint(a: Point2, b: Point2): boolean {
  return distSq(a.x, a.y, b.x, b.y) <= EPS * EPS;
}

function isPointOnSegment(px: number, py: number, a: Point2, b: Point2): boolean {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = px - a.x;
  const apy = py - a.y;
  const cross = abx * apy - aby * apx;
  if (Math.abs(cross) > EPS) {
    return false;
  }
  const dot = apx * abx + apy * aby;
  if (dot < -EPS) {
    return false;
  }
  const lenSq = abx * abx + aby * aby;
  return dot <= lenSq + EPS;
}

function pointOnPolygonBoundary(
  px: number,
  py: number,
  vertices: readonly Point2[],
): boolean {
  for (let i = 0, n = vertices.length; i < n; i++) {
    if (isPointOnSegment(px, py, vertices[i]!, vertices[(i + 1) % n]!)) {
      return true;
    }
  }
  return false;
}

function pointInOrOnPolygon(px: number, py: number, vertices: readonly Point2[]): boolean {
  return pointInPolygon(px, py, vertices) || pointOnPolygonBoundary(px, py, vertices);
}

/**
 * True when the point lies in the polygon’s outer ring and not inside any **active** hole.
 * Inactive polygons and inactive holes are ignored for subtraction.
 */
export function isPointInWalkablePolygon(
  x: number,
  y: number,
  poly: WalkablePolygon,
): boolean {
  if (!isActive(poly.active)) {
    return false;
  }
  if (!pointInPolygon(x, y, poly.points)) {
    return false;
  }
  for (const h of poly.holes ?? []) {
    if (!isActive(h.active) || h.points.length < 3) {
      continue;
    }
    if (pointInPolygon(x, y, h.points)) {
      return false;
    }
  }
  return true;
}

export function isPointInWalkableArea(
  x: number,
  y: number,
  polygons: readonly WalkablePolygon[],
): boolean {
  for (const poly of polygons) {
    if (isPointInWalkablePolygon(x, y, poly)) {
      return true;
    }
  }
  return false;
}

/** Closest point on segment AB to P (clamped). If A and B coincide, returns A. */
function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { x: number; y: number } {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq < 1e-18) {
    return { x: ax, y: ay };
  }
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + abx * t, y: ay + aby * t };
}

function distSq(px: number, py: number, qx: number, qy: number): number {
  const dx = px - qx;
  const dy = py - qy;
  return dx * dx + dy * dy;
}

/** Closest point on the closed polygon boundary (edges only). */
function closestPointOnPolygonBoundary(
  px: number,
  py: number,
  vertices: readonly { x: number; y: number }[],
): { x: number; y: number } | null {
  if (vertices.length < 3) {
    return null;
  }
  let bestX = 0;
  let bestY = 0;
  let bestD = Infinity;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % n]!;
    const q = closestPointOnSegment(px, py, a.x, a.y, b.x, b.y);
    const d = distSq(px, py, q.x, q.y);
    if (d < bestD) {
      bestD = d;
      bestX = q.x;
      bestY = q.y;
    }
  }
  return { x: bestX, y: bestY };
}

function activeHoles(poly: WalkablePolygon): WalkableHole[] {
  return (poly.holes ?? []).filter((h) => isActive(h.active) && h.points.length >= 3);
}

function isPointBlockedByAnyHole(
  px: number,
  py: number,
  holes: readonly WalkableHole[],
  exceptHole?: WalkableHole,
): boolean {
  for (const h of holes) {
    if (h === exceptHole) {
      continue;
    }
    if (pointInOrOnPolygon(px, py, h.points)) {
      return true;
    }
  }
  return false;
}

function pushUniqueNumber(out: number[], value: number): void {
  const clamped = Math.max(0, Math.min(1, value));
  if (!out.some((n) => Math.abs(n - clamped) <= EPS)) {
    out.push(clamped);
  }
}

function pushUniquePoint(out: Point2[], point: Point2): void {
  if (!out.some((p) => almostSamePoint(p, point))) {
    out.push(point);
  }
}

function segmentIntersection(
  a: Point2,
  b: Point2,
  c: Point2,
  d: Point2,
): { x: number; y: number; t: number; u: number } | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) <= EPS) {
    return null;
  }
  const qpx = c.x - a.x;
  const qpy = c.y - a.y;
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * ry - qpy * rx) / denom;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) {
    return null;
  }
  const tc = Math.max(0, Math.min(1, t));
  return { x: a.x + rx * tc, y: a.y + ry * tc, t: tc, u: Math.max(0, Math.min(1, u)) };
}

function collectIntersectionTs(
  edgeA: Point2,
  edgeB: Point2,
  rings: readonly (readonly Point2[])[],
): number[] {
  const ts = [0, 1];
  const ex = edgeB.x - edgeA.x;
  const ey = edgeB.y - edgeA.y;
  const edgeLenSq = ex * ex + ey * ey;
  for (const ring of rings) {
    for (let i = 0, n = ring.length; i < n; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % n]!;
      const hit = segmentIntersection(edgeA, edgeB, a, b);
      if (hit) {
        pushUniqueNumber(ts, hit.t);
      }
      if (edgeLenSq > EPS && isPointOnSegment(a.x, a.y, edgeA, edgeB)) {
        pushUniqueNumber(ts, ((a.x - edgeA.x) * ex + (a.y - edgeA.y) * ey) / edgeLenSq);
      }
      if (edgeLenSq > EPS && isPointOnSegment(b.x, b.y, edgeA, edgeB)) {
        pushUniqueNumber(ts, ((b.x - edgeA.x) * ex + (b.y - edgeA.y) * ey) / edgeLenSq);
      }
    }
  }
  return ts.sort((a, b) => a - b);
}

function pointAtT(a: Point2, b: Point2, t: number): Point2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

interface BoundaryCandidate extends Point2 {
  readonly edgeA: Point2;
  readonly edgeB: Point2;
}

function insetIntervalT(a: Point2, b: Point2, lo: number, hi: number, t: number): number {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len <= EPS) {
    return t;
  }
  const insetT = Math.min(CLAMP_BOUNDARY_INSET_PX / len, Math.max(0, (hi - lo) / 3));
  return Math.max(lo + insetT, Math.min(hi - insetT, t));
}

function closestPointOnAllowedBoundary(
  px: number,
  py: number,
  boundary: readonly Point2[],
  splitRings: readonly (readonly Point2[])[],
  isAllowedMidpoint: (mid: Point2) => boolean,
): BoundaryCandidate | null {
  let best: BoundaryCandidate | null = null;
  let bestD = Infinity;
  for (let i = 0, n = boundary.length; i < n; i++) {
    const a = boundary[i]!;
    const b = boundary[(i + 1) % n]!;
    const ts = collectIntersectionTs(a, b, splitRings);
    for (let j = 0; j + 1 < ts.length; j++) {
      const lo = ts[j]!;
      const hi = ts[j + 1]!;
      if (hi - lo <= EPS) {
        continue;
      }
      const mid = pointAtT(a, b, (lo + hi) / 2);
      if (!isAllowedMidpoint(mid)) {
        continue;
      }
      const q = closestPointOnSegment(px, py, a.x, a.y, b.x, b.y);
      const edgeLenSq = distSq(a.x, a.y, b.x, b.y);
      const rawT =
        edgeLenSq <= EPS
          ? lo
          : ((q.x - a.x) * (b.x - a.x) + (q.y - a.y) * (b.y - a.y)) / edgeLenSq;
      const t = insetIntervalT(a, b, lo, hi, rawT);
      const candidate = pointAtT(a, b, t);
      const d = distSq(px, py, candidate.x, candidate.y);
      if (d < bestD) {
        bestD = d;
        best = { ...candidate, edgeA: a, edgeB: b };
      }
    }
  }
  return best;
}

function nudgeBoundaryCandidateIntoWalkable(
  candidate: BoundaryCandidate | null,
  poly: WalkablePolygon,
): Point2 | null {
  if (!candidate) {
    return null;
  }
  if (isPointInWalkablePolygon(candidate.x, candidate.y, poly)) {
    return { x: candidate.x, y: candidate.y };
  }
  const dx = candidate.edgeB.x - candidate.edgeA.x;
  const dy = candidate.edgeB.y - candidate.edgeA.y;
  const len = Math.hypot(dx, dy);
  if (len <= EPS) {
    return null;
  }
  const nx = -dy / len;
  const ny = dx / len;
  const plus = {
    x: candidate.x + nx * CLAMP_WALKABLE_SIDE_INSET_PX,
    y: candidate.y + ny * CLAMP_WALKABLE_SIDE_INSET_PX,
  };
  if (isPointInWalkablePolygon(plus.x, plus.y, poly)) {
    return plus;
  }
  const minus = {
    x: candidate.x - nx * CLAMP_WALKABLE_SIDE_INSET_PX,
    y: candidate.y - ny * CLAMP_WALKABLE_SIDE_INSET_PX,
  };
  if (isPointInWalkablePolygon(minus.x, minus.y, poly)) {
    return minus;
  }
  return null;
}

/**
 * Closest point in a filled simple polygon (interior ∪ boundary) to P.
 * If P is inside, returns P; otherwise the closest point lies on an edge.
 */
function closestPointInFilledPolygon(
  px: number,
  py: number,
  vertices: readonly { x: number; y: number }[],
): { x: number; y: number } | null {
  if (vertices.length < 3) {
    return null;
  }

  if (pointInPolygon(px, py, vertices)) {
    return { x: px, y: py };
  }

  return closestPointOnPolygonBoundary(px, py, vertices);
}

/**
 * Closest point in one walkable polygon’s outer ring minus active holes.
 */
function closestPointInWalkablePolygonRegion(
  px: number,
  py: number,
  poly: WalkablePolygon,
): { x: number; y: number } | null {
  if (!isActive(poly.active) || poly.points.length < 3) {
    return null;
  }

  if (isPointInWalkablePolygon(px, py, poly)) {
    return { x: px, y: py };
  }

  const inOuter = pointInPolygon(px, py, poly.points);
  const holes = activeHoles(poly);

  if (holes.length === 0) {
    return closestPointInFilledPolygon(px, py, poly.points);
  }

  const holeRings = holes.map((h) => h.points);
  const outerCandidate = closestPointOnAllowedBoundary(px, py, poly.points, holeRings, (mid) => {
    return !isPointBlockedByAnyHole(mid.x, mid.y, holes);
  });
  const outerPoint = nudgeBoundaryCandidateIntoWalkable(outerCandidate, poly);

  if (!inOuter) {
    return outerPoint ?? closestPointOnPolygonBoundary(px, py, poly.points);
  }

  let best = outerPoint;
  let bestD = best ? distSq(px, py, best.x, best.y) : Infinity;

  for (const h of holes) {
    if (!pointInPolygon(px, py, h.points)) {
      continue;
    }
    const candidate = nudgeBoundaryCandidateIntoWalkable(
      closestPointOnAllowedBoundary(
        px,
        py,
        h.points,
        [poly.points, ...holeRings.filter((ring) => ring !== h.points)],
        (mid) =>
          pointInOrOnPolygon(mid.x, mid.y, poly.points) &&
          !isPointBlockedByAnyHole(mid.x, mid.y, holes, h),
      ),
      poly,
    );
    if (!candidate) {
      continue;
    }
    const d = distSq(px, py, candidate.x, candidate.y);
    if (d < bestD) {
      bestD = d;
      best = candidate;
    }
  }

  if (best) {
    return best;
  }

  if (inOuter) {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const h of holes) {
      if (!pointInPolygon(px, py, h.points)) {
        continue;
      }
      const b = closestPointOnPolygonBoundary(px, py, h.points);
      if (!b) {
        continue;
      }
      const d = distSq(px, py, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (best) {
      return best;
    }
    return closestPointOnPolygonBoundary(px, py, poly.points);
  }

  return closestPointInFilledPolygon(px, py, poly.points);
}

/**
 * Closest point in the union of walkable polygons to P.
 * Picks the best candidate per polygon, then the smallest distance.
 *
 * **Limitation:** For overlapping polygons, the true closest point in the union can differ
 * from “best per polygon then min” in pathological overlaps; disjoint regions (typical rooms)
 * behave correctly.
 */
function closestPointInWalkableUnion(
  px: number,
  py: number,
  polygons: readonly WalkablePolygon[],
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const poly of polygons) {
    const c = closestPointInWalkablePolygonRegion(px, py, poly);
    if (!c) {
      continue;
    }
    const d = distSq(px, py, c.x, c.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/**
 * Resolves a walk target from a screen click in a forgiving, “classic adventure” way.
 *
 * **Intent (where the player wants to go on the floor mesh):**
 * - If the click lies inside any walkable polygon, the target is the click.
 * - Otherwise the target is the **closest point in the walkable union** to the click
 *   (per polygon: inside → click; outside → closest point on edges; then pick the nearest).
 *
 * **Starting position:**
 * - If the character is **inside** walkable, that intent point is the tween destination (always
 *   on or inside the mesh).
 * - If the character is **outside** walkable (e.g. spawn or cutscene placement), they still get
 *   the same intent target and may move in a straight line across non-walkable space until they
 *   reach the floor; once inside, later clicks keep using this mesh-aware resolution.
 *
 * `playerX` / `playerY` are the player’s **feet** in room space (see `CharacterData.feet`); kept for
 * a stable call signature — the current resolver ignores them but callers pass feet for future rules.
 *
 * @returns `null` only if there is no usable polygon geometry (e.g. all regions have fewer than
 *          three vertices).
 */
function clipBlockerToOuter(
  blocker: readonly Point2[],
  outer: readonly Point2[],
): Point2[] {
  if (outer.length < 3 || blocker.length < 3) {
    return [];
  }

  const points: Point2[] = [];
  let allBlockerVerticesInsideOuter = true;
  let hasOuterVertexInsideBlocker = false;
  let hasEdgeIntersection = false;
  for (const p of blocker) {
    if (pointInOrOnPolygon(p.x, p.y, outer)) {
      pushUniquePoint(points, { x: p.x, y: p.y });
    } else {
      allBlockerVerticesInsideOuter = false;
    }
  }
  for (const p of outer) {
    if (pointInOrOnPolygon(p.x, p.y, blocker)) {
      hasOuterVertexInsideBlocker = true;
      pushUniquePoint(points, { x: p.x, y: p.y });
    }
  }
  for (let i = 0, n = blocker.length; i < n; i++) {
    const a = blocker[i]!;
    const b = blocker[(i + 1) % n]!;
    for (let j = 0, m = outer.length; j < m; j++) {
      const c = outer[j]!;
      const d = outer[(j + 1) % m]!;
      const hit = segmentIntersection(a, b, c, d);
      if (hit) {
        hasEdgeIntersection = true;
        pushUniquePoint(points, { x: hit.x, y: hit.y });
      }
    }
  }

  if (allBlockerVerticesInsideOuter && !hasOuterVertexInsideBlocker && !hasEdgeIntersection) {
    return blocker.map((p) => ({ x: p.x, y: p.y }));
  }

  if (points.length < 3) {
    return [];
  }

  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return points
    .slice()
    .sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

function normalizeWalkablePolygonBlockers(
  poly: WalkablePolygon,
  extraBlockers: readonly { id: string; active?: boolean; points: Point2[] }[],
): WalkablePolygon {
  if (!isActive(poly.active) || poly.points.length < 3) {
    return poly;
  }

  const holes: WalkableHole[] = [];
  let changed = false;
  for (const h of poly.holes ?? []) {
    if (!isActive(h.active) || h.points.length < 3) {
      holes.push(h);
      continue;
    }
    const clipped = clipBlockerToOuter(h.points, poly.points);
    if (clipped.length >= 3) {
      holes.push({ ...h, points: clipped });
      changed ||= clipped.length !== h.points.length || clipped.some((p, i) => !almostSamePoint(p, h.points[i]!));
    } else {
      changed = true;
    }
  }

  for (const blocker of extraBlockers) {
    if (!isActive(blocker.active) || blocker.points.length < 3) {
      continue;
    }
    const clipped = clipBlockerToOuter(blocker.points, poly.points);
    if (clipped.length >= 3) {
      holes.push({ id: blocker.id, points: clipped });
      changed = true;
    }
  }

  if (!changed) {
    return poly;
  }
  return { ...poly, holes };
}

/**
 * Returns the walkable polygons with active authored holes and `walkable: false` regions clipped
 * to their owning walkable polygon. Boundary-overlapping blockers then subtract only the portion
 * that can actually overlap the walk mesh, and the pathfinder gets valid boundary corner nodes.
 *
 * Returns the original array unchanged when the effective blocker geometry is unchanged.
 */
export function withNonWalkableRegionsAsHoles(
  polygons: readonly WalkablePolygon[],
  regions: readonly RoomRegionData[] | undefined,
): readonly WalkablePolygon[] {
  const blocking = (regions ?? []).filter(
    (r) => r.active !== false && r.walkable === false && r.points.length >= 3,
  );
  let changed = false;
  const normalized = polygons.map((poly) => {
    const next = normalizeWalkablePolygonBlockers(poly, blocking);
    if (next !== poly) {
      changed = true;
    }
    return next;
  });
  return changed ? normalized : polygons;
}

export function clampWalkDestinationTowardClick(
  playerX: number,
  playerY: number,
  clickX: number,
  clickY: number,
  polygons: readonly WalkablePolygon[],
): { x: number; y: number } | null {
  void playerX;
  void playerY;

  if (isPointInWalkableArea(clickX, clickY, polygons)) {
    return { x: clickX, y: clickY };
  }

  return closestPointInWalkableUnion(clickX, clickY, polygons);
}
