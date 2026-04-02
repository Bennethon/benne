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
