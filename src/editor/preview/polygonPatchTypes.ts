export type Point2 = { x: number; y: number };

/** Serialized to the VS Code extension as Option A patch payloads. */
export type RoomPolygonPatch =
    | { kind: 'walkable'; polygonId: string; points: Point2[]; holeId?: string }
    | {
          kind: 'propCollider';
          propId: string;
          points: Point2[];
          walkToPoint: Point2;
          lookAtPoint: Point2;
          /** Room-space Y; omit to leave JSON `baseline` unchanged on save. */
          baseline?: number;
      }
    | {
          /** Baseline-only save for non-clickable props (no collider / walk / look). */
          kind: 'propBaseline';
          propId: string;
          baseline: number;
      }
    | {
          kind: 'hotspotPolygon';
          hotspotId: string;
          points: Point2[];
          walkToPoint: Point2;
          lookAtPoint: Point2;
          /** Room-space Y; omit to leave JSON `baseline` unchanged on save. */
          baseline?: number;
      }
    | { kind: 'regionPolygon'; regionId: string; points: Point2[] }
    | { kind: 'roomPoint'; pointId: string; x: number; y: number }
    | { kind: 'roomSize'; width: number; height: number }
    | { kind: 'scrollBounds'; x: number; y: number; width: number; height: number };
