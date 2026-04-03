import type { WalkablePolygon } from '../types/room';

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

export function isPointInWalkableArea(
  x: number,
  y: number,
  polygons: readonly WalkablePolygon[],
): boolean {
  for (const poly of polygons) {
    if (pointInPolygon(x, y, poly.points)) {
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

  let bestX = 0;
  let bestY = 0;
  let bestD = Infinity;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % n]!;
    const q = closestPointOnSegment(px, py, a.x, a.y, b.x, b.y);
    const dx = px - q.x;
    const dy = py - q.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      bestX = q.x;
      bestY = q.y;
    }
  }
  return { x: bestX, y: bestY };
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
    const c = closestPointInFilledPolygon(px, py, poly.points);
    if (!c) {
      continue;
    }
    const dx = px - c.x;
    const dy = py - c.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/**
 * Resolves a walk target from a screen click in a forgiving, “classic adventure” way:
 *
 * - If the click lies inside any walkable polygon, the target is the click.
 * - Otherwise the target is the **closest point inside the walkable union** to the click
 *   (per polygon: inside → click; outside → closest point on that polygon’s edges; then take
 *   the candidate nearest to the click). This pulls off-screen or “past the edge” clicks onto
 *   the nearest reachable spot so the character slides along the boundary toward intent instead
 *   of refusing to move.
 *
 * `playerX` / `playerY` are only used to ensure the character is currently on walkable ground;
 * destination resolution is driven by the click.
 *
 * @returns `null` if the player is not inside any walkable polygon, or if there is no usable
 *          polygon geometry (e.g. all regions have fewer than three vertices).
 */
export function clampWalkDestinationTowardClick(
  playerX: number,
  playerY: number,
  clickX: number,
  clickY: number,
  polygons: readonly WalkablePolygon[],
): { x: number; y: number } | null {
  if (!isPointInWalkableArea(playerX, playerY, polygons)) {
    return null;
  }

  if (isPointInWalkableArea(clickX, clickY, polygons)) {
    return { x: clickX, y: clickY };
  }

  return closestPointInWalkableUnion(clickX, clickY, polygons);
}
