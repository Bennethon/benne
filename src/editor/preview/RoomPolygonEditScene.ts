import * as Phaser from 'phaser';
import { getInternalHeight, getInternalWidth, SCENE_ROOM } from '../../game/constants';
import type {
    Point2,
    RoomData,
    RoomHotspotData,
    RoomPointData,
    RoomPropInstance,
    RoomRegionData,
} from '../../types/room';
import { polygonEditBridge } from './polygonEditBridge';
import { PreviewPolygonOverlay } from './previewPolygonOverlay';
import type { RoomPolygonPatch } from './polygonPatchTypes';

export const BENNE_POLYGON_EDIT_SCENE = 'BennePolygonEdit';

/** Handle hit radius in CSS pixels (overlay is high-DPI; this stays comfortable on screen). */
const HANDLE_R_CSS = 6;
/** Walk / look markers: slightly larger for picking. */
const AUX_HANDLE_R_CSS = 7;
const EDGE_HIT_CSS = 14;
const LINE_WIDTH_CSS = 2;
const MIN_POINTS = 3;

const COL_WALK = 0x44eedd;
/** Walkable hole ring (distinct from outer mesh). */
const COL_WALK_HOLE = 0xffaa66;
const COL_PROP = 0xff66cc;
const COL_HOTSPOT = 0xff9944;
const COL_REGION = 0x66dd88;
const COL_HANDLE = '#ffee44';
const COL_HANDLE_STROKE = '#000000';
const COL_WALK_TO = '#3db8e8';
const COL_LOOK_AT = '#e8a438';
const COL_AUX_STROKE = '#1a1a24';

function hexToCss(hex: number): string {
    return `#${hex.toString(16).padStart(6, '0')}`;
}

function distPointToSegment(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
): { d: number; t: number; ix: number; iy: number } {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const ab2 = abx * abx + aby * aby;
    let t = ab2 > 0 ? (apx * abx + apy * aby) / ab2 : 0;
    t = Phaser.Math.Clamp(t, 0, 1);
    const ix = ax + t * abx;
    const iy = ay + t * aby;
    const d = Phaser.Math.Distance.Between(px, py, ix, iy);
    return { d, t, ix, iy };
}

function hitVertexCss(
    cx: number,
    cy: number,
    pts: Point2[],
    handleR: number,
    toCss: (p: Point2) => { x: number; y: number },
): number {
    let best = -1;
    let bestD = handleR + 1;
    for (let i = 0; i < pts.length; i++) {
        const p = toCss(pts[i]!);
        const d = Phaser.Math.Distance.Between(cx, cy, p.x, p.y);
        if (d <= handleR && d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
}

function hitAuxCss(
    cx: number,
    cy: number,
    pt: Point2,
    handleR: number,
    toCss: (p: Point2) => { x: number; y: number },
): boolean {
    const p = toCss(pt);
    return Phaser.Math.Distance.Between(cx, cy, p.x, p.y) <= handleR;
}

/** Index `i` is edge from `pts[i]` to `pts[(i+1)%n]`. */
function hitEdgeCss(
    cx: number,
    cy: number,
    pts: Point2[],
    edgeHit: number,
    vertexClear: number,
    toCss: (p: Point2) => { x: number; y: number },
): number {
    const n = pts.length;
    let best = -1;
    let bestD = edgeHit + 1;
    for (let i = 0; i < n; i++) {
        const a = toCss(pts[i]!);
        const b = toCss(pts[(i + 1) % n]!);
        const { d, t } = distPointToSegment(cx, cy, a.x, a.y, b.x, b.y);
        if (d > edgeHit) {
            continue;
        }
        if (Phaser.Math.Distance.Between(cx, cy, a.x, a.y) < vertexClear) {
            continue;
        }
        if (Phaser.Math.Distance.Between(cx, cy, b.x, b.y) < vertexClear) {
            continue;
        }
        if (t <= 0.05 || t >= 0.95) {
            continue;
        }
        if (d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
}

function insertPointOnEdge(pts: Point2[], edgeIdx: number, wx: number, wy: number): void {
    const a = pts[edgeIdx];
    const b = pts[(edgeIdx + 1) % pts.length];
    const { ix, iy } = distPointToSegment(wx, wy, a.x, a.y, b.x, b.y);
    pts.splice(edgeIdx + 1, 0, { x: ix, y: iy });
}

function defaultStandPointForProp(prop: RoomPropInstance): Point2 {
    const c = prop.collider?.points;
    if (c && c.length > 0) {
        return centroidFromPoints(c);
    }
    const x = prop.x ?? 0;
    const y = prop.y ?? 0;
    return { x, y };
}

function centroidFromPoints(c: Point2[]): Point2 {
    let sx = 0;
    let sy = 0;
    for (const p of c) {
        sx += p.x;
        sy += p.y;
    }
    return { x: Math.round(sx / c.length), y: Math.round(sy / c.length) };
}

export class RoomPolygonEditScene extends Phaser.Scene {
    private room!: RoomData;
    private postPatch!: (p: RoomPolygonPatch) => void;

    private overlay?: PreviewPolygonOverlay;

    private dragVertexIndex: number | null = null;
    private selectedVertexIndex: number | null = null;
    private downOnVertex = false;

    private dragAux: 'walk' | 'look' | null = null;
    private selectedAux: 'walk' | 'look' | null = null;

    private tapEdge: { t: number; edgeIdx: number } | null = null;

    private unsubBridge!: () => void;
    private readonly onSaveBound = (): void => {
        this.saveActivePolygon();
    };

    constructor() {
        super(BENNE_POLYGON_EDIT_SCENE);
    }

    create(): void {
        this.room = this.game.registry.get('bennePreviewRoom') as RoomData;
        this.postPatch = this.game.registry.get('bennePreviewPostPatch') as (p: RoomPolygonPatch) => void;

        if (!this.room || typeof this.postPatch !== 'function') {
            return;
        }

        const mount = this.game.canvas.parentElement;
        if (!mount) {
            return;
        }
        this.overlay = new PreviewPolygonOverlay(this.game, mount);
        this.overlay.canvas.addEventListener('pointerdown', this.onOverlayPointerDown);
        this.overlay.canvas.addEventListener('pointermove', this.onOverlayPointerMove);
        this.overlay.canvas.addEventListener('pointerup', this.onOverlayPointerUp);
        this.overlay.canvas.addEventListener('pointercancel', this.onOverlayPointerUp);
        this.overlay.canvas.addEventListener('keydown', this.onOverlayKeyDown);

        this.unsubBridge = polygonEditBridge.subscribe(() => {
            /* During game.destroy(), manager may be null; toolbar wiring notifies before the next game boots. */
            if (!this.scene?.manager) {
                return;
            }
            this.syncRoomInput();
            this.selectedVertexIndex = null;
            this.selectedAux = null;
            this.dragAux = null;
            this.tapEdge = null;
        });
        this.syncRoomInput();

        window.addEventListener('benne-save-polygon', this.onSaveBound);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.shutdownScene();
        });
    }

    update(): void {
        if (!this.overlay) {
            return;
        }
        this.overlay.syncLayout();
        if (!polygonEditBridge.isEditing()) {
            this.overlay.clearAndDraw({
                pts: [],
                strokeStyle: '#000000',
                handleFill: COL_HANDLE,
                handleStroke: COL_HANDLE_STROKE,
                selectedIndex: null,
                handleRadiusCss: HANDLE_R_CSS,
                lineWidthCss: LINE_WIDTH_CSS,
            });
            return;
        }

        const auxEd = this.getPolygonAuxEditor();
        if (auxEd) {
            auxEd.ensure();
            const labeledPoints = [
                {
                    point: auxEd.walk,
                    label: 'Walk to',
                    fillStyle: COL_WALK_TO,
                    strokeStyle: COL_AUX_STROKE,
                    selected: this.selectedAux === 'walk',
                    radiusCss: AUX_HANDLE_R_CSS,
                },
                {
                    point: auxEd.look,
                    label: 'Look at',
                    fillStyle: COL_LOOK_AT,
                    strokeStyle: COL_AUX_STROKE,
                    selected: this.selectedAux === 'look',
                    radiusCss: AUX_HANDLE_R_CSS,
                },
            ];
            this.overlay.clearAndDraw({
                pts: auxEd.pts,
                strokeStyle: hexToCss(auxEd.strokeHex),
                handleFill: COL_HANDLE,
                handleStroke: COL_HANDLE_STROKE,
                selectedIndex: this.selectedVertexIndex,
                handleRadiusCss: HANDLE_R_CSS,
                lineWidthCss: LINE_WIDTH_CSS,
                labeledPoints,
            });
            return;
        }

        if (polygonEditBridge.mode === 'regionPolygon') {
            const pts = this.getActivePoints();
            if (!pts || pts.length === 0) {
                this.overlay.clearAndDraw({
                    pts: [],
                    strokeStyle: '#000000',
                    handleFill: COL_HANDLE,
                    handleStroke: COL_HANDLE_STROKE,
                    selectedIndex: null,
                    handleRadiusCss: HANDLE_R_CSS,
                    lineWidthCss: LINE_WIDTH_CSS,
                });
                return;
            }
            this.overlay.clearAndDraw({
                pts,
                strokeStyle: hexToCss(COL_REGION),
                handleFill: COL_HANDLE,
                handleStroke: COL_HANDLE_STROKE,
                selectedIndex: this.selectedVertexIndex,
                handleRadiusCss: HANDLE_R_CSS,
                lineWidthCss: LINE_WIDTH_CSS,
            });
            return;
        }

        if (polygonEditBridge.mode === 'roomPoint') {
            const p = this.getActiveRoomPoint();
            const pts = p ? [{ x: p.x, y: p.y }] : [];
            this.overlay.clearAndDraw({
                pts,
                strokeStyle: COL_WALK_TO,
                handleFill: COL_HANDLE,
                handleStroke: COL_HANDLE_STROKE,
                selectedIndex: this.selectedVertexIndex,
                handleRadiusCss: HANDLE_R_CSS + 1,
                lineWidthCss: LINE_WIDTH_CSS,
            });
            return;
        }

        const pts = this.getActivePoints();
        if (!pts || pts.length === 0) {
            this.overlay.clearAndDraw({
                pts: [],
                strokeStyle: '#000000',
                handleFill: COL_HANDLE,
                handleStroke: COL_HANDLE_STROKE,
                selectedIndex: null,
                handleRadiusCss: HANDLE_R_CSS,
                lineWidthCss: LINE_WIDTH_CSS,
            });
            return;
        }

        const strokeHex =
            polygonEditBridge.mode === 'walkable'
                ? polygonEditBridge.walkableHoleId
                    ? COL_WALK_HOLE
                    : COL_WALK
                : COL_PROP;

        this.overlay.clearAndDraw({
            pts,
            strokeStyle: hexToCss(strokeHex),
            handleFill: COL_HANDLE,
            handleStroke: COL_HANDLE_STROKE,
            selectedIndex: this.selectedVertexIndex,
            handleRadiusCss: HANDLE_R_CSS,
            lineWidthCss: LINE_WIDTH_CSS,
        });
    }

    private shutdownScene(): void {
        this.overlay?.canvas.removeEventListener('pointerdown', this.onOverlayPointerDown);
        this.overlay?.canvas.removeEventListener('pointermove', this.onOverlayPointerMove);
        this.overlay?.canvas.removeEventListener('pointerup', this.onOverlayPointerUp);
        this.overlay?.canvas.removeEventListener('pointercancel', this.onOverlayPointerUp);
        this.overlay?.canvas.removeEventListener('keydown', this.onOverlayKeyDown);
        window.removeEventListener('benne-save-polygon', this.onSaveBound);
        this.unsubBridge?.();
        this.overlay?.destroy();
        const roomSc = this.scene?.manager?.getScene(SCENE_ROOM);
        if (roomSc) {
            roomSc.input.enabled = true;
        }
    }

    private getActiveProp(): RoomPropInstance | null {
        if (polygonEditBridge.mode !== 'propCollider') {
            return null;
        }
        const id = polygonEditBridge.propId;
        const p = this.room.props?.find((x) => x.id === id);
        if (!p || p.clickable !== true) {
            return null;
        }
        return p;
    }

    private ensurePropWalkLook(prop: RoomPropInstance): void {
        if (!prop.collider) {
            prop.collider = { points: [] };
        }
        if (!prop.collider.points) {
            prop.collider.points = [];
        }
        const base = defaultStandPointForProp(prop);
        if (!prop.walkToPoint) {
            prop.walkToPoint = { x: base.x, y: base.y };
        }
        if (!prop.lookAtPoint) {
            prop.lookAtPoint = { x: base.x + 12, y: base.y };
        }
    }

    private getActiveHotspot(): RoomHotspotData | null {
        if (polygonEditBridge.mode !== 'hotspotPolygon') {
            return null;
        }
        const id = polygonEditBridge.hotspotId;
        const h = this.room.hotspots?.find((x) => x.id === id);
        return h ?? null;
    }

    private ensureHotspotWalkLook(h: RoomHotspotData): void {
        if (!h.points) {
            h.points = [];
        }
        const w = getInternalWidth();
        const hgt = getInternalHeight();
        const base =
            h.points.length > 0
                ? centroidFromPoints(h.points)
                : { x: Math.round(w / 2), y: Math.round(hgt / 2) };
        if (!h.walkToPoint) {
            h.walkToPoint = { x: base.x, y: base.y };
        }
        if (!h.lookAtPoint) {
            h.lookAtPoint = { x: base.x + 12, y: base.y };
        }
    }

    private getPolygonAuxEditor():
        | {
              strokeHex: number;
              pts: Point2[];
              walk: Point2;
              look: Point2;
              ensure: () => void;
          }
        | null {
        if (polygonEditBridge.mode === 'propCollider') {
            const prop = this.getActiveProp();
            if (!prop) {
                return null;
            }
            this.ensurePropWalkLook(prop);
            return {
                strokeHex: COL_PROP,
                pts: prop.collider!.points!,
                walk: prop.walkToPoint!,
                look: prop.lookAtPoint!,
                ensure: () => this.ensurePropWalkLook(prop),
            };
        }
        if (polygonEditBridge.mode === 'hotspotPolygon') {
            const h = this.getActiveHotspot();
            if (!h) {
                return null;
            }
            this.ensureHotspotWalkLook(h);
            return {
                strokeHex: COL_HOTSPOT,
                pts: h.points!,
                walk: h.walkToPoint!,
                look: h.lookAtPoint!,
                ensure: () => this.ensureHotspotWalkLook(h),
            };
        }
        return null;
    }

    private getActiveRegion(): RoomRegionData | null {
        if (polygonEditBridge.mode !== 'regionPolygon') {
            return null;
        }
        const r = this.room.regions?.find((x) => x.id === polygonEditBridge.regionId);
        return r ?? null;
    }

    private getActiveRoomPoint(): RoomPointData | null {
        if (polygonEditBridge.mode !== 'roomPoint') {
            return null;
        }
        const p = this.room.points?.find((x) => x.id === polygonEditBridge.roomPointId);
        return p ?? null;
    }

    private getActivePoints(): Point2[] | null {
        if (polygonEditBridge.mode === 'walkable') {
            const id = polygonEditBridge.walkablePolygonId;
            const poly = this.room.walkable.polygons.find((p) => p.id === id);
            if (!poly) {
                return null;
            }
            const hid = polygonEditBridge.walkableHoleId;
            if (!hid) {
                return poly.points ?? null;
            }
            const hole = poly.holes?.find((h) => h.id === hid);
            if (!hole) {
                return null;
            }
            if (!hole.points) {
                hole.points = [];
            }
            return hole.points;
        }
        if (polygonEditBridge.mode === 'propCollider') {
            const prop = this.getActiveProp();
            if (!prop) {
                return null;
            }
            this.ensurePropWalkLook(prop);
            return prop.collider!.points!;
        }
        if (polygonEditBridge.mode === 'hotspotPolygon') {
            const h = this.getActiveHotspot();
            if (!h) {
                return null;
            }
            this.ensureHotspotWalkLook(h);
            return h.points!;
        }
        if (polygonEditBridge.mode === 'regionPolygon') {
            const r = this.getActiveRegion();
            if (!r) {
                return null;
            }
            if (!r.points) {
                r.points = [];
            }
            return r.points;
        }
        return null;
    }

    private syncRoomInput(): void {
        const mgr = this.scene?.manager;
        if (!mgr) {
            return;
        }
        const roomSc = mgr.getScene(SCENE_ROOM);
        const editing = polygonEditBridge.isEditing();
        if (roomSc) {
            roomSc.input.enabled = !editing;
        }
        this.input.enabled = editing;
        this.overlay?.setPointerEventsEnabled(editing);
    }

    private saveActivePolygon(): void {
        if (!polygonEditBridge.isEditing()) {
            return;
        }
        if (polygonEditBridge.mode === 'propCollider') {
            const prop = this.getActiveProp();
            if (!prop) {
                return;
            }
            this.ensurePropWalkLook(prop);
            const pts = prop.collider!.points!;
            if (pts.length < MIN_POINTS) {
                return;
            }
            const copy = pts.map((p) => ({ x: p.x, y: p.y }));
            this.postPatch({
                kind: 'propCollider',
                propId: polygonEditBridge.propId,
                points: copy,
                walkToPoint: { x: prop.walkToPoint!.x, y: prop.walkToPoint!.y },
                lookAtPoint: { x: prop.lookAtPoint!.x, y: prop.lookAtPoint!.y },
            });
            return;
        }
        if (polygonEditBridge.mode === 'hotspotPolygon') {
            const h = this.getActiveHotspot();
            if (!h) {
                return;
            }
            this.ensureHotspotWalkLook(h);
            const pts = h.points!;
            if (pts.length < MIN_POINTS) {
                return;
            }
            const copy = pts.map((p) => ({ x: p.x, y: p.y }));
            this.postPatch({
                kind: 'hotspotPolygon',
                hotspotId: polygonEditBridge.hotspotId,
                points: copy,
                walkToPoint: { x: h.walkToPoint!.x, y: h.walkToPoint!.y },
                lookAtPoint: { x: h.lookAtPoint!.x, y: h.lookAtPoint!.y },
            });
            return;
        }
        if (polygonEditBridge.mode === 'regionPolygon') {
            const pts = this.getActivePoints();
            if (!pts || pts.length < MIN_POINTS) {
                return;
            }
            const copy = pts.map((p) => ({ x: p.x, y: p.y }));
            this.postPatch({
                kind: 'regionPolygon',
                regionId: polygonEditBridge.regionId,
                points: copy,
            });
            return;
        }
        if (polygonEditBridge.mode === 'roomPoint') {
            const p = this.getActiveRoomPoint();
            if (!p) {
                return;
            }
            this.postPatch({
                kind: 'roomPoint',
                pointId: polygonEditBridge.roomPointId,
                x: p.x,
                y: p.y,
            });
            return;
        }
        const pts = this.getActivePoints();
        if (!pts || pts.length < MIN_POINTS) {
            return;
        }
        const copy = pts.map((p) => ({ x: p.x, y: p.y }));
        if (polygonEditBridge.mode === 'walkable') {
            const hid = polygonEditBridge.walkableHoleId;
            this.postPatch({
                kind: 'walkable',
                polygonId: polygonEditBridge.walkablePolygonId,
                ...(hid ? { holeId: hid } : {}),
                points: copy,
            });
        }
    }

    private pointerCss(e: PointerEvent): { cx: number; cy: number } {
        const rect = this.game.canvas.getBoundingClientRect();
        return { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
    }

    private tryPickWalkLook(
        cx: number,
        cy: number,
        walkToPoint: Point2,
        lookAtPoint: Point2,
        toCss: (p: Point2) => { x: number; y: number },
    ): boolean {
        if (hitAuxCss(cx, cy, walkToPoint, AUX_HANDLE_R_CSS, toCss)) {
            this.dragAux = 'walk';
            this.selectedAux = 'walk';
            this.selectedVertexIndex = null;
            this.downOnVertex = false;
            this.dragVertexIndex = null;
            return true;
        }
        if (hitAuxCss(cx, cy, lookAtPoint, AUX_HANDLE_R_CSS, toCss)) {
            this.dragAux = 'look';
            this.selectedAux = 'look';
            this.selectedVertexIndex = null;
            this.downOnVertex = false;
            this.dragVertexIndex = null;
            return true;
        }
        return false;
    }

    private readonly onOverlayPointerDown = (e: PointerEvent): void => {
        const ov = this.overlay;
        if (!ov || !polygonEditBridge.isEditing() || e.button !== 0) {
            return;
        }
        e.preventDefault();
        ov.canvas.setPointerCapture(e.pointerId);
        ov.canvas.focus({ preventScroll: true });
        const { cx, cy } = this.pointerCss(e);
        const toCss = (p: Point2): { x: number; y: number } => ov.worldToCanvasCss(p);

        if (polygonEditBridge.mode === 'roomPoint') {
            const p = this.getActiveRoomPoint();
            const pts = p ? [{ x: p.x, y: p.y }] : [];
            if (pts.length === 0) {
                return;
            }
            const vi = hitVertexCss(cx, cy, pts, HANDLE_R_CSS + 1, toCss);
            if (vi >= 0) {
                this.downOnVertex = true;
                this.dragVertexIndex = vi;
                this.selectedVertexIndex = vi;
            }
            return;
        }

        const auxEd = this.getPolygonAuxEditor();
        if (auxEd) {
            auxEd.ensure();
            const pts = auxEd.pts;

            if (
                pts.length >= MIN_POINTS &&
                this.tryPickWalkLook(cx, cy, auxEd.walk, auxEd.look, toCss)
            ) {
                return;
            }

            if (pts.length < MIN_POINTS) {
                const vi = pts.length > 0 ? hitVertexCss(cx, cy, pts, HANDLE_R_CSS, toCss) : -1;
                if (vi >= 0) {
                    this.downOnVertex = true;
                    this.dragVertexIndex = vi;
                    this.selectedVertexIndex = vi;
                    this.dragAux = null;
                    this.selectedAux = null;
                    return;
                }
                if (this.tryPickWalkLook(cx, cy, auxEd.walk, auxEd.look, toCss)) {
                    return;
                }
                return;
            }

            const vi = hitVertexCss(cx, cy, pts, HANDLE_R_CSS, toCss);
            if (vi >= 0) {
                this.downOnVertex = true;
                this.dragVertexIndex = vi;
                this.selectedVertexIndex = vi;
                this.dragAux = null;
                this.selectedAux = null;
                return;
            }
            this.downOnVertex = false;
            this.dragVertexIndex = null;
            return;
        }

        const pts = this.getActivePoints();
        if (!pts) {
            return;
        }

        if (pts.length < MIN_POINTS) {
            const vi = pts.length > 0 ? hitVertexCss(cx, cy, pts, HANDLE_R_CSS, toCss) : -1;
            if (vi >= 0) {
                this.downOnVertex = true;
                this.dragVertexIndex = vi;
                this.selectedVertexIndex = vi;
            }
            return;
        }

        const vi = hitVertexCss(cx, cy, pts, HANDLE_R_CSS, toCss);
        if (vi >= 0) {
            this.downOnVertex = true;
            this.dragVertexIndex = vi;
            this.selectedVertexIndex = vi;
            return;
        }
        this.downOnVertex = false;
        this.dragVertexIndex = null;
    };

    private readonly onOverlayPointerMove = (e: PointerEvent): void => {
        const ov = this.overlay;
        if (!ov) {
            return;
        }
        if (this.dragAux === 'walk' || this.dragAux === 'look') {
            const auxEd = this.getPolygonAuxEditor();
            if (!auxEd) {
                return;
            }
            const cam = this.cameras.main;
            const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, cam);
            const w = getInternalWidth();
            const h = getInternalHeight();
            const cx = Phaser.Math.Clamp(wx, 0, w);
            const cy = Phaser.Math.Clamp(wy, 0, h);
            if (this.dragAux === 'walk') {
                auxEd.walk.x = cx;
                auxEd.walk.y = cy;
            } else {
                auxEd.look.x = cx;
                auxEd.look.y = cy;
            }
            return;
        }
        if (this.dragVertexIndex === null) {
            return;
        }
        if (polygonEditBridge.mode === 'roomPoint') {
            const p = this.getActiveRoomPoint();
            if (!p || this.dragVertexIndex !== 0) {
                return;
            }
            const cam = this.cameras.main;
            const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, cam);
            const w = getInternalWidth();
            const h = getInternalHeight();
            p.x = Phaser.Math.Clamp(wx, 0, w);
            p.y = Phaser.Math.Clamp(wy, 0, h);
            return;
        }
        const pts = this.getActivePoints();
        if (!pts || this.dragVertexIndex >= pts.length) {
            return;
        }
        const cam = this.cameras.main;
        const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, cam);
        const w = getInternalWidth();
        const h = getInternalHeight();
        pts[this.dragVertexIndex].x = Phaser.Math.Clamp(wx, 0, w);
        pts[this.dragVertexIndex].y = Phaser.Math.Clamp(wy, 0, h);
    };

    private readonly onOverlayPointerUp = (e: PointerEvent): void => {
        const ov = this.overlay;
        if (e.button === 0 && ov) {
            try {
                ov.canvas.releasePointerCapture(e.pointerId);
            } catch {
                /* not captured */
            }
        }
        if (!polygonEditBridge.isEditing() || !ov) {
            this.dragVertexIndex = null;
            this.downOnVertex = false;
            this.dragAux = null;
            return;
        }

        if (this.dragAux) {
            this.dragAux = null;
            this.downOnVertex = false;
            this.dragVertexIndex = null;
            return;
        }

        const pts = this.getActivePoints();
        const cam = this.cameras.main;
        const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, cam);
        const { cx, cy } = this.pointerCss(e);
        const toCss = (p: Point2): { x: number; y: number } => ov.worldToCanvasCss(p);

        if (this.downOnVertex || this.dragVertexIndex !== null) {
            this.dragVertexIndex = null;
            this.downOnVertex = false;
            return;
        }

        if (polygonEditBridge.mode === 'roomPoint') {
            this.tapEdge = null;
            return;
        }

        if (polygonEditBridge.mode === 'walkable') {
            if (
                e.button === 0 &&
                pts &&
                pts.length < MIN_POINTS &&
                !this.downOnVertex &&
                this.dragVertexIndex === null
            ) {
                const w = getInternalWidth();
                const h = getInternalHeight();
                pts.push({
                    x: Phaser.Math.Clamp(wx, 0, w),
                    y: Phaser.Math.Clamp(wy, 0, h),
                });
                this.tapEdge = null;
                return;
            }

            if (e.button === 0 && pts && pts.length >= MIN_POINTS) {
                const vertexClear = HANDLE_R_CSS + 3;
                const edgeIdx = hitEdgeCss(cx, cy, pts, EDGE_HIT_CSS, vertexClear, toCss);
                if (edgeIdx >= 0) {
                    const now = this.time.now;
                    if (
                        this.tapEdge &&
                        this.tapEdge.edgeIdx === edgeIdx &&
                        now - this.tapEdge.t < 450
                    ) {
                        insertPointOnEdge(pts, edgeIdx, wx, wy);
                        this.tapEdge = null;
                    } else {
                        this.tapEdge = { t: now, edgeIdx };
                    }
                } else {
                    this.tapEdge = null;
                    this.selectedVertexIndex = null;
                }
            }
            return;
        }

        /* prop collider, hotspot polygon, or region polygon */
        if (
            e.button === 0 &&
            pts &&
            pts.length < MIN_POINTS &&
            !this.downOnVertex &&
            this.dragVertexIndex === null
        ) {
            const w = getInternalWidth();
            const h = getInternalHeight();
            pts.push({
                x: Phaser.Math.Clamp(wx, 0, w),
                y: Phaser.Math.Clamp(wy, 0, h),
            });
            this.tapEdge = null;
            return;
        }

        if (
            e.button === 0 &&
            pts &&
            pts.length >= MIN_POINTS &&
            (polygonEditBridge.mode === 'propCollider' ||
                polygonEditBridge.mode === 'hotspotPolygon' ||
                polygonEditBridge.mode === 'regionPolygon')
        ) {
            const vertexClear = HANDLE_R_CSS + 3;
            const edgeIdx = hitEdgeCss(cx, cy, pts, EDGE_HIT_CSS, vertexClear, toCss);
            if (edgeIdx >= 0) {
                const now = this.time.now;
                if (
                    this.tapEdge &&
                    this.tapEdge.edgeIdx === edgeIdx &&
                    now - this.tapEdge.t < 450
                ) {
                    insertPointOnEdge(pts, edgeIdx, wx, wy);
                    this.tapEdge = null;
                } else {
                    this.tapEdge = { t: now, edgeIdx };
                }
            } else {
                this.tapEdge = null;
                this.selectedVertexIndex = null;
                this.selectedAux = null;
            }
        }
    };

    /**
     * Delete/Backspace: handled on the overlay canvas (focus set on pointerdown) because Phaser’s
     * keyboard plugin does not reliably receive keys when the DOM overlay sits above the game canvas.
     */
    private readonly onOverlayKeyDown = (e: KeyboardEvent): void => {
        if (!polygonEditBridge.isEditing()) {
            return;
        }
        if (e.key !== 'Delete' && e.key !== 'Backspace') {
            return;
        }
        if (this.applyDeleteSelectedVertex()) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    /** Returns true if a vertex was removed. */
    private applyDeleteSelectedVertex(): boolean {
        if (polygonEditBridge.mode === 'roomPoint') {
            return false;
        }
        const pts = this.getActivePoints();
        if (
            !pts ||
            this.selectedVertexIndex === null ||
            pts.length <= MIN_POINTS
        ) {
            return false;
        }
        pts.splice(this.selectedVertexIndex, 1);
        this.selectedVertexIndex = null;
        return true;
    }
}
