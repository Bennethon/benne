import * as Phaser from 'phaser';
import { getInternalHeight, getInternalWidth, SCENE_ROOM } from '../../game/constants';
import type { Point2, RoomData } from '../../types/room';
import { polygonEditBridge } from './polygonEditBridge';
import type { RoomPolygonPatch } from './polygonPatchTypes';

export const BENNE_POLYGON_EDIT_SCENE = 'BennePolygonEdit';

const HANDLE_R = 8;
const EDGE_HIT = 10;
const MIN_POINTS = 3;

const COL_WALK = 0x44eedd;
const COL_PROP = 0xff66cc;
const COL_HANDLE = 0xffee44;
const COL_SEL = 0xffffff;

function hitVertex(wx: number, wy: number, pts: Point2[]): number {
    let best = -1;
    let bestD = HANDLE_R + 1;
    for (let i = 0; i < pts.length; i++) {
        const d = Phaser.Math.Distance.Between(wx, wy, pts[i].x, pts[i].y);
        if (d <= HANDLE_R && d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
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

/** Index `i` is edge from `pts[i]` to `pts[(i+1)%n]`. */
function hitEdge(wx: number, wy: number, pts: Point2[], vertexClear: number): number {
    const n = pts.length;
    let best = -1;
    let bestD = EDGE_HIT + 1;
    for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        const { d, t } = distPointToSegment(wx, wy, a.x, a.y, b.x, b.y);
        if (d > EDGE_HIT) {
            continue;
        }
        if (Phaser.Math.Distance.Between(wx, wy, a.x, a.y) < vertexClear) {
            continue;
        }
        if (Phaser.Math.Distance.Between(wx, wy, b.x, b.y) < vertexClear) {
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

export class RoomPolygonEditScene extends Phaser.Scene {
    private room!: RoomData;
    private postPatch!: (p: RoomPolygonPatch) => void;

    private gPoly!: Phaser.GameObjects.Graphics;
    private gHandles!: Phaser.GameObjects.Graphics;

    private dragVertexIndex: number | null = null;
    private selectedVertexIndex: number | null = null;
    private downOnVertex = false;

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

        this.gPoly = this.add.graphics().setDepth(25_000);
        this.gHandles = this.add.graphics().setDepth(25_001);

        this.input.on('pointerdown', this.onPointerDown);
        this.input.on('pointermove', this.onPointerMove);
        this.input.on('pointerup', this.onPointerUp);

        this.input.keyboard?.on('keydown-DELETE', this.onDeleteKey);
        this.input.keyboard?.on('keydown-BACKSPACE', this.onDeleteKey);

        this.unsubBridge = polygonEditBridge.subscribe(() => {
            this.syncRoomInput();
            this.selectedVertexIndex = null;
            this.tapEdge = null;
        });
        this.syncRoomInput();

        window.addEventListener('benne-save-polygon', this.onSaveBound);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.shutdownScene();
        });
    }

    update(): void {
        if (!polygonEditBridge.isEditing()) {
            this.gPoly.clear();
            this.gHandles.clear();
            return;
        }
        const pts = this.getActivePoints();
        if (!pts || pts.length < 2) {
            this.gPoly.clear();
            this.gHandles.clear();
            return;
        }
        const stroke = polygonEditBridge.mode === 'walkable' ? COL_WALK : COL_PROP;
        this.gPoly.clear();
        this.gPoly.lineStyle(2, stroke, 0.95);
        const vecs = pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
        this.gPoly.strokePoints(vecs, true);

        this.gHandles.clear();
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            const sel = i === this.selectedVertexIndex;
            const r = sel ? HANDLE_R + 2 : HANDLE_R;
            const col = sel ? COL_SEL : COL_HANDLE;
            this.gHandles.fillStyle(col, 0.95);
            this.gHandles.fillCircle(p.x, p.y, r);
            this.gHandles.lineStyle(1, 0x000000, 0.5);
            this.gHandles.strokeCircle(p.x, p.y, r);
        }
    }

    private shutdownScene(): void {
        this.input.off('pointerdown', this.onPointerDown);
        this.input.off('pointermove', this.onPointerMove);
        this.input.off('pointerup', this.onPointerUp);
        this.input.keyboard?.off('keydown-DELETE', this.onDeleteKey);
        this.input.keyboard?.off('keydown-BACKSPACE', this.onDeleteKey);
        window.removeEventListener('benne-save-polygon', this.onSaveBound);
        this.unsubBridge?.();
        const roomSc = this.scene.get(SCENE_ROOM);
        if (roomSc) {
            roomSc.input.enabled = true;
        }
    }

    private getActivePoints(): Point2[] | null {
        if (polygonEditBridge.mode === 'walkable') {
            const id = polygonEditBridge.walkablePolygonId;
            const poly = this.room.walkable.polygons.find((p) => p.id === id);
            return poly?.points ?? null;
        }
        if (polygonEditBridge.mode === 'propCollider') {
            const id = polygonEditBridge.propId;
            const p = this.room.props?.find((x) => x.id === id);
            return p?.collider?.points ?? null;
        }
        return null;
    }

    private syncRoomInput(): void {
        const roomSc = this.scene.get(SCENE_ROOM);
        const editing = polygonEditBridge.isEditing();
        if (roomSc) {
            roomSc.input.enabled = !editing;
        }
        this.input.enabled = editing;
    }

    private saveActivePolygon(): void {
        if (!polygonEditBridge.isEditing()) {
            return;
        }
        const pts = this.getActivePoints();
        if (!pts || pts.length < MIN_POINTS) {
            return;
        }
        const copy = pts.map((p) => ({ x: p.x, y: p.y }));
        if (polygonEditBridge.mode === 'walkable') {
            this.postPatch({
                kind: 'walkable',
                polygonId: polygonEditBridge.walkablePolygonId,
                points: copy,
            });
        } else if (polygonEditBridge.mode === 'propCollider') {
            this.postPatch({
                kind: 'propCollider',
                propId: polygonEditBridge.propId,
                points: copy,
            });
        }
    }

    private readonly onPointerDown = (pointer: Phaser.Input.Pointer): void => {
        if (!polygonEditBridge.isEditing() || !pointer.leftButtonDown()) {
            return;
        }
        const cam = this.cameras.main;
        const { x: wx, y: wy } = cam.getWorldPoint(pointer.x, pointer.y);
        const pts = this.getActivePoints();
        if (!pts || pts.length < MIN_POINTS) {
            return;
        }

        const vi = hitVertex(wx, wy, pts);
        if (vi >= 0) {
            this.downOnVertex = true;
            this.dragVertexIndex = vi;
            this.selectedVertexIndex = vi;
            return;
        }
        this.downOnVertex = false;
        this.dragVertexIndex = null;
    };

    private readonly onPointerMove = (pointer: Phaser.Input.Pointer): void => {
        if (this.dragVertexIndex === null) {
            return;
        }
        const pts = this.getActivePoints();
        if (!pts) {
            return;
        }
        const cam = this.cameras.main;
        const { x: wx, y: wy } = cam.getWorldPoint(pointer.x, pointer.y);
        const w = getInternalWidth();
        const h = getInternalHeight();
        pts[this.dragVertexIndex].x = Phaser.Math.Clamp(wx, 0, w);
        pts[this.dragVertexIndex].y = Phaser.Math.Clamp(wy, 0, h);
    };

    private readonly onPointerUp = (pointer: Phaser.Input.Pointer): void => {
        if (!polygonEditBridge.isEditing()) {
            this.dragVertexIndex = null;
            this.downOnVertex = false;
            return;
        }

        const pts = this.getActivePoints();
        const cam = this.cameras.main;
        const { x: wx, y: wy } = cam.getWorldPoint(pointer.x, pointer.y);

        if (this.downOnVertex || this.dragVertexIndex !== null) {
            this.dragVertexIndex = null;
            this.downOnVertex = false;
            return;
        }

        if (pointer.leftButtonReleased() && pts && pts.length >= MIN_POINTS) {
            const edgeIdx = hitEdge(wx, wy, pts, HANDLE_R + 3);
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
    };

    private readonly onDeleteKey = (): void => {
        if (!polygonEditBridge.isEditing()) {
            return;
        }
        const pts = this.getActivePoints();
        if (
            !pts ||
            this.selectedVertexIndex === null ||
            pts.length <= MIN_POINTS
        ) {
            return;
        }
        pts.splice(this.selectedVertexIndex, 1);
        this.selectedVertexIndex = null;
    };
}
