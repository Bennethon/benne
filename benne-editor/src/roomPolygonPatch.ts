import * as vscode from 'vscode';
import { enqueueJsonFileWork } from './inspectorJsonDocument';
import { loadRoomData, writeRoomJson } from './inspectorMutations';

export type Point2 = { x: number; y: number };

export type RoomPolygonPatch =
    | { kind: 'walkable'; polygonId: string; points: Point2[]; holeId?: string }
    | {
          kind: 'propCollider';
          propId: string;
          points: Point2[];
          walkToPoint: Point2;
          lookAtPoint: Point2;
          baseline?: number;
          x: number;
          y: number;
      }
    | {
          kind: 'propBaseline';
          propId: string;
          baseline: number;
          x: number;
          y: number;
      }
    | {
          kind: 'hotspotPolygon';
          hotspotId: string;
          points: Point2[];
          walkToPoint: Point2;
          lookAtPoint: Point2;
          baseline?: number;
      }
    | { kind: 'regionPolygon'; regionId: string; points: Point2[] }
    | { kind: 'roomPoint'; pointId: string; x: number; y: number }
    | { kind: 'roomCharacter'; instanceId: string; x: number; y: number }
    | { kind: 'roomSize'; width: number; height: number }
    | { kind: 'scrollBounds'; x: number; y: number; width: number; height: number };

const MIN_POLY_POINTS = 3;

function isPoint2(v: unknown): v is Point2 {
    if (!v || typeof v !== 'object') {
        return false;
    }
    const o = v as Record<string, unknown>;
    return typeof o.x === 'number' && Number.isFinite(o.x) && typeof o.y === 'number' && Number.isFinite(o.y);
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
        const propPatch: RoomPolygonPatch = {
            kind: 'propCollider',
            propId: o.propId,
            points: pts,
            walkToPoint: { x: o.walkToPoint.x, y: o.walkToPoint.y },
            lookAtPoint: { x: o.lookAtPoint.x, y: o.lookAtPoint.y },
            x: typeof o.x === 'number' && Number.isFinite(o.x) ? o.x : 0,
            y: typeof o.y === 'number' && Number.isFinite(o.y) ? o.y : 0,
        };
        if (typeof o.baseline === 'number' && Number.isFinite(o.baseline)) {
            propPatch.baseline = o.baseline;
        }
        return propPatch;
    }
    if (
        o.kind === 'propBaseline' &&
        typeof o.propId === 'string' &&
        typeof o.baseline === 'number' &&
        Number.isFinite(o.baseline)
    ) {
        return {
            kind: 'propBaseline',
            propId: o.propId,
            baseline: o.baseline,
            x: typeof o.x === 'number' && Number.isFinite(o.x) ? o.x : 0,
            y: typeof o.y === 'number' && Number.isFinite(o.y) ? o.y : 0,
        };
    }
    if (o.kind === 'hotspotPolygon' && typeof o.hotspotId === 'string' && Array.isArray(o.points)) {
        const pts = o.points.filter(isPoint2);
        if (pts.length !== o.points.length) {
            return null;
        }
        if (!isPoint2(o.walkToPoint) || !isPoint2(o.lookAtPoint)) {
            return null;
        }
        const hsPatch: RoomPolygonPatch = {
            kind: 'hotspotPolygon',
            hotspotId: o.hotspotId,
            points: pts,
            walkToPoint: { x: o.walkToPoint.x, y: o.walkToPoint.y },
            lookAtPoint: { x: o.lookAtPoint.x, y: o.lookAtPoint.y },
        };
        if (typeof o.baseline === 'number' && Number.isFinite(o.baseline)) {
            hsPatch.baseline = o.baseline;
        }
        return hsPatch;
    }
    if (o.kind === 'regionPolygon' && typeof o.regionId === 'string' && Array.isArray(o.points)) {
        const pts = o.points.filter(isPoint2);
        if (pts.length !== o.points.length) {
            return null;
        }
        return { kind: 'regionPolygon', regionId: o.regionId, points: pts };
    }
    if (
        o.kind === 'roomPoint' &&
        typeof o.pointId === 'string' &&
        typeof o.x === 'number' && Number.isFinite(o.x) &&
        typeof o.y === 'number' && Number.isFinite(o.y)
    ) {
        return { kind: 'roomPoint', pointId: o.pointId, x: o.x, y: o.y };
    }
    if (
        o.kind === 'roomCharacter' &&
        typeof o.instanceId === 'string' &&
        typeof o.x === 'number' && Number.isFinite(o.x) &&
        typeof o.y === 'number' && Number.isFinite(o.y)
    ) {
        return { kind: 'roomCharacter', instanceId: o.instanceId, x: o.x, y: o.y };
    }
    if (
        o.kind === 'roomSize' &&
        typeof o.width === 'number' && Number.isFinite(o.width) &&
        typeof o.height === 'number' && Number.isFinite(o.height)
    ) {
        return { kind: 'roomSize', width: o.width, height: o.height };
    }
    if (
        o.kind === 'scrollBounds' &&
        typeof o.x === 'number' && Number.isFinite(o.x) &&
        typeof o.y === 'number' && Number.isFinite(o.y) &&
        typeof o.width === 'number' && Number.isFinite(o.width) &&
        typeof o.height === 'number' && Number.isFinite(o.height)
    ) {
        return { kind: 'scrollBounds', x: o.x, y: o.y, width: o.width, height: o.height };
    }
    return null;
}

function roundPoint(p: Point2): Point2 {
    return { x: Math.round(p.x), y: Math.round(p.y) };
}

/**
 * Merge a polygon / point / bounds patch into parsed room JSON. Returns the integer-rounded
 * patch so the preview can sync in-memory room data without a full Phaser teardown.
 */
function applyRoomPolygonPatchToData(
    room: Record<string, unknown>,
    patch: RoomPolygonPatch,
): RoomPolygonPatch {
    if (patch.kind === 'roomPoint') {
        const list = room.points;
        if (!Array.isArray(list)) {
            throw new Error('Room JSON has no points array.');
        }
        const row = list.find(
            (p: unknown) => p && typeof p === 'object' && (p as { id?: string }).id === patch.pointId,
        ) as { id: string; x: number; y: number } | undefined;
        if (!row) {
            throw new Error(`Room point "${patch.pointId}" not found.`);
        }
        const xr = Math.round(patch.x);
        const yr = Math.round(patch.y);
        row.x = xr;
        row.y = yr;
        return { kind: 'roomPoint', pointId: patch.pointId, x: xr, y: yr };
    }

    if (patch.kind === 'roomCharacter') {
        const list = room.characters;
        if (!Array.isArray(list)) {
            throw new Error('Room JSON has no characters array.');
        }
        const row = list.find(
            (p: unknown) =>
                p && typeof p === 'object' && (p as { instanceId?: string }).instanceId === patch.instanceId,
        ) as { instanceId: string; x: number; y: number } | undefined;
        if (!row) {
            throw new Error(`Character instance "${patch.instanceId}" not found.`);
        }
        const xr = Math.round(patch.x);
        const yr = Math.round(patch.y);
        row.x = xr;
        row.y = yr;
        return { kind: 'roomCharacter', instanceId: patch.instanceId, x: xr, y: yr };
    }

    if (patch.kind === 'walkable') {
        if (patch.points.length < MIN_POLY_POINTS) {
            throw new Error(`A polygon needs at least ${MIN_POLY_POINTS} points.`);
        }
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
            return {
                kind: 'walkable',
                polygonId: patch.polygonId,
                holeId: patch.holeId,
                points: rounded.map((p) => ({ ...p })),
            };
        }

        poly.points = rounded;
        return { kind: 'walkable', polygonId: patch.polygonId, points: rounded.map((p) => ({ ...p })) };
    }

    if (patch.kind === 'regionPolygon') {
        if (patch.points.length < MIN_POLY_POINTS) {
            throw new Error(`A polygon needs at least ${MIN_POLY_POINTS} points.`);
        }
        const regions = room.regions as { id: string; active?: boolean; points: Point2[] }[] | undefined;
        if (!Array.isArray(regions)) {
            throw new Error('Room JSON has no regions array.');
        }
        const reg = regions.find((r) => r.id === patch.regionId);
        if (!reg) {
            throw new Error(`Region "${patch.regionId}" not found.`);
        }
        const rounded = patch.points.map(roundPoint);
        reg.points = rounded;
        return { kind: 'regionPolygon', regionId: patch.regionId, points: rounded.map((p) => ({ ...p })) };
    }

    if (patch.kind === 'hotspotPolygon') {
        if (patch.points.length < MIN_POLY_POINTS) {
            throw new Error(`A polygon needs at least ${MIN_POLY_POINTS} points.`);
        }
        const hotspots = room.hotspots as
            | {
                  id: string;
                  points?: Point2[];
                  walkToPoint?: Point2;
                  lookAtPoint?: Point2;
              }[]
            | undefined;
        if (!Array.isArray(hotspots)) {
            throw new Error('Room JSON has no hotspots array.');
        }
        const hsRow = hotspots.find((h) => h.id === patch.hotspotId);
        if (!hsRow) {
            throw new Error(`Hotspot "${patch.hotspotId}" not found.`);
        }
        const hs = hsRow as {
            id: string;
            points?: Point2[];
            walkToPoint?: Point2;
            lookAtPoint?: Point2;
            baseline?: number;
        };
        const rounded = patch.points.map(roundPoint);
        hs.points = rounded;
        const w = roundPoint(patch.walkToPoint);
        const l = roundPoint(patch.lookAtPoint);
        hs.walkToPoint = w;
        hs.lookAtPoint = l;
        let baselineOut: number | undefined;
        if (patch.baseline !== undefined && Number.isFinite(patch.baseline)) {
            baselineOut = Math.round(patch.baseline);
            hs.baseline = baselineOut;
        }
        return {
            kind: 'hotspotPolygon',
            hotspotId: patch.hotspotId,
            points: rounded.map((p) => ({ ...p })),
            walkToPoint: { ...w },
            lookAtPoint: { ...l },
            ...(baselineOut !== undefined ? { baseline: baselineOut } : {}),
        };
    }

    if (patch.kind === 'propCollider') {
        if (patch.points.length < MIN_POLY_POINTS) {
            throw new Error(`A polygon needs at least ${MIN_POLY_POINTS} points.`);
        }
        const props = room.props as
            | {
                  id: string;
                  x?: number;
                  y?: number;
                  collider?: { points: Point2[] };
                  walkToPoint?: Point2;
                  lookAtPoint?: Point2;
                  baseline?: number;
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
        const px = Math.round(patch.x);
        const py = Math.round(patch.y);
        prop.x = px;
        prop.y = py;
        let propBaselineOut: number | undefined;
        if (patch.baseline !== undefined && Number.isFinite(patch.baseline)) {
            propBaselineOut = Math.round(patch.baseline);
            prop.baseline = propBaselineOut;
        }
        return {
            kind: 'propCollider',
            propId: patch.propId,
            points: rounded.map((p) => ({ ...p })),
            walkToPoint: { ...w },
            lookAtPoint: { ...l },
            x: px,
            y: py,
            ...(propBaselineOut !== undefined ? { baseline: propBaselineOut } : {}),
        };
    }

    if (patch.kind === 'propBaseline') {
        const props = room.props as { id: string; baseline?: number; x?: number; y?: number }[] | undefined;
        if (!Array.isArray(props)) {
            throw new Error('Room JSON has no props array.');
        }
        const prop = props.find((p) => p.id === patch.propId);
        if (!prop) {
            throw new Error(`Prop "${patch.propId}" not found.`);
        }
        const baselineOut = Math.round(patch.baseline);
        const px = Math.round(patch.x);
        const py = Math.round(patch.y);
        prop.baseline = baselineOut;
        prop.x = px;
        prop.y = py;
        return { kind: 'propBaseline', propId: patch.propId, baseline: baselineOut, x: px, y: py };
    }

    if (patch.kind === 'roomSize') {
        const w = Math.max(1, Math.round(patch.width));
        const h = Math.max(1, Math.round(patch.height));
        room.size = { width: w, height: h };
        return { kind: 'roomSize', width: w, height: h };
    }

    if (patch.kind === 'scrollBounds') {
        const x = Math.round(patch.x);
        const y = Math.round(patch.y);
        const w = Math.max(1, Math.round(patch.width));
        const h = Math.max(1, Math.round(patch.height));
        room.scrollBounds = { x, y, width: w, height: h };
        return { kind: 'scrollBounds', x, y, width: w, height: h };
    }

    const _never: never = patch;
    void _never;
    throw new Error('Unsupported polygon patch.');
}

/**
 * Writes a polygon / point / bounds patch into `*.room.json`.
 *
 * Uses the same disk-then-sync-open-tab path as the Inspector (`writeRoomJson`) so an open JSON
 * editor cannot flash new geometry and then be overwritten by a stale buffer or blur-save.
 */
export async function applyRoomPolygonPatch(uri: vscode.Uri, patch: RoomPolygonPatch): Promise<RoomPolygonPatch> {
    return enqueueJsonFileWork(uri, async () => {
        const data = await loadRoomData(uri);
        if (!data) {
            throw new Error('Could not parse room JSON.');
        }
        const applied = applyRoomPolygonPatchToData(data, patch);
        await writeRoomJson(uri, data);
        return applied;
    });
}
