import * as vscode from 'vscode';

export type Point2 = { x: number; y: number };

export type RoomPolygonPatch =
    | { kind: 'walkable'; polygonId: string; points: Point2[] }
    | { kind: 'propCollider'; propId: string; points: Point2[] };

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
        return { kind: 'walkable', polygonId: o.polygonId, points: pts };
    }
    if (o.kind === 'propCollider' && typeof o.propId === 'string' && Array.isArray(o.points)) {
        const pts = o.points.filter(isPoint2);
        if (pts.length !== o.points.length) {
            return null;
        }
        return { kind: 'propCollider', propId: o.propId, points: pts };
    }
    return null;
}

function roundPoint(p: Point2): Point2 {
    return { x: Math.round(p.x), y: Math.round(p.y) };
}

/**
 * Apply a polygon patch to `*.room.json` on disk (Option A: merge into parsed JSON, rewrite file).
 */
export async function applyRoomPolygonPatch(uri: vscode.Uri, patch: RoomPolygonPatch): Promise<void> {
    if (patch.points.length < MIN_POINTS) {
        throw new Error(`A polygon needs at least ${MIN_POINTS} points.`);
    }

    const raw = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(raw).toString('utf8');
    const room = JSON.parse(text) as Record<string, unknown>;

    if (patch.kind === 'walkable') {
        const walkable = room.walkable as { polygons?: { id: string; points: Point2[] }[] } | undefined;
        const polys = walkable?.polygons;
        if (!Array.isArray(polys)) {
            throw new Error('Room JSON has no walkable.polygons array.');
        }
        const poly = polys.find((p) => p.id === patch.polygonId);
        if (!poly) {
            throw new Error(`Walkable polygon "${patch.polygonId}" not found.`);
        }
        poly.points = patch.points.map(roundPoint);
    } else {
        const props = room.props as { id: string; collider?: { points: Point2[] } }[] | undefined;
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
        prop.collider.points = patch.points.map(roundPoint);
    }

    const out = `${JSON.stringify(room, null, 2)}\n`;
    await vscode.workspace.fs.writeFile(uri, Buffer.from(out, 'utf8'));
}
