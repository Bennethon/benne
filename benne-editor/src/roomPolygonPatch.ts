import * as vscode from 'vscode';

export type Point2 = { x: number; y: number };

export type RoomPolygonPatch =
    | { kind: 'walkable'; polygonId: string; points: Point2[]; holeId?: string }
    | {
          kind: 'propCollider';
          propId: string;
          points: Point2[];
          walkToPoint: Point2;
          lookAtPoint: Point2;
      };

const MIN_POINTS = 3;

function isPoint2(v: unknown): v is Point2 {
    if (!v || typeof v !== 'object') {
        return false;
    }
    const o = v as Record<string, unknown>;
    return typeof o.x === 'number' && typeof o.y === 'number';
}

/** Validate and narrow a message body from the webview. */
export function parseRoomPolygonPatch(body: unknown): RoomPolygonPatch | null {
    if (!body || typeof body !== 'object') {
        return null;
    }
    const o = body as Record<string, unknown>;
    if (o.kind === 'walkable' && typeof o.polygonId === 'string' && Array.isArray(o.points)) {
        const pts = o.points.filter(isPoint2);
        if (pts.length !== o.points.length) {
            return null;
        }
        const holeId = typeof o.holeId === 'string' && o.holeId.length > 0 ? o.holeId : undefined;
        if (holeId) {
            return { kind: 'walkable', polygonId: o.polygonId, holeId, points: pts };
        }
        return { kind: 'walkable', polygonId: o.polygonId, points: pts };
    }
    if (o.kind === 'propCollider' && typeof o.propId === 'string' && Array.isArray(o.points)) {
        const pts = o.points.filter(isPoint2);
        if (pts.length !== o.points.length) {
            return null;
        }
        if (!isPoint2(o.walkToPoint) || !isPoint2(o.lookAtPoint)) {
            return null;
        }
        return {
            kind: 'propCollider',
            propId: o.propId,
            points: pts,
            walkToPoint: { x: o.walkToPoint.x, y: o.walkToPoint.y },
            lookAtPoint: { x: o.lookAtPoint.x, y: o.lookAtPoint.y },
        };
    }
    return null;
}

function roundPoint(p: Point2): Point2 {
    return { x: Math.round(p.x), y: Math.round(p.y) };
}

/**
 * Apply a polygon patch to `*.room.json` on disk (Option A: merge into parsed JSON, rewrite file).
 * Returns the patch with integer-rounded points (same values written to disk) so the preview can
 * sync in-memory room data without a full Phaser teardown.
 */
export async function applyRoomPolygonPatch(uri: vscode.Uri, patch: RoomPolygonPatch): Promise<RoomPolygonPatch> {
    if (patch.points.length < MIN_POINTS) {
        throw new Error(`A polygon needs at least ${MIN_POINTS} points.`);
    }

    const raw = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(raw).toString('utf8');
    const room = JSON.parse(text) as Record<string, unknown>;

    if (patch.kind === 'walkable') {
        type HoleRow = { id: string; active?: boolean; points: Point2[] };
        type PolyRow = { id: string; active?: boolean; points: Point2[]; holes?: HoleRow[] };
        const walkable = room.walkable as { polygons?: PolyRow[] } | undefined;
        const polys = walkable?.polygons;
        if (!Array.isArray(polys)) {
            throw new Error('Room JSON has no walkable.polygons array.');
        }
        const poly = polys.find((p) => p.id === patch.polygonId);
        if (!poly) {
            throw new Error(`Walkable polygon "${patch.polygonId}" not found.`);
        }
        const rounded = patch.points.map(roundPoint);
        const outPayload = (): RoomPolygonPatch => {
            if (patch.holeId) {
                return {
                    kind: 'walkable',
                    polygonId: patch.polygonId,
                    holeId: patch.holeId,
                    points: rounded.map((p) => ({ ...p })),
                };
            }
            return { kind: 'walkable', polygonId: patch.polygonId, points: rounded.map((p) => ({ ...p })) };
        };

        if (patch.holeId) {
            if (!poly.holes) {
                poly.holes = [];
            }
            let hole = poly.holes.find((h) => h.id === patch.holeId);
            if (!hole) {
                hole = { id: patch.holeId, active: true, points: rounded };
                poly.holes.push(hole);
            } else {
                hole.points = rounded;
            }
            const out = `${JSON.stringify(room, null, 2)}\n`;
            await vscode.workspace.fs.writeFile(uri, Buffer.from(out, 'utf8'));
            return outPayload();
        }

        poly.points = rounded;
        const out = `${JSON.stringify(room, null, 2)}\n`;
        await vscode.workspace.fs.writeFile(uri, Buffer.from(out, 'utf8'));
        return outPayload();
    }

    const props = room.props as
        | {
              id: string;
              collider?: { points: Point2[] };
              walkToPoint?: Point2;
              lookAtPoint?: Point2;
          }[]
        | undefined;
    if (!Array.isArray(props)) {
        throw new Error('Room JSON has no props array.');
    }
    const prop = props.find((p) => p.id === patch.propId);
    if (!prop) {
        throw new Error(`Prop "${patch.propId}" not found.`);
    }
    if (!prop.collider) {
        prop.collider = { points: [] };
    }
    const rounded = patch.points.map(roundPoint);
    prop.collider.points = rounded;
    const w = roundPoint(patch.walkToPoint);
    const l = roundPoint(patch.lookAtPoint);
    prop.walkToPoint = w;
    prop.lookAtPoint = l;
    const out = `${JSON.stringify(room, null, 2)}\n`;
    await vscode.workspace.fs.writeFile(uri, Buffer.from(out, 'utf8'));
    return {
        kind: 'propCollider',
        propId: patch.propId,
        points: rounded.map((p) => ({ ...p })),
        walkToPoint: { ...w },
        lookAtPoint: { ...l },
    };
}
