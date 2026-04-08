import * as Phaser from 'phaser';
import { applyBootAudioSettings } from '../../engine/applyAudioFromSettings';
import {
  placeSpriteByFeet,
  resolveCharacterFeetLocal,
  type CharacterFeetLocal,
} from '../../engine/characterFeet';
import type { CharacterData } from '../../types/character';
import type { Point2 } from '../../types/room';
import { PreviewPolygonOverlay } from './previewPolygonOverlay';

const BOOT = 'BenneCharacterPreviewBoot';
const PREVIEW = 'BenneCharacterPreview';

/** Padding around the sprite frame in world pixels (matches room editor “fit art” feel). */
const WORLD_PAD = 56;
/** Room-editor-style vertex handle: yellow fill, dark stroke (`RoomPolygonEditScene`). */
const HANDLE_FILL = 0xffee44;
const HANDLE_STROKE = 0x1a1a24;
const HANDLE_RADIUS = 3.5;

/** Collider overlay editing (same CSS radii as `RoomPolygonEditScene`). */
const HANDLE_R_CSS = 6;
const EDGE_HIT_CSS = 14;
const LINE_WIDTH_CSS = 2;
const MIN_COLLIDER_POINTS = 3;
const COL_COLLIDER = 0xff66cc;

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

function insertPointOnEdgeLocal(pts: Point2[], edgeIdx: number, lx: number, ly: number): void {
  const a = pts[edgeIdx]!;
  const b = pts[(edgeIdx + 1) % pts.length]!;
  const { ix, iy } = distPointToSegment(lx, ly, a.x, a.y, b.x, b.y);
  pts.splice(edgeIdx + 1, 0, { x: ix, y: iy });
}

export type CharacterPreviewGamePayload = {
  textureKey: string;
  textureURL: string;
  atlasURL: string;
  character: CharacterData;
  idleTag: string;
  revokeObjectUrls: string[];
};

function editorGameConfig(parent: HTMLElement): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
  return {
    type: Phaser.WEBGL,
    parent,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    antialias: false,
    scale: {
      parent,
      mode: Phaser.Scale.RESIZE,
    },
    render: {
      powerPreference: 'high-performance',
    },
  };
}

class BenneCharacterPreviewBoot extends Phaser.Scene {
  private readonly payload: CharacterPreviewGamePayload;

  constructor(payload: CharacterPreviewGamePayload) {
    super(BOOT);
    this.payload = payload;
  }

  preload(): void {
    this.load.aseprite({
      key: this.payload.textureKey,
      textureURL: this.payload.textureURL,
      atlasURL: this.payload.atlasURL,
    });
  }

  create(): void {
    applyBootAudioSettings(this);
    this.scene.start(PREVIEW, {
      textureKey: this.payload.textureKey,
      character: this.payload.character,
      idleTag: this.payload.idleTag,
    });
    for (const u of this.payload.revokeObjectUrls) {
      URL.revokeObjectURL(u);
    }
  }
}

class CharacterPreviewScene extends Phaser.Scene {
  private textureKey!: string;
  private character!: CharacterData;
  private idleTag!: string;
  private sprite!: Phaser.GameObjects.Sprite;
  private marker!: Phaser.GameObjects.Arc;
  private feetLocal!: CharacterFeetLocal;
  private worldW = 0;
  private worldH = 0;
  private isPanning = false;
  private panLastX = 0;
  private panLastY = 0;

  private overlay?: PreviewPolygonOverlay;
  /** Collider vertices in frame-local space (same as `feet` / character JSON). */
  private colliderLocal: Point2[] = [];
  private editMode: 'feet' | 'collider' = 'feet';
  private selectedVertexIndex: number | null = null;
  private dragVertexIndex: number | null = null;
  private downOnVertex = false;
  private tapEdge: { t: number; edgeIdx: number } | null = null;
  private isOverlayPanning = false;
  private overlayPanLastX = 0;
  private overlayPanLastY = 0;

  private readonly onCanvasWheel = (e: WheelEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const cam = this.cameras.main;
    const worldPt = this.domPageToWorld(e.pageX, e.pageY);
    let delta = e.deltaY;
    if (e.deltaMode === 1) {
      delta *= 40;
    }
    if (e.deltaMode === 2) {
      delta *= 400;
    }
    const zoomFactor = 1 - Math.max(-0.3, Math.min(0.3, delta * 0.001));
    const newZoom = Math.max(0.15, Math.min(48, cam.zoom * zoomFactor));
    if (Math.abs(newZoom - cam.zoom) < 0.0001) {
      return;
    }
    this.game.scale.updateBounds();
    const screenX = this.game.scale.transformX(e.pageX);
    const screenY = this.game.scale.transformY(e.pageY);
    const originX = cam.width * cam.originX;
    const originY = cam.height * cam.originY;
    cam.setZoom(newZoom);
    cam.scrollX = worldPt.x - originX - (screenX - originX - cam.x) / newZoom;
    cam.scrollY = worldPt.y - originY - (screenY - originY - cam.y) / newZoom;
  };

  private readonly onCanvasPointerDown = (e: PointerEvent): void => {
    if (e.button !== 1) {
      return;
    }
    e.preventDefault();
    this.isPanning = true;
    this.panLastX = e.clientX;
    this.panLastY = e.clientY;
    this.game.canvas.style.cursor = 'grabbing';
    this.game.canvas.setPointerCapture(e.pointerId);
  };

  private readonly onCanvasPointerMove = (e: PointerEvent): void => {
    if (!this.isPanning) {
      return;
    }
    const cam = this.cameras.main;
    const dx = e.clientX - this.panLastX;
    const dy = e.clientY - this.panLastY;
    cam.scrollX -= dx / cam.zoom;
    cam.scrollY -= dy / cam.zoom;
    this.panLastX = e.clientX;
    this.panLastY = e.clientY;
  };

  private readonly onCanvasPointerUp = (e: PointerEvent): void => {
    if (e.button !== 1 || !this.isPanning) {
      return;
    }
    this.isPanning = false;
    this.game.canvas.style.cursor = '';
    try {
      this.game.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released */
    }
  };

  private readonly onWindowKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'f' && e.key !== 'F') {
      return;
    }
    const ae = document.activeElement;
    if (
      ae instanceof HTMLInputElement ||
      ae instanceof HTMLTextAreaElement ||
      ae instanceof HTMLSelectElement
    ) {
      return;
    }
    if (this.overlay?.canvas === ae) {
      return;
    }
    e.preventDefault();
    this.applyFitCamera();
  };

  private readonly onScaleResize = (): void => {
    this.applyFitCamera();
  };

  constructor() {
    super(PREVIEW);
  }

  init(data: {
    textureKey: string;
    character: CharacterData;
    idleTag: string;
  }): void {
    this.textureKey = data.textureKey;
    this.character = data.character;
    this.idleTag = data.idleTag;
  }

  create(): void {
    const rawPts = this.character.collider?.points;
    this.colliderLocal =
      Array.isArray(rawPts) && rawPts.length > 0
        ? rawPts.map((p) => ({ x: p.x, y: p.y }))
        : [];

    this.sprite = this.add.sprite(0, 0, this.textureKey).setOrigin(0, 0);
    if (!this.anims.exists(this.idleTag)) {
      this.anims.createFromAseprite(this.textureKey);
    }
    this.sprite.play(this.idleTag);

    this.feetLocal = { ...resolveCharacterFeetLocal(this.character, this.sprite) };
    const fw = this.sprite.frame.width;
    const fh = this.sprite.frame.height;
    this.worldW = fw + WORLD_PAD * 2;
    this.worldH = fh + WORLD_PAD * 2;

    const feetWx = WORLD_PAD + this.feetLocal.x;
    const feetWy = WORLD_PAD + this.feetLocal.y;
    placeSpriteByFeet(this.sprite, this.feetLocal, feetWx, feetWy);

    this.marker = this.add
      .circle(feetWx, feetWy, HANDLE_RADIUS, HANDLE_FILL, 1)
      .setStrokeStyle(2, HANDLE_STROKE, 0.55)
      .setDepth(100);

    this.marker.setInteractive({ draggable: true });
    this.input.setDraggable(this.marker);
    this.input.on(
      'drag',
      (
        _pointer: Phaser.Input.Pointer,
        obj: Phaser.GameObjects.GameObject,
        dragX: number,
        dragY: number,
      ) => {
        if (obj !== this.marker) {
          return;
        }
        this.marker.setPosition(dragX, dragY);
        this.clampMarkerToFrame();
      },
    );

    const mount = this.game.canvas.parentElement;
    if (mount) {
      this.overlay = new PreviewPolygonOverlay(this.game, mount);
      this.overlay.setPointerEventsEnabled(false);
      this.overlay.canvas.addEventListener('pointerdown', this.onOverlayPointerDown);
      this.overlay.canvas.addEventListener('pointermove', this.onOverlayPointerMove);
      this.overlay.canvas.addEventListener('pointerup', this.onOverlayPointerUp);
      this.overlay.canvas.addEventListener('pointercancel', this.onOverlayPointerUp);
      this.overlay.canvas.addEventListener('keydown', this.onOverlayKeyDown);
      this.overlay.canvas.addEventListener('wheel', this.onOverlayWheel, { passive: false });
    }

    this.game.registry.set('benneCharacterPreviewReadFeet', () => ({ ...this.feetLocal }));
    this.game.registry.set('benneCharacterPreviewReadCollider', () => this.readColliderForSave());
    this.game.registry.set('benneCharacterPreviewSetMode', (m: 'feet' | 'collider') => {
      this.setEditMode(m);
    });

    const cam = this.cameras.main;
    cam.setBackgroundColor(0x1a1a2e);
    cam.setBounds(0, 0, this.worldW, this.worldH);
    this.applyFitCamera();

    const canvas = this.game.canvas;
    canvas.addEventListener('wheel', this.onCanvasWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    canvas.addEventListener('pointermove', this.onCanvasPointerMove);
    canvas.addEventListener('pointerup', this.onCanvasPointerUp);
    canvas.addEventListener('pointercancel', this.onCanvasPointerUp);
    window.addEventListener('keydown', this.onWindowKeyDown);
    this.scale.on('resize', this.onScaleResize);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener('wheel', this.onCanvasWheel);
      canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
      canvas.removeEventListener('pointermove', this.onCanvasPointerMove);
      canvas.removeEventListener('pointerup', this.onCanvasPointerUp);
      canvas.removeEventListener('pointercancel', this.onCanvasPointerUp);
      window.removeEventListener('keydown', this.onWindowKeyDown);
      this.scale.off('resize', this.onScaleResize);
      if (this.overlay) {
        this.overlay.canvas.removeEventListener('pointerdown', this.onOverlayPointerDown);
        this.overlay.canvas.removeEventListener('pointermove', this.onOverlayPointerMove);
        this.overlay.canvas.removeEventListener('pointerup', this.onOverlayPointerUp);
        this.overlay.canvas.removeEventListener('pointercancel', this.onOverlayPointerUp);
        this.overlay.canvas.removeEventListener('keydown', this.onOverlayKeyDown);
        this.overlay.canvas.removeEventListener('wheel', this.onOverlayWheel);
        this.overlay.destroy();
        this.overlay = undefined;
      }
    });

    this.add
      .text(10, 10, 'Wheel = zoom · middle-drag = pan · F = fit · Collider mode: magenta polygon', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#c8c8d8',
      })
      .setScrollFactor(0)
      .setDepth(200);
  }

  private readColliderForSave(): { points: Point2[] } | null {
    if (this.colliderLocal.length < MIN_COLLIDER_POINTS) {
      return null;
    }
    const fw = this.sprite.frame.width;
    const fh = this.sprite.frame.height;
    const points = this.colliderLocal.map((p) => ({
      x: Math.round(Phaser.Math.Clamp(p.x, 0, fw)),
      y: Math.round(Phaser.Math.Clamp(p.y, 0, fh)),
    }));
    return { points };
  }

  private colliderWorldPoints(): Point2[] {
    const sx = this.sprite.x;
    const sy = this.sprite.y;
    return this.colliderLocal.map((p) => ({ x: sx + p.x, y: sy + p.y }));
  }

  private clampLocalPoint(lx: number, ly: number): Point2 {
    const fw = this.sprite.frame.width;
    const fh = this.sprite.frame.height;
    return { x: Phaser.Math.Clamp(lx, 0, fw), y: Phaser.Math.Clamp(ly, 0, fh) };
  }

  setEditMode(mode: 'feet' | 'collider'): void {
    this.editMode = mode;
    if (mode === 'feet') {
      this.marker.setInteractive({ draggable: true });
      this.input.setDraggable(this.marker);
      this.overlay?.setPointerEventsEnabled(false);
    } else {
      this.marker.disableInteractive();
      this.overlay?.setPointerEventsEnabled(true);
      this.selectedVertexIndex = null;
      this.dragVertexIndex = null;
      this.downOnVertex = false;
      this.tapEdge = null;
    }
  }

  update(): void {
    const ov = this.overlay;
    if (!ov) {
      return;
    }
    ov.syncLayout();
    const cam = this.cameras.main;
    const worldPts = this.colliderWorldPoints();
    ov.clearAndDraw(
      {
        pts: worldPts,
        strokeStyle: hexToCss(COL_COLLIDER),
        handleFill: '#ffee44',
        handleStroke: '#1a1a24',
        selectedIndex: this.editMode === 'collider' ? this.selectedVertexIndex : null,
        handleRadiusCss: HANDLE_R_CSS,
        lineWidthCss: LINE_WIDTH_CSS,
      },
      cam,
    );
  }

  private pointerCss(e: PointerEvent): { cx: number; cy: number } {
    const rect = this.game.canvas.getBoundingClientRect();
    return { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
  }

  private readonly onOverlayWheel = (e: WheelEvent): void => {
    if (this.editMode !== 'collider') {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const ov = this.overlay;
    if (!ov) {
      return;
    }
    const cam = this.cameras.main;
    const worldPt = ov.domToWorld(e.pageX, e.pageY, cam);
    let delta = e.deltaY;
    if (e.deltaMode === 1) {
      delta *= 40;
    }
    if (e.deltaMode === 2) {
      delta *= 400;
    }
    const zoomFactor = 1 - Math.max(-0.3, Math.min(0.3, delta * 0.001));
    const newZoom = Math.max(0.15, Math.min(48, cam.zoom * zoomFactor));
    if (Math.abs(newZoom - cam.zoom) < 0.0001) {
      return;
    }
    this.game.scale.updateBounds();
    const screenX = this.game.scale.transformX(e.pageX);
    const screenY = this.game.scale.transformY(e.pageY);
    const originX = cam.width * cam.originX;
    const originY = cam.height * cam.originY;
    cam.setZoom(newZoom);
    cam.scrollX = worldPt.x - originX - (screenX - originX - cam.x) / newZoom;
    cam.scrollY = worldPt.y - originY - (screenY - originY - cam.y) / newZoom;
  };

  private readonly onOverlayPointerDown = (e: PointerEvent): void => {
    if (this.editMode !== 'collider') {
      return;
    }
    const ov = this.overlay;
    if (!ov) {
      return;
    }

    if (e.button === 1) {
      e.preventDefault();
      this.isOverlayPanning = true;
      this.overlayPanLastX = e.clientX;
      this.overlayPanLastY = e.clientY;
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
    const cam = this.cameras.main;
    const worldPts = this.colliderWorldPoints();
    const toCss = (p: Point2): { x: number; y: number } => ov.worldToCanvasCss(p, cam);
    const pts = this.colliderLocal;

    if (pts.length < MIN_COLLIDER_POINTS) {
      const vi = pts.length > 0 ? hitVertexCss(cx, cy, worldPts, HANDLE_R_CSS, toCss) : -1;
      if (vi >= 0) {
        this.downOnVertex = true;
        this.dragVertexIndex = vi;
        this.selectedVertexIndex = vi;
        return;
      }
      return;
    }

    const vi = hitVertexCss(cx, cy, worldPts, HANDLE_R_CSS, toCss);
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
    if (!ov || this.editMode !== 'collider') {
      return;
    }

    if (this.isOverlayPanning) {
      const cam = this.cameras.main;
      const dx = e.clientX - this.overlayPanLastX;
      const dy = e.clientY - this.overlayPanLastY;
      cam.scrollX -= dx / cam.zoom;
      cam.scrollY -= dy / cam.zoom;
      this.overlayPanLastX = e.clientX;
      this.overlayPanLastY = e.clientY;
      return;
    }

    if (this.dragVertexIndex === null) {
      return;
    }
    const cam = this.cameras.main;
    const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, cam);
    const lx = wx - this.sprite.x;
    const ly = wy - this.sprite.y;
    const c = this.clampLocalPoint(lx, ly);
    const i = this.dragVertexIndex;
    if (i >= 0 && i < this.colliderLocal.length) {
      this.colliderLocal[i] = c;
    }
  };

  private readonly onOverlayPointerUp = (e: PointerEvent): void => {
    const ov = this.overlay;

    if (e.button === 1) {
      if (this.isOverlayPanning) {
        this.isOverlayPanning = false;
        if (ov) {
          ov.canvas.style.cursor = '';
          try {
            ov.canvas.releasePointerCapture(e.pointerId);
          } catch {
            /* */
          }
        }
      }
      return;
    }

    if (e.button === 0 && ov) {
      try {
        ov.canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    }

    if (!ov || this.editMode !== 'collider') {
      this.dragVertexIndex = null;
      this.downOnVertex = false;
      return;
    }

    const cam = this.cameras.main;
    const { x: wx, y: wy } = ov.domToWorld(e.pageX, e.pageY, cam);
    const lx = wx - this.sprite.x;
    const ly = wy - this.sprite.y;
    const { cx, cy } = this.pointerCss(e);
    const worldPts = this.colliderWorldPoints();
    const toCss = (p: Point2): { x: number; y: number } => ov.worldToCanvasCss(p, cam);
    const pts = this.colliderLocal;

    if (this.downOnVertex || this.dragVertexIndex !== null) {
      this.dragVertexIndex = null;
      this.downOnVertex = false;
      return;
    }

    if (pts.length < MIN_COLLIDER_POINTS && !this.downOnVertex && this.dragVertexIndex === null) {
      pts.push(this.clampLocalPoint(lx, ly));
      this.tapEdge = null;
      return;
    }

    if (pts.length >= MIN_COLLIDER_POINTS) {
      const vertexClear = HANDLE_R_CSS + 3;
      const edgeIdx = hitEdgeCss(cx, cy, worldPts, EDGE_HIT_CSS, vertexClear, toCss);
      if (edgeIdx >= 0) {
        const now = this.time.now;
        if (
          this.tapEdge &&
          this.tapEdge.edgeIdx === edgeIdx &&
          now - this.tapEdge.t < 450
        ) {
          const cl = this.clampLocalPoint(lx, ly);
          insertPointOnEdgeLocal(pts, edgeIdx, cl.x, cl.y);
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

  private readonly onOverlayKeyDown = (e: KeyboardEvent): void => {
    if (this.editMode !== 'collider') {
      return;
    }
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      this.applyFitCamera();
      return;
    }
    if (e.key !== 'Delete' && e.key !== 'Backspace') {
      return;
    }
    const pts = this.colliderLocal;
    if (
      this.selectedVertexIndex === null ||
      pts.length <= MIN_COLLIDER_POINTS
    ) {
      return;
    }
    pts.splice(this.selectedVertexIndex, 1);
    this.selectedVertexIndex = null;
    e.preventDefault();
    e.stopPropagation();
  };

  private domPageToWorld(pageX: number, pageY: number): { x: number; y: number } {
    this.game.scale.updateBounds();
    const px = this.game.scale.transformX(pageX);
    const py = this.game.scale.transformY(pageY);
    return this.cameras.main.getWorldPoint(px, py);
  }

  private applyFitCamera(): void {
    const cam = this.cameras.main;
    const panelW = this.scale.width;
    const panelH = this.scale.height;
    if (panelW <= 0 || panelH <= 0 || this.worldW <= 0 || this.worldH <= 0) {
      return;
    }
    const zoom = Math.min(panelW / this.worldW, panelH / this.worldH) * 0.92;
    cam.setZoom(zoom);
    cam.centerToBounds();
  }

  private clampMarkerToFrame(): void {
    const fw = this.sprite.frame.width;
    const fh = this.sprite.frame.height;
    let fx = this.marker.x - this.sprite.x;
    let fy = this.marker.y - this.sprite.y;
    fx = Phaser.Math.Clamp(fx, 0, fw);
    fy = Phaser.Math.Clamp(fy, 0, fh);
    this.feetLocal = { x: fx, y: fy };
    this.marker.setPosition(this.sprite.x + fx, this.sprite.y + fy);
    this.game.registry.set('benneCharacterPreviewReadFeet', () => ({ ...this.feetLocal }));
  }
}

export function createCharacterPreviewPhaserGame(
  parent: HTMLElement,
  payload: CharacterPreviewGamePayload,
): Phaser.Game {
  return new Phaser.Game({
    ...editorGameConfig(parent),
    scene: [new BenneCharacterPreviewBoot(payload), CharacterPreviewScene],
  });
}
