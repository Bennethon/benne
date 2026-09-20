/** 2-axis move gizmo drawn in overlay CSS pixels (stays pickable at any camera zoom). */

export type MoveGizmoPart = 'center' | 'x' | 'y';

export const MOVE_GIZMO_ARROW_LEN_CSS = 32;
export const MOVE_GIZMO_CENTER_HALF_CSS = 6;
export const MOVE_GIZMO_AXIS_HIT_CSS = 8;
export const MOVE_GIZMO_ARROW_HEAD_CSS = 8;

export const MOVE_GIZMO_COL_X = '#e74c3c';
export const MOVE_GIZMO_COL_Y = '#2ecc71';
export const MOVE_GIZMO_COL_CENTER = '#f4f7ff';
export const MOVE_GIZMO_COL_STROKE = '#1a1a24';

export type CssPoint = { x: number; y: number };

export function hitMoveGizmo(cx: number, cy: number, origin: CssPoint): MoveGizmoPart | null {
    const dx = cx - origin.x;
    const dy = cy - origin.y;
    if (Math.abs(dx) <= MOVE_GIZMO_CENTER_HALF_CSS + 1 && Math.abs(dy) <= MOVE_GIZMO_CENTER_HALF_CSS + 1) {
        return 'center';
    }
    if (
        dx >= 0 &&
        dx <= MOVE_GIZMO_ARROW_LEN_CSS + MOVE_GIZMO_ARROW_HEAD_CSS &&
        Math.abs(dy) <= MOVE_GIZMO_AXIS_HIT_CSS
    ) {
        return 'x';
    }
    if (
        dy >= 0 &&
        dy <= MOVE_GIZMO_ARROW_LEN_CSS + MOVE_GIZMO_ARROW_HEAD_CSS &&
        Math.abs(dx) <= MOVE_GIZMO_AXIS_HIT_CSS
    ) {
        return 'y';
    }
    return null;
}

/** World origin after a gizmo drag, from the origin and pointer at drag start. */
export function applyMoveGizmoDelta(
    part: MoveGizmoPart,
    originStart: CssPoint,
    pointerStartWorld: CssPoint,
    pointerNowWorld: CssPoint,
): CssPoint {
    const dx = pointerNowWorld.x - pointerStartWorld.x;
    const dy = pointerNowWorld.y - pointerStartWorld.y;
    if (part === 'x') {
        return { x: originStart.x + dx, y: originStart.y };
    }
    if (part === 'y') {
        return { x: originStart.x, y: originStart.y + dy };
    }
    return { x: originStart.x + dx, y: originStart.y + dy };
}

export function drawMoveGizmo(
    ctx: CanvasRenderingContext2D,
    origin: CssPoint,
    selected: MoveGizmoPart | null,
): void {
    const len = MOVE_GIZMO_ARROW_LEN_CSS;
    const head = MOVE_GIZMO_ARROW_HEAD_CSS;
    const half = MOVE_GIZMO_CENTER_HALF_CSS;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const xW = selected === 'x' ? 3.5 : 2.5;
    ctx.strokeStyle = MOVE_GIZMO_COL_X;
    ctx.fillStyle = MOVE_GIZMO_COL_X;
    ctx.lineWidth = xW;
    ctx.globalAlpha = selected === 'x' ? 1 : 0.95;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + len, origin.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(origin.x + len + head, origin.y);
    ctx.lineTo(origin.x + len, origin.y - head * 0.55);
    ctx.lineTo(origin.x + len, origin.y + head * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = MOVE_GIZMO_COL_STROKE;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.45;
    ctx.stroke();

    const yW = selected === 'y' ? 3.5 : 2.5;
    ctx.strokeStyle = MOVE_GIZMO_COL_Y;
    ctx.fillStyle = MOVE_GIZMO_COL_Y;
    ctx.lineWidth = yW;
    ctx.globalAlpha = selected === 'y' ? 1 : 0.95;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x, origin.y + len);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y + len + head);
    ctx.lineTo(origin.x - head * 0.55, origin.y + len);
    ctx.lineTo(origin.x + head * 0.55, origin.y + len);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = MOVE_GIZMO_COL_STROKE;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.45;
    ctx.stroke();

    const s = selected === 'center' ? half + 1.5 : half;
    ctx.globalAlpha = 0.97;
    ctx.fillStyle = selected === 'center' ? '#ffffff' : MOVE_GIZMO_COL_CENTER;
    ctx.strokeStyle = MOVE_GIZMO_COL_STROKE;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.rect(origin.x - s, origin.y - s, s * 2, s * 2);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.stroke();

    ctx.restore();
}
