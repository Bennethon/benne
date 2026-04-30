import type { GuiControl, GuiGridCellAlign, GuiGridControl, GuiGridPlacement } from '../../types/gui';

/**
 * Normalizes row or column sizes to sum to `total`. When `explicit` is missing, wrong length, or
 * contains non-positive values, returns equal division.
 */
export function normalizeGridTracks(total: number, count: number, explicit?: readonly number[]): number[] {
  const n = Math.max(1, Math.floor(count));
  const t = Math.max(0, total);
  if (
    !explicit ||
    explicit.length !== n ||
    explicit.some((v) => !Number.isFinite(v) || v <= 0)
  ) {
    return Array.from({ length: n }, () => (n > 0 ? t / n : 0));
  }
  const sum = explicit.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) {
    return Array.from({ length: n }, () => (n > 0 ? t / n : 0));
  }
  const scale = t / sum;
  return explicit.map((x) => x * scale);
}

export function cumulativeOffsets(sizes: readonly number[]): number[] {
  const o: number[] = [];
  let c = 0;
  for (const s of sizes) {
    o.push(c);
    c += s;
  }
  return o;
}

/** Resolves authored optional `width` / `height` or derives a default from tracks / 32px cells. */
export function resolveGuiGridContentSize(g: GuiGridControl): { width: number; height: number } {
  const cols = Math.max(1, Math.floor(g.columns));
  const rows = Math.max(1, Math.floor(g.rows));
  let width = g.width ?? NaN;
  let height = g.height ?? NaN;
  if (!Number.isFinite(width) || width <= 0) {
    const cw = g.colWidths;
    if (cw && cw.length === cols) {
      const s = cw.reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? b : 0), 0);
      width = s > 0 ? s : cols * 32;
    } else {
      width = cols * 32;
    }
  }
  if (!Number.isFinite(height) || height <= 0) {
    const rh = g.rowHeights;
    if (rh && rh.length === rows) {
      const s = rh.reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? b : 0), 0);
      height = s > 0 ? s : rows * 32;
    } else {
      height = rows * 32;
    }
  }
  return { width: Math.round(width), height: Math.round(height) };
}

export function layoutGuiGridTracks(g: GuiGridControl): {
  colWidths: number[];
  rowHeights: number[];
  contentW: number;
  contentH: number;
} {
  const { width: contentW, height: contentH } = resolveGuiGridContentSize(g);
  const cols = Math.max(1, Math.floor(g.columns));
  const rows = Math.max(1, Math.floor(g.rows));
  const colWidths = normalizeGridTracks(contentW, cols, g.colWidths);
  const rowHeights = normalizeGridTracks(contentH, rows, g.rowHeights);
  return { colWidths, rowHeights, contentW, contentH };
}

export function spanCellRect(
  colOff: readonly number[],
  rowOff: readonly number[],
  colW: readonly number[],
  rowH: readonly number[],
  col: number,
  row: number,
  colspan: number,
  rowspan: number,
): { x: number; y: number; w: number; h: number } | null {
  const cs = Math.max(1, Math.floor(colspan));
  const rs = Math.max(1, Math.floor(rowspan));
  // Bounds reference track sizes (column/row counts), not offset arrays — they can diverge if mis-built.
  if (row < 0 || col < 0 || col + cs > colW.length || row + rs > rowH.length) {
    return null;
  }
  const x = colOff[col] ?? 0;
  const y = rowOff[row] ?? 0;
  let w = 0;
  for (let i = 0; i < cs; i += 1) {
    w += colW[col + i] ?? 0;
  }
  let h = 0;
  for (let j = 0; j < rs; j += 1) {
    h += rowH[row + j] ?? 0;
  }
  return { x, y, w, h };
}

export function parseGuiGridCellAlign(align: GuiGridCellAlign | undefined): { hx: number; vy: number } {
  switch (align ?? 'top-left') {
    case 'top-left':
      return { hx: 0, vy: 0 };
    case 'top-center':
      return { hx: 0.5, vy: 0 };
    case 'top-right':
      return { hx: 1, vy: 0 };
    case 'center-left':
      return { hx: 0, vy: 0.5 };
    case 'center':
      return { hx: 0.5, vy: 0.5 };
    case 'center-right':
      return { hx: 1, vy: 0.5 };
    case 'bottom-left':
      return { hx: 0, vy: 1 };
    case 'bottom-center':
      return { hx: 0.5, vy: 1 };
    case 'bottom-right':
      return { hx: 1, vy: 1 };
    default:
      return { hx: 0, vy: 0 };
  }
}

/** Top-left of a `bw`×`bh` box aligned inside a `cw`×`ch` cell. */
export function alignBoxTopLeftInCell(
  hx: number,
  vy: number,
  cw: number,
  ch: number,
  bw: number,
  bh: number,
): { dx: number; dy: number } {
  const dx = hx * (cw - bw);
  const dy = vy * (ch - bh);
  return { dx, dy };
}

export function isGuiGridPlacement(
  p: GuiGridPlacement | null | undefined,
): p is GuiGridPlacement {
  if (!p || typeof p !== 'object') {
    return false;
  }
  const g = p as GuiGridPlacement;
  const id = typeof g.gridControlId === 'string' ? g.gridControlId.trim() : '';
  return (
    id.length > 0 &&
    typeof g.row === 'number' &&
    Number.isFinite(g.row) &&
    typeof g.col === 'number' &&
    Number.isFinite(g.col)
  );
}

/** Cached column/row offsets for one {@link GuiGridControl} — used by the compositor and editor preview outlines. */
export type GuiGridLayoutRuntime = {
  def: GuiGridControl;
  colOff: number[];
  rowOff: number[];
  colW: number[];
  rowH: number[];
};

/** Builds a map of grid `id` → layout data from a GUI’s `controls` list (order-independent). */
export function buildGuiGridLayoutRuntimeMap(controls: readonly GuiControl[]): Map<string, GuiGridLayoutRuntime> {
  const map = new Map<string, GuiGridLayoutRuntime>();
  for (const c of controls) {
    if (c.type !== 'grid') {
      continue;
    }
    const id = c.id.trim();
    if (!id) {
      continue;
    }
    const track = layoutGuiGridTracks(c);
    map.set(id, {
      def: c,
      colOff: cumulativeOffsets(track.colWidths),
      rowOff: cumulativeOffsets(track.rowHeights),
      colW: track.colWidths,
      rowH: track.rowHeights,
    });
  }
  return map;
}

/**
 * Top-left of a control in **GUI root** space (includes {@link GuiData} `x`/`y` as `rootOffsetX`/`rootOffsetY`),
 * matching {@link buildGuiOverlay} for either authored `fallbackX`/`fallbackY` or {@link GuiGridPlacement}.
 */
export function resolveGuiControlRootTopLeft(
  gridLayouts: ReadonlyMap<string, GuiGridLayoutRuntime>,
  rootOffsetX: number,
  rootOffsetY: number,
  placement: GuiGridPlacement | undefined,
  contentW: number,
  contentH: number,
  fallbackX: number,
  fallbackY: number,
): { x: number; y: number } {
  const rx = Math.round(rootOffsetX);
  const ry = Math.round(rootOffsetY);
  if (!isGuiGridPlacement(placement)) {
    return { x: rx + Math.round(fallbackX), y: ry + Math.round(fallbackY) };
  }
  const gid = placement.gridControlId.trim();
  const lay = gridLayouts.get(gid);
  if (!lay) {
    return { x: rx + Math.round(fallbackX), y: ry + Math.round(fallbackY) };
  }
  const cell = spanCellRect(
    lay.colOff,
    lay.rowOff,
    lay.colW,
    lay.rowH,
    Math.max(0, Math.floor(placement.col)),
    Math.max(0, Math.floor(placement.row)),
    placement.colspan ?? 1,
    placement.rowspan ?? 1,
  );
  if (!cell) {
    return { x: rx + Math.round(fallbackX), y: ry + Math.round(fallbackY) };
  }
  const bw = Math.max(1, contentW);
  const bh = Math.max(1, contentH);
  const { hx, vy } = parseGuiGridCellAlign(placement.align);
  const { dx, dy } = alignBoxTopLeftInCell(hx, vy, cell.w, cell.h, bw, bh);
  const localX = Math.round(cell.x + dx);
  const localY = Math.round(cell.y + dy);
  const gx = Math.round(lay.def.x);
  const gy = Math.round(lay.def.y);
  return { x: rx + gx + localX, y: ry + gy + localY };
}
