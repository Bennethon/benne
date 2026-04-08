import * as Phaser from 'phaser';
import { getInternalHeight, getInternalWidth, SCENE_ROOM } from '../../game/constants';
import type { RoomScene } from '../../engine/scenes/RoomScene';
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

    /** Cached reference to the sibling RoomScene (set in create, cleared on shutdown). */
    private roomScene: RoomScene | null = null;

    private overlay?: PreviewPolygonOverlay;

    // ── Pan state (middle-mouse drag) ────────────────────────────────────────
    private isPanning = false;
    private panLastX = 0;
    private panLastY = 0;

    // ── Rect edit state (roomSize / scrollBounds modes) ──────────────────────
    /** Which of the 8 handles is currently being dragged (-1 = none). */
    private dragRectHandle = -1;
    /** Which handle is visually selected/highlighted. */
    private selectedRectHandle = -1;

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

        this.roomScene = (this.scene?.manager?.getScene(SCENE_ROOM) as RoomScene | null) ?? null;

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
        this.overlay.canvas.addEventListener('wheel', this.onOverlayWheel, { passive: false });

        this.unsubBridge = polygonEditBridge.subscribe(() => {
            /* During game.destroy(), manager may be null; toolbar wiring notifies before the next game boots. */
            if (!this.scene?.manager) {
                return;
            }
            this.syncRoomInput();
            this.syncEditorCameraMode();
            this.selectedVertexIndex = null;
            this.selectedAux = null;
            this.dragAux = null;
            this.tapEdge = null;
            this.dragRectHandle = -1;
            this.selectedRectHandle = -1;
        });
        this.syncRoomInput();
        this.syncEditorCameraMode();

        window.addEventListener('benne-save-polygon', this.onSaveBound);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.shutdownScene();
        });
    }

    /**
     * Returns the active camera from RoomScene for coordinate transforms.
     * Falls back to this scene's own camera when RoomScene isn't available.
     */
    private getRoomCamera(): Phaser.Cameras.Scene2D.Camera {
        return this.roomScene?.cameras.main ?? this.cameras.main;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Rect editing helpers (roomSize / scrollBounds)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns the current edit rectangle for the active mode in world space,
     * or null if the mode is not a rect mode.
     */
    private getRectFromRoom(): { left: number; top: number; right: number; bottom: number } | null {
        const vW = getInternalWidth();
        const vH = getInternalHeight();
        if (polygonEditBridge.mode === 'roomSize') {
            const w = this.room.size?.width ?? vW;
            const h = this.room.size?.height ?? vH;
            return { left: 0, top: 0, right: w, bottom: h };
        }
        if (polygonEditBridge.mode === 'scrollBounds') {
            const roomW = this.room.size?.width ?? vW;
            const roomH = this.room.size?.height ?? vH;
            const sb = this.room.scrollBounds;
            const x = sb?.x ?? 0;
            const y = sb?.y ?? 0;
            const bw = sb?.width ?? roomW;
            const bh = sb?.height ?? roomH;
            return { left: x, top: y, right: x + bw, bottom: y + bh };
        }
        return null;
    }

    /** 8 handle world positions for a rect (clockwise from top-left). */
    private static rectHandlePositions(
        r: { left: number; top: number; right: number; bottom: number },
    ): { x: number; y: number }[] {
        const mx = (r.left + r.right) / 2;
        const my = (r.top + r.bottom) / 2;
        return [
            { x: r.left,  y: r.top    },  // 0 top-left
            { x: mx,      y: r.top    },  // 1 top-mid
            { x: r.right, y: r.top    },  // 2 top-right
            { x: r.right, y: my       },  // 3 mid-right
            { x: r.right, y: r.bottom },  // 4 bottom-right
            { x: mx,      y: r.bottom },  // 5 bottom-mid
            { x: r.left,  y: r.bottom },  // 6 bottom-left
            { x: r.left,  y: my       },  // 7 mid-left
        ];
    }

    /**
     * Returns which handles are locked (cannot be dragged) for the current mode.
     * For `roomSize` the top-left origin is fixed at (0,0), so any handle that
     * would move left or top is locked.
     */
    private static lockedHandlesForMode(mode: string): ReadonlySet<number> {
        if (mode === 'roomSize') {
            // Handles that affect left (0,6,7) or top (0,1,2) — union = 0,1,2,6,7
            return new Set([0, 1, 2, 6, 7]);
        }
        return new Set<number>();
    }

    /** Hit-test CSS pointer coords against handle circles; returns handle index or -1. */
    private hitRectHandle(
        cx: number,
        cy: number,
        handles: { x: number; y: number }[],
        radiusCss: number,
        toCss: (p: { x: number; y: number }) => { x: number; y: number },
        locked: ReadonlySet<number>,
    ): number {
        let best = -1;
        let bestD = radiusCss + 1;
        for (let i = 0; i < handles.length; i++) {
            if (locked.has(i)) continue;
            const q = toCss(handles[i]!);
            const d = Phaser.Math.Distance.Between(cx, cy, q.x, q.y);
            if (d <= radiusCss && d < bestD) {
                bestD = d;
                best = i;
            }
        }
        return best;
    }

    /**
     * Apply a drag of handle `idx` to (wx, wy) in world space.
     * Directly mutates `room.size` or `room.scrollBounds`.
     */
    private applyRectHandleDrag(idx: number, wx: number, wy: number): void {
        const vW = getInternalWidth();
        const vH = getInternalHeight();

        if (polygonEditBridge.mode === 'roomSize') {
            if (!this.room.size) {
                this.room.size = { width: vW, height: vH };
            }
            const affectsRight  = idx === 2 || idx === 3 || idx === 4;
            const affectsBottom = idx === 4 || idx === 5 || idx === 6;
            if (affectsRight)  this.room.size.width  = Math.max(1, wx);
            if (affectsBottom) this.room.size.height = Math.max(1, wy);
            return;
        }

        if (polygonEditBridge.mode === 'scrollBounds') {
            const roomW = this.room.size?.width ?? vW;
            const roomH = this.room.size?.height ?? vH;
            if (!this.room.scrollBounds) {
                this.room.scrollBounds = { x: 0, y: 0, width: roomW, height: roomH };
            }
            const sb = this.room.scrollBounds;
            const curRight  = sb.x + sb.width;
            const curBottom = sb.y + sb.height;

            const affectsLeft   = idx === 0 || idx === 6 || idx === 7;
            const affectsTop    = idx === 0 || idx === 1 || idx === 2;
            const affectsRight  = idx === 2 || idx === 3 || idx === 4;
            const affectsBottom = idx === 4 || idx === 5 || idx === 6;

            let left   = sb.x;
            let top    = sb.y;
            let right  = curRight;
            let bottom = curBottom;

            if (affectsLeft)   left   = Math.min(wx, right - 1);
            if (affectsTop)    top    = Math.min(wy, bottom - 1);
            if (affectsRight)  right  = Math.max(wx, left + 1);
            if (affectsBottom) bottom = Math.max(wy, top + 1);

            sb.x = left;
            sb.y = top;
            sb.width  = right - left;
            sb.height = bottom - top;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Tells RoomScene to switch between game-play camera (navigate) and full-room
     * editor view (any edit mode). Only has an effect when the room is larger than the viewport.
     */
    private syncEditorCameraMode(): void {
        if (!this.roomScene || typeof this.roomScene.setEditorCameraMode !== 'function') {
            return;
        }
        this.roomScene.setEditorCameraMode(
            polygonEditBridge.mode === 'navigate' ? 'navigate' : 'edit',
        );
    }

    update(): void {
        if (!this.overlay) {
            return;
        }
        this.overlay.syncLayout();
        const roomCam = this.getRoomCamera();

        if (!polygonEditBridge.isEditing()) {
            this.overlay.clearAndDraw({
                pts: [],
                strokeStyle: '#000000',
                handleFill: COL_HANDLE,
                handleStroke: COL_HANDLE_STROKE,
                selectedIndex: null,
                handleRadiusCss: HANDLE_R_CSS,
                lineWidthCss: LINE_WIDTH_CSS,
            }, roomCam);
            return;
        }

        // ── Rect modes ────────────────────────────────────────────────────────
        if (polygonEditBridge.mode === 'roomSize' || polygonEditBridge.mode === 'scrollBounds') {
            const rect = this.getRectFromRoom();
            const isRoomSize = polygonEditBridge.mode === 'roomSize';
            const strokeStyle = isRoomSize ? '#22ddff' : '#ff9944';
            if (rect) {
                this.overlay.clearAndDrawRect({
                    rect,
                    strokeStyle,
                    fillStyle: strokeStyle,
                    handleFill: COL_HANDLE,
                    handleStroke: COL_HANDLE_STROKE,
                    selectedHandleIndex: this.selectedRectHandle,
                    lockedHandles: RoomPolygonEditScene.lockedHandlesForMode(polygonEditBridge.mode),
                    handleRadiusCss: HANDLE_R_CSS,
                    lineWidthCss: LINE_WIDTH_CSS,
                }, roomCam);
            } else {
                this.overlay.clearAndDraw({
                    pts: [],
                    strokeStyle: '#000000',
                    handleFill: COL_HANDLE,
                    handleStroke: COL_HANDLE_STROKE,
                    selectedIndex: null,
                    handleRadiusCss: HANDLE_R_CSS,
                    lineWidthCss: LINE_WIDTH_CSS,
                }, roomCam);
            }
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
            }, roomCam);
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
                }, roomCam);
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
            }, roomCam);
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
            }, roomCam);
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
            }, roomCam);
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
        }, roomCam);
    }

    private shutdownScene(): void {
        this.overlay?.canvas.removeEventListener('pointerdown', this.onOverlayPointerDown);
        this.overlay?.canvas.removeEventListener('pointermove', this.onOverlayPointerMove);
        this.overlay?.canvas.removeEventListener('pointerup', this.onOverlayPointerUp);
        this.overlay?.canvas.removeEventListener('pointercancel', this.onOverlayPointerUp);
        this.overlay?.canvas.removeEventListener('keydown', this.onOverlayKeyDown);
        this.overlay?.canvas.removeEventListener('wheel', this.onOverlayWheel);
        window.removeEventListener('benne-save-polygon', this.onSaveBound);
        this.unsubBridge?.();
        this.overlay?.destroy();
        const roomSc = this.scene?.manager?.getScene(SCENE_ROOM);
        if (roomSc) {
            roomSc.input.enabled = true;
        }
        this.roomScene = null;
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
        const roomW = this.room.size?.width ?? getInternalWidth();
        const roomH = this.room.size?.height ?? getInternalHeight();
        if (!h.points || h.points.length < MIN_POINTS) {
            const cx = Math.round(roomW / 2);
            const cy = Math.round(roomH / 2);
            const s = 24;
            h.points = [
                { x: cx - s, y: cy - s },
                { x: cx + s, y: cy - s },
                { x: cx + s, y: cy + s },
                { x: cx - s, y: cy + s },
            ];
        }
        const base = centroidFromPoints(h.points);
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
        if (polygonEditBridge.mode === 'roomSize') {
            const vW = getInternalWidth();
            const vH = getInternalHeight();
            const w = Math.max(1, Math.round(this.room.size?.width ?? vW));
            const h = Math.max(1, Math.round(this.room.size?.height ?? vH));
            this.postPatch({ kind: 'roomSize', width: w, height: h });
            return;
        }
        if (polygonEditBridge.mode === 'scrollBounds') {
            const vW = getInternalWidth();
            const vH = getInternalHeight();
            const roomW = this.room.size?.width ?? vW;
            const roomH = this.room.size?.height ?? vH;
            const sb = this.room.scrollBounds;
            this.postPatch({
                kind: 'scrollBounds',
                x: Math.round(sb?.x ?? 0),
                y: Math.round(sb?.y ?? 0),
                width: Math.max(1, Math.round(sb?.width ?? roomW)),
                height: Math.max(1, Math.round(sb?.height ?? roomH)),
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

    /**
     * Mouse-wheel zoom centred on the cursor.
     *
     * Uses the Phaser 4 camera's world-to-screen formula (which includes the viewport
     * origin) to keep the world point under the cursor fixed after the zoom change.
     *
     *   newScrollX = worldX − originX − (screenX − originX − cam.x) / newZoom
     *
     * Press **F** to reset zoom to the initial fit view at any time.
     */
    private readonly onOverlayWheel = (e: WheelEvent): void => {
        if (!polygonEditBridge.isEditing()) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();

        const ov = this.overlay;
        if (!ov) {
            return;
        }
        const roomCam = this.getRoomCamera();

        // World point currently under the cursor — must be captured before changing zoom.
        const worldPt = ov.domToWorld(e.pageX, e.pageY, roomCam);

        // Normalise scroll delta across devices (mouse wheel sends large values; trackpad small).
        let delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 40;   // line → pixel approx
        if (e.deltaMode === 2) delta *= 400;  // page → pixel approx

        const zoomFactor = 1 - Math.max(-0.3, Math.min(0.3, delta * 0.001));
        const newZoom = Math.max(0.05, Math.min(20, roomCam.zoom * zoomFactor));
        if (Math.abs(newZoom - roomCam.zoom) < 0.0001) {
            return;
        }

        // Cursor position in Phaser internal screen pixels (= CSS px with Scale.RESIZE).
        this.game.scale.updateBounds();
        const screenX = this.game.scale.transformX(e.pageX);
        const screenY = this.game.scale.transformY(e.pageY);

        const originX = roomCam.width * roomCam.originX;
        const originY = roomCam.height * roomCam.originY;

        roomCam.setZoom(newZoom);
        // Adjust scroll so the world point stays under the cursor.
        roomCam.scrollX = worldPt.x - originX - (screenX - originX - roomCam.x) / newZoom;
        roomCam.scrollY = worldPt.y - originY - (screenY - originY - roomCam.y) / newZoom;
    };

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
        if (!ov || !polygonEditBridge.isEditing()) {
            return;
        }

        // Middle mouse — start camera pan.
        if (e.button === 1) {
            e.preventDefault();
            this.isPanning = true;
            this.panLastX = e.clientX;
            this.panLastY = e.clientY;
            ov.canvas.setPointerCapture(e.pointerId);
            ov.canvas.style.cursor = 'grabbing';
            return;
        }

        if (e.button !== 0) {
            return;
        }
        e.preventDefault();
        ov.canvas.setPointerCapture(e.pointerId);
        ov.canvas.focus({ preventScroll: true });
        const { cx, cy } = this.pointerCss(e);
        const roomCam = this.getRoomCamera();
        const toCss = (p: Point2): { x: number; y: number } => ov.worldToCanvasCss(p, roomCam);

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

        // ── Rect handle hit test ──────────────────────────────────────────────
        if (polygonEditBridge.mode === 'roomSize' || polygonEditBridge.mode === 'scrollBounds') {
            const rect = this.getRectFromRoom();
            if (rect) {
                const handles = RoomPolygonEditScene.rectHandlePositions(rect);
                const locked = RoomPolygonEditScene.lockedHandlesForMode(polygonEditBridge.mode);
                const hit = this.hitRectHandle(cx, cy, handles, HANDLE_R_CSS + 2, toCss, locked);
                this.dragRectHandle = hit;
                this.selectedRectHandle = hit;
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

        // Middle-mouse pan.
        if (this.isPanning) {
            const roomCam = this.getRoomCamera();
            const dx = e.clientX - this.panLastX;
            const dy = e.clientY - this.panLastY;
            // Moving mouse right pans camera left (world shifts right on screen): scrollX -= dx/zoom.
            roomCam.scrollX -= dx / roomCam.zoom;
            roomCam.scrollY -= dy / roomCam.zoom;
            this.panLastX = e.clientX;
            this.panLastY = e.clientY;
            return;
        }

        const roomCam = this.getRoomCamera();
        const roomW = this.room.size?.width ?? getInternalWidth();
        const roomH = this.room.size?.height ?? getInternalHeight();

        // ── Rect handle drag ─────────────────────────────────────────────────
        if (this.dragRectHandle >= 0 &&
            (polygonEditBridge.mode === 'roomSize' || polygonEditBridge.mode === 'scrollBounds')) {
            const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, roomCam);
            this.applyRectHandleDrag(this.dragRectHandle, wx, wy);
            return;
        }

        if (this.dragAux === 'walk' || this.dragAux === 'look') {
            const auxEd = this.getPolygonAuxEditor();
            if (!auxEd) {
                return;
            }
            const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, roomCam);
            const cx = Phaser.Math.Clamp(wx, 0, roomW);
            const cy = Phaser.Math.Clamp(wy, 0, roomH);
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
            const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, roomCam);
            p.x = Phaser.Math.Clamp(wx, 0, roomW);
            p.y = Phaser.Math.Clamp(wy, 0, roomH);
            return;
        }
        const pts = this.getActivePoints();
        if (!pts || this.dragVertexIndex >= pts.length) {
            return;
        }
        const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, roomCam);
        pts[this.dragVertexIndex].x = Phaser.Math.Clamp(wx, 0, roomW);
        pts[this.dragVertexIndex].y = Phaser.Math.Clamp(wy, 0, roomH);
    };

    private readonly onOverlayPointerUp = (e: PointerEvent): void => {
        const ov = this.overlay;

        // Stop middle-mouse pan.
        if (e.button === 1) {
            if (this.isPanning) {
                this.isPanning = false;
                if (ov) {
                    ov.canvas.style.cursor = '';
                    try { ov.canvas.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
                }
            }
            return;
        }

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

        // ── Rect drag end ─────────────────────────────────────────────────────
        if (this.dragRectHandle >= 0) {
            this.dragRectHandle = -1;
            return;
        }
        if (polygonEditBridge.mode === 'roomSize' || polygonEditBridge.mode === 'scrollBounds') {
            // Click in rect area with no handle hit — deselect.
            this.selectedRectHandle = -1;
            return;
        }

        const pts = this.getActivePoints();
        const roomCam = this.getRoomCamera();
        const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, roomCam);
        const { cx, cy } = this.pointerCss(e);
        const toCss = (p: Point2): { x: number; y: number } => ov.worldToCanvasCss(p, roomCam);
        const roomW = this.room.size?.width ?? getInternalWidth();
        const roomH = this.room.size?.height ?? getInternalHeight();

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
                pts.push({
                    x: Phaser.Math.Clamp(wx, 0, roomW),
                    y: Phaser.Math.Clamp(wy, 0, roomH),
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
            pts.push({
                x: Phaser.Math.Clamp(wx, 0, roomW),
                y: Phaser.Math.Clamp(wy, 0, roomH),
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
        // F key: reset camera to fit-room zoom.
        if (e.key === 'f' || e.key === 'F') {
            this.syncEditorCameraMode();
            e.preventDefault();
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
