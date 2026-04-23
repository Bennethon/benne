import type { Cameras, Game } from 'phaser';
import type { Point2 } from '../../types/room';

/** Axis-aligned rect in world / game resolution space (same as room JSON). */
export type PreviewOverlayWorldRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type PreviewOverlayFilledUnderlay = {
  rects: ReadonlyArray<PreviewOverlayWorldRect>;
  fillStyle: string;
  /** Multiplier applied with {@link CanvasRenderingContext2D.globalAlpha} while filling. */
  fillAlpha: number;
};

export type PreviewOverlayRectCornerLabel = {
  rect: PreviewOverlayWorldRect;
  text: string;
};

export type PreviewStrokeRectOverlayExtras = {
  filledUnderlays?: ReadonlyArray<PreviewOverlayFilledUnderlay>;
  rectCornerLabels?: ReadonlyArray<PreviewOverlayRectCornerLabel>;
};

/** High-DPI 2D canvas aligned to the Phaser game canvas for editor chrome. */
export class PreviewPolygonOverlay {
    readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly ro: ResizeObserver;
    private readonly syncLayoutBound: () => void;
    private readonly game: Game;

    constructor(game: Game, mountEl: HTMLElement) {
        this.game = game;
        const canvas = document.createElement('canvas');
        canvas.className = 'benne-editor-polygon-overlay';
        canvas.style.position = 'absolute';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '10';
        canvas.style.touchAction = 'none';
        canvas.style.outline = 'none';
        /** So Delete/Backspace reach the overlay after pointer interaction (Phaser keyboard targets the game canvas below). */
        canvas.tabIndex = 0;
        canvas.setAttribute('aria-hidden', 'true');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('PreviewPolygonOverlay: 2d context unavailable');
        }
        this.canvas = canvas;
        this.ctx = ctx;
        mountEl.appendChild(canvas);

        this.syncLayoutBound = (): void => {
            this.syncLayout();
        };
        this.ro = new ResizeObserver(this.syncLayoutBound);
        this.ro.observe(mountEl);
        this.game.scale.on('resize', this.syncLayoutBound);
        this.syncLayout();
    }

    destroy(): void {
        this.ro.disconnect();
        this.game.scale.off('resize', this.syncLayoutBound);
        this.canvas.remove();
    }

    setPointerEventsEnabled(on: boolean): void {
        this.canvas.style.pointerEvents = on ? 'auto' : 'none';
    }

    syncLayout(): void {
        const c = this.game.canvas;
        if (!c?.parentElement) {
            return;
        }
        this.canvas.style.left = `${c.offsetLeft}px`;
        this.canvas.style.top = `${c.offsetTop}px`;
        const cssW = c.clientWidth;
        const cssH = c.clientHeight;
        this.canvas.style.width = `${cssW}px`;
        this.canvas.style.height = `${cssH}px`;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const bw = Math.max(1, Math.round(cssW * dpr));
        const bh = Math.max(1, Math.round(cssH * dpr));
        if (this.canvas.width !== bw || this.canvas.height !== bh) {
            this.canvas.width = bw;
            this.canvas.height = bh;
        }
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** Map pointer `pageX` / `pageY` to world coordinates (same space as room JSON). */
    domToWorld(
        pageX: number,
        pageY: number,
        cam: Cameras.Scene2D.Camera,
    ): { x: number; y: number } {
        this.game.scale.updateBounds();
        const px = this.game.scale.transformX(pageX);
        const py = this.game.scale.transformY(pageY);
        return cam.getWorldPoint(px, py);
    }

    /**
     * World point → overlay/CSS pixel offset relative to game canvas top-left.
     *
     * Mirrors the transform Phaser 4's `Camera.preRender` applies:
     *   screen = zoom * (world − scroll − origin) + origin + cam.offset
     *
     * Phaser 4 cameras default to `originX = originY = 0.5` (zoom from the viewport
     * centre), so the simple `(world − scroll) * zoom` formula is only correct when
     * zoom = 1. When the editor zooms out to show a large room, the origin correction
     * `origin * (1 − zoom)` is essential to keep handles aligned with the Phaser
     * render output.
     */
    worldToCanvasCss(p: Point2, cam: Cameras.Scene2D.Camera): { x: number; y: number } {
        const sx = this.game.scale.displayScale.x;
        const sy = this.game.scale.displayScale.y;
        const originX = cam.width * cam.originX;
        const originY = cam.height * cam.originY;
        const screenX = cam.zoomX * (p.x - cam.scrollX - originX) + originX + cam.x;
        const screenY = cam.zoomY * (p.y - cam.scrollY - originY) + originY + cam.y;
        return {
            x: screenX / sx,
            y: screenY / sy,
        };
    }

    clearAndDraw(state: {
        pts: Point2[];
        strokeStyle: string;
        handleFill: string;
        handleStroke: string;
        selectedIndex: number | null;
        handleRadiusCss: number;
        lineWidthCss: number;
        /** Prop editor: walk / look markers drawn above the collider. */
        labeledPoints?: {
            point: Point2;
            label: string;
            fillStyle: string;
            strokeStyle: string;
            selected: boolean;
            radiusCss: number;
        }[];
        /** Full room width in world pixels (required when `horizontalGuides` is non-empty). */
        horizontalGuidesRoomWidth?: number;
        /** Horizontal lines in world space (e.g. depth-sort baseline). */
        horizontalGuides?: ReadonlyArray<{
            worldY: number;
            label: string;
            strokeStyle: string;
            lineWidthCss: number;
            dashCss?: readonly number[];
            selected?: boolean;
        }>;
    }, cam: Cameras.Scene2D.Camera): void {
        const c = this.game.canvas;
        const cssW = c.clientWidth;
        const cssH = c.clientHeight;
        this.ctx.clearRect(0, 0, cssW, cssH);
        const { pts } = state;
        const extras = state.labeledPoints;
        const guides = state.horizontalGuides;
        const hasGuides = guides && guides.length > 0;
        if (pts.length === 0 && (!extras || extras.length === 0) && !hasGuides) {
            return;
        }

        if (pts.length >= 2) {
            this.ctx.strokeStyle = state.strokeStyle;
            this.ctx.lineWidth = state.lineWidthCss;
            this.ctx.lineJoin = 'round';
            this.ctx.lineCap = 'round';
            this.ctx.globalAlpha = 0.95;
            this.ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
                const q = this.worldToCanvasCss(pts[i]!, cam);
                if (i === 0) {
                    this.ctx.moveTo(q.x, q.y);
                } else {
                    this.ctx.lineTo(q.x, q.y);
                }
            }
            if (pts.length >= 3) {
                this.ctx.closePath();
            }
            this.ctx.stroke();
        }

        for (let i = 0; i < pts.length; i++) {
            const q = this.worldToCanvasCss(pts[i]!, cam);
            const sel = i === state.selectedIndex;
            const r = sel ? state.handleRadiusCss + 2 : state.handleRadiusCss;
            this.ctx.beginPath();
            this.ctx.fillStyle = sel ? '#ffffff' : state.handleFill;
            this.ctx.strokeStyle = state.handleStroke;
            this.ctx.lineWidth = 1;
            this.ctx.globalAlpha = 0.95;
            this.ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 0.5;
            this.ctx.stroke();
        }

        if (extras && extras.length > 0) {
            this.ctx.font = '600 11px system-ui, -apple-system, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            for (const lp of extras) {
                const q = this.worldToCanvasCss(lp.point, cam);
                const r = lp.selected ? lp.radiusCss + 2 : lp.radiusCss;
                this.ctx.beginPath();
                this.ctx.fillStyle = lp.selected ? '#ffffff' : lp.fillStyle;
                this.ctx.strokeStyle = lp.strokeStyle;
                this.ctx.lineWidth = 1;
                this.ctx.globalAlpha = 0.95;
                this.ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.globalAlpha = 0.55;
                this.ctx.stroke();
                this.ctx.globalAlpha = 1;
                const ty = q.y - r - 5;
                this.ctx.lineWidth = 3;
                this.ctx.strokeStyle = 'rgba(0,0,0,0.82)';
                this.ctx.strokeText(lp.label, q.x, ty);
                this.ctx.fillStyle = '#f2f6ff';
                this.ctx.fillText(lp.label, q.x, ty);
            }
        }

        if (hasGuides) {
            const rw = state.horizontalGuidesRoomWidth ?? 0;
            if (rw > 0) {
                this.ctx.font = '600 11px system-ui, -apple-system, sans-serif';
                this.ctx.textAlign = 'left';
                this.ctx.textBaseline = 'bottom';
                for (const g of guides!) {
                    const p0 = this.worldToCanvasCss({ x: 0, y: g.worldY }, cam);
                    const p1 = this.worldToCanvasCss({ x: rw, y: g.worldY }, cam);
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = g.strokeStyle;
                    this.ctx.lineWidth = g.selected ? g.lineWidthCss + 1 : g.lineWidthCss;
                    this.ctx.globalAlpha = g.selected ? 1 : 0.88;
                    if (g.dashCss && g.dashCss.length > 0) {
                        this.ctx.setLineDash([...g.dashCss]);
                    } else {
                        this.ctx.setLineDash([]);
                    }
                    this.ctx.moveTo(p0.x, p0.y);
                    this.ctx.lineTo(p1.x, p1.y);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);
                    const lx = Math.min(p0.x, p1.x) + 6;
                    const ly = Math.min(p0.y, p1.y) - 4;
                    this.ctx.lineWidth = 3;
                    this.ctx.strokeStyle = 'rgba(0,0,0,0.82)';
                    this.ctx.strokeText(g.label, lx, ly);
                    this.ctx.fillStyle = '#e8fff8';
                    this.ctx.fillText(g.label, lx, ly);
                }
            }
        }
        this.ctx.globalAlpha = 1;
    }

    /**
     * Clear the overlay and draw an interactive rectangle with 8 resize handles.
     *
     * Handles are numbered clockwise from the top-left corner:
     * ```
     * 0 ─ 1 ─ 2
     * │       │
     * 7       3
     * │       │
     * 6 ─ 5 ─ 4
     * ```
     * `lockedHandles` — indices whose handles are drawn dimmed and cannot be interacted with
     * (used for `roomSize` where the top-left origin is always 0,0).
     */
    clearAndDrawRect(state: {
        rect: { left: number; top: number; right: number; bottom: number };
        strokeStyle: string;
        fillStyle: string;
        handleFill: string;
        handleStroke: string;
        selectedHandleIndex: number | null;
        lockedHandles: ReadonlySet<number>;
        handleRadiusCss: number;
        lineWidthCss: number;
    }, cam: Cameras.Scene2D.Camera): void {
        const c = this.game.canvas;
        const cssW = c.clientWidth;
        const cssH = c.clientHeight;
        this.ctx.clearRect(0, 0, cssW, cssH);

        const { rect } = state;
        const tl = this.worldToCanvasCss({ x: rect.left, y: rect.top }, cam);
        const br = this.worldToCanvasCss({ x: rect.right, y: rect.bottom }, cam);
        const rw = br.x - tl.x;
        const rh = br.y - tl.y;

        // Semi-transparent fill
        this.ctx.fillStyle = state.fillStyle;
        this.ctx.globalAlpha = 0.12;
        this.ctx.fillRect(tl.x, tl.y, rw, rh);

        // Border stroke
        this.ctx.strokeStyle = state.strokeStyle;
        this.ctx.lineWidth = state.lineWidthCss;
        this.ctx.lineJoin = 'round';
        this.ctx.globalAlpha = 0.9;
        this.ctx.strokeRect(tl.x, tl.y, rw, rh);

        // 8 handle positions in world space → CSS
        const midX = (rect.left + rect.right) / 2;
        const midY = (rect.top + rect.bottom) / 2;
        const worldHandles: { x: number; y: number }[] = [
            { x: rect.left,  y: rect.top    },  // 0 top-left
            { x: midX,       y: rect.top    },  // 1 top-mid
            { x: rect.right, y: rect.top    },  // 2 top-right
            { x: rect.right, y: midY        },  // 3 mid-right
            { x: rect.right, y: rect.bottom },  // 4 bottom-right
            { x: midX,       y: rect.bottom },  // 5 bottom-mid
            { x: rect.left,  y: rect.bottom },  // 6 bottom-left
            { x: rect.left,  y: midY        },  // 7 mid-left
        ];

        for (let i = 0; i < 8; i++) {
            const q = this.worldToCanvasCss(worldHandles[i]!, cam);
            const sel = i === state.selectedHandleIndex;
            const locked = state.lockedHandles.has(i);
            const r = sel ? state.handleRadiusCss + 2 : state.handleRadiusCss;

            this.ctx.beginPath();
            this.ctx.fillStyle = sel ? '#ffffff' : locked ? '#888888' : state.handleFill;
            this.ctx.strokeStyle = state.handleStroke;
            this.ctx.lineWidth = 1;
            this.ctx.globalAlpha = locked ? 0.35 : 0.95;
            this.ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = locked ? 0.2 : 0.5;
            this.ctx.stroke();
        }

        this.ctx.globalAlpha = 1;
    }

    /**
     * Stroke-only axis-aligned rects in world space — same stroke path as {@link clearAndDrawRect}
     * border (no fill, no resize handles). Used e.g. for GUI `inventoryPanel` slot frames in the editor.
     */
    clearAndDrawStrokeRects(
        rects: ReadonlyArray<{ left: number; top: number; right: number; bottom: number }>,
        cam: Cameras.Scene2D.Camera,
        style: { strokeStyle: string; lineWidthCss: number },
        extras?: PreviewStrokeRectOverlayExtras,
    ): void {
        this.clearAndDrawStrokeRectGroups(
            [{ rects, strokeStyle: style.strokeStyle, lineWidthCss: style.lineWidthCss }],
            cam,
            extras,
        );
    }

    /**
     * Multiple stroke batches (clears once, then draws each group with its own style/width).
     */
    clearAndDrawStrokeRectGroups(
        groups: ReadonlyArray<{
            rects: ReadonlyArray<{ left: number; top: number; right: number; bottom: number }>;
            strokeStyle: string;
            lineWidthCss: number;
        }>,
        cam: Cameras.Scene2D.Camera,
        extras?: PreviewStrokeRectOverlayExtras,
    ): void {
        const c = this.game.canvas;
        const cssW = c.clientWidth;
        const cssH = c.clientHeight;
        this.ctx.clearRect(0, 0, cssW, cssH);

        if (extras?.filledUnderlays) {
            for (const u of extras.filledUnderlays) {
                if (u.rects.length === 0) {
                    continue;
                }
                this.ctx.fillStyle = u.fillStyle;
                this.ctx.globalAlpha = u.fillAlpha;
                for (const rect of u.rects) {
                    const tl = this.worldToCanvasCss({ x: rect.left, y: rect.top }, cam);
                    const br = this.worldToCanvasCss({ x: rect.right, y: rect.bottom }, cam);
                    const rw = br.x - tl.x;
                    const rh = br.y - tl.y;
                    this.ctx.fillRect(tl.x, tl.y, rw, rh);
                }
            }
            this.ctx.globalAlpha = 1;
        }

        for (const g of groups) {
            if (g.rects.length === 0) {
                continue;
            }
            this.ctx.strokeStyle = g.strokeStyle;
            this.ctx.lineWidth = g.lineWidthCss;
            this.ctx.lineJoin = 'round';
            this.ctx.globalAlpha = 0.9;
            for (const rect of g.rects) {
                const tl = this.worldToCanvasCss({ x: rect.left, y: rect.top }, cam);
                const br = this.worldToCanvasCss({ x: rect.right, y: rect.bottom }, cam);
                const rw = br.x - tl.x;
                const rh = br.y - tl.y;
                this.ctx.strokeRect(tl.x, tl.y, rw, rh);
            }
        }

        const labels = extras?.rectCornerLabels;
        if (labels && labels.length > 0) {
            this.ctx.font = '600 10px system-ui, -apple-system, sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';
            for (const lb of labels) {
                const { rect } = lb;
                const corner = this.worldToCanvasCss({ x: rect.left, y: rect.top }, cam);
                const x = corner.x + 3;
                const y = corner.y + 3;
                this.ctx.lineWidth = 3;
                this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.78)';
                this.ctx.globalAlpha = 1;
                this.ctx.strokeText(lb.text, x, y);
                this.ctx.fillStyle = '#fff5fb';
                this.ctx.fillText(lb.text, x, y);
            }
        }

        this.ctx.globalAlpha = 1;
    }
}
