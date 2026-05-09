import type { RoomRegionData, WalkablePolygon } from '../types/room';

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

  if (inOuter) {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const h of poly.holes ?? []) {
      if (!isActive(h.active) || h.points.length < 3) {
        continue;
      }
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
/** Intersection point of lines P1→P2 and P3→P4, or null if parallel. */
function lineLineIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): { x: number; y: number } | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}

/**
 * Clips `subject` to the interior of `clip` using Sutherland–Hodgman.
 * Handles both CW and CCW winding for `clip` (determined from signed area).
 * Returns `[]` when there is no intersection.
 */
function clipToPolygon(
  subject: readonly { x: number; y: number }[],
  clip: readonly { x: number; y: number }[],
): { x: number; y: number }[] {
  if (clip.length < 3 || subject.length < 3) return [];
  let area = 0;
  for (let i = 0, n = clip.length; i < n; i++) {
    const a = clip[i]!;
    const b = clip[(i + 1) % n]!;
    area += a.x * b.y - b.x * a.y;
  }
  if (area === 0) return [];
  const negArea = area < 0;

  let output = subject.slice() as { x: number; y: number }[];
  for (let i = 0, n = clip.length; i < n && output.length > 0; i++) {
    const a = clip[i]!;
    const b = clip[(i + 1) % n]!;
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const curr = input[j]!;
      const prev = input[(j - 1 + input.length) % input.length]!;
      const xc = (b.x - a.x) * (curr.y - a.y) - (b.y - a.y) * (curr.x - a.x);
      const xp = (b.x - a.x) * (prev.y - a.y) - (b.y - a.y) * (prev.x - a.x);
      const currIn = negArea ? xc <= 0 : xc >= 0;
      const prevIn = negArea ? xp <= 0 : xp >= 0;
      if (currIn) {
        if (!prevIn) {
          const isect = lineLineIntersect(prev, curr, a, b);
          if (isect) output.push(isect);
        }
        output.push(curr);
      } else if (prevIn) {
        const isect = lineLineIntersect(prev, curr, a, b);
        if (isect) output.push(isect);
      }
    }
  }
  return output;
}

/**
 * Returns the walkable polygons with any active `walkable: false` regions injected as synthetic
 * holes. Each region is clipped to the walkable polygon's outer ring first so hole vertices
 * always lie on the walkable boundary — giving the pathfinder valid corner nodes to route around.
 *
 * Returns the original array unchanged when no blocking regions exist (no allocation).
 */
export function withNonWalkableRegionsAsHoles(
  polygons: readonly WalkablePolygon[],
  regions: readonly RoomRegionData[] | undefined,
): readonly WalkablePolygon[] {
  const blocking = (regions ?? []).filter(
    (r) => r.active !== false && r.walkable === false && r.points.length >= 3,
  );
  if (blocking.length === 0) {
    return polygons;
  }
  return polygons.map((poly) => {
    if (!isActive(poly.active) || poly.points.length < 3) {
      return poly;
    }
    const added: { id: string; points: { x: number; y: number }[] }[] = [];
    for (const r of blocking) {
      const clipped = clipToPolygon(r.points, poly.points);
      if (clipped.length >= 3) {
        added.push({ id: r.id, points: clipped });
      }
    }
    if (added.length === 0) {
      return poly;
    }
    return { ...poly, holes: [...(poly.holes ?? []), ...added] };
  });
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
