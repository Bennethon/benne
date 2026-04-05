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
      };
