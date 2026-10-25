/**
 * `RoomScene` camera zoom and the cinematic video layer: an instant `camera.zoomTo` zooms before it
 * pans, so it lands on the target; `ignoreCameraZoom` videos divide the gameplay zoom back out.
 */
import { describe, expect, it, vi } from 'vitest';
import { BENNE_RUNTIME_HI_DPI_CAM_ZOOM_REGISTRY_KEY } from '../../src/engine/benneRuntimeHiDpiScale';
import { RoomScene } from '../../src/engine/scenes/RoomScene';

// RoomScene subclasses and references Phaser classes when it loads; nothing here renders.
vi.mock('phaser', () => {
  const Stub = class {};
  const stubs = new Proxy({}, { get: () => Stub });
  return new Proxy(
    {
      Scene: Stub,
      Events: { EventEmitter: Stub },
      Cameras: { Scene2D: { Events: { PAN_COMPLETE: 'camerapancomplete' } } },
      Math: { Clamp: (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v)) },
      BlendModes: {},
    },
    { get: (target, key) => (key in target ? target[key as keyof typeof target] : stubs) },
  );
});

vi.mock('../../src/engine/content/constants', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getInternalWidth: () => 240,
  getInternalHeight: () => 180,
}));

vi.mock('../../src/engine/ConfigManager', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getCameraSettings: () => ({ minZoom: 0.25, maxZoom: 20, defaultTransitionSeconds: 0 }),
}));

/** The parts of a Phaser camera these paths use; `centerOn` clamps to the bounds like Phaser's. */
function fakeCamera(width: number, height: number, originX = 0.5, originY = 0.5) {
  const bounds = { x: 0, y: 0, width, height };
  const clamp = (v: number, size: number, b0: number, bSize: number, zoom: number) => {
    const display = size / zoom;
    const lo = b0 + (display - size) / 2;
    const hi = Math.max(lo, lo + bSize - display);
    return Math.max(lo, Math.min(hi, v));
  };
  return {
    width,
    height,
    originX,
    originY,
    zoom: 1,
    zoomX: 1,
    zoomY: 1,
    scrollX: 0,
    scrollY: 0,
    pans: [] as Array<{ x: number; y: number; ms: number }>,
    get midX() {
      return this.scrollX + this.width / 2;
    },
    get midY() {
      return this.scrollY + this.height / 2;
    },
    setZoom(zx: number, zy = zx) {
      this.zoom = zx;
      this.zoomX = zx;
      this.zoomY = zy;
    },
    centerOn(x: number, y: number) {
      this.scrollX = clamp(x - this.width / 2, this.width, bounds.x, bounds.width, this.zoomX);
      this.scrollY = clamp(y - this.height / 2, this.height, bounds.y, bounds.height, this.zoomY);
    },
    pan(x: number, y: number, ms: number) {
      this.pans.push({ x, y, ms });
    },
    getWorldPoint(x: number, y: number) {
      return { x: this.scrollX + x, y: this.scrollY + y };
    },
    setViewport() {},
    setScroll() {},
    stopFollow() {},
    once() {},
    off() {},
  };
}

/** A scene with only the camera / video state these paths read; the methods are RoomScene's own. */
function cameraScene(opts: { uiCamera?: ReturnType<typeof fakeCamera>; displayZoom?: number } = {}) {
  const main = fakeCamera(240, 180);
  const displayZoom = opts.displayZoom ?? 1;
  main.setZoom(displayZoom);
  const video = {
    x: 0,
    y: 0,
    displayWidth: 0,
    displayHeight: 0,
    width: 320,
    height: 180,
    videoTexture: null,
    setVisible() {
      return this;
    },
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    },
    setDisplaySize(w: number, h: number) {
      this.displayWidth = w;
      this.displayHeight = h;
      return this;
    },
  };
  const backdrop = {
    x: 0,
    y: 0,
    scale: 1,
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    },
    setScale(s: number) {
      this.scale = s;
      return this;
    },
    setVisible() {
      return this;
    },
  };
  const scene: RoomScene = Object.assign(Object.create(RoomScene.prototype) as RoomScene, {
    game: { registry: new Map([[BENNE_RUNTIME_HI_DPI_CAM_ZOOM_REGISTRY_KEY, displayZoom]]) },
    cameras: { main },
    editorCameraMode: null,
    editorUiCamera: opts.uiCamera ?? null,
    player: null,
    scriptGameplayZoom: 1,
    scriptCameraZoomTween: null,
    scriptCameraFocusActive: false,
    scriptCameraFocusPoint: null,
    cutsceneSkipFinishers: new Set(),
    cutsceneSkipFastForwardActive: false,
    roomVideo: video,
    roomVideoBackdrop: backdrop,
    roomVideoActiveKey: null as string | null,
    roomVideoIgnoreCameraZoom: false,
    roomVideoFitSize: null,
    roomVideoOnComplete: null,
    roomVideoCompleteResolvers: [],
    tweens: { add: () => ({ stop() {} }) },
  });
  // Private members the tests drive directly.
  const internals = scene as unknown as {
    roomVideoActiveKey: string | null;
    roomVideoIgnoreCameraZoom: boolean;
    scriptGameplayZoom: number;
    onRoomVideoPlay(): void;
    applyScriptCameraZoom(): void;
    syncEditorUiCameraToMain(): void;
    restoreGenericGuisAfterVideo(): void;
    refreshCustomCursor(): void;
    syncVerbHoverScriptSurface(): void;
    finalizeRoomVideo(emitEvent: boolean): void;
  };
  internals.restoreGenericGuisAfterVideo = () => {};
  internals.refreshCustomCursor = () => {};
  internals.syncVerbHoverScriptSurface = () => {};
  Object.assign(scene, { input: { activePointer: {} } });
  if (opts.uiCamera) {
    internals.syncEditorUiCameraToMain();
  }
  /** What `startRoomVideo` sets before playback, then the VIDEO_PLAY handler. */
  const play = (ignoreCameraZoom: boolean) => {
    internals.roomVideoActiveKey = 'demo';
    internals.roomVideoIgnoreCameraZoom = ignoreCameraZoom;
    internals.onRoomVideoPlay();
  };
  const setGameplayZoom = (z: number) => {
    internals.scriptGameplayZoom = z;
    internals.applyScriptCameraZoom();
  };
  return { scene, internals, main, video, backdrop, play, setGameplayZoom };
}

/** Where a scroll-factor-0 point lands on screen, per Phaser's camera matrix. */
function screenOf(cam: ReturnType<typeof fakeCamera>, x: number, y: number) {
  const ox = cam.width * cam.originX;
  const oy = cam.height * cam.originY;
  return { x: ox + cam.zoomX * (x - ox), y: oy + cam.zoomY * (y - oy) };
}

describe('RoomScene camera.zoomTo', () => {
  it('an instant zoomTo in a screen-sized room centers on the point', async () => {
    const { scene, main } = cameraScene();
    await scene.queueCameraZoomTo({ x: 200, y: 40 }, 10, 0);
    expect(main.zoom).toBe(10);
    expect([main.midX, main.midY]).toEqual([200, 40]);
  });

  it('a zoomTo in a skipped cutscene runs instantly and centers on the point', async () => {
    const { scene, main } = cameraScene();
    Object.assign(scene, { cutsceneSkipFastForwardActive: true });
    await scene.queueCameraZoomTo({ x: 30, y: 150 }, 10, 0.75);
    expect(main.pans).toEqual([]);
    expect([main.midX, main.midY]).toEqual([30, 150]);
  });

  it('an animated zoomTo still pans over the transition', () => {
    const { scene, main } = cameraScene();
    void scene.queueCameraZoomTo({ x: 200, y: 40 }, 10, 0.75);
    expect(main.pans).toEqual([{ x: 200, y: 40, ms: 750 }]);
  });
});

describe('RoomScene video layer and camera zoom', () => {
  it('without ignoreCameraZoom the layer keeps its plain fit at any zoom', () => {
    const { video, backdrop, play, setGameplayZoom } = cameraScene();
    setGameplayZoom(10);
    play(false);
    expect([video.x, video.y, video.displayWidth, video.displayHeight]).toEqual([120, 90, 240, 135]);
    expect([backdrop.x, backdrop.y, backdrop.scale]).toEqual([0, 0, 1]);
  });

  it('with ignoreCameraZoom on the main camera, the size shrinks around the screen center', () => {
    const { main, video, backdrop, play, setGameplayZoom } = cameraScene();
    setGameplayZoom(10);
    play(true);
    expect([video.x, video.y]).toEqual([120, 90]);
    expect([video.displayWidth, video.displayHeight]).toEqual([24, 13.5]);
    expect(backdrop.scale).toBeCloseTo(0.1);
    expect(screenOf(main, backdrop.x, backdrop.y)).toEqual({ x: 0, y: 0 });
    expect(main.zoomX * video.displayWidth).toBeCloseTo(240);
  });

  it('on the UI camera, only the gameplay zoom is divided out, not the display zoom', () => {
    const ui = fakeCamera(720, 540, 0, 0);
    const { main, video, backdrop, play, setGameplayZoom } = cameraScene({ uiCamera: ui, displayZoom: 3 });
    setGameplayZoom(10);
    expect(ui.zoomX).toBeCloseTo(main.zoomX);
    play(true);
    const center = screenOf(ui, video.x, video.y);
    expect(center.x).toBeCloseTo(3 * 120);
    expect(center.y).toBeCloseTo(3 * 90);
    expect(ui.zoomX * video.displayWidth).toBeCloseTo(3 * 240);
    expect(screenOf(ui, backdrop.x, backdrop.y)).toEqual({ x: 0, y: 0 });
    expect(ui.zoomX * 240 * backdrop.scale).toBeCloseTo(3 * 240);
  });

  it('follows zoom changes during playback without compounding', () => {
    const { main, video, play, setGameplayZoom } = cameraScene();
    play(true);
    expect(video.displayWidth).toBe(240);
    setGameplayZoom(4);
    setGameplayZoom(4);
    expect(video.displayWidth).toBe(60);
    expect(main.zoomX * video.displayWidth).toBe(240);
    setGameplayZoom(1);
    expect(video.displayWidth).toBe(240);
  });

  it('ending the video restores the layer, and the next playback reads its own option', () => {
    const ui = fakeCamera(720, 540, 0, 0);
    const { internals, video, backdrop, play, setGameplayZoom } = cameraScene({ uiCamera: ui, displayZoom: 3 });
    setGameplayZoom(10);
    play(true);
    internals.finalizeRoomVideo(false);
    expect([video.x, video.y]).toEqual([120, 90]);
    expect([backdrop.x, backdrop.y, backdrop.scale]).toEqual([0, 0, 1]);
    expect(internals.roomVideoIgnoreCameraZoom).toBe(false);
    play(false);
    expect([video.x, video.y, video.displayWidth]).toEqual([120, 90, 240]);
  });
});
